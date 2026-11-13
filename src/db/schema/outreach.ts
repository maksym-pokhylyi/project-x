import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { supplierContacts, suppliers } from "./procurement";

/**
 * Founder outreach tooling (docs/product/SPEC.md §3.7): the suppression list, campaigns
 * built in /admin/outreach, the prospects listed in them and an audit trail.
 *
 * FOUNDER-ONLY tables: no organization_id, never part of a workspace export. Read and write
 * them only through src/features/outreach/server/*, whose admin functions start with
 * requireAdmin(). Prospect rows are personal data (docs/research/round2/P2 §2): addresses
 * never go to logs, analytics events, error messages or the audit table below.
 *
 * The app NEVER sends these letters. A campaign is a list the founder exports and sends
 * from his own mailbox; `sent_at` is what he records afterwards.
 */

const tz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => tz("created_at").notNull().defaultNow();

export type SuppressionReason = "optout" | "bounce" | "complaint" | "manual" | "data_request";

/**
 * The do-not-contact list, and the SOURCE OF TRUTH for it: an address, or a whole domain.
 * Checked when a list is built and again when it is exported. Never purged — it is the
 * minimum we must keep so that we do not write to someone again.
 *
 * `supplier_contacts.suppressed_at` is only a copy of this table for the legal gate
 * (src/features/procurement/domain/outreach.ts); the builder joins on this table, so an
 * address that re-appears in a later notice as a new contact row stays suppressed.
 */
export const suppressions = pgTable(
  "suppressions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** Lower-cased address. Exactly one of `email` and `domain` is set. */
    email: text("email"),
    /** Lower-cased bare domain ("example.co.uk"): covers every address on it and on its subdomains. */
    domain: text("domain"),
    /** optout | bounce | complaint | manual | data_request */
    reason: text("reason").$type<SuppressionReason>().notNull(),
    /** Where the entry came from: optout_link | optout_form | admin | bounce_import */
    source: text("source").notNull(),
    /** Free text for the founder. Never shown outside /admin. */
    note: text("note"),
    /** users.id of the founder who added it; null for a recipient's own opt-out. */
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("suppressions_email_key").on(t.email),
    uniqueIndex("suppressions_domain_key").on(t.domain),
    check("suppressions_target_check", sql`(${t.email} is null) <> (${t.domain} is null)`),
    check("suppressions_lowercase_check", sql`${t.email} = lower(${t.email}) and ${t.domain} = lower(${t.domain})`),
  ],
);

/** What the builder was asked for. Validated by `segmentSchema` (src/features/outreach/domain/segment.ts). */
export type OutreachSegmentJson = {
  cpvDivisions: string[];
  cpvGroups: string[];
  regions: string[];
  publishedWithinDays: number;
  valueMin: number | null;
  valueMax: number | null;
  mailbox: "generic" | "generic_and_named";
  smeOnly: boolean;
  batchSize: number;
};

/** Numbers frozen when the list was built: how many addresses were considered and why the rest were left out. */
export type OutreachBuildSummaryJson = {
  companiesMatched: number;
  companiesWithoutAddress: number;
  addressesConsidered: number;
  excluded: Record<string, number>;
  notEligibleByReason: Record<string, number>;
  eligibleCompanies: number;
  listed: number;
  listedGeneric: number;
  listedNamed: number;
};

/** One list built from a segment. Nothing is stored until the founder presses "Create campaign". */
export const outreachCampaigns = pgTable(
  "outreach_campaigns",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    segment: jsonb("segment").$type<OutreachSegmentJson>().notNull(),
    /** Letter family from src/features/outreach/domain/letter.ts, e.g. "award_page_v1". */
    templateKey: text("template_key").notNull(),
    /** Subject line of that family, e.g. "s1". Two campaigns with different variants make a split test. */
    templateVariant: text("template_variant").notNull(),
    buildSummary: jsonb("build_summary").$type<OutreachBuildSummaryJson>().notNull(),
    /** users.id of the founder (kept if the account is later deleted). */
    createdBy: text("created_by"),
    createdAt: createdAt(),
    /** Last CSV export of the first letter. */
    exportedAt: tz("exported_at"),
    notes: text("notes"),
  },
  (t) => [index("outreach_campaigns_created_at_idx").on(t.createdAt)],
);

export type ProspectStatus = "listed" | "exported" | "sent" | "opted_out" | "skipped";

/** What the legal gate said when the address was listed (see `outreachEligibility`). */
export type ProspectEligibilityJson = {
  /** The address identifies a person: UK GDPR duties apply (Art. 14 wording, one-month rule). */
  personalData: boolean;
  /** For such addresses: last day a first contact is allowed (ISO). */
  contactBy: string | null;
  /** Always empty for a listed prospect; kept as proof that the gate ran. */
  reasons: string[];
};

/** What the letter is rendered from: the award that put the company in the segment. */
export type ProspectMergeFieldsJson = {
  company: string;
  companyShort: string;
  awardTitle: string;
  buyer: string;
  /** "£175,000 including VAT", "£370,000", or null when the notice gives no figure that is this supplier's alone. */
  value: string | null;
  /** "3 November 2026" */
  noticeDate: string;
  /** Find a Tender notice id, e.g. "103985-2026": the source of the address. */
  noticeId: string;
  supplierSlug: string;
};

/** One company on one list, with the address the letter goes to. */
export const outreachProspects = pgTable(
  "outreach_prospects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    /** No cascade: a supplier that was written to cannot be deleted without deciding what happens to the record. */
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    contactId: text("contact_id").references(() => supplierContacts.id, { onDelete: "set null" }),
    /** Lower-cased. Erased (null) by retention; see src/config/retention.ts. */
    email: text("email"),
    /** SHA-256 of the lower-cased address: lets the cool-off rule recognise an address after it was erased. */
    emailHash: text("email_hash"),
    /** generic | named — kept after erasure so the two can still be compared. */
    emailKind: text("email_kind").$type<"generic" | "named">().notNull(),
    /** `?r=` code of the personal link and `?c=` code of the opt-out link: 10 characters, base62, random. */
    refCode: text("ref_code").notNull(),
    /** listed | exported | sent | opted_out | skipped */
    status: text("status").$type<ProspectStatus>().notNull().default("listed"),
    /** Why a prospect was skipped: suppressed | contact_window_expired */
    skippedReason: text("skipped_reason"),
    eligibility: jsonb("eligibility").$type<ProspectEligibilityJson>().notNull(),
    /** Erased (null) together with the address. */
    mergeFields: jsonb("merge_fields").$type<ProspectMergeFieldsJson>(),
    createdAt: createdAt(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
    /** First CSV export that contained this prospect. */
    exportedAt: tz("exported_at"),
    /** The day the founder sent the first letter: the legal record of first contact. Set by "Mark as sent". */
    sentAt: tz("sent_at"),
    optedOutAt: tz("opted_out_at"),
    /** When retention erased the address and merge fields. */
    erasedAt: tz("erased_at"),
  },
  (t) => [
    uniqueIndex("outreach_prospects_ref_code_key").on(t.refCode),
    // One prospect per company and one use of an address per campaign, whatever the builder does.
    uniqueIndex("outreach_prospects_campaign_supplier_key").on(t.campaignId, t.supplierId),
    uniqueIndex("outreach_prospects_campaign_email_key").on(t.campaignId, t.email),
    index("outreach_prospects_email_hash_idx").on(t.emailHash),
    index("outreach_prospects_email_idx").on(t.email),
    index("outreach_prospects_supplier_idx").on(t.supplierId),
    index("outreach_prospects_campaign_status_idx").on(t.campaignId, t.status),
  ],
);

/**
 * Who did what to the lists and the suppression list, and how many rows it covered.
 * `metadata` holds small non-personal details (reasons, counts, a domain) — NEVER an e-mail
 * address: an address that had to be forgotten must not survive here.
 */
export const outreachAudit = pgTable(
  "outreach_audit",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** users.id of the founder; null for something a recipient did on /optout. */
    actorId: text("actor_id"),
    /** campaign.created | campaign.exported | campaign.marked_sent | campaign.discarded | suppression.added | suppression.imported | suppression.removed | suppression.exported | data_request.resolved */
    action: text("action").notNull(),
    /** Not a foreign key: the entry outlives a discarded campaign. */
    campaignId: uuid("campaign_id"),
    /** Rows the action covered. */
    count: integer("count").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("outreach_audit_created_at_idx").on(t.createdAt), index("outreach_audit_campaign_idx").on(t.campaignId)],
);
