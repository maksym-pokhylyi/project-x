import "server-only";
import { inArray, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { outreachCampaigns, outreachProspects, type ProspectMergeFieldsJson } from "@/db/schema";
import { isFreemailDomain } from "@/features/procurement/domain/normalize";
import { iso, num, str, textArrayParam } from "@/features/procurement/ingest/sql";
import { sha256Hex } from "@/lib/crypto";
import { ConflictError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { requireAdmin } from "@/server/session";
import { NAMED_ADDRESSES_BLOCKED, outreachConfig, ukRepresentativeAppointed } from "../config";
import { isKnownTemplate } from "../domain/letter";
import { displayName, letterValue, longDate, quotedTitle, shortCompanyName } from "../domain/names";
import { describeSegment, segmentSchema, type OutreachSegment } from "../domain/segment";
import { selectProspects, type BuildSummary, type Candidate, type CandidateContact, type SelectedProspect, type Selection, type SelectionContext } from "../domain/select";
import { recordOutreachAudit } from "./audit";
import { loadSuppressionIndex, syncContactSuppressions } from "./suppression-store";

/**
 * The list builder. A segment goes in; out comes who may be written to and a count of
 * everyone who was left out, by reason. `previewSegment` stores nothing; `createCampaign`
 * runs the same selection again inside a transaction and stores exactly what it finds.
 */
const DAY_MS = 86_400_000;

type Row = Record<string, unknown>;

/** Suppliers with an award that matches the segment, each with every address published for it. */
export async function loadCandidates(segment: OutreachSegment, now: Date, executor: DbOrTx = db): Promise<Candidate[]> {
  const since = new Date(now.getTime() - segment.publishedWithinDays * DAY_MS);
  const awardConditions: SQL[] = [
    sql`a.is_current`,
    sql`a.published_at >= ${since.toISOString()}::timestamptz`,
    sql`a.published_at <= ${now.toISOString()}::timestamptz`,
    sql`a.notice_type = any(${textArrayParam(outreachConfig.noticeTypes)})`,
    // Cancelled, unsuccessful and terminated awards are not something to write about.
    sql`a.effective_status in ('active', 'pending')`,
  ];
  const trade: SQL[] = [];
  if (segment.cpvDivisions.length > 0) trade.push(sql`a.cpv_divisions && ${textArrayParam(segment.cpvDivisions)}`);
  if (segment.cpvGroups.length > 0) trade.push(sql`a.cpv_groups && ${textArrayParam(segment.cpvGroups)}`);
  if (trade.length > 0) awardConditions.push(sql`(${sql.join(trade, sql` or `)})`);
  if (segment.valueMin !== null || segment.valueMax !== null) {
    // A band can only be judged on a figure that is this supplier's own.
    awardConditions.push(sql`a.value_amount is not null and not a.value_shared and not a.is_framework`);
    if (segment.valueMin !== null) awardConditions.push(sql`a.value_amount >= ${segment.valueMin}::numeric`);
    if (segment.valueMax !== null) awardConditions.push(sql`a.value_amount <= ${segment.valueMax}::numeric`);
  }
  const region = segment.regions.length > 0 ? sql`and s.region = any(${textArrayParam(segment.regions)})` : sql``;

  const rows = (await executor.execute(sql`
    with matching as (
      select distinct on (a.supplier_id)
        a.supplier_id, a.title, a.published_at, a.value_amount, a.value_gross, a.currency, a.value_shared, a.is_framework, a.release_id, a.notice_type, a.buyer_id
      from awards a
      where ${sql.join(awardConditions, sql` and `)}
      -- the newest matching award; on the same day, one with a figure of its own first
      order by a.supplier_id, a.published_at desc, a.value_shared asc, a.value_amount desc nulls last, a.id asc
    )
    select
      s.id as supplier_id, s.name, s.slug, s.coh, s.legal_form, s.country, s.removed_at, s.merged_into, s.scale, s.locality, s.region,
      m.title as award_title, m.published_at, m.value_amount, m.value_gross, m.currency, m.value_shared, m.is_framework, m.release_id, m.notice_type,
      b.name as buyer_name,
      c.id as contact_id, c.email, c.email_domain, c.kind, c.name_present, c.domain_matches_website, c.first_ingested_at, c.last_seen_at, c.suppressed_at
    from matching m
    join suppliers s on s.id = m.supplier_id
    join buyers b on b.id = m.buyer_id
    left join supplier_contacts c on c.supplier_id = s.id
    where true ${region}
    order by m.published_at desc, s.id asc, c.email asc
    limit ${outreachConfig.maxCandidates}
  `)) as unknown as Row[];

  const bySupplier = new Map<string, Candidate>();
  for (const row of rows) {
    const supplierId = String(row.supplier_id);
    let candidate = bySupplier.get(supplierId);
    if (!candidate) {
      candidate = {
        supplier: {
          id: supplierId,
          name: String(row.name),
          slug: String(row.slug),
          coh: str(row.coh),
          legalForm: String(row.legal_form),
          country: str(row.country),
          removedAt: iso(row.removed_at),
          mergedInto: str(row.merged_into),
          scale: str(row.scale),
          locality: str(row.locality),
          region: str(row.region),
        },
        award: {
          title: String(row.award_title),
          buyerName: str(row.buyer_name),
          publishedAt: iso(row.published_at) ?? "",
          valueAmount: num(row.value_amount),
          valueGross: num(row.value_gross),
          currency: str(row.currency),
          valueShared: row.value_shared === true,
          isFramework: row.is_framework === true,
          releaseId: String(row.release_id),
          noticeType: str(row.notice_type),
        },
        contacts: [],
      };
      bySupplier.set(supplierId, candidate);
    }
    if (row.contact_id !== null && row.contact_id !== undefined) {
      const email = String(row.email).toLowerCase();
      const contact: CandidateContact = {
        id: String(row.contact_id),
        email,
        emailHash: sha256Hex(email),
        emailDomain: String(row.email_domain).toLowerCase(),
        kind: String(row.kind),
        namePresent: row.name_present === true,
        domainMatchesWebsite: typeof row.domain_matches_website === "boolean" ? row.domain_matches_website : null,
        firstIngestedAt: iso(row.first_ingested_at) ?? "",
        lastSeenAt: iso(row.last_seen_at) ?? "",
        suppressedAt: iso(row.suppressed_at),
      };
      candidate.contacts.push(contact);
    }
  }
  return [...bySupplier.values()];
}

/** Supplier ids are compared after merges: a prospect of a row that was since merged counts for the row it was merged into. */
const RESOLVED_SUPPLIER = sql`coalesce(s.merged_into, s.id)`;

/** Everything the selection needs to know about the rest of the system, read in one go. */
export async function loadSelectionContext(now: Date, executor: DbOrTx = db): Promise<SelectionContext> {
  const coolOffSince = new Date(now.getTime() - outreachConfig.coolOffDays * DAY_MS).toISOString();
  const [suppression, optedOut, linked, users, recent] = await Promise.all([
    loadSuppressionIndex(executor),
    executor.execute(sql`select distinct ${RESOLVED_SUPPLIER} as id from outreach_prospects p join suppliers s on s.id = p.supplier_id where p.status = 'opted_out'`),
    executor.execute(sql`select distinct ${RESOLVED_SUPPLIER} as id from org_supplier_links l join suppliers s on s.id = l.supplier_id`),
    executor.execute(sql`select lower(email) as email from users`),
    // Listed or written to inside the window. A prospect that was skipped before anything
    // was exported never left the tool and does not count.
    executor.execute(sql`
      select p.email_hash, ${RESOLVED_SUPPLIER} as supplier_id
      from outreach_prospects p join suppliers s on s.id = p.supplier_id
      where greatest(p.created_at, coalesce(p.exported_at, p.created_at), coalesce(p.sent_at, p.created_at)) > ${coolOffSince}::timestamptz
        and not (p.status = 'skipped' and p.exported_at is null and p.sent_at is null)
    `),
  ]);
  const userEmails = new Set<string>();
  const userDomains = new Set<string>();
  for (const row of users as unknown as Row[]) {
    const email = String(row.email);
    userEmails.add(email);
    const domain = email.slice(email.lastIndexOf("@") + 1);
    // Someone with a webmail account says nothing about who else uses that provider.
    if (domain && !isFreemailDomain(domain)) userDomains.add(domain);
  }
  const emailHashes = new Set<string>();
  const supplierIds = new Set<string>();
  for (const row of recent as unknown as Row[]) {
    if (row.email_hash) emailHashes.add(String(row.email_hash));
    supplierIds.add(String(row.supplier_id));
  }
  return {
    suppression,
    optedOutSupplierIds: new Set((optedOut as unknown as Row[]).map((row) => String(row.id))),
    linkedSupplierIds: new Set((linked as unknown as Row[]).map((row) => String(row.id))),
    userEmails,
    userDomains,
    coolOff: { emailHashes, supplierIds },
  };
}

/**
 * Candidates + context + the pure selection. No authorisation: callers check it.
 *
 * Refuses a segment that asks for named addresses while no UK representative is appointed
 * (UK GDPR Art. 27): until then only generic mailboxes may be listed, whatever the form sent.
 */
export async function buildSelection(segment: OutreachSegment, now: Date, executor: DbOrTx = db): Promise<Selection> {
  if (segment.mailbox !== "generic" && !ukRepresentativeAppointed()) {
    throw new ConflictError(`${NAMED_ADDRESSES_BLOCKED}. Until then a list can hold generic mailboxes only.`);
  }
  const [candidates, context] = await Promise.all([loadCandidates(segment, now, executor), loadSelectionContext(now, executor)]);
  return selectProspects(candidates, segment, context, now);
}

/** What the letter is rendered from, frozen when the company is listed. */
export function mergeFieldsFor(prospect: SelectedProspect): ProspectMergeFieldsJson {
  const company = displayName(prospect.supplier.name);
  return {
    company,
    companyShort: shortCompanyName(company),
    awardTitle: quotedTitle(prospect.award.title),
    buyer: displayName(prospect.award.buyerName ?? ""),
    value: letterValue(prospect.award),
    noticeDate: longDate(prospect.award.publishedAt),
    noticeId: prospect.award.releaseId,
    supplierSlug: prospect.supplier.slug,
  };
}

const LEGAL_FORM_LABELS: Record<string, string> = { ltd: "Ltd", plc: "PLC", llp: "LLP" };

/** A row of the preview table. No address: the preview shows what kind of mailbox it is, not what it is. */
export type PreviewRow = {
  supplierId: string;
  company: string;
  registeredName: string;
  slug: string;
  companyNumber: string | null;
  legalForm: string;
  town: string | null;
  award: { title: string; buyer: string; value: string | null; date: string };
  emailKind: "generic" | "named";
  contactBy: string | null;
  /** "matches" the company's website domain, or "unknown" when the notice gives no website. */
  domainCheck: "matches" | "unknown";
};

export type SegmentPreview = { rows: PreviewRow[]; summary: BuildSummary; builtAt: string };

function toPreviewRow(prospect: SelectedProspect): PreviewRow {
  const fields = mergeFieldsFor(prospect);
  return {
    supplierId: prospect.supplier.id,
    company: fields.company,
    registeredName: prospect.supplier.name,
    slug: prospect.supplier.slug,
    companyNumber: prospect.supplier.coh,
    legalForm: LEGAL_FORM_LABELS[prospect.supplier.legalForm] ?? prospect.supplier.legalForm,
    town: prospect.supplier.locality,
    award: { title: fields.awardTitle, buyer: fields.buyer, value: fields.value, date: fields.noticeDate },
    emailKind: prospect.emailKind,
    contactBy: prospect.contactBy,
    domainCheck: prospect.contact.domainMatchesWebsite === true ? "matches" : "unknown",
  };
}

/** Founder only. Reads; writes nothing. */
export async function previewSegment(segment: OutreachSegment, now: Date = new Date()): Promise<SegmentPreview> {
  await requireAdmin();
  const selection = await buildSelection(segment, now);
  return { rows: selection.prospects.map(toPreviewRow), summary: selection.summary, builtAt: now.toISOString() };
}

/** Codes that are not in use: 10 random base62 characters each (about 59 bits), checked against the table. */
async function freshRefCodes(count: number, executor: DbOrTx): Promise<string[]> {
  const codes = new Set<string>();
  for (let attempt = 0; codes.size < count; attempt += 1) {
    if (attempt > 5) throw new Error("could not generate unique outreach reference codes");
    const wanted = count - codes.size;
    const batch = new Set<string>();
    while (batch.size < wanted) {
      const code = newId(10);
      if (!codes.has(code)) batch.add(code);
    }
    const taken = await executor.select({ refCode: outreachProspects.refCode }).from(outreachProspects).where(inArray(outreachProspects.refCode, [...batch]));
    const takenCodes = new Set(taken.map((row) => row.refCode));
    for (const code of batch) if (!takenCodes.has(code)) codes.add(code);
  }
  return [...codes];
}

export type CreateCampaignInput = { name: string; segment: unknown; templateVariant: string; templateKey?: string; notes?: string | null };
export type CreatedCampaign = { campaignId: string; listed: number; summary: BuildSummary };

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Founder only. Builds the list again — the preview may be minutes old — and stores it:
 * the campaign, one prospect per company with its code, and an audit entry. One list is
 * built at a time (advisory lock), so two requests cannot both list the same address.
 */
export async function createCampaign(input: CreateCampaignInput, now: Date = new Date()): Promise<CreatedCampaign> {
  const admin = await requireAdmin();
  const parsed = segmentSchema.safeParse(input.segment);
  if (!parsed.success) throw new ValidationError("That segment is not valid. Build the preview again.", { segment: parsed.error.issues.map((issue) => issue.message) });
  const segment = parsed.data;
  const name = input.name.replace(/\s+/g, " ").trim();
  const fieldErrors: Record<string, string[]> = {};
  if (name.length < 3 || name.length > 80 || CONTROL_CHARACTERS.test(input.name)) fieldErrors.name = ["Give the campaign a name of 3 to 80 characters."];
  const templateKey = input.templateKey ?? outreachConfig.defaultTemplateKey;
  if (!isKnownTemplate(templateKey, input.templateVariant)) fieldErrors.templateVariant = ["Choose one of the subject lines."];
  const notes = input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null;
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(undefined, fieldErrors);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('outreach:create-campaign'))`);
    await syncContactSuppressions(tx);
    const selection = await buildSelection(segment, now, tx);
    if (selection.prospects.length === 0) {
      throw new ConflictError("Nobody in this segment can be listed right now. Widen the segment, or check the exclusion counts in the preview.");
    }
    const [campaign] = await tx
      .insert(outreachCampaigns)
      .values({ name, segment, templateKey, templateVariant: input.templateVariant, buildSummary: selection.summary, createdBy: admin.id, createdAt: now, notes })
      .returning({ id: outreachCampaigns.id });
    if (!campaign) throw new Error("campaign insert returned no row");

    const codes = await freshRefCodes(selection.prospects.length, tx);
    await tx.insert(outreachProspects).values(
      selection.prospects.map((prospect, index) => ({
        campaignId: campaign.id,
        supplierId: prospect.supplier.id,
        contactId: prospect.contact.id,
        email: prospect.contact.email,
        emailHash: prospect.contact.emailHash,
        emailKind: prospect.emailKind,
        refCode: codes[index]!,
        status: "listed" as const,
        eligibility: { personalData: prospect.personalData, contactBy: prospect.contactBy, reasons: [] },
        mergeFields: mergeFieldsFor(prospect),
        createdAt: now,
        updatedAt: now,
      })),
    );
    await recordOutreachAudit(
      {
        actorId: admin.id,
        action: "campaign.created",
        campaignId: campaign.id,
        count: selection.prospects.length,
        metadata: { segment: describeSegment(segment), generic: selection.summary.listedGeneric, named: selection.summary.listedNamed, templateKey, templateVariant: input.templateVariant },
      },
      tx,
    );
    return { campaignId: campaign.id, listed: selection.prospects.length, summary: selection.summary };
  });
}
