import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import type { Plan } from "@/config/plans";
import { db } from "@/db";
import { members, organizations, sessions } from "@/db/schema";
import { adminEmails, adminUserIds } from "@/env";
import { auth } from "@/lib/auth";
import type { Entitlements } from "@/lib/billing/entitlements";
import { entitlementsFor, getSubscription, type SubscriptionRow } from "@/lib/billing/subscription";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { createPersonalWorkspace, firstOrganizationIdForUser, hasRole, isRole, type Role } from "./workspaces";

/**
 * Authentication & tenancy for everything server-side.
 *
 * RULE: the organization id ALWAYS comes from here (the authenticated session), never
 * from a URL, form field or request body. Tenant data-access functions in src/server
 * take an `OrgContext` as their first argument so that rule is hard to break.
 *
 *   Server Actions / Route Handlers:  const ctx = await requireOrg({ role: "admin" });
 *   Pages / Layouts:                  const ctx = await requireOrgForPage();
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  /** Founder/admin access to /admin (ADMIN_EMAILS + a VERIFIED e-mail, + ADMIN_USER_IDS when pinned). */
  isAdmin: boolean;
};

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  /** True for the workspace created automatically at sign-up. */
  isPersonal: boolean;
};

export type OrgContext = {
  user: CurrentUser;
  sessionId: string;
  organization: CurrentOrganization;
  /** The user's role in `organization`. */
  role: Role;
  subscription: SubscriptionRow | null;
  /** Effective plan, limits and feature flags (see src/lib/billing/entitlements.ts). */
  entitlements: Entitlements;
  plan: Plan;
};

const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

function toCurrentUser(user: { id: string; name: string; email: string; image?: string | null; emailVerified: boolean }): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    emailVerified: user.emailVerified,
    isAdmin: isAdminUser(user),
  };
}

/**
 * Founder access. Three conditions, all required:
 *  - the address is listed in ADMIN_EMAILS,
 *  - it is VERIFIED — which only the mailbox owner can achieve, and which always replaces a
 *    password chosen by anyone else (see src/lib/signup-binding.ts), so registering the
 *    founder's address first does not lead here,
 *  - when ADMIN_USER_IDS is set, the account is one of the pinned ids.
 */
export function isAdminUser(user: { id: string; email: string; emailVerified: boolean }): boolean {
  if (!user.emailVerified || !adminEmails.has(user.email.toLowerCase())) return false;
  return adminUserIds.size === 0 || adminUserIds.has(user.id);
}

function isPersonalWorkspace(metadata: string | null): boolean {
  if (!metadata) return false;
  try {
    return (JSON.parse(metadata) as { personal?: unknown }).personal === true;
  } catch {
    return false;
  }
}

async function findMembership(userId: string, organizationId: string) {
  const [row] = await db
    .select({ role: members.role, organization: organizations })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)));
  return row ?? null;
}

/** The signed-in user, or null. */
export async function getUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  return session ? toCurrentUser(session.user) : null;
}

/** The signed-in user. Throws UnauthorizedError (401) when there is no valid session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

const loadOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = toCurrentUser(session.user);

  const activeId = session.session.activeOrganizationId ?? null;
  let membership = activeId ? await findMembership(user.id, activeId) : null;
  if (!membership) {
    // No active workspace, or the user was removed from it: fall back to their oldest
    // membership (creating the personal workspace if sign-up could not), and repair the session.
    const fallbackId = (await firstOrganizationIdForUser(user.id)) ?? (await createPersonalWorkspace(user));
    membership = await findMembership(user.id, fallbackId);
    if (!membership) throw new Error("Could not resolve a workspace for the signed-in user");
    await db.update(sessions).set({ activeOrganizationId: fallbackId }).where(eq(sessions.id, session.session.id));
  }

  const role: Role = isRole(membership.role) ? membership.role : "member";
  const subscription = await getSubscription(membership.organization.id);
  const entitlements = entitlementsFor(subscription);
  return {
    user,
    sessionId: session.session.id,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      logo: membership.organization.logo,
      createdAt: membership.organization.createdAt,
      isPersonal: isPersonalWorkspace(membership.organization.metadata),
    },
    role,
    subscription,
    entitlements,
    plan: entitlements.plan,
  };
});

/**
 * The signed-in user, their active workspace, role and entitlements.
 * Throws UnauthorizedError (401) without a session and ForbiddenError (403) when
 * `options.role` is not met. Use in Server Actions, Route Handlers and data access.
 */
export async function requireOrg(options: { role?: Role } = {}): Promise<OrgContext> {
  const context = await loadOrgContext();
  if (!context) throw new UnauthorizedError();
  if (options.role) assertRole(context, options.role);
  return context;
}

/** Throws ForbiddenError unless the context's role is at least `minimum`. */
export function assertRole(context: Pick<OrgContext, "role">, minimum: Role): void {
  if (!hasRole(context.role, minimum)) {
    throw new ForbiddenError(`This action requires the ${minimum} role in this workspace.`);
  }
}

/** Founder-only guard for /admin data access. Throws 401/403. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError("Admin access required.");
  return user;
}

// --- Page variants: redirect / render the 403 page instead of throwing -------------------

function signInUrl(returnTo?: string): string {
  return returnTo ? `/sign-in?redirect=${encodeURIComponent(returnTo)}` : "/sign-in";
}

/** For pages: redirects to /sign-in when signed out. */
export async function requireUserForPage(returnTo?: string): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect(signInUrl(returnTo));
  return user;
}

/** For pages: redirects to /sign-in when signed out, renders the 403 page when the role is too low. */
export async function requireOrgForPage(options: { role?: Role; returnTo?: string } = {}): Promise<OrgContext> {
  const context = await loadOrgContext();
  if (!context) redirect(signInUrl(options.returnTo ?? "/app"));
  if (options.role && !hasRole(context.role, options.role)) forbidden();
  return context;
}

/** For /admin pages: redirects when signed out, 403 for everyone who is not a founder. */
export async function requireAdminForPage(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect(signInUrl("/admin"));
  if (!user.isAdmin) forbidden();
  return user;
}
