import "server-only";
import { db, type DbOrTx } from "@/db";
import { outreachAudit } from "@/db/schema";

export type OutreachAuditAction =
  | "campaign.created"
  | "campaign.exported"
  | "campaign.marked_sent"
  | "campaign.sent_cleared"
  | "campaign.discarded"
  | "suppression.added"
  | "suppression.imported"
  | "suppression.removed"
  | "suppression.exported"
  | "data_request.resolved"
  | "retention.erased";

export type OutreachAuditEntry = {
  /** users.id of the founder; null for the system or a recipient. */
  actorId: string | null;
  action: OutreachAuditAction;
  campaignId?: string | null;
  /** Rows the action covered. */
  count?: number;
  /** Small, non-personal details. An e-mail address here is a bug and is refused. */
  metadata?: Record<string, unknown>;
};

const LOOKS_LIKE_AN_ADDRESS = /[^\s"@]+@[^\s"@]+\.[^\s"@]+/;

/**
 * Appends to the outreach audit trail: who, when, what and how many — never whom. Pass the
 * transaction of the change so the entry exists exactly when the change does.
 */
export async function recordOutreachAudit(entry: OutreachAuditEntry, executor: DbOrTx = db): Promise<void> {
  const metadata = entry.metadata ?? {};
  if (LOOKS_LIKE_AN_ADDRESS.test(JSON.stringify(metadata))) {
    throw new Error(`outreach audit "${entry.action}": metadata must not contain an e-mail address`);
  }
  await executor.insert(outreachAudit).values({
    actorId: entry.actorId,
    action: entry.action,
    campaignId: entry.campaignId ?? null,
    count: entry.count ?? 0,
    metadata,
  });
}
