import { eq } from "drizzle-orm";
import { unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { aiUsage, bidQuestions, bids, events } from "@/db/schema";
import { answerHash } from "@/features/bids/answer-text";
import { countWords } from "@/features/bids/constants";
import * as bidsApi from "@/features/bids/server/bids";
import { applySuggestions, draftAnswer, evaluateAnswer, matchScaleRow, DEFAULT_SCALE, restoreVersion, saveAnswer } from "@/features/bids/server/drafting";
import { csvField, exportAnswersDocx, exportBriefDocx, exportRequirementsCsv, exportRequirementsDocx } from "@/features/bids/server/export";
import type { CompanyFacts, EvaluationModel } from "@/features/bids/types";
import { ConflictError, ValidationError } from "@/lib/errors";
import { createTestUser, type TestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { addLibraryDoc, confirmFacts, createBidWithFiles, installMockModel, scopeOf, taskOf, type MockCall, type Scope } from "./helpers";

/**
 * Grounded drafting and evaluator-style marking with a scripted model. What matters here
 * is what the CODE guarantees whatever the model writes: evidence only from confirmed
 * facts and library documents, gaps marked, the word limit enforced, unsupported claims
 * flagged, scores only from the scale, and a person's text never lost.
 */

const FACTS = {
  legalName: "Example Facilities Ltd",
  employees: 42,
  insurance: { publicLiability: { amountGbp: 5_000_000, expiresAt: "2028-03-31" }, employersLiability: { amountGbp: null, expiresAt: null }, professionalIndemnity: { amountGbp: null, expiresAt: null } },
  accreditations: [{ name: "ISO 9001:2015", reference: null, expiresAt: "2028-05-01" }],
} as CompanyFacts;

const CASE_STUDY = "Case study: Riverside Borough parks contract.\nExample Facilities Ltd maintained 31 parks for Riverside Borough Council from April 2023 to March 2026. Contract value £412,000 a year. 98.4% of scheduled visits were completed on time in 2025.";

const DRAFT =
  "Our approach\n\nExample Facilities Ltd employs 42 people [E1] and holds ISO 9001:2015 [E1]. We maintained 31 parks for Riverside Borough Council, completing 98.4% of scheduled visits on time in 2025 [E2].\n\n" +
  "We have never missed a deadline in 20 years of trading. Our annual turnover is £9,999,999 [E7].\n\n[EVIDENCE_NEEDED - named contract manager and their qualification]\n\nWord count: 61";

let user: TestUser;
let scope: Scope;
let mock: ReturnType<typeof installMockModel> | null = null;
let bidId: string;
let questionId: string;

const words = (n: number, word = "word") => Array.from({ length: n }, (_, index) => `${word}${index + 1}`).join(" ");

function respond(overrides: Partial<Record<ReturnType<typeof taskOf>, (call: MockCall) => string>> = {}) {
  return (call: MockCall): string => {
    const task = taskOf(call.prompt);
    if (overrides[task]) return overrides[task]!(call);
    if (task === "summary") return JSON.stringify({ summary: "A case study of a parks contract.", kind: "case_study", facts: ["31 parks for Riverside Borough Council, £412,000 a year"], parties: ["Riverside Borough Council"], dates: [], expires_at: null });
    if (task === "draft") return DRAFT;
    if (task === "claims") return JSON.stringify({ unsupported: [{ claim: "We have never missed a deadline in 20 years of trading.", reason: "The library says nothing about deadlines or years trading." }], unanswered_parts: ["Who will manage the contract"] });
    if (task === "evaluate") {
      return JSON.stringify({
        score: "3 - Satisfactory",
        band: "whatever the model says",
        rationale: "Addresses the question with some evidence.",
        parts: [{ part: "Approach", status: "covered", note: "Evidenced." }, { part: "Contract manager", status: "missing", note: "Not named." }],
        strengths: ["Measured results from a comparable contract."],
        improvements: [
          { suggestion: "Tidy the headings", rationale: "Minor.", impact: "low", needs_evidence: false },
          { suggestion: "Name the contract manager", rationale: "The descriptors reward named, qualified people.", impact: "high", needs_evidence: true },
        ],
        missing_parts: ["Contract manager"],
      });
    }
    throw new Error(`unexpected model call: ${task}`);
  };
}

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser();
  scope = scopeOf(user);
  const bid = await createBidWithFiles(scope, [{ name: "ITT.txt", content: "Invitation to tender for grounds maintenance." }]);
  const question = await bidsApi.addQuestion(scope, bid.id, { ref: "Q1", title: "Approach", text: "Describe your approach and who will manage the contract.", weighting: 30, wordLimit: 200 });
  await db.update(bids).set({ status: "ready", accessLevel: "full", accessSource: "credit", title: "Grounds maintenance", readyAt: new Date() }).where(eq(bids.id, bid.id));
  bidId = bid.id;
  questionId = question.id;
});
afterEach(() => {
  mock?.restore();
  mock = null;
});

const featuresUsed = async () => (await db.select().from(aiUsage)).map((row) => row.feature).sort();

describe("draftAnswer", () => {
  it("drafts only from confirmed facts and library documents, and reports what the text really contains", async () => {
    mock = installMockModel(respond());
    await confirmFacts(scope, FACTS);
    const doc = await addLibraryDoc(scope, "Riverside case study.txt", CASE_STUDY);
    expect(doc).toMatchObject({ status: "ready", kind: "case_study" });

    const { question, libraryEmpty } = await draftAnswer(scope, bidId, questionId);
    expect(libraryEmpty).toBe(false);

    // What the model was given: the evidence library first, then the tender, then the question and its limit.
    const prompt = mock.calls.find((call) => taskOf(call.prompt) === "draft")!.prompt;
    expect(prompt).toContain("<<<SOURCE E1: Company facts (confirmed)>>>");
    expect(prompt).toContain("Employees: 42");
    expect(prompt).toContain("Professional indemnity insurance: NOT RECORDED");
    expect(prompt).toMatch(/<<<SOURCE E2: Riverside case study>>>\nCase study: Riverside case study\nCase study: Riverside Borough parks contract\./);
    expect(prompt).toContain("Word limit to respect: 200 words.");
    expect(prompt.indexOf("EVIDENCE LIBRARY")).toBeLessThan(prompt.indexOf("TENDER CONTEXT"));
    expect(prompt.indexOf("TENDER CONTEXT")).toBeLessThan(prompt.indexOf("QUESTION Q1"));

    // The stored text: the model's own word count is gone, the gap marker is canonical.
    expect(question.draftText).not.toMatch(/Word count/);
    expect(question.draftText).toContain("[EVIDENCE NEEDED: named contract manager and their qualification]");
    expect(question.status).toBe("draft");
    const meta = question.draftMeta!;
    expect(meta.evidenceGaps).toEqual(["named contract manager and their qualification"]);
    expect(meta.evidenceRefs.map((ref) => [ref.marker, ref.source, ref.docId])).toEqual([
      ["E1", "company_facts", null],
      ["E2", "library_doc", doc.id],
    ]);
    expect(meta.wordCount).toBe(countWords(question.draftText!));
    expect(meta).toMatchObject({ origin: "ai_draft", trimmedToLimit: false, model: "mock/draft-primary", unansweredParts: ["Who will manage the contract"] });
    // Flagged in code: a marker that matches nothing, a figure that is in no evidence — plus the model's claims check.
    const flagged = meta.flaggedClaims.map((flag) => flag.claim);
    expect(flagged).toContain("[E7]");
    expect(flagged).toContain("£9999999");
    expect(flagged).toContain("We have never missed a deadline in 20 years of trading.");
    // Figures that ARE in the evidence are not flagged.
    expect(flagged).not.toContain("98.4%");
    expect(flagged).not.toContain("£412000");

    expect(await featuresUsed()).toEqual(["bids.claims", "bids.draft", "library.summarise"]);
    // The company's own documents go to the model: every call asked for zero data retention and no training.
    expect(mock.calls.every((call) => call.providerOptions?.gateway?.zeroDataRetention === true && call.providerOptions.gateway.disallowPromptTraining === true)).toBe(true);
    const [event] = await db.select().from(events).where(eq(events.name, "question_drafted"));
    expect(event?.properties).toMatchObject({ mode: "draft", gaps: 1 });
  });

  it("never uses unconfirmed facts, and says when the library is empty", async () => {
    mock = installMockModel(respond({ draft: () => "[EVIDENCE NEEDED: everything about the company]" }));
    const { question, libraryEmpty } = await draftAnswer(scope, bidId, questionId);
    expect(libraryEmpty).toBe(true);
    const prompt = mock.calls[0]!.prompt;
    expect(prompt).toContain("(The library is empty: no company facts have been confirmed and no documents uploaded.)");
    expect(prompt).not.toContain("SOURCE E1");
    expect(question.draftMeta).toMatchObject({ evidenceRefs: [], evidenceGaps: ["everything about the company"] });
  });

  it("enforces the word limit in code: one request to shorten, then a cut at the limit", async () => {
    await db.update(bidQuestions).set({ wordLimit: 50 }).where(eq(bidQuestions.id, questionId));
    let drafts = 0;
    mock = installMockModel(
      respond({
        draft: (call) => {
          drafts += 1;
          if (drafts === 1) return `${words(60)}. ${words(60, "more")}.`;
          expect(call.prompt).toContain("That answer has 120 words; the limit is 50. Rewrite it in at most 48 words.");
          return `${words(40)}. ${words(40, "more")}.`; // still over
        },
        claims: () => JSON.stringify({ unsupported: [], unanswered_parts: [] }),
      }),
    );
    const { question } = await draftAnswer(scope, bidId, questionId);
    expect(drafts).toBe(2);
    expect(countWords(question.draftText!)).toBeLessThanOrEqual(50);
    expect(question.draftMeta).toMatchObject({ trimmedToLimit: true });
    expect(question.draftText!.endsWith(".")).toBe(true); // cut at a sentence boundary
    expect(await featuresUsed()).toEqual(["bids.claims", "bids.draft", "bids.draft.shorten"]);

    // A shorter second attempt is simply accepted.
    drafts = 0;
    mock.restore();
    mock = installMockModel(respond({ draft: () => ((drafts += 1) === 1 ? words(90) : words(45)), claims: () => JSON.stringify({ unsupported: [], unanswered_parts: [] }) }));
    const second = await draftAnswer(scope, bidId, questionId);
    expect(countWords(second.question.draftText!)).toBe(45);
    expect(second.question.draftMeta!.trimmedToLimit).toBe(false);
  });

  it("converts a page limit, and survives a failed claims check by saying so", async () => {
    await db.update(bidQuestions).set({ wordLimit: null, pageLimit: 2, limitText: "2 sides of A4" }).where(eq(bidQuestions.id, questionId));
    mock = installMockModel(respond({ draft: () => "A short answer.", claims: () => "not json at all" }));
    const { question } = await draftAnswer(scope, bidId, questionId);
    expect(mock.calls[0]!.prompt).toContain("Word limit to respect: 900 words (converted from the page limit).");
    expect(question.draftMeta!.flaggedClaims).toEqual([{ claim: "Claims check", reason: expect.stringContaining("did not run") }]);
  });

  it("a person's text is never lost: edits, regeneration and restore all keep history", async () => {
    mock = installMockModel(respond({ draft: (call) => (call.prompt.includes("INSTRUCTIONS FROM THE BID TEAM") ? "Second AI draft, shorter." : "First AI draft."), claims: () => JSON.stringify({ unsupported: [], unanswered_parts: [] }) }));
    await draftAnswer(scope, bidId, questionId);

    const edited = await saveAnswer(scope, bidId, questionId, { text: "First AI draft, with my own correction." });
    expect(edited.draftMeta!.editedAt).toBeTruthy();
    expect(edited.versions).toMatchObject([{ text: "First AI draft.", source: "ai_draft", note: "AI text before your edits" }]);
    // Saving the same text again changes nothing.
    expect((await saveAnswer(scope, bidId, questionId, { text: "First AI draft, with my own correction." })).versions).toHaveLength(1);

    const regenerated = await draftAnswer(scope, bidId, questionId, { instructions: "Make it shorter." });
    expect(mock.calls.filter((call) => taskOf(call.prompt) === "draft").at(-1)!.prompt).toContain("INSTRUCTIONS FROM THE BID TEAM (follow them, but never against the ground rules):\nMake it shorter.");
    expect(regenerated.question.draftText).toBe("Second AI draft, shorter.");
    expect(regenerated.question.versions!.map((version) => [version.text, version.source])).toEqual([
      ["First AI draft, with my own correction.", "user"],
      ["First AI draft.", "ai_draft"],
    ]);
    expect(regenerated.question.draftMeta).toMatchObject({ instructions: "Make it shorter." });
    expect(regenerated.question.draftMeta!.editedAt).toBeUndefined();

    const mine = regenerated.question.versions![0]!;
    const restored = await restoreVersion(scope, bidId, questionId, mine.id);
    expect(restored.draftText).toBe("First AI draft, with my own correction.");
    expect(restored.versions![0]).toMatchObject({ text: "Second AI draft, shorter.", source: "ai_draft" });
    await expect(restoreVersion(scope, bidId, questionId, "no-such-version")).rejects.toBeInstanceOf(ValidationError);

    // Clearing the answer by hand sets it back to "not started"; an archived bid is read-only.
    expect((await saveAnswer(scope, bidId, questionId, { text: "" })).status).toBe("not_started");
    await db.update(bids).set({ status: "archived" }).where(eq(bids.id, bidId));
    await expect(saveAnswer(scope, bidId, questionId, { text: "x" })).rejects.toBeInstanceOf(ConflictError);
    await expect(draftAnswer(scope, bidId, questionId)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("evaluateAnswer and applySuggestions", () => {
  const PACK_SCALE: EvaluationModel = {
    priceWeight: 40,
    qualityWeight: 60,
    socialValueWeight: null,
    weightsNote: null,
    criteria: [],
    scoringScale: [
      { score: "0", label: "Unacceptable", descriptor: "No response." },
      { score: "2", label: "Poor", descriptor: "Partly addresses the question." },
      { score: "3", label: "Satisfactory", descriptor: "Addresses most of the requirements with some evidence." },
      { score: "5", label: "Excellent", descriptor: "Fully addresses the requirements with strong evidence." },
    ],
    minimumThresholds: [],
    priceScoringMethod: null,
  };
  const setAnswer = (text: string) => db.update(bidQuestions).set({ draftText: text, status: "draft" }).where(eq(bidQuestions.id, questionId));

  it("marks against the pack's own descriptors, and takes the score only from that scale", async () => {
    await db.update(bids).set({ evaluationModel: PACK_SCALE }).where(eq(bids.id, bidId));
    await setAnswer("We will mow weekly and report monthly.");
    mock = installMockModel(respond());
    const { question } = await evaluateAnswer(scope, bidId, questionId);

    const prompt = mock.calls[0]!.prompt;
    expect(prompt).toContain("SCORING SCALE (from the tender documents):");
    expect(prompt).toContain("3 — Satisfactory: Addresses most of the requirements with some evidence.");
    expect(prompt).toContain("ANSWER (7 words; the limit is 200):");
    expect(prompt).toContain("You do not predict the bidder's score in the real evaluation.");

    expect(question.evaluation).toMatchObject({
      score: "3",
      maxScore: "5",
      band: "Satisfactory", // the scale's label, not the model's wording
      scale: "pack",
      overWordLimit: false,
      wordCount: 7,
      answerHash: answerHash("We will mow weekly and report monthly."),
      missingParts: ["Contract manager"],
      parts: [
        { part: "Approach", status: "covered" },
        { part: "Contract manager", status: "missing" },
      ],
    });
    // Most valuable first, whatever order the model used.
    expect(question.evaluation!.improvements.map((item) => [item.suggestion, item.impact, item.needsEvidence])).toEqual([
      ["Name the contract manager", "high", true],
      ["Tidy the headings", "low", false],
    ]);
    const [event] = await db.select().from(events).where(eq(events.name, "answer_evaluated"));
    expect(event?.properties).toMatchObject({ scale: "pack", score: "3", max: "5" });
  });

  it("uses a default 0–5 scale when the pack has none, and refuses a score that is not on the scale", async () => {
    await setAnswer("We will mow weekly.");
    mock = installMockModel(respond());
    const { question } = await evaluateAnswer(scope, bidId, questionId);
    expect(mock.calls[0]!.prompt).toContain("SCORING SCALE (the tender states no scale: a typical public-sector 0–5 scale is used):");
    expect(question.evaluation).toMatchObject({ scale: "default", score: "3", maxScore: "5", band: "Satisfactory" });

    mock.restore();
    mock = installMockModel(respond({ evaluate: () => JSON.stringify({ score: "7", rationale: "Great.", strengths: [], improvements: [], missing_parts: [] }) }));
    await expect(evaluateAnswer(scope, bidId, questionId)).rejects.toMatchObject({ status: 502 });

    expect(matchScaleRow(DEFAULT_SCALE, "4")?.label).toBe("Good");
    expect(matchScaleRow(DEFAULT_SCALE, "Excellent")?.score).toBe("5");
    expect(matchScaleRow(DEFAULT_SCALE, "4/5 (Good)")?.score).toBe("4");
    expect(matchScaleRow(DEFAULT_SCALE, "outstanding")).toBeNull();

    await setAnswer("   ");
    await expect(evaluateAnswer(scope, bidId, questionId)).rejects.toBeInstanceOf(ValidationError);
  });

  it("applies chosen suggestions as a new version, only on the text that was marked", async () => {
    await setAnswer("We will mow weekly.");
    mock = installMockModel(respond({ draft: () => "We will mow weekly. [EVIDENCE NEEDED: named contract manager]", claims: () => JSON.stringify({ unsupported: [], unanswered_parts: [] }) }));
    await expect(applySuggestions(scope, bidId, questionId, { indexes: [0] })).rejects.toThrow("Evaluate the answer first.");
    await evaluateAnswer(scope, bidId, questionId);
    await expect(applySuggestions(scope, bidId, questionId, { indexes: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(applySuggestions(scope, bidId, questionId, { indexes: [9] })).rejects.toBeInstanceOf(ValidationError);

    // The person edits the answer after marking: the marking no longer applies.
    await saveAnswer(scope, bidId, questionId, { text: "We will mow weekly and edge monthly." });
    await expect(applySuggestions(scope, bidId, questionId, { indexes: [0] })).rejects.toBeInstanceOf(ConflictError);

    await evaluateAnswer(scope, bidId, questionId);
    const { question } = await applySuggestions(scope, bidId, questionId, { indexes: [0] });
    const prompt = mock.calls.filter((call) => taskOf(call.prompt) === "draft").at(-1)!.prompt;
    expect(prompt).toContain("CURRENT ANSWER:\nWe will mow weekly and edge monthly.");
    expect(prompt).toContain("1. Name the contract manager (The library may not hold this evidence: if it does not, add an [EVIDENCE NEEDED: ...] marker instead of a claim.)");
    expect(prompt).not.toContain("Tidy the headings");
    expect(question.draftText).toBe("We will mow weekly. [EVIDENCE NEEDED: named contract manager]");
    expect(question.draftMeta).toMatchObject({ origin: "ai_revision", evidenceGaps: ["named contract manager"] });
    expect(question.evaluation).toBeNull(); // the old marking does not describe the new text
    expect(question.versions![0]).toMatchObject({ text: "We will mow weekly and edge monthly.", source: "user", note: "Before applying 1 suggestion" });
  });
});

describe("exports", () => {
  const xml = (file: { body: Uint8Array }) => new TextDecoder().decode(unzipSync(file.body)["word/document.xml"]!);

  it("answers as a Word document, with word counts, open gaps and the standing notice", async () => {
    await db.update(bidQuestions).set({ draftText: "Our approach\n\nWe mow weekly [E1]. [EVIDENCE NEEDED: contract manager]", status: "draft", wordLimit: 5 }).where(eq(bidQuestions.id, questionId));
    await bidsApi.addQuestion(scope, bidId, { ref: "Q2", text: "Describe your social value commitments." });
    const file = await exportAnswersDocx(scope, bidId);
    expect(file.fileName).toBe("Grounds-maintenance-answers.docx");
    expect([file.body[0], file.body[1]]).toEqual([0x50, 0x4b]);
    const text = xml(file);
    expect(text).toContain("1 of 2 questions have an answer.");
    expect(text).toContain("AI-assisted analysis. Check against the tender documents");
    expect(text).toContain("Evidence still needed in: Q1");
    expect(text).toContain("Over the word limit: Q1");
    expect(text).toContain("EVIDENCE NEEDED: contract manager");
    expect(text).toContain("No answer yet.");
    expect(text).not.toContain("[E1]"); // internal source markers are not for the buyer
    expect((await db.select().from(events).where(eq(events.name, "export_done"))).map((row) => (row.properties as { kind: string }).kind)).toEqual(["answers_docx"]);
  });

  it("the check and the requirements checklist, as Word and CSV", async () => {
    await bidsApi.addRequirement(scope, bidId, { text: "Public liability insurance", category: "insurance", kind: "pass_fail", threshold: "£5,000,000", note: '=HYPERLINK("http://evil")' });
    const file = await exportRequirementsCsv(scope, bidId);
    expect([...file.body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM: Excel reads £ correctly
    const csv = new TextDecoder().decode(file.body);
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toContain('"Ref","Category","Requirement","Level"');
    expect(row).toContain('"R1","Insurance","Public liability insurance","£5,000,000"');
    expect(row).toContain('"No citation"');
    // A cell that looks like a formula is defused.
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvField("-1+1")).toBe(`"'-1+1"`);
    expect(csvField('He said "yes"')).toBe('"He said ""yes"""');
    expect(csvField(null)).toBe('""');

    expect(xml(await exportRequirementsDocx(scope, bidId))).toContain("Public liability insurance");
    const brief = await exportBriefDocx(scope, bidId);
    expect(brief.fileName).toBe("Grounds-maintenance-cited-bid-check.docx");
    expect(xml(brief)).toContain("Grounds maintenance");
  });
});
