/**
 * Shared, client-safe types of the bid desk and the evidence library.
 * (No server imports here: this file is used by the database schema, server code and UI.)
 */

// --- Citations --------------------------------------------------------------------------

export type CitationMatch =
  /** Quote found verbatim (after whitespace/punctuation normalisation) at the cited location. */
  | "exact"
  /** Most of the quote found at the cited location (OCR noise, table flattening). */
  | "fuzzy"
  /** Quote found, but on another page of the same file: the location was corrected. */
  | "relocated"
  /** Quote found, but in another file of the pack: file and location were corrected. */
  | "relocated_file"
  /** The quote could not be found anywhere in the pack. */
  | "not_found"
  /** The item carries no quote at all. */
  | "none";

export type Citation = {
  /** bid_files.id, or null when the cited file name matches no file of the pack. */
  fileId: string | null;
  fileName: string;
  /** Location marker: "p12" (page), "s3" (section of a Word/text file) or "sheet:Pricing". */
  loc: string;
  /** Page number for PDFs (for "Open source page"); null for sections and sheets. */
  page: number | null;
  quote: string;
  /** True only when a programmatic check found the quote in the extracted text. */
  verified: boolean;
  match: CitationMatch;
  /** Set when the quote was found but a stated figure is not in the source text. */
  issue?: "figure_not_in_source";
};

// --- Brief ------------------------------------------------------------------------------

export const SUMMARY_FIELDS = [
  "buyer",
  "title",
  "reference",
  "procedure_type",
  "lots",
  "estimated_value",
  "contract_start",
  "contract_duration",
  "extensions",
  "submission_deadline",
  "clarification_deadline",
  "submission_method",
  "tender_validity",
] as const;
export type SummaryField = (typeof SUMMARY_FIELDS)[number];

export const SUMMARY_FIELD_LABELS: Record<SummaryField, string> = {
  buyer: "Buyer",
  title: "Title",
  reference: "Reference",
  procedure_type: "Procedure",
  lots: "Lots",
  estimated_value: "Estimated value",
  contract_start: "Contract start",
  contract_duration: "Contract length",
  extensions: "Extension options",
  submission_deadline: "Submission deadline",
  clarification_deadline: "Clarification deadline",
  submission_method: "How to submit",
  tender_validity: "Tender validity",
};

export type FactStatus = "stated" | "not_stated" | "ambiguous" | "conflicting";

export type BriefFact = {
  value: string | null;
  normalized: string | null;
  status: FactStatus;
  note: string | null;
  citation: Citation | null;
  /** Other readings of the same fact when two extraction passes disagree. */
  alternatives?: Array<{ value: string | null; normalized: string | null; citation: Citation | null }>;
};

/** Which extraction passes found an item, and where they differed. */
export type Provenance = {
  /** "primary", "second", "document", "recheck". Two or more = found independently. */
  passes: string[];
  /** Readings that differed between passes (e.g. "weighting 20 vs 25"). */
  notes?: string[];
};

/** Key facts a person has confirmed against the documents: field -> ISO time. */
export type BidReview = { facts?: Partial<Record<SummaryField, string>> };

export type RedFlagType =
  | "tupe"
  | "liability_indemnity"
  | "payment_terms"
  | "timescale"
  | "contradiction_in_documents"
  | "funding_or_award_condition"
  | "ip_ownership"
  | "termination"
  | "insurance_level"
  | "pricing_risk"
  | "eligibility_risk"
  | "other";

export const RED_FLAG_LABELS: Record<RedFlagType, string> = {
  tupe: "TUPE",
  liability_indemnity: "Liability and indemnities",
  payment_terms: "Payment terms",
  timescale: "Timescale",
  contradiction_in_documents: "Contradiction in the documents",
  funding_or_award_condition: "Funding or award condition",
  ip_ownership: "Intellectual property",
  termination: "Termination",
  insurance_level: "Insurance level",
  pricing_risk: "Pricing risk",
  eligibility_risk: "Eligibility risk",
  other: "Other",
};

export type BidBrief = {
  /** Two or three plain sentences: what is being bought, by whom, and the main hurdle. */
  overview: string | null;
  summary: Record<SummaryField, BriefFact>;
  documentsToReturn: Array<{ name: string; mandatory: boolean | null; formatNote: string | null; citation: Citation | null }>;
  redFlags: Array<{ type: RedFlagType; description: string; severity: "high" | "medium" | "low"; citation: Citation | null }>;
  unknowns: Array<{ item: string; whyItMatters: string }>;
  generatedAt: string;
};

export type BidKeyDate = {
  event: string;
  /** YYYY-MM-DD, when the pack states a date. */
  dateIso: string | null;
  /** HH:MM (24h, UK local time), when stated. */
  time: string | null;
  citation: Citation | null;
};

export type ScoringDescriptor = { score: string; label: string | null; descriptor: string | null; citation?: Citation | null };

export type EvaluationModel = {
  priceWeight: number | null;
  qualityWeight: number | null;
  socialValueWeight: number | null;
  weightsNote: string | null;
  criteria: Array<{ name: string; weight: number | null; parent: string | null; whatIsAssessed: string | null; citation: Citation | null }>;
  /** The pack's own scoring scale; empty when the pack does not state one. */
  scoringScale: ScoringDescriptor[];
  minimumThresholds: Array<{ description: string; citation: Citation | null }>;
  priceScoringMethod: BriefFact | null;
};

// --- Company check ----------------------------------------------------------------------

export const VERDICTS = ["looks_biddable", "biddable_with_gaps", "likely_not_eligible", "not_enough_information"] as const;
export type VerdictKey = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<VerdictKey, string> = {
  looks_biddable: "Looks biddable",
  biddable_with_gaps: "Biddable with gaps",
  likely_not_eligible: "Likely not eligible",
  not_enough_information: "Not enough information",
};

export type BidVerdict = {
  verdict: VerdictKey;
  /** Short, specific reasons (each names the requirement it is about). */
  reasons: string[];
  counts: { requirements: number; passFail: number; gating: number; met: number; gap: number; unknown: number; verify: number };
  /** What this check cannot judge — always shown next to the verdict. */
  notAssessed: string[];
  /** False when the company facts had not been confirmed by a person at check time. */
  factsConfirmed: boolean;
  generatedAt: string;
};

export const COMPANY_STATUSES = ["met", "gap", "unknown", "verify"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const REQUIREMENT_CATEGORIES = ["insurance", "financial", "accreditation", "experience", "policy", "legal", "other"] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const REQUIREMENT_CATEGORY_LABELS: Record<RequirementCategory, string> = {
  insurance: "Insurance",
  financial: "Financial standing",
  accreditation: "Accreditations and certifications",
  experience: "Experience and references",
  policy: "Policies",
  legal: "Legal and declarations",
  other: "Other requirements",
};

export const REQUIREMENT_KINDS = ["pass_fail", "mandatory", "minimum_score", "desirable", "information"] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const REQUIREMENT_KIND_LABELS: Record<RequirementKind, string> = {
  pass_fail: "Pass/fail",
  mandatory: "Mandatory",
  minimum_score: "Minimum score",
  desirable: "Desirable",
  information: "For information",
};

// --- Questions, drafts, evaluation ------------------------------------------------------

export const QUESTION_STATUSES = ["not_started", "draft", "reviewed", "final"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  reviewed: "Reviewed",
  final: "Final",
};

/** A source the draft relied on: company facts or a library document. */
export type EvidenceRef = {
  /** Marker used in the draft text, e.g. "E1". */
  marker: string;
  source: "company_facts" | "library_doc";
  /** library_docs.id for documents. */
  docId: string | null;
  title: string;
  /** What the source supports (short). */
  supports: string;
};

export type DraftMeta = {
  evidenceRefs: EvidenceRef[];
  /** `[EVIDENCE NEEDED: …]` items found in the draft text. */
  evidenceGaps: string[];
  /** Claims a programmatic or model check could not tie to supplied evidence. */
  flaggedClaims: Array<{ claim: string; reason: string }>;
  /** Sub-parts of the question the draft does not answer. */
  unansweredParts: string[];
  wordCount: number;
  /** True when the model's draft had to be shortened to respect the limit. */
  trimmedToLimit: boolean;
  instructions: string | null;
  model: string;
  generatedAt: string;
  /** ai_draft | ai_revision */
  origin: "ai_draft" | "ai_revision";
  /** Set once a person has edited the AI text by hand. */
  editedAt?: string;
};

export type EvaluationImprovement = {
  /** What to change, concretely. */
  suggestion: string;
  /** Why it would gain marks, tied to the scoring descriptors. */
  rationale: string;
  /** Rough marks impact: high | medium | low. */
  impact: "high" | "medium" | "low";
  /** True when acting on it needs evidence the library does not hold. */
  needsEvidence: boolean;
};

export type AnswerEvaluation = {
  /** Score on the scale used, e.g. "3". */
  score: string;
  /** Top of the scale, e.g. "5". */
  maxScore: string;
  /** Label of the score band, e.g. "Good". */
  band: string | null;
  /** pack = the tender's own descriptors; default = generic 0–5 public-sector scale. */
  scale: "pack" | "default";
  rationale: string;
  strengths: string[];
  /** Ordered by likely marks gained, most valuable first. */
  improvements: EvaluationImprovement[];
  /** Sub-parts of the question that are not answered. */
  missingParts: string[];
  overWordLimit: boolean;
  wordCount: number;
  /** Hash of the answer text that was evaluated (to show "answer changed since"). */
  answerHash: string;
  model: string;
  evaluatedAt: string;
};

export type AnswerVersion = {
  id: string;
  text: string;
  /** ai_draft | ai_revision | user */
  source: "ai_draft" | "ai_revision" | "user";
  note: string | null;
  wordCount: number;
  createdAt: string;
};

// --- Company facts and library ----------------------------------------------------------

export const TURNOVER_BANDS = ["under_100k", "100k_250k", "250k_500k", "500k_1m", "1m_2m", "2m_5m", "5m_10m", "10m_25m", "25m_plus"] as const;
export type TurnoverBand = (typeof TURNOVER_BANDS)[number];

export const TURNOVER_BAND_LABELS: Record<TurnoverBand, string> = {
  under_100k: "Under £100k",
  "100k_250k": "£100k – £250k",
  "250k_500k": "£250k – £500k",
  "500k_1m": "£500k – £1m",
  "1m_2m": "£1m – £2m",
  "2m_5m": "£2m – £5m",
  "5m_10m": "£5m – £10m",
  "10m_25m": "£10m – £25m",
  "25m_plus": "£25m or more",
};

/** [min, max) annual turnover in GBP for each band (max = null means open-ended). */
export const TURNOVER_BAND_RANGES: Record<TurnoverBand, [number, number | null]> = {
  under_100k: [0, 100_000],
  "100k_250k": [100_000, 250_000],
  "250k_500k": [250_000, 500_000],
  "500k_1m": [500_000, 1_000_000],
  "1m_2m": [1_000_000, 2_000_000],
  "2m_5m": [2_000_000, 5_000_000],
  "5m_10m": [5_000_000, 10_000_000],
  "10m_25m": [10_000_000, 25_000_000],
  "25m_plus": [25_000_000, null],
};

export type InsuranceCover = {
  /** Level of cover in GBP; null when not held / not known. */
  amountGbp: number | null;
  /** YYYY-MM-DD renewal date, when known. */
  expiresAt: string | null;
};

export type Accreditation = {
  name: string;
  reference: string | null;
  /** YYYY-MM-DD, when the certificate expires. */
  expiresAt: string | null;
};

export type CompanyFacts = {
  legalName?: string | null;
  tradingName?: string | null;
  companyNumber?: string | null;
  website?: string | null;
  turnoverBand?: TurnoverBand | null;
  employees?: number | null;
  yearsTrading?: number | null;
  insurance?: {
    publicLiability?: InsuranceCover | null;
    employersLiability?: InsuranceCover | null;
    professionalIndemnity?: InsuranceCover | null;
  };
  accreditations?: Accreditation[];
  sectors?: string[];
  regions?: string[];
  /** Policies the company holds (names), e.g. "Health and Safety Policy". */
  policies?: string[];
  /** Anything else worth knowing, in the company's own words. */
  notes?: string | null;
};

export const LIBRARY_DOC_KINDS = ["policy", "case_study", "past_bid", "cv", "certificate", "other"] as const;
export type LibraryDocKind = (typeof LIBRARY_DOC_KINDS)[number];

export const LIBRARY_DOC_KIND_LABELS: Record<LibraryDocKind, string> = {
  policy: "Policy",
  case_study: "Case study",
  past_bid: "Past bid",
  cv: "CV",
  certificate: "Certificate",
  other: "Other",
};

export type LibraryKeyFacts = {
  /** Short factual statements the document supports (names, dates, numbers). */
  facts: string[];
  /** Issuer / client / subject, when the document names one. */
  parties: string[];
  /** Dates the document carries (issue, expiry, project dates). */
  dates: Array<{ label: string; date: string }>;
};

// --- Processing -------------------------------------------------------------------------

/** Stages shown to the user, in order. */
export const PROCESSING_STAGES = ["reading", "requirements", "questions", "company"] as const;
export type ProcessingStage = (typeof PROCESSING_STAGES)[number];

export const PROCESSING_STAGE_LABELS: Record<ProcessingStage, string> = {
  reading: "Reading files",
  requirements: "Finding requirements",
  questions: "Listing questions",
  company: "Checking against your company",
};

/** Resumable units of work behind the stages. */
export const PIPELINE_STEPS = ["extract", "overview", "requirements", "questions", "documents", "recheck", "company", "finalise"] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export const STEP_STAGE: Record<PipelineStep, ProcessingStage> = {
  extract: "reading",
  overview: "requirements",
  requirements: "requirements",
  questions: "questions",
  documents: "questions",
  recheck: "questions",
  company: "company",
  finalise: "company",
};

export type StepState = {
  status: "pending" | "running" | "done" | "failed";
  startedAt?: string;
  finishedAt?: string;
  attempts?: number;
  /** Model that ran the step and what it used. */
  model?: string;
  usage?: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  /** Extraction passes of this step that completed / did not complete. */
  passes?: string[];
  failedPasses?: string[];
  /** User-facing message for a failed step (or a warning on a finished one). */
  error?: string;
};

export type ProcessingState = {
  /** Changes on every (re)start so stale jobs of an older run stop quietly. */
  runId: string;
  steps: Partial<Record<PipelineStep, StepState>>;
  /** Set when the run stopped: which step failed and why. */
  failure?: { step: PipelineStep; stage: ProcessingStage; message: string; at: string; retryable: boolean };
};

export type PackStats = {
  files: number;
  /** Pages + sections + sheets read. */
  pages: number;
  chars: number;
  tokens: number;
  transcribedPages: number;
  /** Files that look scanned (little or no text layer). */
  lowTextFiles: string[];
  /** Files left out of the analysis because the pack exceeded the size cap. */
  excludedFiles: string[];
  /** Files that could not be read at all. */
  failedFiles: string[];
  warnings: string[];
  usage: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  /** Model that ran each pipeline step (gateway ids), for later comparison. */
  models: Record<string, string>;
  /** Seconds from start of processing to "ready". */
  durationSeconds: number | null;
  /** Citation check: how many cited items carried a quote found in the pack. */
  citations: { total: number; verified: number };
  /** Honest coverage: what was read, by which passes, and what nothing was extracted from. */
  coverage?: {
    /** Extraction passes that completed ("primary", "second", "document: <file>", "recheck"). */
    passes: string[];
    /** Passes that did not complete. */
    failedPasses: string[];
    /** Readable files from which no requirement, question or brief item was extracted. */
    silentFiles: string[];
    /** Per file: pages/sections read and items citing it. */
    files: Array<{ name: string; pages: number; tokens: number; items: number; status: string; note: string | null }>;
  };
};
