import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { outreachProspects } from "@/db/schema";
import { isFreemailDomain } from "@/features/procurement/domain/normalize";
import { track } from "@/lib/analytics";
import { normaliseEmail, normaliseTarget } from "../domain/suppression";
import { addSuppressionEntry, findSuppression } from "./suppression-store";

/**
 * The public opt-out (/optout). No session: what authorises a request is the code from the
 * recipient's own letter, or — for the form — nothing at all, which is why the form can only
 * ever ADD an address to the suppression list.
 *
 * READING NEVER CHANGES ANYTHING. Mail scanners and link previews follow the link in a
 * letter; only the button (a POST) opts anyone out.
 */

/** A link code: 10 base62 characters (see createCampaign). */
export const OPTOUT_CODE = /^[0-9A-Za-z]{10}$/;

export type OptOutView =
  | { state: "unknown" }
  | {
      state: "pending" | "done";
      /** The company the letter was about. The address is never shown. */
      company: string;
      supplierSlug: string;
      /** The company has a public page (it is not removed or unpublished). */
      pagePublic: boolean;
    };

type Prospect = {
  id: string;
  campaignId: string;
  email: string | null;
  status: string;
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  pagePublic: boolean;
  company: string;
};

async function findProspect(code: string): Promise<Prospect | null> {
  if (!OPTOUT_CODE.test(code)) return null;
  const rows = (await db.execute(sql`
    select p.id, p.campaign_id, p.email, p.status, p.merge_fields ->> 'company' as company,
           t.id as supplier_id, t.name as supplier_name, t.slug as supplier_slug,
           (t.removed_at is null and t.merged_into is null and t.identity_basis <> 'name' and t.is_incorporated) as page_public
    from outreach_prospects p
    join suppliers s on s.id = p.supplier_id
    join suppliers t on t.id = coalesce(s.merged_into, s.id)
    where p.ref_code = ${code}
  `)) as unknown as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    status: String(row.status),
    supplierId: String(row.supplier_id),
    supplierName: String(row.supplier_name),
    supplierSlug: String(row.supplier_slug),
    pagePublic: row.page_public === true,
    company: typeof row.company === "string" && row.company ? row.company : String(row.supplier_name),
  };
}

/** What the page shows for a code. READ ONLY. */
export async function getOptOutView(code: string | null | undefined): Promise<OptOutView> {
  const prospect = code ? await findProspect(code) : null;
  if (!prospect) return { state: "unknown" };
  const suppressed = prospect.status === "opted_out" || (prospect.email !== null && (await findSuppression(prospect.email)) !== null);
  return {
    state: suppressed ? "done" : "pending",
    company: prospect.company,
    supplierSlug: prospect.supplierSlug,
    pagePublic: prospect.pagePublic,
  };
}

export type OptOutResult = { found: boolean; changed: boolean };

/**
 * The button of a personal link. Puts the address on the suppression list, marks the
 * prospect as opted out (its company is then never listed again) and records the `optout`
 * event — once: pressing again changes nothing.
 */
export async function confirmOptOut(code: string): Promise<OptOutResult> {
  const prospect = await findProspect(code);
  if (!prospect) return { found: false, changed: false };
  const changed = await db.transaction(async (tx) => {
    let created = false;
    const email = normaliseEmail(prospect.email);
    if (email) {
      const effects = await addSuppressionEntry({ kind: "email", value: email.email, domain: email.domain }, { reason: "optout", source: "optout_link" }, tx);
      created = effects.created;
      // "We will not contact [Company] again" (the letter's own words; compliance pack §3.1):
      // when the domain is this company's alone as far as the notices show, the whole
      // domain goes on the list. A domain shared by several suppliers (nhs.net, a group)
      // is left alone — the company itself is blocked through its opted-out prospect.
      const domain = normaliseTarget(email.domain);
      if (domain?.kind === "domain" && !isFreemailDomain(email.domain)) {
        const [sharing] = (await tx.execute(sql`
          select count(distinct coalesce(s.merged_into, s.id))::int as suppliers
          from supplier_contacts c join suppliers s on s.id = c.supplier_id
          where c.email_domain = ${email.domain}
        `)) as unknown as Array<{ suppliers: number }>;
        if (Number(sharing?.suppliers ?? 0) <= 1) {
          await addSuppressionEntry(domain, { reason: "optout", source: "optout_link", note: "Domain of a company that opted out by its link" }, tx);
        }
      }
    }
    const updated = await tx
      .update(outreachProspects)
      .set({ status: "opted_out", optedOutAt: new Date(), updatedAt: new Date() })
      .where(and(eq(outreachProspects.id, prospect.id), sql`${outreachProspects.status} <> 'opted_out'`))
      .returning({ id: outreachProspects.id });
    return created || updated.length > 0;
  });
  if (changed) await track("optout", {}, { via: "link", campaign: prospect.campaignId });
  return { found: true, changed };
}

/**
 * The form without a code: someone types an address. It is put on the suppression list
 * whether or not we have ever seen it — so the answer is the same for every address and
 * tells nobody who is on a list. Only the address, never its domain: the request proves
 * nothing about who is asking.
 */
export async function optOutByAddress(input: string): Promise<{ valid: boolean; changed: boolean }> {
  const email = normaliseEmail(input);
  if (!email) return { valid: false, changed: false };
  const effects = await db.transaction((tx) => addSuppressionEntry({ kind: "email", value: email.email, domain: email.domain }, { reason: "optout", source: "optout_form" }, tx));
  const changed = effects.created || effects.prospectsOptedOut > 0 || effects.prospectsSkipped > 0;
  if (changed) await track("optout", {}, { via: "form", campaign: null });
  return { valid: true, changed };
}
