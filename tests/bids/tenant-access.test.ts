import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));

import { GET as exportRoute } from "@/app/api/bids/[bidId]/export/[kind]/route";
import { GET as fileRoute } from "@/app/api/bids/[bidId]/files/[fileId]/route";
import { GET as statusRoute } from "@/app/api/bids/[bidId]/status/route";
import { PUT as uploadRoute } from "@/app/api/bids/[bidId]/upload/route";
import { POST as workerRoute } from "@/app/api/bids/worker/route";
import { db } from "@/db";
import { bidCredits, bidFiles, bidQuestions, bidRequirements, bids, events } from "@/db/schema";
import { canStartFullBid, consumeBidAllowance, getBidAccess, getBidCapabilities, grantBidPass } from "@/features/bids/access";
import * as bidsApi from "@/features/bids/server/bids";
import { applySuggestions, draftAnswer, evaluateAnswer, restoreVersion, saveAnswer } from "@/features/bids/server/drafting";
import { exportAnswersDocx, exportBriefDocx, exportRequirementsCsv, exportRequirementsDocx } from "@/features/bids/server/export";
import { workerAuthHeader } from "@/features/bids/server/pipeline/dispatch";
import { runCompanyCheck } from "@/features/bids/server/pipeline/step-company";
import { NotFoundError } from "@/lib/errors";
import { actAs, createTestUser, type TestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { createBidWithFiles, ensureBidsSchema, scopeOf, type Scope } from "./helpers";

let userA: TestUser;
let userB: TestUser;
let a: Scope;
let b: Scope;

beforeAll(ensureBidsSchema);
beforeEach(async () => {
  await resetDatabase();
  userA = await createTestUser();
  userB = await createTestUser();
  a = scopeOf(userA);
  b = scopeOf(userB);
  actAs(null);
});
afterEach(() => {
  delete process.env.BIDS_SIMULATE_PLAN;
  delete process.env.VERCEL_ENV;
});

const PACK = [{ name: "ITT.txt", content: "Invitation to tender. The Contractor shall hold Public Liability insurance of not less than £5,000,000." }];

/** A ready, full bid of workspace A with one file, one requirement and one answered question. */
async function seedBidA() {
  const bid = await createBidWithFiles(a, PACK);
  const requirement = await bidsApi.addRequirement(a, bid.id, { text: "Public liability insurance", category: "insurance", kind: "pass_fail", threshold: "£5m" });
  const question = await bidsApi.addQuestion(a, bid.id, { ref: "Q1", text: "Describe your method.", wordLimit: 200 });
  await db.update(bids).set({ status: "ready", accessLevel: "full", accessSource: "credit", readyAt: new Date() }).where(eq(bids.id, bid.id));
  await db.update(bidQuestions).set({ draftText: "Our method is simple.", status: "draft" }).where(eq(bidQuestions.id, question.id));
  const [file] = await bidsApi.listBidFiles(a, bid.id);
  return { bid, requirement, question, file: file! };
}

describe("tenant isolation", () => {
  it("another workspace cannot read or change a bid through any data function", async () => {
    const { bid, requirement, question, file } = await seedBidA();
    const own = await createBidWithFiles(b, PACK);
    const version = "00000000-0000-4000-8000-000000000000";

    const attempts: Array<[string, () => Promise<unknown>]> = [
      ["getBid", () => bidsApi.getBid(b, bid.id)],
      ["getBidWorkspace", () => bidsApi.getBidWorkspace(b, bid.id)],
      ["updateBid", () => bidsApi.updateBid(b, bid.id, { title: "Stolen" })],
      ["setBidArchived", () => bidsApi.setBidArchived(b, bid.id, true)],
      ["deleteBid", () => bidsApi.deleteBid(b, bid.id)],
      ["listBidFiles", () => bidsApi.listBidFiles(b, bid.id)],
      ["getBidFile", () => bidsApi.getBidFile(b, bid.id, file.id)],
      ["getBidFile via own bid", () => bidsApi.getBidFile(b, own.id, file.id)],
      ["planBidUpload", () => bidsApi.planBidUpload(b, bid.id, { name: "x.pdf", size: 10 })],
      ["registerBidFile", () => bidsApi.registerBidFile(b, bid.id, { fileId: file.id, name: "ITT.txt" })],
      ["removeBidFile", () => bidsApi.removeBidFile(b, bid.id, file.id)],
      ["startBidProcessing", () => bidsApi.startBidProcessing(b, bid.id)],
      ["retryBidProcessing", () => bidsApi.retryBidProcessing(b, bid.id)],
      ["unlockFullBid", () => bidsApi.unlockFullBid(b, bid.id)],
      ["listRequirements", () => bidsApi.listRequirements(b, bid.id)],
      ["addRequirement", () => bidsApi.addRequirement(b, bid.id, { text: "Injected", category: "other", kind: "mandatory" })],
      ["getRequirement", () => bidsApi.getRequirement(b, bid.id, requirement.id)],
      ["getRequirement via own bid", () => bidsApi.getRequirement(b, own.id, requirement.id)],
      ["updateRequirement", () => bidsApi.updateRequirement(b, bid.id, requirement.id, { companyStatus: "met" })],
      ["updateRequirement via own bid", () => bidsApi.updateRequirement(b, own.id, requirement.id, { companyStatus: "met" })],
      ["deleteRequirement", () => bidsApi.deleteRequirement(b, bid.id, requirement.id)],
      ["setRequirementChecked", () => bidsApi.setRequirementChecked(b, bid.id, requirement.id, true)],
      ["setFactConfirmed", () => bidsApi.setFactConfirmed(b, bid.id, "submission_deadline", true)],
      ["listQuestions", () => bidsApi.listQuestions(b, bid.id)],
      ["addQuestion", () => bidsApi.addQuestion(b, bid.id, { text: "Injected question" })],
      ["getQuestion via own bid", () => bidsApi.getQuestion(b, own.id, question.id)],
      ["updateQuestion", () => bidsApi.updateQuestion(b, bid.id, question.id, { text: "Changed question" })],
      ["setQuestionStatus", () => bidsApi.setQuestionStatus(b, bid.id, question.id, "final")],
      ["deleteQuestion", () => bidsApi.deleteQuestion(b, bid.id, question.id)],
      ["draftAnswer", () => draftAnswer(b, bid.id, question.id)],
      ["saveAnswer", () => saveAnswer(b, bid.id, question.id, { text: "Overwritten" })],
      ["evaluateAnswer", () => evaluateAnswer(b, bid.id, question.id)],
      ["applySuggestions", () => applySuggestions(b, bid.id, question.id, { indexes: [0] })],
      ["restoreVersion", () => restoreVersion(b, bid.id, question.id, version)],
      ["exportAnswersDocx", () => exportAnswersDocx(b, bid.id)],
      ["exportBriefDocx", () => exportBriefDocx(b, bid.id)],
      ["exportRequirementsDocx", () => exportRequirementsDocx(b, bid.id)],
      ["exportRequirementsCsv", () => exportRequirementsCsv(b, bid.id)],
      ["consumeBidAllowance", () => consumeBidAllowance(userB.organizationId, bid.id)],
      ["malformed id", () => bidsApi.getBid(b, "not-a-uuid' or 1=1 --")],
    ];
    for (const [name, attempt] of attempts) {
      await expect(attempt(), name).rejects.toBeInstanceOf(NotFoundError);
    }
    await expect(runCompanyCheck(userB.organizationId, bid.id, userB.id)).rejects.toThrow("Bid not found");

    // B sees only its own bid; A's data is exactly as it was.
    expect((await bidsApi.listBids(b)).map((row) => row.id)).toEqual([own.id]);
    expect((await bidsApi.listBids(a)).map((row) => row.id)).toEqual([bid.id]);
    expect(await bidsApi.getBid(a, bid.id)).toMatchObject({ title: bid.title, status: "ready" });
    expect(await bidsApi.getRequirement(a, bid.id, requirement.id)).toMatchObject({ companyStatus: "unknown", checkedAt: null });
    expect(await bidsApi.getQuestion(a, bid.id, question.id)).toMatchObject({ draftText: "Our method is simple.", status: "draft" });
    expect(await db.select().from(bidRequirements).where(eq(bidRequirements.bidId, bid.id))).toHaveLength(1);
    expect(await db.select().from(bidFiles).where(eq(bidFiles.bidId, bid.id))).toHaveLength(1);
    // Every row carries its workspace.
    expect((await db.select().from(bidQuestions).where(eq(bidQuestions.bidId, bid.id)))[0]!.organizationId).toBe(userA.organizationId);
  });

  it("route handlers return 401 without a session and 404 for another workspace's bid", async () => {
    const { bid, file } = await seedBidA();
    const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) });
    const url = (path: string) => new Request(`http://localhost:3000${path}`);
    const calls = {
      status: () => statusRoute(url(`/api/bids/${bid.id}/status`), params({ bidId: bid.id })),
      file: () => fileRoute(url(`/api/bids/${bid.id}/files/${file.id}`), params({ bidId: bid.id, fileId: file.id })),
      csv: () => exportRoute(url(`/api/bids/${bid.id}/export/requirements-csv`), params({ bidId: bid.id, kind: "requirements-csv" })),
      answers: () => exportRoute(url(`/api/bids/${bid.id}/export/answers`), params({ bidId: bid.id, kind: "answers" })),
      upload: () =>
        uploadRoute(new Request(`http://localhost:3000/api/bids/${bid.id}/upload?fileId=${file.id}&name=evil.txt`, { method: "PUT", body: "overwrite", headers: { origin: "http://localhost:3000" } }), params({ bidId: bid.id })),
    };

    actAs(null);
    for (const [name, call] of Object.entries(calls)) expect((await call()).status, `${name} anonymous`).toBe(401);
    actAs(userB);
    for (const [name, call] of Object.entries(calls)) expect((await call()).status, `${name} other workspace`).toBe(404);

    actAs(userA);
    const status = await calls.status();
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ status: "ready", counts: { files: 1, requirements: 1, questions: 1 } });
    const source = await calls.file();
    expect(source.status).toBe(200);
    expect(await source.text()).toContain("Invitation to tender");
    expect(source.headers.get("content-disposition")).toMatch(/attachment/); // only real PDFs are shown inline
    const csv = await calls.csv();
    expect(csv.status).toBe(200);
    expect(await csv.text()).toContain("Public liability insurance");
    expect((await calls.answers()).headers.get("content-disposition")).toMatch(/-answers\.docx"$/);
    expect((await exportRoute(url(`/api/bids/${bid.id}/export/everything`), params({ bidId: bid.id, kind: "everything" }))).status).toBe(404);
    // The owner cannot add files to an analysed bid either.
    expect((await calls.upload()).status).toBe(409);
  });

  it("the worker endpoint only accepts the app's own short-lived signature", async () => {
    const post = (authorization?: string) => workerRoute(new Request("http://localhost:3000/api/bids/worker", { method: "POST", headers: authorization ? { authorization } : {} }), undefined);
    expect((await post()).status).toBe(401);
    expect((await post("BidsWorker 1700000000.deadbeef")).status).toBe(401);
    expect((await post(workerAuthHeader(Date.now() - 10 * 60_000))).status).toBe(401); // too old
    expect((await post(workerAuthHeader())).status).toBe(202);
  });
});

describe("plan gating (access adapter)", () => {
  const start = async (scope: Scope) => {
    const bid = await createBidWithFiles(scope, PACK);
    return bidsApi.startBidProcessing(scope, bid.id);
  };

  it("Free: one cited check, ever — then an upgrade is required; no drafting", async () => {
    expect(await getBidAccess(userA.organizationId)).toMatchObject({ planName: "Free", drafting: false, freeCheckAvailable: true, bidPasses: 0, next: { source: "free_brief", level: "brief" } });
    const first = await start(a);
    expect(first).toMatchObject({ status: "processing", accessLevel: "brief", accessSource: "free_brief" });
    expect(await getBidAccess(userA.organizationId)).toMatchObject({ freeCheckAvailable: false, next: null });

    const second = await createBidWithFiles(a, PACK);
    await expect(bidsApi.startBidProcessing(a, second.id)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", status: 402 });
    expect((await bidsApi.getBid(a, second.id)).status).toBe("draft");
    expect((await db.select().from(events).where(and(eq(events.organizationId, userA.organizationId), eq(events.name, "quota.limit_reached")))).length).toBe(1);

    expect(await getBidCapabilities(userA.organizationId, first)).toEqual({ drafting: false, exportAnswers: false, lockedReason: "check_only" });
    const question = await bidsApi.addQuestion(a, first.id, { text: "Describe your method." });
    await expect(draftAnswer(a, first.id, question.id)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", status: 402 });
    await expect(saveAnswer(a, first.id, question.id, { text: "typed by hand" })).rejects.toMatchObject({ status: 402 });
    await expect(exportAnswersDocx(a, first.id)).rejects.toMatchObject({ status: 402 });
    // The check itself can always be exported.
    expect((await exportRequirementsCsv(a, first.id)).fileName).toMatch(/\.csv$/);
    // Another workspace still has its own free check.
    expect((await start(b)).accessSource).toBe("free_brief");
  });

  it("a Bid Pass buys one full bid, is granted idempotently, and is spent after the free check", async () => {
    expect(await canStartFullBid(userA.organizationId)).toBe(false);
    expect(await grantBidPass(userA.organizationId, { source: "paddle", externalRef: "txn_123" })).toBe(true);
    expect(await grantBidPass(userA.organizationId, { source: "paddle", externalRef: "txn_123" })).toBe(false); // webhook replay
    expect(await getBidAccess(userA.organizationId)).toMatchObject({ bidPasses: 1, next: { source: "free_brief", level: "brief" } });
    expect(await canStartFullBid(userA.organizationId)).toBe(true);

    // Nobody should spend a Bid Pass to find out they are not eligible: the free check goes first.
    const check = await start(a);
    expect(check).toMatchObject({ accessLevel: "brief", accessSource: "free_brief" });
    // Unlocking drafting on that check spends the pass — once.
    const unlocked = await bidsApi.unlockFullBid(a, check.id);
    expect(unlocked).toMatchObject({ accessLevel: "full", accessSource: "credit" });
    expect(await bidsApi.unlockFullBid(a, check.id)).toMatchObject({ accessLevel: "full" });
    const credits = await db.select().from(bidCredits).where(and(eq(bidCredits.organizationId, userA.organizationId), eq(bidCredits.kind, "bid_pass")));
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ consumedBidId: check.id });
    expect(credits[0]!.consumedAt).not.toBeNull();
    // A bid bought with a pass keeps drafting on any plan.
    expect(await getBidCapabilities(userA.organizationId, unlocked)).toEqual({ drafting: true, exportAnswers: true, lockedReason: null });
    expect(await canStartFullBid(userA.organizationId)).toBe(false);
    const next = await createBidWithFiles(a, PACK);
    await expect(bidsApi.startBidProcessing(a, next.id)).rejects.toMatchObject({ status: 402 });
    await expect(bidsApi.unlockFullBid(a, next.id)).rejects.toMatchObject({ status: 402 });

    // An expired pass is worth nothing.
    await grantBidPass(userB.organizationId, { source: "admin", expiresAt: new Date(Date.now() - 1000) });
    expect(await canStartFullBid(userB.organizationId)).toBe(false);
  });

  it("one allowance is taken once, even when two bids start at the same moment", async () => {
    const [one, two] = await Promise.all([createBidWithFiles(a, PACK), createBidWithFiles(a, PACK)]);
    const results = await Promise.allSettled([bidsApi.startBidProcessing(a, one.id), bidsApi.startBidProcessing(a, two.id)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    // Asking again for the bid that got it changes nothing.
    const winner = (results.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<bidsApi.BidRow>).value;
    expect(await consumeBidAllowance(userA.organizationId, winner.id)).toEqual({ ok: true, level: "brief", source: "free_brief" });
    expect(await db.select().from(bidCredits).where(eq(bidCredits.organizationId, userA.organizationId))).toHaveLength(1);
  });

  it("simulated plans: Bid Desk gives 3 full bids a month, Radar Pro 1 check a month", async () => {
    process.env.BIDS_SIMULATE_PLAN = "bid_desk";
    expect(await getBidAccess(userA.organizationId)).toMatchObject({ planName: "Bid Desk", simulated: true, drafting: true, fullBids: { limit: 3, used: 0, remaining: 3 }, next: { source: "plan_bid", level: "full" } });
    const started = [await start(a), await start(a), await start(a)];
    expect(started.map((bid) => [bid.accessLevel, bid.accessSource])).toEqual(Array(3).fill(["full", "plan_bid"]));
    expect(await getBidCapabilities(userA.organizationId, started[0]!)).toMatchObject({ drafting: true, lockedReason: null });
    expect(await getBidAccess(userA.organizationId)).toMatchObject({ fullBids: { used: 3, remaining: 0 }, next: { source: "free_brief", level: "brief" } });
    expect(await canStartFullBid(userA.organizationId)).toBe(false);
    // The fourth pack this month is still read (the free check), but as a check only; the fifth is refused.
    expect(await start(a)).toMatchObject({ accessLevel: "brief", accessSource: "free_brief" });
    const fifth = await createBidWithFiles(a, PACK);
    await expect(bidsApi.startBidProcessing(a, fifth.id)).rejects.toMatchObject({ status: 402 });

    // A new month: the allowance is back.
    await db.update(bids).set({ allowancePeriodStart: new Date(Date.UTC(2020, 0, 1)) }).where(eq(bids.organizationId, userA.organizationId));
    expect(await getBidAccess(userA.organizationId)).toMatchObject({ fullBids: { used: 0, remaining: 3 } });
    expect(await bidsApi.startBidProcessing(a, fifth.id)).toMatchObject({ accessLevel: "full", accessSource: "plan_bid" });

    // After a downgrade the plan's bids stay readable but locked.
    process.env.BIDS_SIMULATE_PLAN = "free";
    expect(await getBidCapabilities(userA.organizationId, started[0]!)).toEqual({ drafting: false, exportAnswers: false, lockedReason: "plan_lapsed" });

    process.env.BIDS_SIMULATE_PLAN = "radar_pro";
    expect(await getBidAccess(userB.organizationId)).toMatchObject({ planName: "Radar Pro", drafting: false, checks: { limit: 1 }, next: { source: "plan_brief", level: "brief" } });
    expect((await start(b)).accessSource).toBe("plan_brief");
    expect((await start(b)).accessSource).toBe("free_brief");
    await expect(start(b)).rejects.toMatchObject({ status: 402 });
  });

  it("the simulation switch is ignored on a production deployment", async () => {
    process.env.BIDS_SIMULATE_PLAN = "bid_desk_plus";
    expect((await getBidAccess(userA.organizationId)).planName).toBe("Bid Desk Plus");
    process.env.VERCEL_ENV = "production";
    expect(await getBidAccess(userA.organizationId)).toMatchObject({ planName: "Free", simulated: false, drafting: false });
  });
});
