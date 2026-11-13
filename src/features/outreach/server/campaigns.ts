import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { RETENTION_DAYS } from "@/config/retention";
import { site } from "@/config/site";
import { db, type DbOrTx } from "@/db";
import { outreachAudit, outreachCampaigns, outreachProspects, type OutreachBuildSummaryJson, type ProspectEligibilityJson, type ProspectMergeFieldsJson, type ProspectStatus } from "@/db/schema";
import { appUrl } from "@/env";
import { iso, str, textArrayParam } from "@/features/procurement/ingest/sql";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { requireAdmin } from "@/server/session";
import { outreachConfig, outreachSender, senderProblems, type OutreachSender, type SenderProblem } from "../config";
import { toCsv } from "../domain/csv";
import { renderLetter, type LetterKind, type LetterSender, type RenderedLetter } from "../domain/letter";
import { describeSegment, segmentSchema } from "../domain/segment";
import { recordOutreachAudit } from "./audit";
import { loadSuppressionIndex } from "./suppression-store";

/**
 * Campaigns after they exist: listing, the letters, the CSV export, "mark as sent" and
 * discarding. Cross-tenant by design: every exported function starts with requireAdmin().
 *
 * NOTHING HERE SENDS E-MAIL. The export is a file; the founder sends each letter himself.
 */

type Row = Record<string, unknown>;
const DAY_MS = 86_400_000;

export const LETTER_KINDS: readonly LetterKind[] = ["first", "reminder_1", "reminder_2"];
export const LETTER_KIND_LABELS: Record<LetterKind, string> = { first: "First letter", reminder_1: "Reminder 1", reminder_2: "Reminder 2 (the last)" };

export type CampaignSummary = {
  id: string;
  name: string;
  segmentText: string;
  templateKey: string;
  templateVariant: string;
  createdAt: string;
  exportedAt: string | null;
  notes: string | null;
  counts: { total: number; listed: number; exported: number; sent: number; optedOut: number; skipped: number; named: number };
};

function toSummary(row: Row): CampaignSummary {
  const segment = segmentSchema.safeParse(row.segment);
  return {
    id: String(row.id),
    name: String(row.name),
    segmentText: segment.success ? describeSegment(segment.data) : "Segment could not be read",
    templateKey: String(row.template_key),
    templateVariant: String(row.template_variant),
    createdAt: iso(row.created_at) ?? "",
    exportedAt: iso(row.exported_at),
    notes: str(row.notes),
    counts: {
      total: Number(row.total ?? 0),
      listed: Number(row.listed ?? 0),
      exported: Number(row.exported ?? 0),
      // "Sent" is a fact with a date, whatever happened afterwards (an opt-out does not unsend a letter).
      sent: Number(row.sent ?? 0),
      optedOut: Number(row.opted_out ?? 0),
      skipped: Number(row.skipped ?? 0),
      named: Number(row.named ?? 0),
    },
  };
}

const CAMPAIGN_COUNTS = sql`
  count(p.id)::int as total,
  count(p.id) filter (where p.status = 'listed')::int as listed,
  count(p.id) filter (where p.status = 'exported')::int as exported,
  count(p.id) filter (where p.sent_at is not null)::int as sent,
  count(p.id) filter (where p.status = 'opted_out')::int as opted_out,
  count(p.id) filter (where p.status = 'skipped')::int as skipped,
  count(p.id) filter (where p.email_kind = 'named')::int as named`;

export async function listCampaigns(): Promise<CampaignSummary[]> {
  await requireAdmin();
  const rows = (await db.execute(sql`
    select c.id, c.name, c.segment, c.template_key, c.template_variant, c.created_at, c.exported_at, c.notes, ${CAMPAIGN_COUNTS}
    from outreach_campaigns c left join outreach_prospects p on p.campaign_id = c.id
    group by c.id order by c.created_at desc limit 200
  `)) as unknown as Row[];
  return rows.map(toSummary);
}

export type ProspectRow = {
  id: string;
  company: string;
  registeredName: string;
  slug: string;
  companyNumber: string | null;
  town: string | null;
  emailKind: "generic" | "named";
  status: ProspectStatus;
  skippedReason: string | null;
  /** ISO; only for an address that identifies a person. */
  contactBy: string | null;
  award: { title: string; buyer: string; value: string | null; date: string } | null;
  exportedAt: string | null;
  sentAt: string | null;
  optedOutAt: string | null;
  /** The address (and letter) were erased by retention. */
  erased: boolean;
  /** Non-bot page views carrying this prospect's code. */
  visits: number;
  firstVisitAt: string | null;
  /** Reason of the suppression entry that covers the address today, if any. */
  suppressedNow: string | null;
  /** Would be in the next export of the first letter. */
  exportable: boolean;
};

export type CampaignDetail = {
  campaign: CampaignSummary & { buildSummary: OutreachBuildSummaryJson };
  prospects: ProspectRow[];
  /** How many rows each export would contain right now. */
  exportable: Record<LetterKind, number>;
  /** Sender details still missing for this list (the export refuses until they are set). */
  senderProblems: SenderProblem[];
  /** Links in the letters start with this. A warning is shown when it is not the public https origin. */
  linkOrigin: string;
  canDiscard: boolean;
};

type ExportRow = {
  id: string;
  email: string | null;
  refCode: string;
  status: ProspectStatus;
  eligibility: ProspectEligibilityJson;
  mergeFields: ProspectMergeFieldsJson | null;
  exportedAt: string | null;
  sentAt: string | null;
  resolvedSupplierId: string;
  slug: string;
  removed: boolean;
};

async function loadExportRows(campaignId: string, executor: DbOrTx): Promise<ExportRow[]> {
  const rows = (await executor.execute(sql`
    select p.id, p.email, p.ref_code, p.status, p.eligibility, p.merge_fields, p.exported_at, p.sent_at,
           coalesce(s.merged_into, s.id) as resolved_supplier_id, coalesce(m.slug, s.slug) as slug,
           (coalesce(m.removed_at, s.removed_at) is not null) as removed
    from outreach_prospects p
    join suppliers s on s.id = p.supplier_id
    left join suppliers m on m.id = s.merged_into
    where p.campaign_id = ${campaignId}::uuid
    order by p.created_at asc, p.id asc
  `)) as unknown as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    email: str(row.email),
    refCode: String(row.ref_code),
    status: String(row.status) as ProspectStatus,
    eligibility: row.eligibility as ProspectEligibilityJson,
    mergeFields: (row.merge_fields as ProspectMergeFieldsJson | null) ?? null,
    exportedAt: iso(row.exported_at),
    sentAt: iso(row.sent_at),
    resolvedSupplierId: String(row.resolved_supplier_id),
    slug: String(row.slug),
    removed: row.removed === true,
  }));
}

async function optedOutSupplierIds(executor: DbOrTx): Promise<Set<string>> {
  const rows = (await executor.execute(
    sql`select distinct coalesce(s.merged_into, s.id) as id from outreach_prospects p join suppliers s on s.id = p.supplier_id where p.status = 'opted_out'`,
  )) as unknown as Row[];
  return new Set(rows.map((row) => String(row.id)));
}

type ExportDecision = { include: true } | { include: false; reason: "suppressed" | "contact_window_expired" | "not_due" | "erased" };

/**
 * Whether a prospect belongs in an export made NOW. The suppression list is read again for
 * every export (P2 §2.6: "checked before every send"); so is the one-month window of an
 * address that identifies a person.
 */
function decide(row: ExportRow, kind: LetterKind, check: { suppressed: (row: ExportRow) => boolean }, now: Date): ExportDecision {
  if (!row.email || !row.mergeFields) return { include: false, reason: "erased" };
  if (kind === "first") {
    if (row.sentAt || (row.status !== "listed" && row.status !== "exported")) return { include: false, reason: "not_due" };
  } else if (!row.sentAt || row.status !== "sent") return { include: false, reason: "not_due" };
  if (check.suppressed(row)) return { include: false, reason: "suppressed" };
  if (kind === "first" && row.eligibility.personalData && row.eligibility.contactBy && new Date(row.eligibility.contactBy).getTime() < now.getTime()) {
    return { include: false, reason: "contact_window_expired" };
  }
  return { include: true };
}

function letterSender(sender: OutreachSender): LetterSender | null {
  if (!sender.firstName || !sender.fullName || !sender.legalName || !sender.postalAddress || !sender.contactEmail) return null;
  return {
    firstName: sender.firstName,
    fullName: sender.fullName,
    legalName: sender.legalName,
    registerReference: sender.registerReference,
    postalAddress: sender.postalAddress,
    contactEmail: sender.contactEmail,
    ukRepresentative: sender.ukRepresentative,
    icoNumber: sender.icoNumber,
  };
}

/** Shown in place of a detail that is not configured yet, so a preview still reads as a letter. */
const MISSING = (problem: string) => `[[${problem}]]`;

function previewSender(sender: OutreachSender): LetterSender {
  return {
    firstName: sender.firstName ?? MISSING("YOUR FIRST NAME"),
    fullName: sender.fullName ?? MISSING("YOUR FULL NAME"),
    legalName: sender.legalName ?? MISSING("FULL LEGAL NAME"),
    registerReference: sender.registerReference,
    postalAddress: sender.postalAddress ?? MISSING("POSTAL ADDRESS"),
    contactEmail: sender.contactEmail ?? MISSING("CONTACT E-MAIL"),
    ukRepresentative: sender.ukRepresentative,
    icoNumber: sender.icoNumber,
  };
}

export function prospectLinks(row: { slug: string; refCode: string }): { page: string; optout: string; privacy: string } {
  return {
    page: `${appUrl}/suppliers/${row.slug}?r=${row.refCode}`,
    optout: `${appUrl}/optout?c=${row.refCode}`,
    privacy: `${appUrl}${outreachConfig.privacyNoticePath}`,
  };
}

function render(row: ExportRow, campaign: { templateKey: string; templateVariant: string }, kind: LetterKind, sender: LetterSender): RenderedLetter {
  const fields = row.mergeFields!;
  return renderLetter({
    templateKey: campaign.templateKey,
    subjectVariant: campaign.templateVariant,
    kind,
    personalData: row.eligibility.personalData,
    fields: { company: fields.company, companyShort: fields.companyShort, awardTitle: fields.awardTitle, buyer: fields.buyer, value: fields.value, noticeDate: fields.noticeDate },
    links: prospectLinks(row),
    sender,
    brand: { name: site.name, domain: site.domain },
    namedRetentionDays: RETENTION_DAYS.outreachNamedAddresses,
  });
}

async function loadCampaignRow(campaignId: string, executor: DbOrTx, lock = false): Promise<Row | null> {
  const rows = (await executor.execute(sql`
    select c.id, c.name, c.segment, c.template_key, c.template_variant, c.build_summary, c.created_at, c.exported_at, c.notes
    from outreach_campaigns c where c.id = ${campaignId}::uuid ${lock ? sql`for update` : sql``}
  `)) as unknown as Row[];
  return rows[0] ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One campaign with its prospects (no addresses: they are only ever in the exported file). */
export async function getCampaign(campaignId: string, now: Date = new Date()): Promise<CampaignDetail> {
  await requireAdmin();
  if (!UUID.test(campaignId)) throw new NotFoundError("Campaign not found.");
  const [summaryRows, detailRows, exportRows, index, optedOut] = await Promise.all([
    db.execute(sql`
      select c.id, c.name, c.segment, c.template_key, c.template_variant, c.build_summary, c.created_at, c.exported_at, c.notes, ${CAMPAIGN_COUNTS}
      from outreach_campaigns c left join outreach_prospects p on p.campaign_id = c.id
      where c.id = ${campaignId}::uuid group by c.id
    `),
    db.execute(sql`
      select p.id, p.email_kind, p.status, p.skipped_reason, p.eligibility, p.merge_fields, p.exported_at, p.sent_at, p.opted_out_at, p.erased_at,
             s.name as registered_name, coalesce(m.slug, s.slug) as slug, s.coh, s.locality,
             v.visits, v.first_visit_at
      from outreach_prospects p
      join suppliers s on s.id = p.supplier_id
      left join suppliers m on m.id = s.merged_into
      left join lateral (
        select count(*)::int as visits, min(pv.created_at) as first_visit_at
        from page_visits pv where pv.ref_code = p.ref_code and pv.is_bot = false
      ) v on true
      where p.campaign_id = ${campaignId}::uuid
      order by p.created_at asc, p.id asc
    `),
    loadExportRows(campaignId, db),
    loadSuppressionIndex(db),
    optedOutSupplierIds(db),
  ]);
  const campaignRow = (summaryRows as unknown as Row[])[0];
  if (!campaignRow) throw new NotFoundError("Campaign not found.");

  const check = { suppressed: (row: ExportRow) => row.removed || (row.status !== "opted_out" && optedOut.has(row.resolvedSupplierId)) || (row.email ? index.match(row.email) !== null : false) };
  const exportById = new Map(exportRows.map((row) => [row.id, row]));
  const exportable: Record<LetterKind, number> = { first: 0, reminder_1: 0, reminder_2: 0 };
  for (const row of exportRows) for (const kind of LETTER_KINDS) if (decide(row, kind, check, now).include) exportable[kind] += 1;

  const prospects = (detailRows as unknown as Row[]).map((row): ProspectRow => {
    const fields = (row.merge_fields as ProspectMergeFieldsJson | null) ?? null;
    const eligibility = row.eligibility as ProspectEligibilityJson;
    const exportRow = exportById.get(String(row.id));
    const entry = exportRow?.email ? index.match(exportRow.email) : null;
    return {
      id: String(row.id),
      company: fields?.company ?? String(row.registered_name),
      registeredName: String(row.registered_name),
      slug: String(row.slug),
      companyNumber: str(row.coh),
      town: str(row.locality),
      emailKind: row.email_kind === "named" ? "named" : "generic",
      status: String(row.status) as ProspectStatus,
      skippedReason: str(row.skipped_reason),
      contactBy: eligibility.personalData ? eligibility.contactBy : null,
      award: fields ? { title: fields.awardTitle, buyer: fields.buyer, value: fields.value, date: fields.noticeDate } : null,
      exportedAt: iso(row.exported_at),
      sentAt: iso(row.sent_at),
      optedOutAt: iso(row.opted_out_at),
      erased: row.erased_at !== null && row.erased_at !== undefined,
      visits: Number(row.visits ?? 0),
      firstVisitAt: iso(row.first_visit_at),
      suppressedNow: entry?.reason ?? null,
      exportable: exportRow ? decide(exportRow, "first", check, now).include : false,
    };
  });

  const summary = toSummary(campaignRow);
  const includesNamed = exportRows.some((row) => row.eligibility.personalData && row.email !== null && row.status !== "skipped");
  return {
    campaign: { ...summary, buildSummary: campaignRow.build_summary as OutreachBuildSummaryJson },
    prospects,
    exportable,
    senderProblems: senderProblems(outreachSender(), { includesNamed }),
    linkOrigin: appUrl,
    canDiscard: prospects.every((prospect) => !prospect.exportedAt && !prospect.sentAt),
  };
}

/** One prospect's letter as it would be exported now. Missing sender details show as [[PLACEHOLDERS]]. */
export async function getProspectLetter(campaignId: string, prospectId: string, kind: LetterKind = "first"): Promise<(RenderedLetter & { company: string }) | null> {
  await requireAdmin();
  if (!UUID.test(campaignId) || !UUID.test(prospectId)) return null;
  const campaign = await loadCampaignRow(campaignId, db);
  if (!campaign) return null;
  const row = (await loadExportRows(campaignId, db)).find((candidate) => candidate.id === prospectId);
  if (!row || !row.mergeFields) return null;
  const letter = render(row, { templateKey: String(campaign.template_key), templateVariant: String(campaign.template_variant) }, kind, previewSender(outreachSender()));
  return { ...letter, company: row.mergeFields.company };
}

export const EXPORT_COLUMNS = ["email", "company", "first_name", "subject", "body", "page_link", "optout_link", "contact_by", "ref_code"] as const;

export type CampaignExport = {
  filename: string;
  csv: string;
  /** Letters in the file. */
  count: number;
  /** Prospects left out because they are suppressed or past their contact-by date. */
  leftOut: number;
};

/**
 * The CSV the founder sends from: one row per letter, with the address, the rendered subject
 * and body and both links. Refused while sender details are missing. Re-checks the
 * suppression list and the one-month window, marks the rows as exported and writes an audit
 * entry that says who, when and how many — not whom.
 */
export async function exportCampaignCsv(campaignId: string, kind: LetterKind = "first", now: Date = new Date()): Promise<CampaignExport> {
  const admin = await requireAdmin();
  if (!UUID.test(campaignId)) throw new NotFoundError("Campaign not found.");
  return db.transaction(async (tx) => {
    const campaign = await loadCampaignRow(campaignId, tx, true);
    if (!campaign) throw new NotFoundError("Campaign not found.");
    const [rows, index, optedOut] = [await loadExportRows(campaignId, tx), await loadSuppressionIndex(tx), await optedOutSupplierIds(tx)];
    const check = { suppressed: (row: ExportRow) => row.removed || (row.status !== "opted_out" && optedOut.has(row.resolvedSupplierId)) || (row.email ? index.match(row.email) !== null : false) };

    const included: ExportRow[] = [];
    const drop: Record<"suppressed" | "contact_window_expired", string[]> = { suppressed: [], contact_window_expired: [] };
    let leftOut = 0;
    for (const row of rows) {
      const decision = decide(row, kind, check, now);
      if (decision.include) included.push(row);
      else if (decision.reason === "suppressed" || decision.reason === "contact_window_expired") {
        leftOut += 1;
        // Only a prospect that never left the tool changes status; an exported one may already have been written to.
        if (row.status === "listed" && !row.exportedAt) drop[decision.reason].push(row.id);
      }
    }

    const sender = outreachSender();
    const problems = senderProblems(sender, { includesNamed: included.some((row) => row.eligibility.personalData) });
    const complete = letterSender(sender);
    if (problems.length > 0 || !complete) {
      throw new ConflictError(`Letters cannot be exported yet. Missing: ${problems.map((problem) => problem.label).join("; ")}.`);
    }

    const template = { templateKey: String(campaign.template_key), templateVariant: String(campaign.template_variant) };
    const records = included.map((row) => {
      const letter = render(row, template, kind, complete);
      const links = prospectLinks(row);
      const contactBy = row.eligibility.personalData && row.eligibility.contactBy ? row.eligibility.contactBy.slice(0, 10) : "";
      // first_name is always empty: the contact person's name is never stored (P2 §2.1), so letters open with "Hello,".
      return [row.email!, row.mergeFields!.company, "", letter.subject, letter.body, links.page, links.optout, contactBy, row.refCode];
    });

    for (const reason of ["suppressed", "contact_window_expired"] as const) {
      if (drop[reason].length === 0) continue;
      await tx.execute(sql`
        update outreach_prospects set status = 'skipped', skipped_reason = ${reason}, updated_at = ${now.toISOString()}::timestamptz
        where id = any(${textArrayParam(drop[reason])}::uuid[])
      `);
    }
    if (kind === "first" && included.length > 0) {
      await tx.execute(sql`
        update outreach_prospects set
          status = case when status = 'listed' then 'exported' else status end,
          exported_at = coalesce(exported_at, ${now.toISOString()}::timestamptz), updated_at = ${now.toISOString()}::timestamptz
        where id = any(${textArrayParam(included.map((row) => row.id))}::uuid[])
      `);
      await tx.update(outreachCampaigns).set({ exportedAt: now }).where(eq(outreachCampaigns.id, campaignId));
    }
    if (included.length > 0) {
      await recordOutreachAudit(
        { actorId: admin.id, action: "campaign.exported", campaignId, count: included.length, metadata: { letter: kind, leftOut, named: included.filter((row) => row.eligibility.personalData).length } },
        tx,
      );
    }
    const slug = String(campaign.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "campaign";
    return { filename: `outreach-${slug}-${kind.replace("_", "-")}-${now.toISOString().slice(0, 10)}.csv`, csv: toCsv(EXPORT_COLUMNS, records), count: included.length, leftOut };
  });
}

export type MarkSentInput = { campaignId: string; sentOn: string; prospectIds?: string[]; allExported?: boolean };
export type MarkSentResult = { marked: number; notChanged: number; afterContactBy: number; sentOn: string };

/**
 * Records that the founder sent the first letter to these prospects on `sentOn`: the legal
 * record of first contact. A selection may be partial; "all exported" takes every prospect
 * that was exported and has no date yet. Prospects that were skipped are never marked.
 */
export async function markProspectsSent(input: MarkSentInput, now: Date = new Date()): Promise<MarkSentResult> {
  const admin = await requireAdmin();
  if (!UUID.test(input.campaignId)) throw new NotFoundError("Campaign not found.");
  const ids = [...new Set(input.prospectIds ?? [])];
  if (ids.some((id) => !UUID.test(id)) || ids.length > outreachConfig.batchSize.max) throw new ValidationError("That selection is not valid.");
  if (!input.allExported && ids.length === 0) throw new ValidationError("Select at least one company, or choose every exported company.", { ids: ["Nothing is selected."] });

  const sentAt = /^\d{4}-\d{2}-\d{2}$/.test(input.sentOn) ? new Date(`${input.sentOn}T12:00:00.000Z`) : new Date(Number.NaN);
  if (Number.isNaN(sentAt.getTime()) || sentAt.toISOString().slice(0, 10) !== input.sentOn) throw new ValidationError(undefined, { sentOn: ["Enter the date the letters were sent."] });
  // "Today" somewhere on Earth may already be tomorrow in UTC; anything later is a typo.
  if (sentAt.getTime() > now.getTime() + DAY_MS) throw new ValidationError(undefined, { sentOn: ["The date cannot be in the future."] });

  return db.transaction(async (tx) => {
    const campaign = await loadCampaignRow(input.campaignId, tx, true);
    if (!campaign) throw new NotFoundError("Campaign not found.");
    const created = new Date(String(iso(campaign.created_at)));
    if (sentAt.getTime() < created.getTime() - DAY_MS) throw new ValidationError(undefined, { sentOn: ["The date cannot be before the campaign was created."] });

    const scope = input.allExported ? sql`p.exported_at is not null` : sql`p.id = any(${textArrayParam(ids)}::uuid[])`;
    const rows = (await tx.execute(sql`
      update outreach_prospects p set
        sent_at = ${sentAt.toISOString()}::timestamptz,
        status = case when p.status = 'opted_out' then 'opted_out' else 'sent' end,
        updated_at = ${now.toISOString()}::timestamptz
      where p.campaign_id = ${input.campaignId}::uuid and p.sent_at is null and ${scope}
        and (p.status in ('listed', 'exported') or (p.status = 'opted_out' and p.exported_at is not null))
      returning p.eligibility
    `)) as unknown as Row[];
    const afterContactBy = rows.filter((row) => {
      const eligibility = row.eligibility as ProspectEligibilityJson;
      return eligibility.personalData && eligibility.contactBy !== null && sentAt.getTime() > new Date(eligibility.contactBy).getTime();
    }).length;
    if (rows.length > 0) {
      await recordOutreachAudit({ actorId: admin.id, action: "campaign.marked_sent", campaignId: input.campaignId, count: rows.length, metadata: { sentOn: input.sentOn, afterContactBy } }, tx);
    }
    return { marked: rows.length, notChanged: input.allExported ? 0 : ids.length - rows.length, afterContactBy, sentOn: input.sentOn };
  });
}

/**
 * Deletes a campaign that never left the tool (nothing exported, nothing sent), which also
 * frees its companies for another list. Anything that was exported is a record and stays.
 */
export async function discardCampaign(campaignId: string): Promise<{ discarded: number }> {
  const admin = await requireAdmin();
  if (!UUID.test(campaignId)) throw new NotFoundError("Campaign not found.");
  return db.transaction(async (tx) => {
    const campaign = await loadCampaignRow(campaignId, tx, true);
    if (!campaign) throw new NotFoundError("Campaign not found.");
    const [used] = (await tx.execute(sql`
      select count(*)::int as total, count(*) filter (where exported_at is not null or sent_at is not null)::int as used
      from outreach_prospects where campaign_id = ${campaignId}::uuid
    `)) as unknown as Row[];
    if (Number(used?.used ?? 0) > 0) throw new ConflictError("This campaign has been exported, so it is kept as a record. Only a list that never left the tool can be discarded.");
    await tx.delete(outreachProspects).where(eq(outreachProspects.campaignId, campaignId));
    await tx.delete(outreachCampaigns).where(eq(outreachCampaigns.id, campaignId));
    await recordOutreachAudit({ actorId: admin.id, action: "campaign.discarded", campaignId, count: Number(used?.total ?? 0) }, tx);
    return { discarded: Number(used?.total ?? 0) };
  });
}

/** Newest audit entries, for the foot of the outreach pages. */
export async function listOutreachAudit(limit = 20) {
  await requireAdmin();
  return db.select().from(outreachAudit).orderBy(desc(outreachAudit.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}
