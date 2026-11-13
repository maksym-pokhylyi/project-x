import "server-only";
import { sql } from "drizzle-orm";
import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { recordOutreachAudit } from "./audit";
import { syncContactSuppressions } from "./suppression-store";

/**
 * Retention for the outreach tables (src/config/retention.ts), run by the daily
 * `maintenance.cleanup` job. Idempotent: a second run finds nothing left to do.
 *
 * Prospect rows are never deleted — the funnel counts and the record of first contact
 * depend on them. What is erased is the personal part: the address, and later its
 * fingerprint and the merge fields of the letter.
 */
export type OutreachRetentionSummary = {
  /** Prospects erased in this run: the address, or (after 12 months) what was left of it. */
  outreachProspectsErased: number;
  /** Audit entries past their retention period. */
  outreachAudit: number;
  /** Contact rows newly stamped because their address is on the suppression list. */
  outreachContactsStamped: number;
};

const PERSONAL = sql`(p.eligibility ->> 'personalData') = 'true'`;

export async function runOutreachRetention(now: Date = new Date()): Promise<OutreachRetentionSummary> {
  const at = now.toISOString();
  const d = RETENTION_DAYS;

  // 1. A named address that was never written to and can no longer be: its one-month window
  //    has passed. Off the list if it never left the tool; an exported one keeps its status so
  //    the founder can still record a letter he did send in time.
  const expired = await db.execute(sql`
    update outreach_prospects p set
      email = null, erased_at = ${at}::timestamptz, updated_at = ${at}::timestamptz,
      status = case when p.status = 'listed' then 'skipped' else p.status end,
      skipped_reason = case when p.status = 'listed' then 'contact_window_expired' else p.skipped_reason end
    where p.email is not null and p.sent_at is null and ${PERSONAL}
      and (p.eligibility ->> 'contactBy') is not null and (p.eligibility ->> 'contactBy')::timestamptz < ${at}::timestamptz
    returning 1
  `);

  // 2. A named address, 90 days after the first letter.
  const named = await db.execute(sql`
    update outreach_prospects p set email = null, erased_at = ${at}::timestamptz, updated_at = ${at}::timestamptz
    where p.email is not null and ${PERSONAL}
      and p.sent_at < ${at}::timestamptz - make_interval(days => ${d.outreachNamedAddresses}::int)
    returning 1
  `);

  // 3. Everything personal about every prospect, 12 months after the campaign.
  const old = await db.execute(sql`
    update outreach_prospects p set
      email = null, email_hash = null, merge_fields = null,
      erased_at = coalesce(p.erased_at, ${at}::timestamptz), updated_at = ${at}::timestamptz
    from outreach_campaigns c
    where c.id = p.campaign_id
      and c.created_at < ${at}::timestamptz - make_interval(days => ${d.outreachProspects}::int)
      and (p.email is not null or p.email_hash is not null or p.merge_fields is not null)
    returning 1
  `);

  const audit = await db.execute(sql`
    delete from outreach_audit where created_at < ${at}::timestamptz - make_interval(days => ${d.outreachAudit}::int) returning 1
  `);
  const stamped = await syncContactSuppressions();

  const erased = expired.length + named.length + old.length;
  if (erased > 0) {
    await recordOutreachAudit({
      actorId: null,
      action: "retention.erased",
      count: erased,
      metadata: { contactWindowExpired: expired.length, namedAfterDays: named.length, afterCampaign: old.length },
    });
  }
  return { outreachProspectsErased: erased, outreachAudit: audit.length, outreachContactsStamped: stamped };
}
