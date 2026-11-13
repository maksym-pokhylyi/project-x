import type { ModelMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
// Server Actions revalidate pages; there is no page cache in a unit test.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/features/procurement/queries/notices", () => ({
  getTender: vi.fn(),
}));

import {
  AI_DOCUMENT_MAX_OUTPUT_TOKENS,
  AI_FILE_TOKENS_PER_PAGE,
  AI_MAX_OUTPUT_TOKENS,
  estimateCostUsd,
  MODEL_PRICES,
} from "@/config/ai";
import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import {
  aiUsage,
  bidCredits,
  bidFiles,
  bidQuestions,
  bidRequirements,
  bids,
  companyFacts,
  events,
  libraryDocs,
} from "@/db/schema";
import {
  createBidAction,
  deleteBidAction,
  saveAnswerAction,
} from "@/features/bids/actions";
import { callText } from "@/features/bids/server/ai/call";
import { setBidModelResolverForTests } from "@/features/bids/server/ai/models";
import * as bidsApi from "@/features/bids/server/bids";
import { listBidDeadlines } from "@/features/bids/server/deadlines";
import { runBidRetention } from "@/features/bids/server/retention";
import { bidFolder, bidWorkFolder } from "@/features/bids/server/store";
import { lookupTender } from "@/features/bids/server/tender";
import {
  deleteLibraryDocAction,
  saveCompanyFactsAction,
} from "@/features/library/actions";
import { getTender } from "@/features/procurement/queries/notices";
import { AiBudgetExceededError, aiBudgetLimits, AiInputTooLargeError, estimatePromptTokens, generateAiText } from "@/lib/ai";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { SeatsOverLimitError } from "@/lib/errors";
import { orgFileKey, orgStoragePrefix, storage } from "@/lib/storage";
import { requireOrg } from "@/server/session";
import {
  deleteWorkspace,
  exportWorkspaceData,
  listTenantTables,
} from "@/server/tenant-data";
import {
  actAs,
  addMember,
  createTestUser,
  type TestUser,
} from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import {
  addLibraryDoc,
  confirmFacts,
  createBidWithFiles,
  installMockModel,
  priceMockModels,
  scopeOf,
  type Scope,
} from "./helpers";

/**
 * Where the bid desk meets the foundation: budget reservations, document-scale calls,
 * workspace erasure and export, retention, read-only workspaces, the Radar lookup and the
 * deadline list for reminders.
 */
let user: TestUser;
let scope: Scope;

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser();
  scope = scopeOf(user);
  actAs(null);
});
afterEach(() => {
  setBidModelResolverForTests(null);
  priceMockModels();
  vi.mocked(getTender).mockReset();
});

const PACK = [
  {
    name: "ITT.txt",
    content:
      "Invitation to tender. Tenders must be returned by 12 noon on 4 December 2026.",
  },
];
const call = (
  organizationId: string,
  extra: Partial<Parameters<typeof callText>[0]> = {},
) =>
  callText({
    organizationId,
    feature: "test.call",
    step: "draft",
    system: "You are a test.",
    messages: "Say hello.",
    maxOutputTokens: 6_000,
    ...extra,
  });

/**
 * A mock price at which one 6,000-token call reserves `share` of what a Free workspace may
 * hold at once today — its own day, or the shared free pool where that is smaller — so these
 * tests do not depend on the numbers in the plan catalogue.
 */
async function priceCallsAt(share: number, organizationId: string): Promise<{ perCallUsd: number; binding: number }> {
  const limits = aiBudgetLimits(await getOrgEntitlements(organizationId));
  const binding = Math.min(limits.organizationDailyUsd, limits.freePoolDailyUsd ?? Number.POSITIVE_INFINITY);
  const perCallUsd = Math.round(binding * share * 1e6) / 1e6;
  priceMockModels({ inputPerMTok: 0, outputPerMTok: (perCallUsd / 6_000) * 1e6 });
  return { perCallUsd, binding };
}

describe("model calls under the reservation rules", () => {
  it("waits for its own running calls when their worst-case reservations crowd a later call out", async () => {
    // Each call reserves 60% of what the workspace may hold today: two never fit at once.
    let running = 0;
    let peak = 0;
    const mock = installMockModel(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 80));
      running -= 1;
      return "hello";
    });
    const { perCallUsd } = await priceCallsAt(0.6, user.organizationId);

    const results = await Promise.all([call(user.organizationId), call(user.organizationId), call(user.organizationId)]);

    expect(results.map((result) => result.text)).toEqual(["hello", "hello", "hello"]);
    expect(mock.calls).toHaveLength(3);
    // Never two at once: the second and third waited instead of failing or overspending.
    expect(peak).toBe(1);
    const rows = await db.select().from(aiUsage).where(eq(aiUsage.organizationId, user.organizationId));
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === "ok" && Math.abs((row.reservedUsd ?? 0) - perCallUsd) < 1e-6)).toBe(true);
    mock.restore();
  });

  it("passes the refusal on when nothing of its own is running", async () => {
    const mock = installMockModel(() => "hello");
    const { binding } = await priceCallsAt(0.6, user.organizationId);
    // Nine tenths of today's room is already spent (on the Free plan, so it counts in the free pool too).
    await db.insert(aiUsage).values({ organizationId: user.organizationId, feature: "seed", model: "mock/draft-primary", costUsd: binding * 0.9, planKey: "free" });

    await expect(call(user.organizationId)).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(mock.calls).toHaveLength(0);
    mock.restore();
  });

  it("does not wait for calls that were refused themselves", async () => {
    const mock = installMockModel(() => "hello");
    const { binding } = await priceCallsAt(0.6, user.organizationId);
    await db.insert(aiUsage).values({ organizationId: user.organizationId, feature: "seed", model: "mock/draft-primary", costUsd: binding * 0.9, planKey: "free" });

    // Five at once, none of which can ever fit: each is refused once and gives up.
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => call(user.organizationId)));

    expect(results.every((result) => result.status === "rejected" && result.reason instanceof AiBudgetExceededError)).toBe(true);
    expect(mock.calls).toHaveLength(0);
    const refusals = await db.select().from(events).where(eq(events.name, "ai.budget_exceeded"));
    expect(refusals.length).toBeLessThanOrEqual(5);
    mock.restore();
  });

  it("uses the document-scale ceilings only for steps that read a pack", async () => {
    const mock = installMockModel(() => "ok");
    const longPack = "The Contractor shall comply. ".repeat(18_000); // about 520 KB = 260K reserved tokens

    // A drafting step is a standard call: too large to send, and the output allowance is clamped.
    await expect(
      call(user.organizationId, { messages: longPack }),
    ).rejects.toBeInstanceOf(AiInputTooLargeError);
    await call(user.organizationId, { maxOutputTokens: 30_000 });
    // A pack reading may be that large and may return a long list.
    await call(user.organizationId, {
      step: "extract",
      messages: longPack,
      maxOutputTokens: 30_000,
    });

    const rows = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.organizationId, user.organizationId))
      .orderBy(aiUsage.createdAt);
    expect(rows).toHaveLength(2);
    const price = MODEL_PRICES["mock/draft-primary"]!;
    expect(rows[0]!.reservedUsd).toBeCloseTo(
      (AI_MAX_OUTPUT_TOKENS * price.outputPerMTok) / 1e6,
      4,
    );
    expect(rows[1]!.reservedUsd).toBeGreaterThan(
      (30_000 * price.outputPerMTok + 250_000 * price.inputPerMTok) / 1e6,
    );
    expect(AI_DOCUMENT_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(30_000);
    mock.restore();
  });

  it("reserves an attached PDF by its pages, and byte for byte when the pages are not stated", () => {
    const pdf = new Uint8Array(2_000_000);
    const prompt: ModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "file", data: pdf, mediaType: "application/pdf" },
          { type: "text", text: "Transcribe pages 1 to 12." },
        ],
      },
    ];
    const stated = estimatePromptTokens({ prompt, filePages: 12 });
    expect(stated).toBeGreaterThanOrEqual(12 * AI_FILE_TOKENS_PER_PAGE);
    expect(stated).toBeLessThan(12 * AI_FILE_TOKENS_PER_PAGE + 500);
    expect(estimatePromptTokens({ prompt })).toBeGreaterThanOrEqual(1_000_000);
    // The same file as base64 text is still a file, not two million characters of prose.
    const inline: ModelMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: Buffer.from(pdf.subarray(0, 300_000)).toString("base64"),
            mediaType: "application/pdf",
          },
        ],
      },
    ];
    expect(estimatePromptTokens({ prompt: inline, filePages: 2 })).toBeLessThan(
      2 * AI_FILE_TOKENS_PER_PAGE + 500,
    );
    // Plain text is unchanged: one token per two bytes.
    expect(
      estimatePromptTokens({ prompt: "x".repeat(10_000) }),
    ).toBeGreaterThanOrEqual(5_000);
  });

  it("settles a reservation to the cost the gateway reports", async () => {
    const model = new MockLanguageModelV4({
      provider: "mock",
      modelId: "draft-primary",
      doGenerate: async () => ({
        content: [{ type: "text" as const, text: "ok" }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: {
            total: 1_000,
            noCache: 1_000,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 500, text: 500, reasoning: undefined },
        },
        providerMetadata: { gateway: { cost: "0.004321" } },
        warnings: [],
      }),
    });
    const result = await generateAiText({
      organizationId: user.organizationId,
      feature: "test.cost",
      model,
      prompt: "hello",
      maxOutputTokens: 2_000,
    });
    expect(result.usage.costUsd).toBe(0.004321);
    const [row] = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.organizationId, user.organizationId));
    expect(row).toMatchObject({
      status: "ok",
      costUsd: 0.004321,
      inputTokens: 1_000,
      outputTokens: 500,
    });
    expect(row!.reservedUsd).toBeGreaterThan(0);
  });

  it("prices a long Haiku prompt at the long-prompt rate, for estimates and for reservations", () => {
    expect(
      estimateCostUsd("anthropic/claude-haiku-5.5", 100_000, 1_000),
    ).toBeCloseTo(0.0105, 6);
    expect(
      estimateCostUsd("anthropic/claude-haiku-5.5", 100_001, 1_000),
    ).toBeCloseTo(0.0525, 5);
    expect(
      estimateCostUsd("anthropic/claude-sonnet-5.5", 300_000, 1_000),
    ).toBeCloseTo(0.61, 6);
  });
});

describe("workspace erasure and export", () => {
  it("deleting a workspace removes its bids, files, library documents and company facts", async () => {
    const mock = installMockModel(() =>
      JSON.stringify({
        summary: "Policy.",
        kind: "policy",
        facts: [],
        parties: [],
        dates: [],
        expires_at: null,
      }),
    );
    const bid = await createBidWithFiles(scope, PACK);
    await bidsApi.addRequirement(scope, bid.id, {
      text: "Public liability insurance",
      category: "insurance",
      kind: "pass_fail",
      threshold: "£5m",
    });
    await bidsApi.addQuestion(scope, bid.id, {
      ref: "Q1",
      text: "Describe your method.",
      wordLimit: 200,
    });
    await addLibraryDoc(
      scope,
      "Quality policy.txt",
      "We hold ISO 9001. ".repeat(20),
    );
    await confirmFacts(scope, {});
    await db
      .insert(bidCredits)
      .values({
        organizationId: user.organizationId,
        kind: "bid_pass",
        source: "test",
      });
    // Working files and an upload that was never registered live in the same folder.
    await storage.put(
      orgFileKey(
        user.organizationId,
        "bids",
        bid.id,
        "work",
        "overview-primary.json",
      ),
      new TextEncoder().encode("{}"),
      { contentType: "application/json" },
    );
    mock.restore();

    // Every bid desk table is a tenant table, so the catalogue-driven erasure covers it.
    const tenantTables = await listTenantTables();
    for (const table of [
      "bids",
      "bid_files",
      "bid_requirements",
      "bid_questions",
      "library_docs",
      "company_facts",
      "bid_credits",
    ])
      expect(tenantTables).toContain(table);
    expect(
      (await storage.list(orgStoragePrefix(user.organizationId))).length,
    ).toBeGreaterThanOrEqual(4);

    actAs(user);
    const exported = await exportWorkspaceData(await requireOrg());
    expect(exported.tables.bids!.rows).toHaveLength(1);
    expect(exported.tables.bid_requirements!.rows).toHaveLength(1);
    expect(exported.tables.library_docs!.rows).toHaveLength(1);
    expect(
      exported.files.some((key) => key.includes(`/bids/${bid.id}/src/`)),
    ).toBe(true);
    expect(exported.files.some((key) => key.includes("/library/src/"))).toBe(
      true,
    );

    await deleteWorkspace(user.organizationId);

    for (const table of [
      bids,
      bidFiles,
      bidRequirements,
      bidQuestions,
      libraryDocs,
      companyFacts,
      bidCredits,
    ]) {
      expect(
        await db
          .select()
          .from(table)
          .where(eq(table.organizationId, user.organizationId)),
      ).toHaveLength(0);
    }
    expect(await storage.list(orgStoragePrefix(user.organizationId))).toEqual(
      [],
    );
  });

  it("deleting a bid removes its whole folder, including working files and unregistered uploads", async () => {
    const bid = await createBidWithFiles(scope, PACK);
    const other = await createBidWithFiles(scope, PACK);
    await storage.put(
      orgFileKey(
        user.organizationId,
        "bids",
        bid.id,
        "work",
        "requirements-second.json",
      ),
      new TextEncoder().encode("{}"),
      { contentType: "application/json" },
    );
    await storage.put(
      orgFileKey(
        user.organizationId,
        "bids",
        bid.id,
        "src",
        "11111111-1111-4111-8111-111111111111.pdf",
      ),
      new Uint8Array([1, 2, 3]),
      { contentType: "application/pdf" },
    );
    expect(
      await storage.list(bidFolder(user.organizationId, bid.id)),
    ).toHaveLength(3);

    await bidsApi.deleteBid(scope, bid.id);

    expect(await storage.list(bidFolder(user.organizationId, bid.id))).toEqual(
      [],
    );
    expect(
      await storage.list(bidFolder(user.organizationId, other.id)),
    ).toHaveLength(1);
  });
});

describe("retention", () => {
  it("removes the working files of checks that finished long enough ago, and nothing else", async () => {
    const day = 24 * 60 * 60 * 1000;
    const make = async (status: string, readyDaysAgo: number | null) => {
      const bid = await createBidWithFiles(scope, PACK);
      await db
        .update(bids)
        .set({
          status,
          readyAt:
            readyDaysAgo === null
              ? null
              : new Date(Date.now() - readyDaysAgo * day),
        })
        .where(eq(bids.id, bid.id));
      await storage.put(
        orgFileKey(
          user.organizationId,
          "bids",
          bid.id,
          "work",
          "overview-primary.json",
        ),
        new TextEncoder().encode("{}"),
        { contentType: "application/json" },
      );
      return bid.id;
    };
    const old = await make("ready", RETENTION_DAYS.bidWorkFiles + 1);
    const archived = await make("archived", RETENTION_DAYS.bidWorkFiles + 5);
    const recent = await make("ready", RETENTION_DAYS.bidWorkFiles - 1);
    const failed = await make("failed", null);

    expect(await runBidRetention()).toEqual({ bidWorkFiles: 2 });

    const work = async (bidId: string) =>
      (await storage.list(bidWorkFolder(user.organizationId, bidId))).length;
    expect([
      await work(old),
      await work(archived),
      await work(recent),
      await work(failed),
    ]).toEqual([0, 0, 1, 1]);
    // The uploaded documents stay: they are the customer's until the customer deletes them.
    for (const bidId of [old, archived, recent, failed])
      expect(
        await storage.list(bidFolder(user.organizationId, bidId)),
      ).toContainEqual(expect.stringContaining("/src/"));
    expect(await runBidRetention()).toEqual({ bidWorkFiles: 0 });
  });
});

describe("deadlines for reminders", () => {
  it("lists bids in progress with a known, future closing time — soonest first, this workspace only", async () => {
    const now = new Date("2026-11-20T09:00:00Z");
    const make = async (
      target: Scope,
      values: Partial<typeof bids.$inferInsert>,
    ) => {
      const bid = await bidsApi.createBid(target, {});
      await db.update(bids).set(values).where(eq(bids.id, bid.id));
      return bid.id;
    };
    const later = await make(scope, {
      title: "Grounds maintenance",
      buyerName: "Ryde Town Council",
      status: "ready",
      submissionDeadline: new Date("2026-12-04T12:00:00Z"),
    });
    const sooner = await make(scope, {
      title: "Bus shelters",
      buyerName: null,
      status: "processing",
      submissionDeadline: new Date("2026-11-27T17:00:00Z"),
    });
    await make(scope, {
      title: "Closed already",
      status: "ready",
      submissionDeadline: new Date("2026-11-19T12:00:00Z"),
    });
    await make(scope, {
      title: "Archived",
      status: "archived",
      submissionDeadline: new Date("2026-12-10T12:00:00Z"),
    });
    await make(scope, {
      title: "Two deadlines in the pack",
      status: "ready",
      submissionDeadline: null,
    });
    const stranger = await createTestUser();
    await make(scopeOf(stranger), {
      title: "Someone else's",
      status: "ready",
      submissionDeadline: new Date("2026-11-25T12:00:00Z"),
    });

    expect(await listBidDeadlines(user.organizationId, now)).toEqual([
      {
        bidId: sooner,
        title: "Bus shelters",
        buyerName: null,
        closesAt: new Date("2026-11-27T17:00:00Z"),
        href: `/app/bids/${sooner}`,
      },
      {
        bidId: later,
        title: "Grounds maintenance",
        buyerName: "Ryde Town Council",
        closesAt: new Date("2026-12-04T12:00:00Z"),
        href: `/app/bids/${later}`,
      },
    ]);
  });
});

describe("read-only workspaces", () => {
  it("refuses bid desk writes while the workspace is over its seat limit, and still lets data be removed", async () => {
    const bid = await createBidWithFiles(scope, PACK);
    // The Free plan includes two seats: a third member puts the workspace over its limit.
    await addMember(user.organizationId, await createTestUser(), "member");
    await addMember(user.organizationId, await createTestUser(), "member");
    actAs(user);
    await expect(requireOrg({ write: true })).rejects.toBeInstanceOf(
      SeatsOverLimitError,
    );

    for (const result of [
      await createBidAction({}),
      await saveAnswerAction(
        bid.id,
        "00000000-0000-4000-8000-000000000000",
        "text",
      ),
      await saveCompanyFactsAction({}),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        error: { code: "SEAT_LIMIT_REACHED" },
      });
    }
    expect(
      await db
        .select()
        .from(bids)
        .where(eq(bids.organizationId, user.organizationId)),
    ).toHaveLength(1);

    // Withdrawing data is not a product write.
    expect(
      await deleteLibraryDocAction("00000000-0000-4000-8000-000000000000"),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await deleteBidAction(bid.id)).toMatchObject({ ok: true });
    expect(
      await db
        .select()
        .from(bids)
        .where(eq(bids.organizationId, user.organizationId)),
    ).toHaveLength(0);
  });
});

describe("tender lookup (Radar)", () => {
  it("maps a notice to what the new-check page shows, and never invents one", async () => {
    vi.mocked(getTender).mockResolvedValueOnce({
      ocid: "ocds-h6vhtk-0a1b2c",
      releaseId: "048213-2026",
      title: "Grounds maintenance 2027 to 2030",
      buyerName: "Ryde Town Council",
      deadlineAt: "2026-12-04T12:00:00.000Z",
      noticeUrl: "https://www.find-tender.service.gov.uk/Notice/048213-2026",
    } as never);
    expect(await lookupTender("048213-2026")).toEqual({
      id: "ocds-h6vhtk-0a1b2c",
      title: "Grounds maintenance 2027 to 2030",
      buyerName: "Ryde Town Council",
      reference: "048213-2026",
      closesAt: new Date("2026-12-04T12:00:00.000Z"),
      url: "https://www.find-tender.service.gov.uk/Notice/048213-2026",
    });
    vi.mocked(getTender).mockResolvedValueOnce(null);
    expect(await lookupTender("999999-2026")).toBeNull();
    vi.mocked(getTender).mockRejectedValueOnce(
      new Error("relation notices does not exist"),
    );
    expect(await lookupTender("048213-2026")).toBeNull();
  });
});
