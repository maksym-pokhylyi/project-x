import { sql } from "drizzle-orm";
import { bigint, boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type {
  BidBrief,
  BidKeyDate,
  BidVerdict,
  Citation,
  CompanyFacts,
  DraftMeta,
  EvaluationModel,
  PackStats,
  ProcessingState,
  AnswerEvaluation,
  AnswerVersion,
  LibraryKeyFacts,
  ScoringDescriptor,
} from "@/features/bids/types";
import { organizations, users } from "./auth";

/**
 * Bid desk + evidence library tables (SPEC §3.4, §3.5).
 *
 * Every table carries `organization_id`; rows are only ever read or written through the
 * functions in src/features/bids/server and src/features/library/server, which take the
 * organization from the authenticated session (or, in background jobs, from the bid row).
 */

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const tz = (name: string) => timestamp(name, { withTimezone: true });
const orgId = () =>
  text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

/** One tender the workspace is bidding for: the uploaded pack and everything derived from it. */
export const bids = pgTable(
  "bids",
  {
    id: id(),
    organizationId: orgId(),
    /** Optional link to a procurement notice (src/features/procurement); stored as-is, no FK. */
    noticeId: text("notice_id"),
    title: text("title").notNull(),
    buyerName: text("buyer_name"),
    reference: text("reference"),
    /** draft (files being uploaded) | processing | ready | failed | archived */
    status: text("status").notNull().default("draft"),
    /** What this bid includes: brief (brief + matrix only) | full (drafting, evaluation, export). */
    accessLevel: text("access_level").notNull().default("brief"),
    /** Which allowance paid for it: free_brief | plan_brief | plan_bid | credit | simulated */
    accessSource: text("access_source"),
    /** When the allowance was taken (start of the UTC month it counts against). */
    allowancePeriodStart: tz("allowance_period_start"),
    /** reading | requirements | questions | company | done */
    processingStage: text("processing_stage"),
    /** 0–100, monotonic within one run. */
    processingProgress: integer("processing_progress").notNull().default(0),
    /** Per-step status, timings and the last error (see ProcessingState). */
    processingState: jsonb("processing_state").$type<ProcessingState>(),
    submissionDeadline: tz("submission_deadline"),
    keyDates: jsonb("key_dates").$type<BidKeyDate[]>(),
    brief: jsonb("brief").$type<BidBrief>(),
    verdict: jsonb("verdict").$type<BidVerdict>(),
    evaluationModel: jsonb("evaluation_model").$type<EvaluationModel>(),
    packStats: jsonb("pack_stats").$type<PackStats>(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    processingStartedAt: tz("processing_started_at"),
    readyAt: tz("ready_at"),
    archivedAt: tz("archived_at"),
  },
  (t) => [
    index("bids_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("bids_organization_id_status_idx").on(t.organizationId, t.status),
    index("bids_notice_id_idx").on(t.noticeId),
  ],
);

/** A file of the tender pack (or a member of an uploaded ZIP, linked through parent_file_id). */
export const bidFiles = pgTable(
  "bid_files",
  {
    id: id(),
    organizationId: orgId(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    /** Set for files expanded from an uploaded ZIP. */
    parentFileId: uuid("parent_file_id"),
    storageKey: text("storage_key").notNull(),
    /** Original file name (for ZIP members: "archive.zip/folder/name.pdf"). */
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    /** pdf | docx | xlsx | csv | txt | zip */
    kind: text("kind").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    /** Pages (PDF), sections (DOCX/TXT) or sheets (XLSX/CSV) extracted. */
    pages: integer("pages"),
    /** pending | processing | done | failed | skipped | expanded (ZIP whose members were added) */
    extractionStatus: text("extraction_status").notNull().default("pending"),
    /** Storage key of the extracted text (JSON: units with loc + text). */
    textStorageKey: text("text_storage_key"),
    /** True when most pages had no text layer (scanned document). */
    lowText: boolean("low_text").notNull().default(false),
    /** Pages transcribed by the model because they had no text layer. */
    transcribedPages: integer("transcribed_pages").notNull().default(0),
    charCount: integer("char_count").notNull().default(0),
    /** Estimated tokens of the extracted text. */
    tokenCount: integer("token_count").notNull().default(0),
    /** False when the pack was too large and this file was left out of the analysis. */
    includedInAnalysis: boolean("included_in_analysis").notNull().default(true),
    /** User-facing reason for failed / skipped, or an extraction warning. */
    error: text("error"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bid_files_bid_id_idx").on(t.bidId, t.sortOrder),
    index("bid_files_organization_id_idx").on(t.organizationId),
    uniqueIndex("bid_files_storage_key_key").on(t.storageKey),
  ],
);

/** One row of the compliance matrix: something the bidder must hold, be or confirm. */
export const bidRequirements = pgTable(
  "bid_requirements",
  {
    id: id(),
    organizationId: orgId(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    /** insurance | financial | accreditation | experience | policy | legal | other */
    category: text("category").notNull().default("other"),
    text: text("text").notNull(),
    /** Level or number, e.g. "£5,000,000". */
    threshold: text("threshold"),
    /** pass_fail | mandatory | minimum_score | desirable | information */
    kind: text("kind").notNull().default("mandatory"),
    isPassFail: boolean("is_pass_fail").notNull().default(false),
    evidenceToProvide: text("evidence_to_provide"),
    citation: jsonb("citation").$type<Citation>(),
    /** met | gap | unknown | verify */
    companyStatus: text("company_status").notNull().default("unknown"),
    /** Why the company check reached that status (AI, cautious). */
    companyNote: text("company_note"),
    /** The user's own note. */
    note: text("note"),
    userEdited: boolean("user_edited").notNull().default(false),
    /** ai | ai_recheck | user */
    source: text("source").notNull().default("ai"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bid_requirements_bid_id_idx").on(t.bidId, t.sortOrder),
    index("bid_requirements_organization_id_idx").on(t.organizationId),
  ],
);

/** A scored question / response section of the tender, with the workspace's draft answer. */
export const bidQuestions = pgTable(
  "bid_questions",
  {
    id: id(),
    organizationId: orgId(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    /** Reference as printed in the pack ("Q3", "A02", "4.2"). */
    ref: text("ref").notNull().default(""),
    title: text("title"),
    text: text("text").notNull(),
    section: text("section"),
    /** Percentage weighting, when stated. */
    weighting: numeric("weighting", { precision: 6, scale: 2, mode: "number" }),
    maxScore: numeric("max_score", { precision: 8, scale: 2, mode: "number" }),
    wordLimit: integer("word_limit"),
    pageLimit: numeric("page_limit", { precision: 5, scale: 1, mode: "number" }),
    /** The limit exactly as stated in the pack. */
    limitText: text("limit_text"),
    guidance: text("guidance"),
    /** scored_weighted | scored_unweighted | pass_fail | information_only | unclear */
    scored: text("scored").notNull().default("unclear"),
    /** Question-specific scoring descriptors; null = use the bid's evaluation model. */
    scoringDescriptors: jsonb("scoring_descriptors").$type<ScoringDescriptor[]>(),
    citation: jsonb("citation").$type<Citation>(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** not_started | draft | reviewed | final */
    status: text("status").notNull().default("not_started"),
    draftText: text("draft_text"),
    draftMeta: jsonb("draft_meta").$type<DraftMeta>(),
    evaluation: jsonb("evaluation").$type<AnswerEvaluation>(),
    /** Minimal history: the last few versions of the answer, newest first. */
    versions: jsonb("versions").$type<AnswerVersion[]>().notNull().default([]),
    userEdited: boolean("user_edited").notNull().default(false),
    /** ai | ai_recheck | user */
    source: text("source").notNull().default("ai"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bid_questions_bid_id_idx").on(t.bidId, t.sortOrder),
    index("bid_questions_organization_id_idx").on(t.organizationId),
  ],
);

/** Evidence library: the workspace's own documents that drafts are grounded in. */
export const libraryDocs = pgTable(
  "library_docs",
  {
    id: id(),
    organizationId: orgId(),
    /** policy | case_study | past_bid | cv | certificate | other */
    kind: text("kind").notNull().default("other"),
    title: text("title").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    /** Storage key of the extracted text (JSON units, same format as bid files). */
    textStorageKey: text("text_storage_key"),
    summary: text("summary"),
    keyFacts: jsonb("key_facts").$type<LibraryKeyFacts>(),
    expiresAt: date("expires_at", { mode: "string" }),
    /** processing | ready | failed */
    status: text("status").notNull().default("processing"),
    error: text("error"),
    tokenCount: integer("token_count").notNull().default(0),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("library_docs_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    uniqueIndex("library_docs_storage_key_key").on(t.storageKey),
  ],
);

/** One row per workspace: structured facts about the company, confirmed by a person. */
export const companyFacts = pgTable("company_facts", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  /** The facts drafts and company checks may rely on once `confirmed_at` is set. */
  facts: jsonb("facts").$type<CompanyFacts>().notNull().default({}),
  /** Auto-drafted facts awaiting confirmation; never used by drafting or checks. */
  draft: jsonb("draft").$type<CompanyFacts>(),
  /** Where the draft came from (URL, pages read, when). */
  draftSource: jsonb("draft_source").$type<{ url: string; pages: string[]; generatedAt: string; notes: string[] }>(),
  confirmedAt: tz("confirmed_at"),
  confirmedBy: text("confirmed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * One-off allowances: a Bid Pass (one full bid on any plan) or the single free brief every
 * workspace gets. A row is consumed exactly once, by one bid.
 */
export const bidCredits = pgTable(
  "bid_credits",
  {
    id: id(),
    organizationId: orgId(),
    /** bid_pass | free_brief */
    kind: text("kind").notNull().default("bid_pass"),
    /** Where it came from: "paddle", "admin", "signup", … */
    source: text("source").notNull().default("admin"),
    /** Idempotency key of the grant (e.g. the Paddle transaction id). */
    externalRef: text("external_ref"),
    grantedAt: tz("granted_at").notNull().defaultNow(),
    expiresAt: tz("expires_at"),
    consumedAt: tz("consumed_at"),
    consumedBidId: uuid("consumed_bid_id").references(() => bids.id, { onDelete: "set null" }),
  },
  (t) => [
    index("bid_credits_organization_id_idx").on(t.organizationId, t.consumedAt),
    uniqueIndex("bid_credits_external_ref_key").on(t.externalRef),
    // At most one free brief per workspace, ever.
    uniqueIndex("bid_credits_free_brief_key").on(t.organizationId).where(sql`${t.kind} = 'free_brief'`),
  ],
);
