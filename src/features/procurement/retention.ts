import "server-only";
import { sql } from "drizzle-orm";
import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { queryOptionalTable } from "@/lib/optional-table";
import { eraseExpiredContacts } from "./ingest/contact-erasure";

/**
 * Retention for the contact addresses taken from notices, run by the daily
 * `maintenance.cleanup` job (the rule and its reasons: src/config/retention.ts).
 *
 * An address that identifies a person is erased in place RETENTION_DAYS.supplierNamedContacts
 * days after we first stored it: we either wrote to the person within the month or we stop
 * holding the address (UK GDPR Art. 5(1)(e), Art. 14(3)(a)). How a row is erased, and why it
 * is not deleted: ./ingest/contact-erasure.ts. Idempotent — a second run finds nothing.
 *
 *  - Generic role mailboxes of companies are not personal data and are left alone.
 *  - A suppressed address is erased like any other. The do-not-contact list
 *    (`suppressions`) holds its own copy, which is what keeps the promise.
 *  - An address on an outreach list follows the outreach module's periods instead: its
 *    contact row is left alone for as long as a prospect still holds the address, and is
 *    erased by the first run after that module has erased its copy. This step therefore
 *    runs AFTER runOutreachRetention.
 */
const DAY_MS = 86_400_000;
const BATCH_SIZE = 5_000;
const MAX_BATCHES = 20;

export type ContactRetentionSummary = {
  /** Contact addresses that identify a person, erased in this run. */
  supplierContactsErased: number;
};

/**
 * Contact rows whose address an outreach list still holds. That table belongs to another
 * module: where it is not installed nothing is listed. (Were it unreadable, nothing would
 * be kept back either — the prospect row carries its own copy of the address, so erasing
 * ours takes nothing away from a list.)
 */
async function listedContactIds(): Promise<string[]> {
  const rows = await queryOptionalTable("outreach_prospects", () =>
    db.execute<{ contact_id: string }>(sql`select distinct contact_id from outreach_prospects where contact_id is not null and email is not null`),
  );
  return (rows ?? []).map((row) => row.contact_id);
}

export async function runContactRetention(now: Date = new Date(), batching: { batchSize?: number; maxBatches?: number } = {}): Promise<ContactRetentionSummary> {
  const storedBefore = new Date(now.getTime() - RETENTION_DAYS.supplierNamedContacts * DAY_MS);
  const batchSize = batching.batchSize ?? BATCH_SIZE;
  const keepIds = await listedContactIds();
  let erased = 0;
  // Whatever does not fit in a run is picked up by the next one, oldest first.
  for (let batch = 0; batch < (batching.maxBatches ?? MAX_BATCHES); batch += 1) {
    const done = await eraseExpiredContacts(db, { storedBefore, now, limit: batchSize, keepIds });
    const handled = done.erased + done.duplicatesRemoved;
    erased += handled;
    if (handled < batchSize) break;
  }
  return { supplierContactsErased: erased };
}
