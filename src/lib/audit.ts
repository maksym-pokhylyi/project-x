import "server-only";
import { db, type DbOrTx } from "@/db";
import { auditLog } from "@/db/schema";
import { log } from "./logger";

export type AuditEntry = {
  organizationId: string;
  /** Who did it. `userId` for people, or the system/Paddle acting on its own. */
  actor: { type: "user"; id: string } | { type: "system" } | { type: "paddle" };
  /** Dotted verb, e.g. "member.invited", "workspace.updated", "billing.plan_changed". */
  action: string;
  /** What it was done to, e.g. "member:abc", "invitation:xyz". */
  target?: string | null;
  /** Small, non-sensitive details. */
  metadata?: Record<string, unknown>;
};

/**
 * Appends to the workspace audit log. Pass a transaction to make the entry atomic with
 * the change it describes. Outside a transaction it never throws (the change already
 * happened; a failed audit write is logged loudly instead of failing the request).
 */
export async function recordAudit(entry: AuditEntry, executor?: DbOrTx): Promise<void> {
  const values = {
    organizationId: entry.organizationId,
    actorType: entry.actor.type,
    actorId: entry.actor.type === "user" ? entry.actor.id : null,
    action: entry.action,
    target: entry.target ?? null,
    metadata: entry.metadata ?? {},
  };
  if (executor) {
    await executor.insert(auditLog).values(values);
    return;
  }
  try {
    await db.insert(auditLog).values(values);
  } catch (error) {
    log.error("audit log write failed", { action: entry.action, organizationId: entry.organizationId, reason: error instanceof Error ? error.message : "unknown" });
  }
}
