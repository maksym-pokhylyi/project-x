import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { suppressions } from "@/db/schema";
import { textArrayParam } from "@/features/procurement/ingest/sql";
import { buildSuppressionIndex, domainAndParents, type SuppressionIndex, type SuppressionMatch, type SuppressionReason, type SuppressionTarget } from "../domain/suppression";

/**
 * The suppression list in the database. NO authorisation here: these functions are called
 * by the founder's actions (which check requireAdmin first) and by the public opt-out
 * (which is allowed to add, and only to add).
 *
 * Suppression is by address. Three things follow from one entry:
 *  1. the row in `suppressions` — the source of truth, read whenever a list is built or exported;
 *  2. a stamp on every matching `supplier_contacts` row, for the legal gate;
 *  3. prospects holding the address: taken off a list that was not exported yet, or marked
 *     as opted out when the entry is an objection.
 */

type Scope = SuppressionTarget | { kind: "emails"; values: readonly string[] };

/** Rows whose address (`emailColumn`) and domain (`domainColumn`) fall under `scope`. */
function covers(scope: Scope, emailColumn: SQL, domainColumn: SQL): SQL {
  if (scope.kind === "email") return sql`${emailColumn} = ${scope.value}`;
  if (scope.kind === "emails") return sql`${emailColumn} = any(${textArrayParam(scope.values)})`;
  return sql`(${domainColumn} = ${scope.value} or right(${domainColumn}, ${scope.value.length + 1}::int) = ${`.${scope.value}`})`;
}

/** An entry `x` of the list that covers contact row `c` (aliases in the surrounding statement). */
const ENTRY_COVERS_CONTACT = sql`(x.email = c.email or (x.domain is not null and (c.email_domain = x.domain or right(c.email_domain, length(x.domain) + 1) = '.' || x.domain)))`;

/** Reasons that are an objection by the recipient: the company is not written to again. */
const OBJECTIONS: readonly SuppressionReason[] = ["optout", "complaint", "data_request"];

export type SuppressionInput = { reason: SuppressionReason; source: string; note?: string | null; createdBy?: string | null };
export type SuppressionEffects = { contactsStamped: number; prospectsSkipped: number; prospectsOptedOut: number };

/** What an entry does to contact rows and to prospects. Safe to repeat. */
async function applyEffects(scope: Scope, reason: SuppressionReason, executor: DbOrTx): Promise<SuppressionEffects> {
  const stamped = await executor.execute(sql`
    update supplier_contacts c set suppressed_at = now(), suppressed_reason = ${reason}
    where c.suppressed_at is null and ${covers(scope, sql`c.email`, sql`c.email_domain`)}
    returning 1
  `);
  const onProspect = sql`p.email is not null and ${covers(scope, sql`p.email`, sql`split_part(p.email, '@', 2)`)}`;
  // Never left the tool: simply off the list.
  const skipped = await executor.execute(sql`
    update outreach_prospects p set status = 'skipped', skipped_reason = 'suppressed', updated_at = now()
    where ${onProspect} and p.status = 'listed' and p.exported_at is null and p.sent_at is null
    returning 1
  `);
  // Exported or sent: the letter may be out. An objection is recorded as an opt-out; a bounce
  // leaves the status alone (the record of sending stays) and later exports leave the address out.
  let optedOut = 0;
  if (OBJECTIONS.includes(reason)) {
    const rows = await executor.execute(sql`
      update outreach_prospects p set status = 'opted_out', opted_out_at = coalesce(p.opted_out_at, now()), updated_at = now()
      where ${onProspect} and p.status in ('exported', 'sent')
      returning 1
    `);
    optedOut = rows.length;
  }
  return { contactsStamped: stamped.length, prospectsSkipped: skipped.length, prospectsOptedOut: optedOut };
}

const cleanNote = (note: string | null | undefined) => (note?.trim() ? note.trim().slice(0, 500) : null);

/** Adds an address or a domain (no-op when it is already listed) and applies its effects. Idempotent. */
export async function addSuppressionEntry(target: SuppressionTarget, input: SuppressionInput, executor: DbOrTx = db): Promise<SuppressionEffects & { created: boolean }> {
  const inserted = await executor
    .insert(suppressions)
    .values({
      email: target.kind === "email" ? target.value : null,
      domain: target.kind === "domain" ? target.value : null,
      reason: input.reason,
      source: input.source,
      note: cleanNote(input.note),
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: suppressions.id });
  return { created: inserted.length > 0, ...(await applyEffects(target, input.reason, executor)) };
}

/** Adds many addresses in one go (a bounce list). Returns how many were new. */
export async function addEmailSuppressions(emails: readonly string[], input: SuppressionInput, executor: DbOrTx = db): Promise<SuppressionEffects & { created: number }> {
  if (emails.length === 0) return { created: 0, contactsStamped: 0, prospectsSkipped: 0, prospectsOptedOut: 0 };
  const inserted = await executor.execute(sql`
    insert into suppressions (email, reason, source, note, created_by)
    select distinct lower(e), ${input.reason}::text, ${input.source}::text, ${cleanNote(input.note)}::text, ${input.createdBy ?? null}::text
    from unnest(${textArrayParam(emails)}) as e
    on conflict do nothing
    returning 1
  `);
  return { created: inserted.length, ...(await applyEffects({ kind: "emails", values: emails }, input.reason, executor)) };
}

/** Removes the stamp from contact rows that a deleted entry covered and no remaining entry covers. */
export async function unstampContacts(target: SuppressionTarget, executor: DbOrTx = db): Promise<number> {
  const rows = await executor.execute(sql`
    update supplier_contacts c set suppressed_at = null, suppressed_reason = null
    where c.suppressed_at is not null and ${covers(target, sql`c.email`, sql`c.email_domain`)}
      and not exists (select 1 from suppressions x where ${ENTRY_COVERS_CONTACT})
    returning 1
  `);
  return rows.length;
}

/**
 * Stamps contact rows that the list covers but that carry no stamp yet: an address that
 * re-appeared in a later notice (ingestion creates the row and never touches the
 * suppression fields). Run daily by maintenance and when a campaign is created. The builder
 * does not depend on it — it reads the list itself — so a missed run changes nothing about
 * who is written to.
 */
export async function syncContactSuppressions(executor: DbOrTx = db): Promise<number> {
  const rows = await executor.execute(sql`
    update supplier_contacts c set suppressed_at = x.created_at, suppressed_reason = x.reason
    from suppressions x
    where c.suppressed_at is null and ${ENTRY_COVERS_CONTACT}
    returning 1
  `);
  return rows.length;
}

/** The whole list, for checking many addresses at once (building or exporting a list). */
export async function loadSuppressionIndex(executor: DbOrTx = db): Promise<SuppressionIndex> {
  const rows = await executor.select({ email: suppressions.email, domain: suppressions.domain, reason: suppressions.reason, createdAt: suppressions.createdAt }).from(suppressions);
  return buildSuppressionIndex(rows);
}

/** Is this one address covered by the list — by its own entry, its domain or a parent domain? */
export async function findSuppression(email: string, executor: DbOrTx = db): Promise<SuppressionMatch | null> {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return null;
  const domains = domainAndParents(address.slice(at + 1));
  const onDomain = domains.length > 0 ? sql` or ${suppressions.domain} = any(${textArrayParam(domains)})` : sql``;
  const rows = await executor
    .select({ email: suppressions.email, domain: suppressions.domain, reason: suppressions.reason, createdAt: suppressions.createdAt })
    .from(suppressions)
    .where(sql`${suppressions.email} = ${address}${onDomain}`);
  return buildSuppressionIndex(rows).match(address);
}
