import "server-only";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { members, organizations, sessions } from "@/db/schema";
import { track } from "@/lib/analytics";
import { newId, shortToken, slugify } from "@/lib/ids";

/** Roles of the Better Auth organization plugin, lowest to highest. */
export const ROLES = ["member", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True when `role` is at least `minimum` (owner > admin > member). */
export function hasRole(role: Role, minimum: Role): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(minimum);
}

function personalWorkspaceName(user: { name?: string | null; email: string }): string {
  const first = user.name?.trim().split(/\s+/)[0];
  const base = first || user.email.split("@")[0] || "My";
  return `${base.slice(0, 40)}'s workspace`;
}

/**
 * Creates the personal workspace every user gets at sign-up, with the user as owner.
 * Written directly with Drizzle (not through the Better Auth API) because it runs inside
 * Better Auth's own `user.create.after` hook and from `requireOrg()` as a self-heal.
 */
export async function createPersonalWorkspace(user: { id: string; name?: string | null; email: string }): Promise<string> {
  const name = personalWorkspaceName(user);
  const organizationId = newId();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: organizationId,
      name,
      slug: `${slugify(name, 30)}-${shortToken(4)}`,
      createdAt: now,
      metadata: JSON.stringify({ personal: true }),
    });
    await tx.insert(members).values({ id: newId(), organizationId, userId: user.id, role: "owner", createdAt: now });
  });
  await track("workspace.created", { organizationId, userId: user.id }, { personal: true });
  return organizationId;
}

/** The user's oldest membership (their personal workspace unless they left it). */
export async function firstOrganizationIdForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, userId))
    .orderBy(asc(members.createdAt))
    .limit(1);
  return row?.organizationId ?? null;
}

/**
 * Workspace a NEW session should start in: the one the user used last (if they are still
 * a member), otherwise their oldest membership.
 */
export async function defaultOrganizationIdForUser(userId: string): Promise<string | null> {
  const [last] = await db
    .select({ organizationId: sessions.activeOrganizationId })
    .from(sessions)
    .innerJoin(
      members,
      and(eq(members.organizationId, sessions.activeOrganizationId), eq(members.userId, sessions.userId)),
    )
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.activeOrganizationId)))
    .orderBy(desc(sessions.updatedAt))
    .limit(1);
  return last?.organizationId ?? (await firstOrganizationIdForUser(userId));
}
