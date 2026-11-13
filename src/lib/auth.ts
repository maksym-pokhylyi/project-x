import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";
import { site } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appUrl, env, features } from "@/env";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { sendEmail } from "@/lib/email/send";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { createPersonalWorkspace, defaultOrganizationIdForUser } from "@/server/workspaces";

/**
 * Better Auth configuration — the only place authentication behaviour is defined.
 *
 * - E-mail + password with verification (see `features.requireEmailVerification`),
 *   password reset, optional Google OAuth.
 * - Organization plugin = workspaces (roles owner/admin/member, e-mail invitations).
 * - Every new user gets a personal workspace; every new session starts in a workspace.
 * - Seat limits come from the workspace's plan (entitlements), enforced server-side.
 * - Rate limiting is done by our Postgres limiter in the route handler
 *   (src/app/api/auth/[...all]/route.ts), so Better Auth's in-memory limiter is off.
 * - CSRF: Better Auth checks the Origin of every state-changing request against
 *   `trustedOrigins`; session cookies are HttpOnly + SameSite=Lax (+ Secure on https).
 */

const UNLIMITED_SEATS = 100_000;

async function seatLimit(organizationId: string): Promise<number> {
  const entitlements = await getOrgEntitlements(organizationId);
  return entitlements.limits.seats ?? UNLIMITED_SEATS;
}

async function memberCount(organizationId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(schema.members).where(eq(schema.members.organizationId, organizationId));
  return row?.value ?? 0;
}

if (!features.emailConfigured && features.isRealProduction) {
  log.warn("RESEND_API_KEY is not set in production: e-mails are NOT delivered and e-mail verification is NOT enforced");
}

export const auth = betterAuth({
  appName: site.name,
  baseURL: appUrl,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
  telemetry: { enabled: false },
  // Route Better Auth's own log lines through our structured logger.
  logger: {
    level: "warn",
    log: (level, message, ...details) => {
      const fields = details.length > 0 ? { details: details.map((detail) => (detail instanceof Error ? detail.message : detail)) } : undefined;
      if (level === "error") log.error(`[auth] ${message}`, fields);
      else if (level === "warn") log.warn(`[auth] ${message}`, fields);
      else log.info(`[auth] ${message}`, fields);
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: features.requireEmailVerification,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(user.email, { name: "reset-password", props: { name: user.name, url } });
    },
  },

  emailVerification: {
    sendOnSignUp: features.requireEmailVerification,
    sendOnSignIn: features.requireEmailVerification,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(user.email, { name: "verify-email", props: { name: user.name, url } });
    },
    afterEmailVerification: async (user) => {
      await track("user.email_verified", { userId: user.id });
    },
  },

  socialProviders: features.googleOAuth
    ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
    : {},

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: { enabled: false },

  advanced: {
    // Explicit instead of NODE_ENV-derived, so a production build served over plain
    // http://localhost (e2e, local `next start`) still gets working cookies.
    useSecureCookies: appUrl.startsWith("https://"),
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },

  databaseHooks: {
    user: {
      create: {
        // Runs after the user row is committed. requireOrg() self-heals if this fails.
        after: async (user, ctx) => {
          try {
            await createPersonalWorkspace(user);
          } catch (error) {
            await reportError(error, { route: "auth:user.create.after", userId: user.id });
          }
          const method = ctx?.path?.startsWith("/callback") || ctx?.path?.startsWith("/sign-in/social") ? "google" : "email";
          await track("user.signed_up", { userId: user.id }, { method });
        },
      },
    },
    session: {
      create: {
        // Every session starts inside a workspace, so requireOrg() rarely has to repair it.
        before: async (session) => {
          const activeOrganizationId = await defaultOrganizationIdForUser(session.userId);
          return { data: { ...session, activeOrganizationId } };
        },
      },
    },
  },

  hooks: {
    /**
     * One audit + analytics hook for every successful workspace mutation, whichever way
     * it was triggered (client SDK, server action, direct API call).
     */
    after: createAuthMiddleware(async (ctx) => {
      try {
        if (ctx.path === "/sign-in/email" && ctx.context.newSession) {
          await track("user.signed_in", { userId: ctx.context.newSession.user.id }, { method: "email" });
          return;
        }
        if (!ctx.path.startsWith("/organization/")) return;
        const returned = ctx.context.returned;
        if (!returned || returned instanceof APIError || returned instanceof Response) return;
        const session = await getSessionFromCtx(ctx);
        if (!session) return;
        await auditOrganizationMutation(ctx.path, returned as Record<string, unknown>, ctx.body, session.user.id);
      } catch (error) {
        // Never fail the user's request because bookkeeping failed.
        await reportError(error, { route: `auth:after${ctx.path}` });
      }
    }),
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      creatorRole: "owner",
      // Deleting a workspace with a live subscription needs a human: do it via the runbook.
      disableOrganizationDeletion: true,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      cancelPendingInvitationsOnReInvite: true,
      requireEmailVerificationOnInvitation: features.requireEmailVerification,
      // Seats: accepted members may never exceed the plan...
      membershipLimit: async (_user, org) => seatLimit(org.id),
      // ...and members + pending invitations may not exceed it either.
      invitationLimit: async ({ organization: org }) => {
        const [limit, used] = await Promise.all([seatLimit(org.id), memberCount(org.id)]);
        return Math.max(0, limit - used);
      },
      sendInvitationEmail: async (data) => {
        await sendEmail(data.email, {
          name: "invitation",
          props: {
            inviterName: data.inviter.user.name || data.inviter.user.email,
            organizationName: data.organization.name,
            role: data.role,
            url: `${appUrl}/accept-invitation/${data.id}`,
          },
        });
      },
    }),
    // Must stay last: lets auth.api.* calls from Server Actions set cookies.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function auditOrganizationMutation(path: string, returned: Record<string, unknown>, body: unknown, actorId: string) {
  const actor = { type: "user", id: actorId } as const;
  const input = record(body);
  switch (path) {
    case "/organization/create": {
      const organizationId = str(returned.id);
      if (!organizationId) return;
      await recordAudit({ organizationId, actor, action: "workspace.created", target: `organization:${organizationId}` });
      await track("workspace.created", { organizationId, userId: actorId }, { personal: false });
      return;
    }
    case "/organization/update": {
      const organizationId = str(returned.id);
      if (!organizationId) return;
      const fields = Object.keys(record(input.data));
      await recordAudit({ organizationId, actor, action: "workspace.updated", target: `organization:${organizationId}`, metadata: { fields } });
      await track("workspace.updated", { organizationId, userId: actorId }, { fields });
      return;
    }
    case "/organization/invite-member": {
      const organizationId = str(returned.organizationId);
      if (!organizationId) return;
      const role = str(returned.role) ?? "member";
      await recordAudit({
        organizationId,
        actor,
        action: "member.invited",
        target: `invitation:${str(returned.id) ?? "unknown"}`,
        metadata: { email: str(returned.email), role },
      });
      await track("member.invited", { organizationId, userId: actorId }, { role });
      return;
    }
    case "/organization/cancel-invitation": {
      const organizationId = str(returned.organizationId);
      if (!organizationId) return;
      await recordAudit({ organizationId, actor, action: "member.invitation_canceled", target: `invitation:${str(returned.id) ?? "unknown"}`, metadata: { email: str(returned.email) } });
      await track("member.invitation_canceled", { organizationId, userId: actorId });
      return;
    }
    case "/organization/accept-invitation": {
      const member = record(returned.member);
      const organizationId = str(member.organizationId) ?? str(record(returned.invitation).organizationId);
      if (!organizationId) return;
      const role = str(member.role) ?? "member";
      await recordAudit({ organizationId, actor, action: "member.invitation_accepted", target: `member:${str(member.id) ?? "unknown"}`, metadata: { role } });
      await track("member.invitation_accepted", { organizationId, userId: actorId }, { role });
      return;
    }
    case "/organization/remove-member":
    case "/organization/leave": {
      const member = record(returned.member ?? returned);
      const organizationId = str(member.organizationId);
      if (!organizationId) return;
      await recordAudit({
        organizationId,
        actor,
        action: path.endsWith("/leave") ? "member.left" : "member.removed",
        target: `member:${str(member.id) ?? "unknown"}`,
        metadata: { userId: str(member.userId), role: str(member.role) },
      });
      await track("member.removed", { organizationId, userId: actorId });
      return;
    }
    case "/organization/update-member-role": {
      const organizationId = str(returned.organizationId);
      if (!organizationId) return;
      const role = str(returned.role) ?? "member";
      await recordAudit({ organizationId, actor, action: "member.role_changed", target: `member:${str(returned.id) ?? "unknown"}`, metadata: { userId: str(returned.userId), role } });
      await track("member.role_changed", { organizationId, userId: actorId }, { to: role });
      return;
    }
    default:
      return;
  }
}
