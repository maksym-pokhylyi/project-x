import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { assertRole, type OrgContext } from "./session";

export type AuditRow = {
  id: string;
  action: string;
  target: string | null;
  actorType: string;
  actorName: string | null;
  metadata: unknown;
  createdAt: Date;
};

/** Recent audit entries of the active workspace. Admins and owners only. */
export async function listAuditLog(ctx: OrgContext, limit = 20): Promise<AuditRow[]> {
  assertRole(ctx, "admin");
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      target: auditLog.target,
      actorType: auditLog.actorType,
      actorName: users.name,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(eq(auditLog.organizationId, ctx.organization.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}
