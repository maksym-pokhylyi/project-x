import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./auth";

/**
 * Procurement data platform (Find a Tender, OGL v3.0) + the tenant tables of the Radar.
 *
 * SHARED tables (no organization_id): buyers, suppliers, supplier_contacts, notices, awards,
 * supplier_profiles, cpv_codes, procurement_aliases, ingest_state, ingest_runs,
 * match_reasons, page_visits, data_requests.
 * TENANT tables (organization_id, cascade on workspace deletion): org_supplier_links,
 * radar_profiles, radar_items. Read them only through src/features/procurement/radar/*,
 * which take the organization from the session.
 *
 * Ids of shared rows are deterministic text (hash of a natural key), so re-ingesting the
 * same release always addresses the same rows — see src/features/procurement/ingest/upsert.ts.
 *
 * Needs, beyond what Drizzle generates: extension pg_trgm and three trigram indexes, in
 * drizzle/extra/procurement.sql (idempotent; append it to the migration).
 */

const tz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => tz("created_at").notNull().defaultNow();
const updatedAt = () => tz("updated_at").notNull().defaultNow();
const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: "number" });
const textArray = (name: string) => text(name).array().notNull().default(sql`'{}'::text[]`);
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

// ---------------------------------------------------------------------------
// Organisations named in notices
// ---------------------------------------------------------------------------

export const buyers = pgTable(
  "buyers",
  {
    id: text("id").primaryKey(),
    /** Identity key the row was created from, e.g. "GB-PPON:PXLY-5862-RMML" or "NAME:historic england". */
    key: text("key").notNull(),
    ppon: text("ppon"),
    name: text("name").notNull(),
    nameNorm: text("name_norm").notNull(),
    slug: text("slug").notNull(),
    /** UK_CA_TYPE / TED_CA_TYPE id, e.g. publicAuthoritySubCentralGovernment. */
    buyerType: text("buyer_type"),
    /** GB-WLS | GB-NIR | GB-SCT */
    devolved: text("devolved"),
    regionCode: text("region_code"),
    /** Top-level region, e.g. UKI. */
    region: text("region"),
    locality: text("locality"),
    postcodeArea: text("postcode_area"),
    website: text("website"),
    noticesCount: integer("notices_count").notNull().default(0),
    awardsCount: integer("awards_count").notNull().default(0),
    awardsValue: money("awards_value").notNull().default(0),
    lastNoticeAt: tz("last_notice_at"),
    /** Set when this row was folded into another buyer; the page redirects there. */
    mergedInto: text("merged_into"),
    /** Release the descriptive fields were last taken from (newest wins). */
    sourceDate: tz("source_date").notNull(),
    sourceReleaseId: text("source_release_id").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("buyers_slug_key").on(t.slug), index("buyers_name_norm_idx").on(t.nameNorm), index("buyers_awards_count_idx").on(t.awardsCount)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    /** What the identity rests on: coh | ppon | register | name. Name-only suppliers never get a public page. */
    identityBasis: text("identity_basis").notNull(),
    /** Companies House number, canonical 8 characters. */
    coh: text("coh"),
    ppon: text("ppon"),
    name: text("name").notNull(),
    nameNorm: text("name_norm").notNull(),
    slug: text("slug").notNull(),
    /** sme | large */
    scale: text("scale"),
    vcse: boolean("vcse"),
    /** ltd | plc | llp | cic | company | lp | registered_society | royal_charter | charitable_incorporated | overseas | charity | public_body | unknown */
    legalForm: text("legal_form").notNull().default("unknown"),
    /** A body with legal personality as far as notices show. False = possibly a sole trader or partnership. */
    isIncorporated: boolean("is_incorporated").notNull().default(false),
    /** company_number_and_suffix | company_number | suffix | register | none */
    legalEvidence: text("legal_evidence").notNull().default("none"),
    country: text("country"),
    regionCode: text("region_code"),
    region: text("region"),
    locality: text("locality"),
    postcodeArea: text("postcode_area"),
    website: text("website"),
    // --- statistics over current awards (recomputed by ingestion) ---
    awardsCount: integer("awards_count").notNull().default(0),
    /** Sum of awards attributable to this supplier alone (shared/framework ceilings excluded). */
    totalValue: money("total_value").notNull().default(0),
    buyersCount: integer("buyers_count").notNull().default(0),
    firstAwardAt: tz("first_award_at"),
    lastAwardAt: tz("last_award_at"),
    mergedInto: text("merged_into"),
    /** Correction/removal request honoured: no page, no search result, no outreach. Never cleared by ingestion. */
    removedAt: tz("removed_at"),
    sourceDate: tz("source_date").notNull(),
    sourceReleaseId: text("source_release_id").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("suppliers_slug_key").on(t.slug),
    index("suppliers_coh_idx").on(t.coh),
    index("suppliers_name_norm_idx").on(t.nameNorm),
    index("suppliers_awards_count_idx").on(t.awardsCount),
    index("suppliers_last_award_at_idx").on(t.lastAwardAt),
  ],
);

/** Every identifier seen for an organisation -> the row it resolves to. */
export const procurementAliases = pgTable(
  "procurement_aliases",
  {
    /** supplier | buyer */
    kind: text("kind").notNull(),
    aliasKey: text("alias_key").notNull(),
    entityId: text("entity_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.aliasKey] }), index("procurement_aliases_entity_idx").on(t.entityId)],
);

/**
 * INTERNAL ONLY — never rendered on any page. Contact addresses published next to a
 * supplier in a notice, kept for the founder's outreach gate
 * (src/features/procurement/domain/outreach.ts). The contact person's NAME is not stored.
 */
export const supplierContacts = pgTable(
  "supplier_contacts",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    emailDomain: text("email_domain").notNull(),
    /** generic | named | freemail */
    kind: text("kind").notNull(),
    /** A personal name was published with the address (the name itself is discarded). */
    namePresent: boolean("name_present").notNull().default(false),
    /** The address is on the supplier's own website domain. */
    domainMatchesWebsite: boolean("domain_matches_website"),
    sourceReleaseId: text("source_release_id").notNull(),
    /** Publication date of the earliest / latest notice carrying the address. */
    firstSeenAt: tz("first_seen_at").notNull(),
    lastSeenAt: tz("last_seen_at").notNull(),
    /** When WE first stored the address: starts the one-month clock for named addresses. Never updated. */
    firstIngestedAt: tz("first_ingested_at").notNull().defaultNow(),
    suppressedAt: tz("suppressed_at"),
    /** optout | objection | bounce | removal_request | manual */
    suppressedReason: text("suppressed_reason"),
  },
  (t) => [uniqueIndex("supplier_contacts_supplier_email_key").on(t.supplierId, t.email), index("supplier_contacts_domain_idx").on(t.emailDomain)],
);

// ---------------------------------------------------------------------------
// Notices and awards
// ---------------------------------------------------------------------------

/** One row per notice version per procurement (release id + ocid). */
export const notices = pgTable(
  "notices",
  {
    /** `${ocid}:${release_id}` */
    id: text("id").primaryKey(),
    /** Find a Tender notice id, e.g. "107788-2026". */
    releaseId: text("release_id").notNull(),
    ocid: text("ocid").notNull(),
    /** planning | tender | award | contract | market */
    stage: text("stage").notNull(),
    /** UK1..UK17; null for notices under the previous regulations. */
    noticeType: text("notice_type"),
    /** PA23 | legacy */
    regime: text("regime").notNull(),
    tags: textArray("tags"),
    isUpdate: boolean("is_update").notNull().default(false),
    title: text("title").notNull(),
    description: text("description"),
    /** tender.status as published (active, complete, planned, cancelled…). */
    status: text("status"),
    buyerId: text("buyer_id").references(() => buyers.id, { onDelete: "set null" }),
    cpvMain: text("cpv_main"),
    cpvCodes: textArray("cpv_codes"),
    cpvDivisions: textArray("cpv_divisions"),
    cpvGroups: textArray("cpv_groups"),
    cpvClasses: textArray("cpv_classes"),
    cpvText: text("cpv_text"),
    /** goods | services | works */
    category: text("category"),
    /** Net of VAT when published, otherwise gross. Null = not published or a placeholder. */
    valueAmount: money("value_amount"),
    valueGross: money("value_gross"),
    currency: text("currency"),
    valuePlaceholder: boolean("value_placeholder").notNull().default(false),
    /** procurementMethodDetails as published, e.g. "Below threshold - open competition". */
    procedure: text("procedure"),
    procurementMethod: text("procurement_method"),
    /** open | limited | direct | framework | unknown */
    competition: text("competition").notNull().default("unknown"),
    aboveThreshold: boolean("above_threshold"),
    isFramework: boolean("is_framework").notNull().default(false),
    specialRegimes: textArray("special_regimes"),
    publishedAt: tz("published_at").notNull(),
    deadlineAt: tz("deadline_at"),
    enquiryDeadlineAt: tz("enquiry_deadline_at"),
    contractStart: tz("contract_start"),
    contractEnd: tz("contract_end"),
    futureNoticeAt: tz("future_notice_at"),
    engagementDeadlineAt: tz("engagement_deadline_at"),
    /** Delivery regions as published ("UKK14", "UK"). */
    regionCodes: textArray("region_codes"),
    /** Top-level regions used for matching; falls back to the buyer's region. */
    regions: textArray("regions"),
    /** delivery | buyer */
    regionSource: text("region_source"),
    /** The notice on Find a Tender. Always shown, never gated. */
    noticeUrl: text("notice_url").notNull(),
    awardCriteria: jsonb("award_criteria"),
    lots: jsonb("lots").notNull().default([]),
    lotsCount: integer("lots_count").notNull().default(0),
    smeSuitable: boolean("sme_suitable"),
    vcseSuitable: boolean("vcse_suitable"),
    bidsCount: integer("bids_count"),
    suppliersCount: integer("suppliers_count").notNull().default(0),
    /** Terminations / cancellations this notice applies to earlier awards of the ocid. */
    effects: jsonb("effects"),
    /** Newest notice of its stage for this ocid (recomputed by ingestion). */
    isLatest: boolean("is_latest").notNull().default(false),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(${notices.title}, '')), 'A') || setweight(to_tsvector('english', coalesce(${notices.cpvText}, '')), 'B') || setweight(to_tsvector('english', left(coalesce(${notices.description}, ''), 6000)), 'C')`,
    ),
    ingestedAt: tz("ingested_at").notNull().defaultNow(),
  },
  (t) => [
    index("notices_ocid_stage_idx").on(t.ocid, t.stage, t.publishedAt),
    index("notices_release_id_idx").on(t.releaseId),
    index("notices_buyer_id_idx").on(t.buyerId, t.publishedAt),
    index("notices_live_idx").on(t.deadlineAt).where(sql`${t.isLatest} and ${t.stage} = 'tender'`),
    index("notices_planning_idx").on(t.publishedAt).where(sql`${t.isLatest} and ${t.stage} = 'planning'`),
    index("notices_cpv_groups_idx").using("gin", t.cpvGroups),
    index("notices_cpv_divisions_idx").using("gin", t.cpvDivisions),
    index("notices_search_idx").using("gin", t.search),
  ],
);

/** One row per supplier per award per notice version; `is_current` marks the newest version. */
export const awards = pgTable(
  "awards",
  {
    id: text("id").primaryKey(),
    noticeId: text("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    releaseId: text("release_id").notNull(),
    ocid: text("ocid").notNull(),
    /** awards[].id / contracts[].id in the release (unique only within the ocid, and not stable across notices). */
    awardRef: text("award_ref").notNull(),
    contractRef: text("contract_ref"),
    /** Sorted related lot ids joined by ","; with ocid + supplier it identifies the award across notice versions. */
    lotKey: text("lot_key").notNull().default(""),
    lots: textArray("lots"),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").references(() => buyers.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    cpvMain: text("cpv_main"),
    cpvCodes: textArray("cpv_codes"),
    cpvDivisions: textArray("cpv_divisions"),
    cpvGroups: textArray("cpv_groups"),
    cpvClasses: textArray("cpv_classes"),
    category: text("category"),
    valueAmount: money("value_amount"),
    valueGross: money("value_gross"),
    currency: text("currency"),
    /** The figure covers several suppliers: never attributed to one of them. */
    valueShared: boolean("value_shared").notNull().default(false),
    suppliersCount: integer("suppliers_count").notNull().default(1),
    /** As published: pending | active | cancelled | unsuccessful | terminated */
    status: text("status").notNull(),
    /** After later UK11/UK12 notices of the same ocid are applied (recomputed by ingestion). */
    effectiveStatus: text("effective_status").notNull(),
    endedEarlyAt: tz("ended_early_at"),
    awardedAt: tz("awarded_at"),
    signedAt: tz("signed_at"),
    contractStart: tz("contract_start"),
    contractEnd: tz("contract_end"),
    maxExtentEnd: tz("max_extent_end"),
    hasRenewal: boolean("has_renewal"),
    procedure: text("procedure"),
    competition: text("competition").notNull().default("unknown"),
    aboveThreshold: boolean("above_threshold"),
    isFramework: boolean("is_framework").notNull().default(false),
    noticeType: text("notice_type"),
    publishedAt: tz("published_at").notNull(),
    regionCodes: textArray("region_codes"),
    regions: textArray("regions"),
    /** Newest version of this award (ocid + supplier + lots). Recomputed by ingestion. */
    isCurrent: boolean("is_current").notNull().default(false),
    search: tsvector("search").generatedAlwaysAs((): SQL => sql`to_tsvector('english', coalesce(${awards.title}, ''))`),
  },
  (t) => [
    index("awards_supplier_idx").on(t.supplierId, t.isCurrent),
    index("awards_buyer_idx").on(t.buyerId, t.isCurrent),
    index("awards_ocid_idx").on(t.ocid),
    index("awards_notice_idx").on(t.noticeId),
    index("awards_contract_end_idx").on(t.contractEnd).where(sql`${t.isCurrent}`),
    index("awards_cpv_groups_idx").using("gin", t.cpvGroups),
    index("awards_cpv_divisions_idx").using("gin", t.cpvDivisions),
    index("awards_search_idx").using("gin", t.search),
  ],
);

/** Official CPV labels as published in notices. Feeds the trade picker and match reasons. */
export const cpvCodes = pgTable("cpv_codes", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  createdAt: createdAt(),
});

/** What a supplier does, derived from its current awards (src/features/procurement/profiles). */
export const supplierProfiles = pgTable("supplier_profiles", {
  supplierId: text("supplier_id")
    .primaryKey()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  /** { "45": 0.6, "452": 0.4, "4521": 0.4, … } — recency-weighted share per CPV prefix (2–5 digits). */
  cpvWeights: jsonb("cpv_weights").$type<Record<string, number>>().notNull().default({}),
  cpvDivisions: textArray("cpv_divisions"),
  cpvGroups: textArray("cpv_groups"),
  /** [{ code, label, weight }] — top specific codes, for display. */
  topCpv: jsonb("top_cpv").$type<Array<{ code: string; label: string | null; weight: number }>>().notNull().default([]),
  keywords: textArray("keywords"),
  /** Top-level regions the supplier has delivered in (plus its home region). */
  regions: textArray("regions"),
  homeRegion: text("home_region"),
  valueLow: money("value_low"),
  valueMedian: money("value_median"),
  valueHigh: money("value_high"),
  awardsCount: integer("awards_count").notNull().default(0),
  totalValue: money("total_value").notNull().default(0),
  /** One factual sentence for page intros and metadata. */
  summary: text("summary"),
  /** { buyers: [{ id, name, awards }], competition: { direct, limited, open, framework }, … } */
  stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
  computedAt: tz("computed_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Ingestion bookkeeping
// ---------------------------------------------------------------------------

export const ingestState = pgTable("ingest_state", {
  /** "fts:incremental", "fts:backfill", "fts:pacer" */
  source: text("source").primaryKey(),
  /** Incremental: newest release date fully ingested (ISO). Backfill: start of the oldest week fully ingested. */
  cursor: text("cursor"),
  /** Next page of a window that was interrupted (links.next). */
  nextUrl: text("next_url"),
  /** Upper bound of the interrupted window. */
  windowTo: text("window_to"),
  /** Pacer: earliest time of the next request to the API. */
  nextRequestAt: tz("next_request_at"),
  /** Single-flight lease. */
  lockedUntil: tz("locked_until"),
  lastRunAt: tz("last_run_at"),
  lastSuccessAt: tz("last_success_at"),
  lastError: text("last_error"),
  stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: updatedAt(),
});

/** One summary row per ingestion run, for the admin page. */
export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    source: text("source").notNull(),
    /** incremental | backfill | seed */
    mode: text("mode").notNull(),
    /** running | ok | partial | error | skipped */
    status: text("status").notNull(),
    startedAt: tz("started_at").notNull().defaultNow(),
    finishedAt: tz("finished_at"),
    pages: integer("pages").notNull().default(0),
    releases: integer("releases").notNull().default(0),
    notices: integer("notices").notNull().default(0),
    awards: integer("awards").notNull().default(0),
    suppliersTouched: integer("suppliers_touched").notNull().default(0),
    rateLimited: integer("rate_limited").notNull().default(0),
    windowFrom: text("window_from"),
    windowTo: text("window_to"),
    error: text("error"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("ingest_runs_started_at_idx").on(t.startedAt)],
);

/** Cached one-line reasons why a notice matches a profile (LLM-written, optional). */
export const matchReasons = pgTable(
  "match_reasons",
  {
    /** "s:<supplier id>" or "r:<radar profile id>" */
    profileKey: text("profile_key").notNull(),
    ocid: text("ocid").notNull(),
    reason: text("reason").notNull(),
    model: text("model").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.profileKey, t.ocid] })],
);

/**
 * Page views of public data pages: a server-side log of the request with the optional
 * outreach reference code. Nothing about the visitor is stored — no IP, no user agent,
 * no cookie, no fingerprint.
 */
export const pageVisits = pgTable(
  "page_visits",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** supplier | buyer | tender */
    pageType: text("page_type").notNull(),
    entityId: text("entity_id").notNull(),
    /** `?r=` code from an outreach link, if any. */
    refCode: text("ref_code"),
    /** Request came from a declared crawler (derived at request time; the user agent is not kept). */
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("page_visits_entity_idx").on(t.pageType, t.entityId, t.createdAt), index("page_visits_ref_code_idx").on(t.refCode)],
);

/** "Request a correction or removal" submissions from /about-the-data. */
export const dataRequests = pgTable(
  "data_requests",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** correction | removal | other */
    kind: text("kind").notNull(),
    pageUrl: text("page_url"),
    organisationName: text("organisation_name"),
    requesterEmail: text("requester_email").notNull(),
    message: text("message").notNull(),
    /** open | done | rejected */
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: tz("resolved_at"),
  },
  (t) => [index("data_requests_status_idx").on(t.status, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Tenant tables (Radar)
// ---------------------------------------------------------------------------

/** A workspace's claim on a supplier: the source of its radar. */
export const orgSupplierLinks = pgTable(
  "org_supplier_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    /** users.id of the member who claimed (kept if the user is later deleted). */
    createdBy: text("created_by"),
    /** self_declared | email_domain (the claimant's e-mail domain matches the supplier's published domain) */
    method: text("method").notNull().default("self_declared"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("org_supplier_links_org_supplier_key").on(t.organizationId, t.supplierId), index("org_supplier_links_supplier_idx").on(t.supplierId)],
);

/** A manually described radar, for companies without published awards. */
export const radarProfiles = pgTable(
  "radar_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** CPV codes (8 digits) chosen in the trade picker. */
    cpvCodes: textArray("cpv_codes"),
    keywords: textArray("keywords"),
    /** Top-level regions, e.g. UKI; empty = anywhere in the UK. */
    regions: textArray("regions"),
    valueMin: money("value_min"),
    valueMax: money("value_max"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("radar_profiles_organization_idx").on(t.organizationId)],
);

/** Saved / dismissed state of a procurement (ocid) for a workspace. Survives notice updates. */
export const radarItems = pgTable(
  "radar_items",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ocid: text("ocid").notNull(),
    /** saved | dismissed */
    state: text("state").notNull(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.ocid] }), index("radar_items_org_state_idx").on(t.organizationId, t.state)],
);
