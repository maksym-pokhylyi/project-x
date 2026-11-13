import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { chunk, queryRows, textArrayParam, type SqlExecutor } from "./sql";

/**
 * Erasing a contact address IN PLACE, and recognising it afterwards.
 *
 * A row of `supplier_contacts` whose address identifies a person may not be kept beyond
 * RETENTION_DAYS.supplierNamedContacts (the rule and its reasons: src/config/retention.ts;
 * the step that applies it: ../retention.ts). Deleting the row would not do: the notice is
 * still published, so the next time it is read the address would simply come back, with a
 * fresh one-month clock. So the row stays and the address goes:
 *
 *   email_fingerprint = sha256(lower(email))                  hex, not reversible
 *   email             = "erased:" + first 16 hex of it        still unique per supplier
 *   erased_at         = when
 *
 * Ingestion fingerprints every incoming address and leaves out those a supplier already
 * holds as erased (`erasedContactKeys`), so an erased address is never restored and its
 * `first_ingested_at` never moves.
 *
 * The fingerprint is a plain SHA-256 — the same value as `outreach_prospects.email_hash` —
 * so that the database can compute it too. It does not give the address back, but it is not
 * anonymous either: whoever already has an address can tell from it that we once held it.
 * That is exactly what ingestion uses it for.
 *
 * Imports are relative and nothing here reads the environment: ingestion and
 * scripts/backfill-contact-fingerprints.ts run this file outside Next.js, on either driver.
 */

export const ERASED_PREFIX = "erased:";

/** SHA-256 (hex) of the lower-cased address. */
export function contactFingerprint(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * What `email` holds once the address is erased (the retention statement below writes the
 * same thing in SQL). It has no "@", so the outreach gate refuses it as `invalid_email`.
 */
export function erasedPlaceholder(fingerprint: string): string {
  return `${ERASED_PREFIX}${fingerprint.slice(0, 16)}`;
}

/** `contactFingerprint()` as the database computes it from `<alias>.email`. */
const fingerprintExpression = (alias: string) => `encode(sha256(convert_to(lower(${alias}.email), 'UTF8')), 'hex')`;

/** Only for rows that still hold an address: on an erased row this would be the hash of a placeholder. */
const fingerprintOfEmail = (alias: string): SQL => sql.raw(fingerprintExpression(alias));

/**
 * The fingerprint of a contact row whatever its state: the stored one (an erased row always
 * has it), or that of the address on a row stored before the column existed.
 */
export const contactRowFingerprint = (alias: string): SQL => sql.raw(`coalesce(${alias}.email_fingerprint, ${fingerprintExpression(alias)})`);

/**
 * "The address identifies a person" — the SAME test as `personalData` in the outreach gate
 * (../domain/outreach.ts): anything that is not clearly a role mailbox, and a role mailbox
 * that was published with a contact name. tests/procurement/contact-retention.test.ts holds
 * the two together.
 */
export const contactIdentifiesPerson = (alias: string): SQL => sql.raw(`(${alias}.kind <> 'generic' or ${alias}.name_present)`);

/** `${supplierId}|${fingerprint}`: one address of one supplier. */
export const contactKey = (supplierId: string, fingerprint: string): string => `${supplierId}|${fingerprint}`;

/** The addresses these suppliers hold as erased, as `contactKey`s. One statement per 5,000 suppliers. */
export async function erasedContactKeys(db: SqlExecutor, supplierIds: readonly string[]): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const part of chunk([...new Set(supplierIds)], 5000)) {
    const rows = await queryRows<{ supplier_id: string; email_fingerprint: string | null }>(
      db,
      sql`select supplier_id, email_fingerprint from supplier_contacts where erased_at is not null and supplier_id = any(${textArrayParam(part)})`,
    );
    for (const row of rows) if (row.email_fingerprint) keys.add(contactKey(row.supplier_id, row.email_fingerprint));
  }
  return keys;
}

export type EraseContactsOptions = {
  /** Rows first stored before this instant are due. */
  storedBefore: Date;
  /** Recorded as `erased_at`. */
  now: Date;
  /** Rows per call: a backlog is worked off in batches, never in one long statement. */
  limit: number;
  /** Ids of contact rows to leave alone: their address is still held, lawfully, elsewhere. */
  keepIds?: readonly string[];
};

export type EraseContactsResult = {
  /** Addresses replaced by their placeholder. */
  erased: number;
  /** Rows removed because the same supplier already held that address as erased. */
  duplicatesRemoved: number;
};

/**
 * Erases up to `limit` addresses that identify a person and were first stored before
 * `storedBefore`, oldest first. One statement, safe to repeat and to run twice at once: an
 * erased row is never selected again.
 *
 * `dropped` should never find anything — ingestion and merges keep one row per supplier and
 * address. If a second row for an erased address exists all the same, it cannot take the
 * placeholder (unique per supplier), and leaving it would keep the address for good and stop
 * every later run; so that row is removed, and the erased one remains as the record.
 */
export async function eraseExpiredContacts(db: SqlExecutor, options: EraseContactsOptions): Promise<EraseContactsResult> {
  const keep = options.keepIds && options.keepIds.length > 0 ? sql`and c.id <> all(${textArrayParam(options.keepIds)})` : sql``;
  const placeholder = sql.raw(`'${ERASED_PREFIX}' || left(d.fingerprint, 16)`);
  const alreadyErased = sql`exists (select 1 from supplier_contacts e where e.supplier_id = d.supplier_id and e.id <> d.id and e.email = ${placeholder})`;
  const [row] = await queryRows<{ erased: number | string; dropped: number | string }>(
    db,
    sql`
      with due as (
        select c.id, c.supplier_id, ${fingerprintOfEmail("c")} as fingerprint
        from supplier_contacts c
        where c.erased_at is null
          and ${contactIdentifiesPerson("c")}
          and c.first_ingested_at < ${options.storedBefore.toISOString()}::timestamptz
          ${keep}
        order by c.first_ingested_at, c.id
        limit ${options.limit}::int
      ),
      dropped as (
        delete from supplier_contacts c using due d
        where c.id = d.id and c.erased_at is null and ${alreadyErased}
        returning 1
      ),
      erased as (
        update supplier_contacts c
        set email = ${placeholder}, email_fingerprint = d.fingerprint, erased_at = ${options.now.toISOString()}::timestamptz
        from due d
        where c.id = d.id and c.erased_at is null and not ${alreadyErased}
        returning 1
      )
      select (select count(*) from erased)::int as erased, (select count(*) from dropped)::int as dropped
    `,
  );
  return { erased: Number(row?.erased ?? 0), duplicatesRemoved: Number(row?.dropped ?? 0) };
}

export type FingerprintBackfillResult = { filled: number; batches: number };

/**
 * Fills `email_fingerprint` on rows stored before the column existed (the migration adds it
 * empty; retention and ingestion fill it only on the rows they touch). Walks the table once
 * in id order, `batchSize` rows per statement. Idempotent and safe to interrupt: a row that
 * has a fingerprint, or was erased, is never written.
 */
export async function backfillContactFingerprints(
  db: SqlExecutor,
  options: { batchSize?: number; onBatch?: (progress: FingerprintBackfillResult) => void } = {},
): Promise<FingerprintBackfillResult> {
  const batchSize = Math.max(1, Math.trunc(options.batchSize ?? 5000));
  const progress: FingerprintBackfillResult = { filled: 0, batches: 0 };
  let after = "";
  for (;;) {
    // The conditions are repeated on the row being written: one that retention erased while
    // this statement ran keeps the fingerprint of its address, not one of its placeholder.
    const [row] = await queryRows<{ filled: number | string; seen: number | string; last: string | null }>(
      db,
      sql`
        with batch as (
          select id from supplier_contacts
          where id > ${after} and email_fingerprint is null and erased_at is null
          order by id
          limit ${batchSize}::int
        ),
        filled as (
          update supplier_contacts c set email_fingerprint = ${fingerprintOfEmail("c")}
          from batch b
          where c.id = b.id and c.email_fingerprint is null and c.erased_at is null
          returning 1
        )
        select (select count(*) from filled)::int as filled, (select count(*) from batch)::int as seen, (select max(id) from batch) as last
      `,
    );
    const seen = Number(row?.seen ?? 0);
    if (seen === 0 || !row?.last) break;
    progress.filled += Number(row.filled ?? 0);
    progress.batches += 1;
    options.onBatch?.({ ...progress });
    after = row.last;
    if (seen < batchSize) break;
  }
  return progress;
}
