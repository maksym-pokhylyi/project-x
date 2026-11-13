import { MockLanguageModelV4 } from "ai/test";
import { eq, sql } from "drizzle-orm";
import { zipSync } from "fflate";
import { db } from "@/db";
import { companyFacts, jobs } from "@/db/schema";
import { setBidModelResolverForTests, type ModelStep } from "@/features/bids/server/ai/models";
import * as bidsApi from "@/features/bids/server/bids";
import type { CompanyFacts } from "@/features/bids/types";
import { runWorker } from "@/lib/jobs/worker";
import { storage } from "@/lib/storage";
import { applyBidsSchema } from "../../scripts/bids/apply-schema";
import type { TestUser } from "../helpers/auth";

/** The bid desk tables are created on demand until their migration exists (see apply-schema.ts). */
export async function ensureBidsSchema(): Promise<void> {
  await applyBidsSchema(process.env.DATABASE_URL!);
}

export type Scope = bidsApi.Scope;

export function scopeOf(user: TestUser): Scope {
  return { organization: { id: user.organizationId }, user: { id: user.id } } as unknown as Scope;
}

// --- Mock model ---------------------------------------------------------------------------

export type MockCall = { step: ModelStep; which: "primary" | "fallback"; prompt: string };

function flatten(prompt: unknown): string {
  const messages = (prompt as Array<{ role: string; content: unknown }>) ?? [];
  return messages
    .map((message) => {
      if (typeof message.content === "string") return message.content;
      if (Array.isArray(message.content)) return message.content.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : "")).join("\n");
      return "";
    })
    .join("\n\n");
}

/**
 * Routes every model call of the bid desk to `respond(call)`, which returns the text the
 * "model" answers (or throws to simulate a failure). Calls are recorded for assertions.
 * Usage is tiny so budgets are never the reason a test fails.
 */
export function installMockModel(respond: (call: MockCall) => string | Promise<string>): { calls: MockCall[]; restore: () => void } {
  const calls: MockCall[] = [];
  setBidModelResolverForTests((step, which) => {
    return new MockLanguageModelV4({
      provider: "mock",
      modelId: `${step}-${which}`,
      doGenerate: async (options) => {
        const call: MockCall = { step, which, prompt: flatten(options.prompt) };
        calls.push(call);
        const text = await respond(call);
        return {
          content: [{ type: "text" as const, text }],
          finishReason: { unified: "stop" as const, raw: undefined },
          usage: { inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } },
          warnings: [],
        };
      },
    });
  });
  return { calls, restore: () => setBidModelResolverForTests(null) };
}

/** Which pipeline task a prompt belongs to. */
export function taskOf(prompt: string): "overview" | "keyfacts" | "requirements" | "questions" | "document" | "recheck" | "company" | "summary" | "facts" | "claims" | "evaluate" | "draft" | "transcribe" | "unknown" {
  if (prompt.includes("Transcribe ONLY these pages")) return "transcribe";
  if (prompt.includes("TASK: second-pass check")) return "recheck";
  if (prompt.includes("report ONLY these key facts")) return "keyfacts";
  if (prompt.includes("NOTE: the text above is ONE document")) return "document";
  if (prompt.includes("TASK: produce the compliance matrix")) return "requirements";
  if (prompt.includes("TASK: list EVERY question")) return "questions";
  if (prompt.includes("TASK: produce the bid brief")) return "overview";
  if (prompt.includes("For EACH requirement below decide its status")) return "company";
  if (prompt.includes("Catalogue the document above")) return "summary";
  if (prompt.includes("Fill in the company facts from the website text above")) return "facts";
  if (prompt.includes("List every statement in the DRAFT")) return "claims";
  if (prompt.includes("Mark the ANSWER.")) return "evaluate";
  if (prompt.includes("Write the answer now.") || prompt.includes("Revise the current answer") || prompt.includes("Rewrite it in at most")) return "draft";
  return "unknown";
}

export const NOT_STATED = { value: null, normalized: null, status: "not_stated", note: null, file: null, loc: null, quote: null };

export function emptyOverview(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    overview: "A test tender.",
    summary: {},
    key_dates: [],
    evaluation: { price_weight_percent: null, quality_weight_percent: null, social_value_weight_percent: null, weights_note: null, criteria: [], scoring_scale: [], minimum_thresholds: [], price_scoring_method: null },
    documents_to_return: [],
    red_flags: [],
    unknowns: [],
    ...extra,
  };
}

export const EMPTY_PATCH = {
  add_requirements: [],
  add_questions: [],
  add_criteria: [],
  add_minimum_thresholds: [],
  add_key_dates: [],
  add_documents_to_return: [],
  add_red_flags: [],
  summary_corrections: [],
  requirement_corrections: [],
  question_corrections: [],
  removals: [],
};

// --- Bids -----------------------------------------------------------------------------------

/** Creates a draft bid with text files already "uploaded" to storage. */
export async function createBidWithFiles(scope: Scope, files: Array<{ name: string; content: string | Uint8Array }>): Promise<bidsApi.BidRow> {
  const bid = await bidsApi.createBid(scope, {});
  for (const file of files) {
    const bytes = typeof file.content === "string" ? new TextEncoder().encode(file.content) : file.content;
    const plan = await bidsApi.planBidUpload(scope, bid.id, { name: file.name, size: bytes.byteLength });
    await storage.put(plan.storageKey, bytes, { contentType: plan.contentType });
    await bidsApi.registerBidFile(scope, bid.id, { fileId: plan.fileId, name: file.name });
  }
  return bid;
}

/** Runs queued jobs until the bid leaves `processing` (retries are released from their backoff). */
export async function runPipeline(scope: Scope, bidId: string, timeoutMs = 20_000): Promise<bidsApi.BidRow> {
  const deadline = Date.now() + timeoutMs;
  let bid = await bidsApi.getBid(scope, bidId);
  while (bid.status === "processing" && Date.now() < deadline) {
    await db.update(jobs).set({ runAfter: new Date(Date.now() - 1000) }).where(eq(jobs.status, "pending"));
    const summary = await runWorker({ maxJobs: 20, timeBudgetMs: 60_000 });
    // Nothing to claim: another worker (a watchdog kick) holds the job. Give it a moment.
    if (summary.claimed === 0) await new Promise((resolve) => setTimeout(resolve, 50));
    bid = await bidsApi.getBid(scope, bidId);
  }
  // Let a concurrent worker finish recording its job before the next test resets the database.
  for (let i = 0; i < 100; i += 1) {
    const [running] = await db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.status, "running"));
    if ((running?.count ?? 0) === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return bid;
}

export async function confirmFacts(scope: Scope, facts: CompanyFacts): Promise<void> {
  await db
    .insert(companyFacts)
    .values({ organizationId: scope.organization.id, facts, confirmedAt: new Date(), confirmedBy: scope.user.id })
    .onConflictDoUpdate({ target: companyFacts.organizationId, set: { facts, confirmedAt: new Date() } });
}

export async function countRows(table: string, bidId: string): Promise<number> {
  const rows = await db.execute<{ count: number }>(sql`select count(*)::int as count from ${sql.identifier(table)} where bid_id = ${bidId}`);
  return rows[0]?.count ?? 0;
}

// --- Fixture builders -----------------------------------------------------------------------

/** A minimal, valid single-font PDF with one page per string (text layer) or blank pages. */
export function buildPdf(pages: Array<string | null>): Uint8Array {
  const objects: string[] = [];
  const kids: string[] = [];
  const fontId = 3 + pages.length * 2;
  pages.forEach((text, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const lines = (text ?? "").split("\n");
    const stream =
      text === null
        ? "0.9 g 50 50 400 600 re f" // a grey rectangle: a "scan" with no text layer
        : `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((line) => `(${line.replace(/([()\\])/g, "\\$1")}) Tj T*`).join(" ")} ET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

export function buildZip(entries: Record<string, Uint8Array | string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, typeof value === "string" ? new TextEncoder().encode(value) : value])));
}
