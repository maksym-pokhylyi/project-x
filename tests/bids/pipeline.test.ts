import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { db } from "@/db";
import { aiUsage, bidFiles, bidQuestions, bidRequirements, bids, emailOutbox, events, jobs } from "@/db/schema";
import { callJson, callText } from "@/features/bids/server/ai/call";
import { ModelJsonError } from "@/features/bids/server/ai/json";
import { isZdrUnavailable } from "@/features/bids/server/ai/models";
import * as bidsApi from "@/features/bids/server/bids";
import { processBidJob } from "@/features/bids/server/pipeline/runner";
import { buildPackIndex } from "@/features/bids/server/pipeline/quote-verify";
import { persistRequirements } from "@/features/bids/server/pipeline/step-analyse";
import { runCompanyCheck } from "@/features/bids/server/pipeline/step-company";
import { getBidStatus, reviveStalledBid } from "@/features/bids/server/status";
import type { CompanyFacts } from "@/features/bids/types";
import { runWorker } from "@/lib/jobs/worker";
import { createTestUser, type TestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { confirmFacts, createBidWithFiles, EMPTY_PATCH, emptyOverview, ensureBidsSchema, installMockModel, NOT_STATED, runPipeline, scopeOf, taskOf, type MockCall, type Scope } from "./helpers";

/**
 * The pack pipeline end to end against a real database, with a scripted model:
 * extraction -> two-model union -> per-document reading -> "what did we miss" -> company
 * check -> ready. Then the ways it must survive: a transient failure, a dead worker, a
 * model that keeps returning rubbish, and a person's own edits.
 */

const ITT = "Invitation to Tender.txt";
const QQ = "Quality Questionnaire.txt";

const ITT_TEXT = [
  "Invitation to Tender — Grounds Maintenance 2027-2030",
  "Harbourside Town Council invites tenders for grounds maintenance of its parks and open spaces.",
  "Tenders must be received by 12:00 noon on Friday 14 May 2027 through the e-tendering portal.",
  "Clarification questions must be raised by 30 April 2027.",
  "4.1 The Contractor shall hold Public Liability insurance of not less than £5,000,000 for any one claim. This is a pass/fail requirement.",
  "4.2 Bidders must provide two references for contracts of a similar nature completed within the last three years.",
  "4.3 Bidders must hold Cyber Essentials certification at the tender deadline. Failure to hold it will result in exclusion.",
  "Quality is worth 60% of the marks and price 40%.",
  "Question 1 Methodology (30%): Describe how you will deliver the service. Maximum 500 words.",
].join("\n");

const QQ_TEXT = [
  "Quality Questionnaire — to be completed and returned by all bidders",
  "Question 1 Methodology (30%): Describe how you will deliver the service. Maximum 500 words.",
  "Question 2 Social value (10%): Describe the social value commitments you will make for this contract. Maximum 300 words.",
  "Question 3 Mobilisation (20%): Explain how you will mobilise the contract in the first four weeks. Maximum 400 words.",
].join("\n");

const cite = (file: string, quote: string) => ({ file, loc: "s1", quote });
const req = (category: string, requirement: string, threshold: string | null, kind: string, file: string, quote: string) => ({ id: "", category, requirement, threshold, kind, evidence_to_provide: null, ...cite(file, quote) });
const question = (id: string, title: string, weight: number, words: number, file: string, quote: string) => ({
  id,
  title,
  text: quote,
  sub_parts: [],
  section: null,
  guidance: null,
  weight_percent: weight,
  max_score_points: null,
  limit_text: `${words} words`,
  limit_words: words,
  limit_pages: null,
  attachments_allowed: null,
  scored: "scored_weighted",
  ...cite(file, quote),
});

const PL = "The Contractor shall hold Public Liability insurance of not less than £5,000,000 for any one claim.";
const REFS = "Bidders must provide two references for contracts of a similar nature completed within the last three years.";
const CYBER = "Bidders must hold Cyber Essentials certification at the tender deadline.";
const Q1 = "Question 1 Methodology (30%): Describe how you will deliver the service. Maximum 500 words.";
const Q2 = "Question 2 Social value (10%): Describe the social value commitments you will make for this contract. Maximum 300 words.";
const Q3 = "Question 3 Mobilisation (20%): Explain how you will mobilise the contract in the first four weeks. Maximum 400 words.";

const deadlineFact = (normalized: string, value: string, quote: string) => ({ value, normalized, status: "stated", note: null, ...cite(ITT, quote) });
const DEADLINE = deadlineFact("2027-05-14T12:00", "12:00 noon on Friday 14 May 2027", "Tenders must be received by 12:00 noon on Friday 14 May 2027");

/** What a well-behaved pair of models returns for this pack. */
function script(call: MockCall, overrides: Partial<Record<ReturnType<typeof taskOf>, (call: MockCall) => string>> = {}): string {
  const task = taskOf(call.prompt);
  if (overrides[task]) return overrides[task]!(call);
  switch (task) {
    case "overview":
      return JSON.stringify(
        emptyOverview({
          overview: "Harbourside Town Council wants a grounds maintenance contractor for 2027 to 2030.",
          summary: {
            title: { value: "Grounds Maintenance 2027-2030", normalized: null, status: "stated", note: null, ...cite(ITT, "Invitation to Tender — Grounds Maintenance 2027-2030") },
            buyer: { value: "Harbourside Town Council", normalized: null, status: "stated", note: null, ...cite(ITT, "Harbourside Town Council invites tenders") },
            submission_deadline: DEADLINE,
            estimated_value: NOT_STATED,
          },
          key_dates: [{ event: "Tender deadline", date_iso: "2027-05-14", time_24h: "12:00", ...cite(ITT, "Tenders must be received by 12:00 noon on Friday 14 May 2027") }],
          evaluation: { price_weight_percent: 40, quality_weight_percent: 60, social_value_weight_percent: null, weights_note: null, criteria: [], scoring_scale: [], minimum_thresholds: [], price_scoring_method: null },
        }),
      );
    case "keyfacts":
      return JSON.stringify({ summary: { submission_deadline: DEADLINE }, key_dates: [{ event: "Clarification deadline", date_iso: "2027-04-30", time_24h: null, ...cite(ITT, "Clarification questions must be raised by 30 April 2027.") }] });
    case "requirements":
      return JSON.stringify({
        requirements:
          call.step === "extract"
            ? [req("insurance", "Public liability insurance of at least £5,000,000", "£5,000,000", "pass_fail", ITT, PL), req("experience_references", "Provide two references from the last three years", "2 references", "mandatory_unscored", ITT, REFS)]
            : [
                req("insurance", "Hold public liability insurance (minimum £5m any one claim)", "£5m", "pass_fail", ITT, PL),
                req("accreditation_certification", "Hold Cyber Essentials certification at the tender deadline", null, "pass_fail", ITT, CYBER),
                // An invention: the quote is nowhere in the pack.
                req("accreditation_certification", "ISO 14001 certification is mandatory", null, "pass_fail", ITT, "Bidders must hold ISO 14001 environmental management certification."),
              ],
      });
    case "questions":
      return JSON.stringify({ questions: call.step === "extract" ? [question("Q1", "Methodology", 30, 500, ITT, Q1)] : [question("Question 1", "Methodology", 30, 500, ITT, Q1), question("Q2", "Social value", 10, 300, QQ, Q2)] });
    case "document":
      return JSON.stringify({ requirements: [], questions: [question("2", "Social value", 10, 300, QQ, Q2), question("3", "Mobilisation", 20, 400, QQ, Q3)] });
    case "recheck":
      return JSON.stringify({
        ...EMPTY_PATCH,
        add_requirements: [
          req("insurance", "Public liability insurance £5,000,000", "£5,000,000", "pass_fail", ITT, PL),
          req("submission_formality", "Submit the tender through the e-tendering portal", null, "mandatory_unscored", ITT, "Tenders must be received by 12:00 noon on Friday 14 May 2027 through the e-tendering portal."),
        ],
      });
    case "company": {
      const ids = [...call.prompt.matchAll(/"id": "([0-9a-f-]{36})"/g)].map((match) => match[1]!);
      return JSON.stringify({ results: ids.map((id) => ({ id, status: "met", reason: "The company facts cover this.", fact_used: null })) });
    }
    default:
      throw new Error(`unexpected model call: ${task}`);
  }
}

const FACTS = {
  legalName: "Example Facilities Ltd",
  insurance: { publicLiability: { amountGbp: 5_000_000, expiresAt: "2028-03-31" }, employersLiability: { amountGbp: null, expiresAt: null }, professionalIndemnity: { amountGbp: null, expiresAt: null } },
  accreditations: [{ name: "Cyber Essentials", reference: null, expiresAt: "2028-01-01" }],
} as CompanyFacts;

let user: TestUser;
let scope: Scope;
let mock: ReturnType<typeof installMockModel> | null = null;

const tasks = () => (mock?.calls ?? []).map((call) => taskOf(call.prompt));
const countOf = (task: string) => tasks().filter((item) => item === task).length;

async function startBid(): Promise<string> {
  const bid = await createBidWithFiles(scope, [
    { name: ITT, content: ITT_TEXT },
    { name: QQ, content: QQ_TEXT },
  ]);
  await bidsApi.startBidProcessing(scope, bid.id);
  return bid.id;
}

beforeAll(ensureBidsSchema);
beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser();
  scope = scopeOf(user);
});
afterEach(() => {
  mock?.restore();
  mock = null;
  delete process.env.BIDS_RECHECK;
});

describe("pack pipeline", () => {
  it("reads a pack into a cited check: union of two models, per-document reading, second pass, company check", async () => {
    await confirmFacts(scope, FACTS);
    mock = installMockModel((call) => script(call));
    const bidId = await startBid();
    expect((await bidsApi.getBid(scope, bidId)).status).toBe("processing");
    const bid = await runPipeline(scope, bidId);

    expect(bid.status).toBe("ready");
    expect(bid.processingProgress).toBe(100);
    expect(bid.title).toBe("Grounds Maintenance 2027-2030");
    expect(bid.buyerName).toBe("Harbourside Town Council");
    expect(bid.submissionDeadline?.toISOString()).toBe("2027-05-14T11:00:00.000Z"); // 12:00 UK time (BST)
    expect(bid.brief?.summary.submission_deadline).toMatchObject({ status: "stated", citation: { verified: true } });
    expect(bid.keyDates?.map((item) => item.event)).toEqual(["Clarification deadline", "Tender deadline"]);
    expect(bid.evaluationModel).toMatchObject({ qualityWeight: 60, priceWeight: 40, socialValueWeight: null });

    // One call per reading, no more: 2 brief + 2 requirements + 2 questions + 1 document + recheck + company.
    expect(tasks().sort()).toEqual(["company", "document", "keyfacts", "overview", "questions", "questions", "recheck", "requirements", "requirements"]);
    // The two whole-pack readings ran on DIFFERENT model routes.
    expect(new Set(mock.calls.filter((call) => taskOf(call.prompt) === "requirements").map((call) => call.step))).toEqual(new Set(["extract", "extract2"]));

    const requirements = await bidsApi.listRequirements(scope, bidId);
    const byText = (needle: string) => requirements.find((row) => row.text.toLowerCase().includes(needle))!;
    expect(requirements).toHaveLength(5);
    expect(requirements.map((row) => row.ref)).toEqual(["R1", "R2", "R3", "R4", "R5"]);
    // Found by both models: one row, both passes remembered; the duplicate from the second pass was not re-added.
    expect(byText("public liability")).toMatchObject({ isPassFail: true, category: "insurance", citation: { verified: true, match: "exact", loc: "s1" } });
    expect([...byText("public liability").provenance!.passes].sort()).toEqual(["primary", "second"]);
    expect(requirements.filter((row) => /public liability/i.test(row.text))).toHaveLength(1);
    expect(byText("cyber essentials").provenance).toEqual({ passes: ["second"] });
    expect(byText("e-tendering portal")).toMatchObject({ source: "ai_recheck", provenance: { passes: ["recheck"] } });
    // The invented requirement is kept (recall first) but can never look verified or met.
    expect(byText("iso 14001")).toMatchObject({ citation: { verified: false, match: "not_found" }, companyStatus: "verify" });

    // Company check: arithmetic for insurance, guarded "met" for the accreditation.
    expect(byText("public liability")).toMatchObject({ companyStatus: "met", companyNote: "You hold £5m public liability cover; the tender asks for £5m." });
    expect(byText("cyber essentials")).toMatchObject({ companyStatus: "met", companyNote: expect.stringContaining("You hold Cyber Essentials") });
    expect(bid.verdict).toMatchObject({ verdict: "biddable_with_gaps", factsConfirmed: true, counts: { requirements: 5, passFail: 3, met: 4, verify: 1 } });
    // Only requirements with a verified quote were sent to the model for the company check.
    const companyCall = mock.calls.find((call) => taskOf(call.prompt) === "company")!;
    expect(companyCall.prompt).not.toContain("ISO 14001");

    const questions = await bidsApi.listQuestions(scope, bidId);
    expect(questions.map((row) => [row.title, row.weighting, row.wordLimit])).toEqual([
      ["Methodology", 30, 500],
      ["Social value", 10, 300],
      ["Mobilisation", 20, 400],
    ]);
    expect([...questions[1]!.provenance!.passes].sort()).toEqual(["document", "second"]);

    // Honest statistics and coverage.
    expect(bid.packStats).toMatchObject({ files: 2, failedFiles: [], usage: { calls: 9 } });
    expect(bid.packStats!.citations.total - bid.packStats!.citations.verified).toBe(1);
    expect(bid.packStats!.coverage!.passes).toEqual(expect.arrayContaining(["primary brief", "second reading of key facts", "requirements (first model)", "requirements (second model)", `questionnaire: ${QQ}`, "what did we miss"]));
    expect(bid.packStats!.coverage!.failedPasses).toEqual([]);
    expect(Object.keys(bid.packStats!.models)).toEqual(expect.arrayContaining(["overview", "requirements", "questions", "documents", "recheck", "company"]));

    // Every model call went through the foundation wrapper (usage recorded per workspace).
    const usage = await db.select().from(aiUsage).where(eq(aiUsage.organizationId, user.organizationId));
    expect(usage).toHaveLength(9);
    expect(usage.map((row) => row.feature)).toEqual(expect.arrayContaining(["bids.overview", "bids.keyfacts", "bids.requirements.primary", "bids.requirements.second", "bids.document", "bids.recheck", "bids.company_check"]));

    // Confidentiality: every request carrying the customer's documents asked for zero data retention and no training.
    expect(mock.calls.map((call) => call.providerOptions?.gateway)).toEqual(Array(9).fill({ zeroDataRetention: true, disallowPromptTraining: true }));

    // Events and the "ready" e-mail, exactly once.
    const names = (await db.select().from(events).where(eq(events.organizationId, user.organizationId))).map((row) => row.name);
    expect(names.filter((name) => name === "brief_ready")).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining(["bid_created", "pack_uploaded"]));
    const mail = await db.select().from(emailOutbox).where(eq(emailOutbox.template, "brief-ready"));
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ toEmail: user.email, subject: "Your cited bid check is ready: Grounds Maintenance 2027-2030" });

    // The status the UI polls says the same thing.
    const status = await getBidStatus(scope, bid);
    expect(status).toMatchObject({ status: "ready", progress: 100, failure: null, counts: { files: 2, filesRead: 2, requirements: 5, passFail: 3, questions: 3 } });
    expect(status.stages.map((stage) => stage.status)).toEqual(["done", "done", "done", "done"]);
  });

  it("without confirmed company facts: no company model call, nothing asserted, a cautious verdict", async () => {
    mock = installMockModel((call) => script(call));
    const bid = await runPipeline(scope, await startBid());
    expect(bid.status).toBe("ready");
    expect(countOf("company")).toBe(0);
    expect(bid.verdict).toMatchObject({ verdict: "not_enough_information", factsConfirmed: false });
    const statuses = (await bidsApi.listRequirements(scope, bid.id)).map((row) => row.companyStatus);
    expect(statuses.filter((status) => status === "met" || status === "gap")).toEqual([]);
  });

  it("shows both readings when two models disagree on the deadline, and sets no deadline", async () => {
    mock = installMockModel((call) =>
      script(call, { keyfacts: () => JSON.stringify({ summary: { submission_deadline: deadlineFact("2027-04-30T17:00", "30 April 2027", "Clarification questions must be raised by 30 April 2027.") }, key_dates: [] }) }),
    );
    const bid = await runPipeline(scope, await startBid());
    const fact = bid.brief!.summary.submission_deadline;
    expect(fact.status).toBe("conflicting");
    expect(fact.alternatives).toHaveLength(1);
    expect(bid.submissionDeadline).toBeNull();
    expect(bid.brief!.redFlags[0]).toMatchObject({ type: "contradiction_in_documents", severity: "high" });
  });

  it("retries a transient failure without repeating (or paying again for) finished readings", async () => {
    let failures = 0;
    mock = installMockModel((call) => {
      if (taskOf(call.prompt) === "requirements" && call.step === "extract2" && failures < 1) {
        failures += 1;
        throw new Error("socket hang up");
      }
      return script(call);
    });
    const bidId = await startBid();
    await runWorker({ maxJobs: 1 });

    // After the failed run: still processing, the step says it is retrying, partial results are visible.
    const midway = await bidsApi.getBid(scope, bidId);
    expect(midway.status).toBe("processing");
    expect(midway.processingLockAt).toBeNull();
    expect(midway.processingState?.steps.requirements).toMatchObject({ status: "pending", error: expect.stringContaining("Retrying") });
    expect(midway.processingState?.steps.overview?.status).toBe("done");
    expect((await bidsApi.listRequirements(scope, bidId)).length).toBeGreaterThan(0);
    const [job] = await db.select().from(jobs).where(eq(jobs.type, "bids.process"));
    expect(job).toMatchObject({ status: "pending", attempts: 1 });

    const bid = await runPipeline(scope, bidId);
    expect(bid.status).toBe("ready");
    expect(await bidsApi.listRequirements(scope, bidId)).toHaveLength(5);
    expect(await bidsApi.listQuestions(scope, bidId)).toHaveLength(3);
    // Finished readings were not repeated: the first model's requirements reading ran once.
    expect(mock.calls.filter((call) => taskOf(call.prompt) === "requirements" && call.step === "extract")).toHaveLength(1);
    expect(mock.calls.filter((call) => taskOf(call.prompt) === "requirements" && call.step === "extract2")).toHaveLength(2);
    expect(countOf("overview")).toBe(1);
    expect(countOf("questions")).toBe(2);
    expect(countOf("document")).toBe(1);
  });

  it("resumes after a worker dies mid-pipeline: the lock expires, the watchdog restarts, nothing is duplicated", async () => {
    let crash = true;
    mock = installMockModel((call) => {
      if (taskOf(call.prompt) === "recheck" && crash) throw new Error("function timed out");
      return script(call);
    });
    const bidId = await startBid();
    await runWorker({ maxJobs: 1 });
    const beforeCrash = { requirements: (await bidsApi.listRequirements(scope, bidId)).length, calls: mock.calls.length };
    expect(beforeCrash.requirements).toBe(4);

    // Simulate the dead worker: its job is gone, the step is left "running", the lock is still held.
    await db.delete(jobs);
    await db.execute(sql`update bids set processing_lock_at = now(), processing_state = jsonb_set(processing_state, '{steps,recheck,status}', '"running"') where id = ${bidId}`);

    // While the lock is fresh nobody else may touch the bid — not a second worker, not the watchdog.
    const locked = await bidsApi.getBid(scope, bidId);
    await processBidJob({ bidId, runId: locked.processingState!.runId }, { jobId: "other-worker", attempt: 1 });
    expect(mock.calls.length).toBe(beforeCrash.calls);
    expect(await reviveStalledBid(locked)).toBe(false);

    // The lock expires (function maxDuration passed) and the page is still being watched.
    await db.execute(sql`update bids set processing_lock_at = now() - interval '10 minutes', updated_at = now() - interval '2 minutes' where id = ${bidId}`);
    crash = false;
    expect(await reviveStalledBid(await bidsApi.getBid(scope, bidId))).toBe(true);
    const bid = await runPipeline(scope, bidId);

    expect(bid.status).toBe("ready");
    expect(await bidsApi.listRequirements(scope, bidId)).toHaveLength(5);
    expect(await bidsApi.listQuestions(scope, bidId)).toHaveLength(3);
    // Extraction and the first-pass readings were not run again.
    expect(countOf("overview")).toBe(1);
    expect(countOf("requirements")).toBe(2);
    expect(countOf("document")).toBe(1);
    expect((await db.select().from(emailOutbox).where(eq(emailOutbox.template, "brief-ready"))).length).toBe(1);
  });

  it("stops loudly when a step keeps failing, keeps partial results, and Retry continues from that step", async () => {
    let broken = true;
    mock = installMockModel((call) => (taskOf(call.prompt) === "requirements" && broken ? "I am sorry, I cannot produce that list." : script(call)));
    const bidId = await startBid();
    const failed = await runPipeline(scope, bidId);

    expect(failed.status).toBe("failed");
    expect(failed.processingState?.failure).toMatchObject({ step: "requirements", stage: "requirements", retryable: true, message: expect.stringContaining("could not use") });
    const status = await getBidStatus(scope, failed);
    expect(status.failure?.message).toMatch(/Try again/);
    expect(status.stages.find((stage) => stage.stage === "requirements")?.status).toBe("failed");
    // Partial results survive: the brief and the questions are there.
    expect(failed.brief?.summary.title.value).toBe("Grounds Maintenance 2027-2030");
    expect(await bidsApi.listQuestions(scope, bidId)).toHaveLength(3);
    const [job] = await db.select().from(jobs).where(and(eq(jobs.type, "bids.process"), eq(jobs.status, "succeeded")));
    expect(job?.attempts).toBe(3);

    broken = false;
    const before = { overview: countOf("overview"), questions: countOf("questions") };
    const retried = await bidsApi.retryBidProcessing(scope, bidId);
    expect(retried.status).toBe("processing");
    expect(retried.processingState?.runId).not.toBe(failed.processingState?.runId);
    const bid = await runPipeline(scope, bidId);
    expect(bid.status).toBe("ready");
    expect(await bidsApi.listRequirements(scope, bidId)).toHaveLength(5);
    expect(countOf("overview")).toBe(before.overview);
    expect(countOf("questions")).toBe(before.questions);
  });

  it("fails permanently, with the reason, when nothing in the pack can be read", async () => {
    mock = installMockModel((call) => script(call));
    const bid = await createBidWithFiles(scope, [{ name: "scan.pdf", content: "this is not a pdf" }, { name: "empty.txt", content: "   \n  " }]);
    await bidsApi.startBidProcessing(scope, bid.id);
    const failed = await runPipeline(scope, bid.id);
    expect(failed.status).toBe("failed");
    expect(failed.processingState?.failure).toMatchObject({ step: "extract", retryable: false, message: expect.stringContaining("None of the uploaded files could be read") });
    expect(mock.calls).toHaveLength(0);
    const files = await db.select().from(bidFiles).where(eq(bidFiles.bidId, bid.id));
    expect(files.map((file) => file.extractionStatus)).toEqual(["failed", "failed"]);
    expect(files.find((file) => file.name === "scan.pdf")?.error).toBe("This file is not a valid PDF.");
  });

  it("never overwrites what a person edited or decided", async () => {
    await confirmFacts(scope, FACTS);
    process.env.BIDS_RECHECK = "0";
    mock = installMockModel((call) => script(call));
    const bidId = await startBid();
    const bid = await runPipeline(scope, bidId);
    expect(countOf("recheck")).toBe(0);
    const [insurance] = (await bidsApi.listRequirements(scope, bidId)).filter((row) => /public liability/i.test(row.text));

    await bidsApi.updateRequirement(scope, bidId, insurance!.id, { text: "Public liability insurance of £5,000,000 — certificate to be attached", companyStatus: "gap" });
    // A later pass finds the same requirement again, and the company check runs again.
    const index = buildPackIndex([{ id: (await bidsApi.listBidFiles(scope, bidId))[0]!.id, name: ITT, units: [{ loc: "s1", text: ITT_TEXT }] }]);
    const added = await persistRequirements(bid, index, [req("insurance", "Public liability insurance of at least £5,000,000", "£5,000,000", "mandatory_unscored", ITT, PL) as never], "recheck");
    await runCompanyCheck(user.organizationId, bidId, user.id);

    expect(added).toBe(0);
    const after = await bidsApi.getRequirement(scope, bidId, insurance!.id);
    expect(after).toMatchObject({ text: "Public liability insurance of £5,000,000 — certificate to be attached", userEdited: true, companyStatus: "gap", companyStatusSource: "user", isPassFail: true });
    expect(after.provenance?.passes).toContain("recheck");
    expect((await bidsApi.getBid(scope, bidId)).verdict?.verdict).toBe("likely_not_eligible");
  });

  it("starting twice is harmless, and files cannot change once the analysis has started", async () => {
    mock = installMockModel((call) => script(call));
    const bidId = await startBid();
    const again = await bidsApi.startBidProcessing(scope, bidId);
    expect(again.status).toBe("processing");
    expect(await db.select().from(jobs).where(eq(jobs.type, "bids.process"))).toHaveLength(1);
    await expect(bidsApi.planBidUpload(scope, bidId, { name: "late.pdf", size: 10 })).rejects.toThrow(/before the pack is analysed/);
    await expect(bidsApi.deleteBid(scope, bidId)).rejects.toThrow(/being analysed/);
    await runPipeline(scope, bidId);
    expect(await db.select({ count: sql<number>`count(*)::int` }).from(bidRequirements).where(eq(bidRequirements.bidId, bidId))).toEqual([{ count: 5 }]);
    expect(await db.select({ count: sql<number>`count(*)::int` }).from(bidQuestions).where(eq(bidQuestions.bidId, bidId))).toEqual([{ count: 3 }]);
    expect((await db.select().from(bids).where(eq(bids.id, bidId)))[0]!.processingLockAt).toBeNull();
  });
});

describe("callJson (model output is never taken on trust)", () => {
  const schema = z.object({ items: z.array(z.object({ name: z.string() })) });
  const base = () => ({ organizationId: user.organizationId, userId: user.id, feature: "test.json", step: "extract" as const, system: "s", messages: "p", maxOutputTokens: 100, schema });

  it("asks once for a repair with the exact problem, then accepts the corrected JSON", async () => {
    mock = installMockModel((call) => (mock!.calls.length === 1 ? '{"items": [{"nome": "x"}]}' : (expect(call.prompt).toContain("items.0.name"), '{"items": [{"name": "x"}]}')));
    const result = await callJson(base());
    expect(result).toMatchObject({ value: { items: [{ name: "x" }] }, truncated: false, usage: { calls: 2 } });
    const features = (await db.select().from(aiUsage)).map((row) => row.feature).sort();
    expect(features).toEqual(["test.json", "test.json.repair"]);
  });

  it("keeps the complete items of a cut-off answer and says it was truncated", async () => {
    mock = installMockModel(() => '{"items": [{"name": "a"}, {"name": "b"}, {"na');
    const result = await callJson(base());
    expect(result).toMatchObject({ value: { items: [{ name: "a" }, { name: "b" }] }, truncated: true, usage: { calls: 1 } });
  });

  it("falls back to the secondary model when the primary keeps returning rubbish, then gives up with a typed error", async () => {
    mock = installMockModel((call) => (call.which === "fallback" ? '{"items": []}' : "not json"));
    const result = await callJson(base());
    expect(result.model).toBe("mock/extract-fallback");
    expect(mock.calls.map((call) => call.which)).toEqual(["primary", "primary", "fallback"]);
    mock.restore();
    mock = installMockModel(() => "still not json");
    await expect(callJson(base())).rejects.toBeInstanceOf(ModelJsonError);
  });

  it("asks for zero data retention on every call, falls back when a model cannot give it, and never sends without it", async () => {
    const text = () => callText({ organizationId: user.organizationId, feature: "test.zdr", step: "draft", system: "s", messages: "p", maxOutputTokens: 50 });
    mock = installMockModel((call) => {
      if (call.which === "primary") throw Object.assign(new Error("Zero data retention (ZDR) requires a paid account"), { statusCode: 403 });
      return "from a model with zero data retention";
    });
    expect(await text()).toMatchObject({ text: "from a model with zero data retention", model: "mock/draft-fallback" });
    expect(mock.calls.map((call) => call.providerOptions?.gateway)).toEqual(Array(2).fill({ zeroDataRetention: true, disallowPromptTraining: true }));

    mock.restore();
    mock = installMockModel(() => {
      throw Object.assign(new Error("No ZDR provider is available for this model"), { statusCode: 403 });
    });
    await expect(text()).rejects.toMatchObject({ name: "ZdrUnavailableError" });
    expect(mock.calls.map((call) => call.which)).toEqual(["primary", "fallback"]); // two attempts, both with ZDR; no third without it
    expect(isZdrUnavailable(new Error("Rate limit exceeded"))).toBe(false);
    expect(isZdrUnavailable({ message: "wrapped", cause: { message: "zero data retention is not supported by any provider" } })).toBe(true);
  });

  it("records the cost the gateway reports, not the price-table estimate", async () => {
    mock = installMockModel(() => ({ text: "ok", providerMetadata: { gateway: { cost: "0.012345" } } }));
    const result = await callText({ organizationId: user.organizationId, feature: "test.cost", step: "draft", system: "s", messages: "p", maxOutputTokens: 50 });
    expect(result.usage.costUsd).toBe(0.012345);
    expect((await db.select().from(aiUsage))[0]).toMatchObject({ feature: "test.cost", costUsd: 0.012345 });
  });

  it("switches model only when the primary is not available to the account", async () => {
    mock = installMockModel((call) => {
      if (call.which === "primary") throw Object.assign(new Error("Free tier users do not have access to this model."), { statusCode: 403 });
      return "from the secondary model";
    });
    const result = await callText({ organizationId: user.organizationId, feature: "test.text", step: "draft", system: "s", messages: "p", maxOutputTokens: 50 });
    expect(result).toMatchObject({ text: "from the secondary model", model: "mock/draft-fallback" });
    mock.restore();
    mock = installMockModel(() => {
      throw Object.assign(new Error("Rate limit exceeded"), { statusCode: 429 });
    });
    await expect(callText({ organizationId: user.organizationId, feature: "test.text", step: "draft", system: "s", messages: "p", maxOutputTokens: 50 })).rejects.toThrow("Rate limit exceeded");
    expect(mock.calls).toHaveLength(1);
  });
});
