import "server-only";
import { and, asc, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { invitations, members, organizations, users } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { assertRole, type OrgContext } from "./session";
import { isRole, type Role } from "./workspaces";

/**
 * Tenant-scoped reads for workspace membership. Every query filters on
 * `ctx.organization.id`, which comes from the session (see requireOrg).
 */
export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  joinedAt: Date;
};

export type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
};

/** All members of the active workspace. Visible to every member. */
export async function listMembers(ctx: OrgContext): Promise<MemberRow[]> {
  const rows = await db
    .select({
      id: members.id,
      userId: members.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      role: members.role,
      joinedAt: members.createdAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, ctx.organization.id))
    .orderBy(asc(members.createdAt));
  return rows.map((row) => ({ ...row, role: isRole(row.role) ? row.role : "member" }));
}

/** Pending, unexpired invitations of the active workspace. Admins and owners only. */
export async function listPendingInvitations(ctx: OrgContext): Promise<InvitationRow[]> {
  assertRole(ctx, "admin");
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, ctx.organization.id),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitations.createdAt));
  return rows.map((row) => ({ ...row, role: isRole(row.role) ? row.role : "member" }));
}

export type SeatUsage = { members: number; pendingInvitations: number; limit: number | null };

export async function getSeatUsage(ctx: OrgContext): Promise<SeatUsage> {
  const organizationId = ctx.organization.id;
  const [[memberRow], [invitationRow]] = await Promise.all([
    db.select({ value: count() }).from(members).where(eq(members.organizationId, organizationId)),
    db
      .select({ value: count() })
      .from(invitations)
      .where(and(eq(invitations.organizationId, organizationId), eq(invitations.status, "pending"), gt(invitations.expiresAt, new Date()))),
  ]);
  return {
    members: memberRow?.value ?? 0,
    pendingInvitations: invitationRow?.value ?? 0,
    limit: ctx.entitlements.limits.seats,
  };
}

/** Loads a member of the ACTIVE workspace or throws 404 — the guard before any member mutation. */
export async function getMemberInOrg(ctx: OrgContext, memberId: string) {
  const [row] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.organizationId, ctx.organization.id)));
  if (!row) throw new NotFoundError("Member not found in this workspace.");
  return row;
}

/** Loads an invitation of the ACTIVE workspace or throws 404. */
export async function getInvitationInOrg(ctx: OrgContext, invitationId: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, ctx.organization.id)));
  if (!row) throw new NotFoundError("Invitation not found in this workspace.");
  return row;
}

/** Workspaces the user belongs to, for the switcher. */
export async function listUserWorkspaces(userId: string) {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name, logo: organizations.logo, role: members.role })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId))
    .orderBy(asc(members.createdAt));
  return rows.map((row) => ({ ...row, role: isRole(row.role) ? row.role : ("member" as Role) }));
}

/** True when the user belongs to the workspace (any role). Used by /api/files. */
export async function isMemberOf(userId: string, organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)));
  return Boolean(row);
}
