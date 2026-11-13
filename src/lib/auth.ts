import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, createEmailVerificationToken, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { and, count, eq, sql } from "drizzle-orm";
import { site } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appUrl, env, features, trustedOrigins } from "@/env";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { announceConfigWarnings } from "@/lib/config-warnings";
import { emailKey } from "@/lib/crypto";
import { describeError, scrubText } from "@/lib/describe-error";
import { sendEmail } from "@/lib/email/send";
import { log } from "@/lib/logger";
import { rateLimit, trustedIpHeaders } from "@/lib/rate-limit";
import { reportError } from "@/lib/report-error";
import { SIGNUP_BINDING_COOKIE, issueSignupBinding, signupBindingCookieOptions, signupBindingMatches } from "@/lib/signup-binding";
import { emailSchema, nameSchema, sanitizeDisplayName, workspaceNameSchema, workspaceSlugSchema } from "@/lib/validation";
import { createPersonalWorkspace, defaultOrganizationIdForUser } from "@/server/workspaces";

/**
 * Better Auth configuration — the only place authentication behaviour is defined.
 *
 * - E-mail + password with verification, password reset, optional Google OAuth.
 *   Verification is ALWAYS enforced. A deployment that cannot deliver e-mail does not
 *   skip it: sign-up, password reset and invitations answer 503 with a clear message
 *   (`hooks.before`). The only opt-out is ALLOW_UNVERIFIED_SIGNUP=1 (pre-launch testing).
 * - Pre-registration takeover protection: a verification link completes directly only in
 *   the browser that created the account (sign-up binding cookie). Anywhere else the
 *   mailbox owner is asked to choose a password, which replaces the stored one
 *   (src/lib/signup-binding.ts, `confirmEmailAction`). A password reset also verifies.
 * - Organization plugin = workspaces (roles owner/admin/member, e-mail invitations).
 * - Every new user gets a personal workspace; every new session starts in a workspace.
 * - Seat limits come from the workspace's plan (entitlements), enforced server-side.
 * - Rate limiting is done by our Postgres limiter in the route handler
 *   (src/app/api/auth/[...all]/route.ts), so Better Auth's in-memory limiter is off.
 * - CSRF: Better Auth checks the Origin of every state-changing request against
 *   `trustedOrigins`; session cookies are HttpOnly + SameSite=Lax (+ Secure on https).
 */

const UNLIMITED_SEATS = 100_000;
const VERIFICATION_LINK_TTL_SECONDS = 24 * 60 * 60;
/** Notices triggered by a repeated sign-up, per target address: enough for a real user, useless for mail-bombing. */
const EXISTING_SIGN_UP_NOTICES = { limit: 3, windowSeconds: 60 * 60 };

async function seatLimit(organizationId: string): Promise<number> {
  const entitlements = await getOrgEntitlements(organizationId);
  return entitlements.limits.seats ?? UNLIMITED_SEATS;
}

async function memberCount(organizationId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(schema.members).where(eq(schema.members.organizationId, organizationId));
  return row?.value ?? 0;
}

// Unsafe or half-configured deployments are never silent (also listed on /admin).
announceConfigWarnings();

const SIGN_UP_DISABLED_MESSAGE =
  "Sign-up is not available right now: this site cannot send the email needed to confirm your address. Please try again later or contact support.";
const EMAIL_UNAVAILABLE_MESSAGE =
  "This site cannot send email right now, so this action is unavailable. Please try again later or contact support.";

/**
 * 400 with a stable code. The same rules as the app's own forms, enforced HERE so that
 * calling /api/auth/* directly cannot bypass them (the Server Actions are not the boundary).
 */
function invalid(message: string): APIError {
  return new APIError("BAD_REQUEST", { code: "VALIDATION", message });
}

function firstIssue(error: { issues: Array<{ message: string }> }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/** Invitations per workspace, however they are created (Server Action or raw endpoint). */
const INVITATIONS_PER_WORKSPACE = { limit: 30, windowSeconds: 60 * 60 };
const MEMBER_ROLES = new Set(["member", "admin", "owner"]);
const INVITABLE_ROLES = new Set(["member", "admin"]);

function assertWorkspaceName(name: unknown): void {
  const parsed = workspaceNameSchema.safeParse(name);
  if (!parsed.success) throw invalid(`Workspace name: ${firstIssue(parsed.error, "invalid")}`);
  if (parsed.data !== name) throw invalid("Workspace name: remove leading and trailing spaces.");
}

function assertWorkspaceSlug(slug: unknown): void {
  const parsed = workspaceSlugSchema.safeParse(slug);
  if (!parsed.success) throw invalid(`Workspace slug: ${firstIssue(parsed.error, "invalid")}`);
}

/**
 * Removes the member that was just added if the workspace is now over its seat limit.
 * Better Auth checks the limit before inserting (check-then-insert), so two invitations
 * accepted at the same moment could both pass; under a per-workspace lock exactly the
 * surplus joiners are undone.
 */
export async function enforceSeatLimitAfterJoin(organizationId: string, memberId: string, invitationId?: string): Promise<boolean> {
  const limit = await seatLimit(organizationId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`seats:${organizationId}`}))`);
    const [row] = await tx.select({ value: count() }).from(schema.members).where(eq(schema.members.organizationId, organizationId));
    if ((row?.value ?? 0) <= limit) return true;
    await tx.delete(schema.members).where(and(eq(schema.members.id, memberId), eq(schema.members.organizationId, organizationId)));
    if (invitationId) await tx.update(schema.invitations).set({ status: "pending" }).where(eq(schema.invitations.id, invitationId));
    return false;
  });
}

/** 503 for flows that depend on a deliverable e-mail when there is no way to deliver one. */
function emailUnavailable(code: string, message: string): APIError {
  return new APIError("SERVICE_UNAVAILABLE", { code, message });
}

export const auth = betterAuth({
  appName: site.name,
  baseURL: appUrl,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
  telemetry: { enabled: false },
  // Route Better Auth's own log lines through our structured logger.
  logger: {
    level: "warn",
    log: (level, message, ...details) => {
      // Better Auth passes raw errors (failed queries with their bind parameters) and
      // arbitrary objects (users, request data) as details: keep only safe text.
      const fields = details.length > 0 ? { details: details.map(authLogDetail) } : undefined;
      const line = `[auth] ${scrubText(String(message), 300)}`;
      if (level === "error") log.error(line, fields);
      else if (level === "warn") log.warn(line, fields);
      else log.info(line, fields);
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
    // Completing a reset proves control of the mailbox (and has just replaced the password
    // and revoked every session), so it is an equally good proof for verification.
    onPasswordReset: async ({ user }) => {
      const updated = await db
        .update(schema.users)
        .set({ emailVerified: true })
        .where(and(eq(schema.users.id, user.id), eq(schema.users.emailVerified, false)))
        .returning({ id: schema.users.id });
      if (updated.length > 0) await track("user.email_verified", { userId: user.id });
    },
    /**
     * A second sign-up for an address that already exists changes NOTHING about the account
     * (the caller gets the same generic answer as a first sign-up). The mailbox gets a
     * message so the real owner is never at a dead end:
     *  - verified account   -> "you already have an account" (no token)
     *  - unverified account -> a fresh verification link. Opened anywhere but the browser
     *    that created the account, it asks the visitor to choose a new password.
     */
    onExistingUserSignUp: async ({ user }) => {
      const allowed = await rateLimit(`auth:existing-sign-up:${emailKey(user.email)}`, EXISTING_SIGN_UP_NOTICES);
      if (!allowed.ok) return;
      if (user.emailVerified) {
        await sendEmail(user.email, {
          name: "account-exists",
          props: { signInUrl: `${appUrl}/sign-in`, resetUrl: `${appUrl}/forgot-password` },
        });
        return;
      }
      const token = await createEmailVerificationToken(env.BETTER_AUTH_SECRET, user.email, undefined, VERIFICATION_LINK_TTL_SECONDS, {
        userId: user.id,
      });
      const url = `${appUrl}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent("/app")}`;
      // The stored name was typed by whoever registered first: do not greet with it.
      await sendEmail(user.email, { name: "verify-email", props: { name: "", url } });
    },
  },

  emailVerification: {
    sendOnSignUp: features.requireEmailVerification,
    sendOnSignIn: features.requireEmailVerification,
    autoSignInAfterVerification: true,
    expiresIn: VERIFICATION_LINK_TTL_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(user.email, { name: "verify-email", props: { name: user.name, url } });
    },
    /**
     * Runs for a valid link of a still-unverified account, before anything is changed.
     * Only the browser that created the account (sign-up binding cookie) may complete the
     * verification with the existing password. Every other visitor holds the link — so
     * they control the mailbox — but did not necessarily choose the password: they are sent
     * to /verify-email/confirm to choose one. Nothing happens on this GET, so link scanners
     * and mail previews cannot verify an account or burn the link.
     */
    beforeEmailVerification: async (user, request) => {
      if (await signupBindingMatches(user.id, request?.headers.get("cookie"))) return;
      if (!request) {
        throw new APIError("FORBIDDEN", {
          code: "EMAIL_CONFIRMATION_REQUIRED",
          message: "Open the verification link in a browser to confirm this email address.",
        });
      }
      const requestUrl = new URL(request.url);
      const confirm = new URL("/verify-email/confirm", appUrl);
      confirm.searchParams.set("token", requestUrl.searchParams.get("token") ?? "");
      const callbackURL = requestUrl.searchParams.get("callbackURL");
      if (callbackURL) confirm.searchParams.set("redirect", callbackURL);
      throw new APIError("FOUND", undefined, { location: confirm.toString(), "cache-control": "no-store" });
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
    // Session rows record an IP only from a header the client cannot forge (F-24).
    ipAddress: trustedIpHeaders.length > 0 ? { ipAddressHeaders: [...trustedIpHeaders] } : { disableIpTracking: true },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * Names end up in other people's inboxes (invitation subject and body). The sign-up
         * endpoint is strict; a name from an OAuth profile is cleaned instead of refused.
         */
        before: async (user, ctx) => {
          if (ctx?.path === "/sign-up/email") {
            const parsed = nameSchema.safeParse(user.name);
            if (!parsed.success) throw invalid(`Name: ${firstIssue(parsed.error, "invalid")}`);
            if (user.image) throw invalid("A profile image cannot be set at sign-up.");
            return { data: { ...user, name: parsed.data } };
          }
          return { data: { ...user, name: sanitizeDisplayName(user.name ?? "", user.email.split("@")[0] || "User") } };
        },
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
      update: {
        before: async (data, ctx) => {
          if (ctx?.path !== "/update-user") return;
          if (data.name !== undefined) {
            const parsed = nameSchema.safeParse(data.name);
            if (!parsed.success) throw invalid(`Name: ${firstIssue(parsed.error, "invalid")}`);
            if (parsed.data !== data.name) return { data: { ...data, name: parsed.data } };
          }
          // No avatar upload exists; an arbitrary URL would be rendered to other members.
          if (data.image !== undefined && data.image !== null) throw invalid("A profile image cannot be set.");
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
    /** Flows that need a deliverable e-mail fail closed, with a message the user can read. */
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && !features.signUpEnabled) {
        throw emailUnavailable("SIGN_UP_DISABLED", SIGN_UP_DISABLED_MESSAGE);
      }
      if ((ctx.path === "/request-password-reset" || ctx.path === "/send-verification-email") && !features.passwordResetEnabled) {
        throw emailUnavailable("EMAIL_DELIVERY_UNAVAILABLE", EMAIL_UNAVAILABLE_MESSAGE);
      }
    }),
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
        if (ctx.path === "/sign-up/email") {
          // Bind the new account to this browser (or set an indistinguishable decoy when
          // the address was already registered). See src/lib/signup-binding.ts.
          const signedUp = ctx.context.returned;
          if (!signedUp || signedUp instanceof APIError || signedUp instanceof Response) return;
          const userId = str(record(record(signedUp).user).id);
          if (userId) ctx.setCookie(SIGNUP_BINDING_COOKIE, await issueSignupBinding(userId), signupBindingCookieOptions);
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
      // Unconditional: an invitation is only ever accepted by a PROVEN owner of the invited address.
      requireEmailVerificationOnInvitation: true,
      /**
       * Server-side rules for every workspace mutation, so the raw /api/auth/organization/*
       * endpoints obey what the app's forms and Server Actions enforce (name, slug, logo,
       * roles, invitation volume). Seats are enforced by the two limits above.
       */
      organizationHooks: {
        beforeCreateOrganization: async ({ organization: input }) => {
          assertWorkspaceName(input.name);
          assertWorkspaceSlug(input.slug);
          if (input.logo !== undefined && input.logo !== null) throw invalid("A logo can only be set by uploading it.");
          // `metadata` marks personal workspaces and is never client-writable.
          if (input.metadata !== undefined && input.metadata !== null) throw invalid("Workspace metadata cannot be set.");
        },
        beforeUpdateOrganization: async ({ organization: input, member }) => {
          if (input.name !== undefined) assertWorkspaceName(input.name);
          if (input.slug !== undefined) assertWorkspaceSlug(input.slug);
          if (input.metadata !== undefined) throw invalid("Workspace metadata cannot be changed.");
          if (input.logo !== undefined && input.logo !== null) {
            // Only a file this workspace uploaded through /api/workspace/logo; never an external URL
            // or another key (the upload route deletes whatever own-workspace key the logo names).
            const own = new RegExp(`^/api/files/org/${member.organizationId}/logo/[A-Za-z0-9][A-Za-z0-9._-]{0,80}$`);
            if (typeof input.logo !== "string" || !own.test(input.logo)) throw invalid("A logo can only be set by uploading it.");
          }
        },
        beforeCreateInvitation: async ({ invitation, organization: org }) => {
          if (features.mailDelivery === "none") throw emailUnavailable("EMAIL_DELIVERY_UNAVAILABLE", EMAIL_UNAVAILABLE_MESSAGE);
          if (!INVITABLE_ROLES.has(invitation.role)) throw invalid("Invite people as member or admin.");
          const email = emailSchema.safeParse(invitation.email);
          if (!email.success) throw invalid("Enter a valid email address.");
          const allowed = await rateLimit(`invite:${org.id}`, INVITATIONS_PER_WORKSPACE);
          if (!allowed.ok) {
            throw new APIError("TOO_MANY_REQUESTS", {
              code: "RATE_LIMITED",
              message: "This workspace has sent too many invitations. Please try again later.",
              retryAfterSeconds: allowed.retryAfterSeconds,
            });
          }
        },
        beforeAddMember: async ({ member }) => {
          if (!MEMBER_ROLES.has(member.role)) throw invalid("Unknown role.");
        },
        beforeUpdateMemberRole: async ({ newRole }) => {
          if (!MEMBER_ROLES.has(newRole)) throw invalid("Unknown role.");
        },
        afterAcceptInvitation: async ({ invitation, member }) => {
          if (!(await enforceSeatLimitAfterJoin(member.organizationId, member.id, invitation.id))) {
            throw new APIError("FORBIDDEN", { code: "ORGANIZATION_MEMBERSHIP_LIMIT_REACHED", message: "Organization membership limit reached" });
          }
        },
      },
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

function authLogDetail(detail: unknown): unknown {
  if (typeof detail === "string") return scrubText(detail, 300);
  if (typeof detail === "number" || typeof detail === "boolean" || detail === null || detail === undefined) return detail;
  if (detail instanceof Error || (typeof detail === "object" && "message" in detail)) {
    const described = describeError(detail);
    return `${described.name}: ${described.message}`;
  }
  return "[object]";
}

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
