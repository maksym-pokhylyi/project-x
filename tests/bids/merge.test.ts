import { describe, expect, it } from "vitest";
import type { BriefFact, Citation } from "@/features/bids/types";
import { dedupeQuestions, dedupeRequirements, discriminators, planPatch, sameQuestion, sameRequirement, textSimilarity, type RecheckDraft } from "@/features/bids/server/pipeline/merge";
import { patchOutputSchema, type PatchOutput, type RawQuestion, type RawRequirement } from "@/features/bids/server/pipeline/schema";
import type { QuestionDraft, RequirementDraft } from "@/features/bids/server/pipeline/transform";
import { keepRequirement, mergeQuestionPass, mergeRequirementPass, reconcileFact, type ExistingQuestion, type ExistingRequirement } from "@/features/bids/server/pipeline/union";

/**
 * The union of several readings happens in code. These tests pin the rules that keep
 * recall (nothing found is lost), avoid duplicates, and never merge two different hurdles.
 */

const citation = (quote: string, verified = true): Citation => ({ fileId: "f1", fileName: "ITT.pdf", loc: "p2", page: 2, quote, verified, match: verified ? "exact" : "not_found" });

const requirement = (text: string, extra: Partial<RequirementDraft> = {}): RequirementDraft => ({
  category: "insurance",
  text,
  threshold: null,
  kind: "mandatory",
  isPassFail: false,
  evidenceToProvide: null,
  citation: citation(text),
  ...extra,
});

const existingRequirement = (id: string, text: string, extra: Partial<ExistingRequirement> = {}): ExistingRequirement => ({
  id,
  text,
  threshold: null,
  kind: "mandatory",
  isPassFail: false,
  citation: citation(text),
  evidenceToProvide: null,
  provenance: { passes: ["primary"] },
  locked: false,
  ...extra,
});

const question = (ref: string, title: string, extra: Partial<QuestionDraft> = {}): QuestionDraft => ({
  ref,
  title,
  text: `${title}. Describe your approach.`,
  section: null,
  weighting: null,
  maxScore: null,
  wordLimit: null,
  pageLimit: null,
  limitText: null,
  guidance: null,
  scored: "scored_weighted",
  citation: citation(title),
  ...extra,
});

const existingQuestion = (id: string, ref: string, title: string, extra: Partial<ExistingQuestion> = {}): ExistingQuestion => ({
  id,
  ref,
  title,
  text: `${title}. Describe your approach.`,
  weighting: null,
  maxScore: null,
  wordLimit: null,
  pageLimit: null,
  limitText: null,
  guidance: null,
  section: null,
  citation: citation(title),
  provenance: { passes: ["primary"] },
  locked: false,
  ...extra,
});

describe("sameRequirement", () => {
  const same = (a: string, b: string, ta: string | null = null, tb: string | null = null, qa: string | null = null, qb: string | null = null) =>
    sameRequirement({ requirement: a, threshold: ta, quote: qa }, { requirement: b, threshold: tb, quote: qb });

  it("matches the same requirement worded differently", () => {
    expect(same("Bidders must hold public liability insurance of at least £5 million", "Public liability insurance — minimum £5,000,000", "£5m", "£5,000,000")).toBe(true);
    expect(same("Provide two references from the last three years", "Bidders must provide 2 references within the last 3 years")).toBe(true);
    expect(same("Hold a valid CHAS accreditation", "CHAS accreditation must be held by the bidder")).toBe(true);
  });

  it("never merges different insurances, even from one sentence with one figure", () => {
    const quote = "The Contractor shall hold Public Liability and Professional Indemnity insurance of £5,000,000 each";
    expect(same("Public liability insurance of £5m", "Professional indemnity insurance of £5m", "£5m", "£5m", quote, quote)).toBe(false);
    expect(same("Employers' liability insurance £10m", "Public liability insurance £10m")).toBe(false);
  });

  it("never merges different levels or different named standards", () => {
    expect(same("Public liability insurance", "Public liability insurance", "£5m", "£10m")).toBe(false);
    expect(same("Hold ISO 9001 certification", "Hold ISO 14001 certification")).toBe(false);
    expect(same("Hold Cyber Essentials certification", "Hold Cyber Essentials Plus certification")).toBe(false);
    expect(same("Provide two references", "Provide three references")).toBe(false);
  });

  it("does not merge unrelated requirements that share a few words", () => {
    expect(same("Tenders must be submitted through the portal", "Bidders must attend the mandatory site visit")).toBe(false);
  });

  it("names what a requirement is about", () => {
    expect(discriminators("Employers' Liability insurance and ISO 9001:2015")).toEqual(["employers_liability", "std_9001"]);
    expect(discriminators("Cyber Essentials Plus")).toEqual(["cyber_essentials_plus"]);
    expect(textSimilarity("Annual audits of the accounts", "An audit of annual accounts")).toBeGreaterThan(0.9);
  });

  it("dedupes inside one list, keeping the first", () => {
    const list = [
      { requirement: "Public liability insurance of £5m", threshold: "£5m", quote: null },
      { requirement: "Hold public liability insurance (minimum £5,000,000)", threshold: null, quote: null },
      { requirement: "Professional indemnity insurance of £1m", threshold: "£1m", quote: null },
    ];
    expect(dedupeRequirements(list).map((item) => item.requirement)).toEqual(["Public liability insurance of £5m", "Professional indemnity insurance of £1m"]);
  });
});

describe("sameQuestion", () => {
  const q = (id: string, title: string, text = "", quote: string | null = null) => ({ id, title, text, quote });

  it("matches by reference, by nested reference and by title", () => {
    expect(sameQuestion(q("Q3", "Health and safety management"), q("Question 3", "Health & Safety management approach"))).toBe(true);
    expect(sameQuestion(q("3.3", "On-site welfare arrangements for employees"), q("H&S_3.3", "Arrangements for on-site welfare of employees"))).toBe(true);
    expect(sameQuestion(q("", "Risk Assessments and Method Statements"), q("Q4", "Health & Safety Q4 — Risk Assessments and Method Statements"))).toBe(true);
  });

  it("keeps different questions apart, even with the same reference in two documents", () => {
    expect(sameQuestion(q("1", "Social value commitments"), q("1", "Name of legal entity"))).toBe(false);
    expect(sameQuestion(q("Q2", "Mobilisation plan"), q("Q5", "Contract management and reporting"))).toBe(false);
  });

  it("dedupes a list", () => {
    expect(dedupeQuestions([q("Q1", "Methodology and approach"), q("1", "Methodology and approach to delivery"), q("Q2", "Social value")])).toHaveLength(2);
  });
});

describe("keepRequirement", () => {
  const draft = (text: string, extra: Partial<RequirementDraft> = {}) => requirement(text, { category: "other", ...extra });

  it("always keeps pass/fail items", () => {
    expect(keepRequirement(draft("Describe how you will manage quality", { isPassFail: true, kind: "pass_fail" }), { pass: "document", documentClass: "response_template" })).toBe(true);
  });

  it("drops questions restated as requirements, and soft items that are not about what the bidder holds", () => {
    expect(keepRequirement(draft("Describe how you will mobilise the contract"), { pass: "primary" })).toBe(false);
    expect(keepRequirement(draft("Please explain your approach to social value"), { pass: "second" })).toBe(false);
    expect(keepRequirement(draft("It would be an advantage to have local depots", { kind: "desirable" }), { pass: "primary" })).toBe(false);
    expect(keepRequirement(draft("ISO 14001 is desirable", { kind: "desirable", category: "accreditation" }), { pass: "primary" })).toBe(true);
    expect(keepRequirement(draft("Tenders must be submitted by the portal", { category: "submission" }), { pass: "primary" })).toBe(true);
  });

  it("takes nothing but pass/fail items from response templates and pricing forms", () => {
    expect(keepRequirement(draft("Complete every row of the schedule", { category: "submission" }), { pass: "document", documentClass: "pricing" })).toBe(false);
    expect(keepRequirement(draft("Sign the form of tender", { category: "submission" }), { pass: "document", documentClass: "response_template" })).toBe(false);
    expect(keepRequirement(draft("Hold employers' liability insurance", { category: "insurance" }), { pass: "document", documentClass: "questionnaire" })).toBe(true);
    expect(keepRequirement(draft("Bidders who did not attend the site visit will be rejected", { category: "submission" }), { pass: "document", documentClass: "clarifications" })).toBe(true);
  });
});

describe("mergeRequirementPass", () => {
  it("adds new items and remembers every pass that found an existing one", () => {
    const existing = [existingRequirement("a", "Public liability insurance of £5m", { threshold: "£5m" })];
    const plan = mergeRequirementPass(
      existing,
      [requirement("Hold public liability insurance (minimum £5,000,000)", { threshold: "£5,000,000" }), requirement("Professional indemnity insurance of £1m", { threshold: "£1m" })],
      "second",
    );
    expect(plan.inserts.map((item) => item.text)).toEqual(["Professional indemnity insurance of £1m"]);
    expect(plan.inserts[0]!.provenance).toEqual({ passes: ["second"] });
    expect(plan.updates).toEqual([{ id: "a", patch: { provenance: { passes: ["primary", "second"] } } }]);
  });

  it("does not insert the same new item twice from one pass", () => {
    const plan = mergeRequirementPass([], [requirement("Hold CHAS accreditation"), requirement("CHAS accreditation must be held")], "primary");
    expect(plan.inserts).toHaveLength(1);
  });

  it("lets a verified quote replace an unverified one and fills missing details", () => {
    const existing = [existingRequirement("a", "Public liability insurance", { citation: citation("made up", false) })];
    const verified = citation("Public Liability insurance of not less than £5,000,000");
    const plan = mergeRequirementPass(existing, [requirement("Public liability insurance", { threshold: "£5m", citation: verified, evidenceToProvide: "Insurance certificate" })], "second");
    expect(plan.updates[0]!.patch).toMatchObject({ citation: verified, threshold: "£5m", evidenceToProvide: "Insurance certificate" });
  });

  it("treats a pass/fail disagreement as pass/fail and says the readings differ", () => {
    const existing = [existingRequirement("a", "Hold CHAS accreditation")];
    const plan = mergeRequirementPass(existing, [requirement("CHAS accreditation must be held", { kind: "pass_fail", isPassFail: true })], "second");
    expect(plan.updates[0]!.patch).toMatchObject({ kind: "pass_fail", isPassFail: true });
    expect(plan.updates[0]!.patch.provenance.notes?.[0]).toMatch(/pass\/fail/);

    // The other way round: the row stays pass/fail, the note is still recorded.
    const strict = [existingRequirement("b", "Hold CHAS accreditation", { kind: "pass_fail", isPassFail: true })];
    const softer = mergeRequirementPass(strict, [requirement("CHAS accreditation must be held")], "second");
    expect(softer.updates[0]!.patch.isPassFail).toBeUndefined();
    expect(softer.updates[0]!.patch.provenance.notes).toHaveLength(1);
  });

  it("never changes a row a person edited (only its provenance)", () => {
    const existing = [existingRequirement("a", "Public liability insurance", { locked: true, citation: null })];
    const plan = mergeRequirementPass(existing, [requirement("Public liability insurance", { threshold: "£5m", kind: "pass_fail", isPassFail: true })], "second");
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toEqual([{ id: "a", patch: { provenance: { passes: ["primary", "second"] } } }]);
  });
});

describe("mergeQuestionPass", () => {
  it("unions questions and fills details the first reading missed", () => {
    const existing = [existingQuestion("x", "Q1", "Methodology and approach")];
    const plan = mergeQuestionPass(existing, [question("Question 1", "Methodology and approach", { weighting: 30, wordLimit: 1000, limitText: "1000 words" }), question("Q2", "Social value commitments")], "second");
    expect(plan.inserts.map((item) => item.ref)).toEqual(["Q2"]);
    expect(plan.updates[0]).toMatchObject({ id: "x", patch: { weighting: 30, wordLimit: 1000, limitText: "1000 words", provenance: { passes: ["primary", "second"] } } });
  });

  it("keeps the first value and flags the difference when readings disagree on a number", () => {
    const existing = [existingQuestion("x", "Q1", "Methodology and approach", { weighting: 30, wordLimit: 500 })];
    const plan = mergeQuestionPass(existing, [question("Q1", "Methodology and approach", { weighting: 40, wordLimit: 500 })], "second");
    expect(plan.updates[0]!.patch.weighting).toBeUndefined();
    expect(plan.updates[0]!.patch.provenance.notes).toEqual(["Readings differ on the weighting: 30 and 40 — check the documents."]);
  });

  it("leaves a locked question alone", () => {
    const existing = [existingQuestion("x", "Q1", "Methodology and approach", { locked: true })];
    const plan = mergeQuestionPass(existing, [question("Q1", "Methodology and approach", { weighting: 40 })], "document");
    expect(plan.updates[0]!.patch).toEqual({ provenance: { passes: ["primary", "document"] } });
  });
});

describe("reconcileFact (two readings of a key fact)", () => {
  const fact = (value: string | null, normalized: string | null, verified = true, status: BriefFact["status"] = "stated"): BriefFact => ({
    value,
    normalized,
    status: value === null ? "not_stated" : status,
    note: null,
    citation: value === null ? null : citation(value, verified),
  });

  it("keeps the first reading when both agree", () => {
    const first = fact("12 noon on 14 May 2027", "2027-05-14T12:00");
    expect(reconcileFact(first, fact("14/05/2027 12:00", "2027-05-14T12:00"))).toBe(first);
    expect(reconcileFact(first, null)).toBe(first);
    expect(reconcileFact(first, fact(null, null))).toBe(first);
  });

  it("prefers the reading with a time when both give the same day", () => {
    const dateOnly = fact("14 May 2027", "2027-05-14");
    const withTime = fact("12 noon on 14 May 2027", "2027-05-14T12:00");
    expect(reconcileFact(dateOnly, withTime).normalized).toBe("2027-05-14T12:00");
    expect(reconcileFact(withTime, dateOnly).normalized).toBe("2027-05-14T12:00");
  });

  it("shows both readings as conflicting when the deadlines differ", () => {
    const result = reconcileFact(fact("12 noon on 14 May 2027", "2027-05-14T12:00"), fact("5pm on 17 May 2027", "2027-05-17T17:00"));
    expect(result.status).toBe("conflicting");
    expect(result.value).toBe("12 noon on 14 May 2027");
    expect(result.alternatives).toEqual([expect.objectContaining({ value: "5pm on 17 May 2027", normalized: "2027-05-17T17:00" })]);
    expect(result.note).toMatch(/disagree/);
    // Same day, different time is a disagreement too.
    expect(reconcileFact(fact("12:00 14 May", "2027-05-14T12:00"), fact("17:00 14 May", "2027-05-14T17:00")).status).toBe("conflicting");
  });

  it("leads with the verified reading in a conflict", () => {
    const result = reconcileFact(fact("£400,000", "400000", false), fact("£450,000", "450000", true));
    expect(result).toMatchObject({ status: "conflicting", value: "£450,000" });
    expect(result.alternatives?.[0]?.value).toBe("£400,000");
  });

  it("takes a fact only the second reading found, but only with a verified quote", () => {
    const missing = fact(null, null);
    expect(reconcileFact(missing, fact("£450,000", "450000", true))).toMatchObject({ value: "£450,000", status: "stated", note: expect.stringMatching(/second reading/) });
    expect(reconcileFact(missing, fact("£450,000", "450000", false))).toBe(missing);
  });

  it("does not invent a conflict from free text or small numbers", () => {
    const first = fact("Via the Delta e-sourcing portal", null);
    expect(reconcileFact(first, fact("Upload to the portal", null))).toBe(first);
    const duration = fact("3 years", "3 years");
    expect(reconcileFact(duration, fact("36 months", "36 months"))).toBe(duration);
  });
});

describe("planPatch (the second 'what did we miss' pass)", () => {
  const rawRequirement = (text: string, extra: Partial<RawRequirement> = {}): RawRequirement => ({
    id: "",
    category: "insurance",
    requirement: text,
    threshold: null,
    kind: "pass_fail",
    evidence_to_provide: null,
    file: "ITT.pdf",
    loc: "p2",
    quote: text,
    ...extra,
  });
  const rawQuestion = (id: string, title: string): RawQuestion => ({
    id,
    title,
    text: `${title}. Describe your approach.`,
    sub_parts: [],
    section: null,
    guidance: null,
    weight_percent: null,
    max_score_points: null,
    limit_text: null,
    limit_words: null,
    limit_pages: null,
    attachments_allowed: null,
    scored: "scored_weighted",
    file: "ITT.pdf",
    loc: "p5",
    quote: title,
  });
  const draft: RecheckDraft = {
    requirements: [
      { id: "R1", category: "insurance", requirement: "Public liability insurance of £5m", threshold: "£5m", kind: "pass_fail", quote: null },
      { id: "R2", category: "experience", requirement: "Provide two references from the last three years", threshold: "2 references", kind: "mandatory", quote: null },
    ],
    questions: [{ id: "Q1", title: "Methodology and approach", text: "Describe your method.", weight_percent: 30, quote: null }],
    criteria: [{ name: "Quality" }, { name: "Price" }],
    key_dates: [{ event: "Tender deadline", date_iso: "2027-05-14" }],
    documents_to_return: [{ name: "Form of Tender" }],
    red_flags: [{ type: "tupe", description: "TUPE may apply to four operatives" }],
    minimum_thresholds: [],
  };
  const patch = (value: Partial<PatchOutput>): PatchOutput => patchOutputSchema.parse(value);

  it("accepts genuinely new items and drops additions already in the draft", () => {
    const plan = planPatch(
      draft,
      patch({
        add_requirements: [
          rawRequirement("Hold public liability insurance (minimum £5,000,000)", { threshold: "£5,000,000" }),
          rawRequirement("Professional indemnity insurance of £1m", { threshold: "£1m" }),
          rawRequirement("Professional indemnity cover of £1,000,000 is required", { threshold: "£1,000,000" }),
          rawRequirement("   "),
        ],
        add_questions: [rawQuestion("Question 1", "Methodology and approach"), rawQuestion("Q2", "Social value commitments")],
        add_criteria: [{ name: "price", weight_percent: 40, parent: null, what_is_assessed: null, file: null, loc: null, quote: null }, { name: "Social value", weight_percent: 10, parent: null, what_is_assessed: null, file: null, loc: null, quote: null }],
        add_key_dates: [
          { event: "Tender deadline", date_iso: "2027-05-14", time_24h: "12:00", file: null, loc: null, quote: null },
          { event: "Clarification deadline", date_iso: "2027-05-01", time_24h: null, file: null, loc: null, quote: null },
        ],
        add_documents_to_return: [{ name: "Form of tender", mandatory: true, format_note: null, file: null, loc: null, quote: null }],
      }),
    );
    expect(plan.addRequirements.map((item) => item.requirement)).toEqual(["Professional indemnity insurance of £1m"]);
    expect(plan.addQuestions.map((item) => item.id)).toEqual(["Q2"]);
    expect(plan.addCriteria.map((item) => item.name)).toEqual(["Social value"]);
    expect(plan.addKeyDates.map((item) => item.event)).toEqual(["Clarification deadline"]);
    expect(plan.addDocuments).toEqual([]);
    expect(plan.ignored).toMatchObject({ duplicateRequirements: 2, duplicateQuestions: 1 });
    expect(plan.ignored.duplicateOther).toBe(3);
  });

  it("applies corrections and removals only to items that exist", () => {
    const plan = planPatch(
      draft,
      patch({
        requirement_corrections: [
          { requirement_id: "r1", problem: "The level is £10m", kind: null, threshold: "£10m", file: "ITT.pdf", loc: "p2", quote: "not less than £10,000,000" },
          { requirement_id: "R9", problem: "unknown", kind: "pass_fail", threshold: null, file: null, loc: null, quote: null },
          { requirement_id: "R2", problem: "nothing to change", kind: null, threshold: null, file: null, loc: null, quote: null },
        ],
        question_corrections: [
          { question_id: "Question 1", problem: "Weighting is 40%", weight_percent: 40, max_score_points: null, limit_text: null, limit_words: null, limit_pages: null, file: "ITT.pdf", loc: "p6", quote: "Methodology 40%" },
          { question_id: "Q7", problem: "unknown", weight_percent: 10, max_score_points: null, limit_text: null, limit_words: null, limit_pages: null, file: null, loc: null, quote: null },
        ],
        removals: [
          { section: "requirements", id_or_name: "R2", reason: "Not in the pack" },
          { section: "requirements", id_or_name: "R77", reason: "Unknown" },
          { section: "questions", id_or_name: "Q1", reason: "Duplicate" },
          { section: "criteria", id_or_name: "PRICE", reason: "Not a criterion" },
          { section: "red_flags", id_or_name: "Something never listed", reason: "x" },
        ],
      }),
    );
    expect(plan.requirementUpdates).toEqual([{ id: "R1", kind: null, threshold: "£10m", cite: { file: "ITT.pdf", loc: "p2", quote: "not less than £10,000,000" }, problem: "The level is £10m" }]);
    expect(plan.questionUpdates).toEqual([expect.objectContaining({ id: "Q1", weight_percent: 40, cite: { file: "ITT.pdf", loc: "p6", quote: "Methodology 40%" } })]);
    expect(plan.removeRequirementIds).toEqual([{ id: "R2", reason: "Not in the pack" }]);
    expect(plan.removeQuestionIds).toEqual([{ id: "Q1", reason: "Duplicate" }]);
    expect(plan.removeCriteria).toEqual(["price"]);
    expect(plan.removeRedFlags).toEqual([]);
    expect(plan.ignored.unknownIds).toBe(3);
  });

  it("keeps only the last correction of a summary field", () => {
    const corrected = (value: string) => ({ value, normalized: null, status: "stated" as const, note: null, file: "ITT.pdf", loc: "p1", quote: value });
    const plan = planPatch(
      draft,
      patch({
        summary_corrections: [
          { field: "submission_deadline", problem: "first", corrected: corrected("14 May 2027") },
          { field: "submission_deadline", problem: "second", corrected: corrected("17 May 2027") },
          { field: "estimated_value", problem: "value", corrected: corrected("£450,000") },
        ],
      }),
    );
    expect(plan.summaryCorrections.map((item) => [item.field, item.problem])).toEqual([
      ["submission_deadline", "second"],
      ["estimated_value", "value"],
    ]);
  });

  it("an empty patch changes nothing", () => {
    const plan = planPatch(draft, patch({}));
    expect(plan.addRequirements).toEqual([]);
    expect(plan.requirementUpdates).toEqual([]);
    expect(plan.removeRequirementIds).toEqual([]);
    expect(plan.ignored).toEqual({ duplicateRequirements: 0, duplicateQuestions: 0, unknownIds: 0, duplicateOther: 0 });
  });
});
