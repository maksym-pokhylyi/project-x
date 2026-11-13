import { APICallError, JSONParseError, TypeValidationError } from "ai";
import { desc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { errorLog, jobs, organizations } from "@/db/schema";
import { describeError, scrubText } from "@/lib/describe-error";
import { jobHandlers } from "@/lib/jobs/handlers";
import { enqueueJob, markJobFailed } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/worker";
import { log } from "@/lib/logger";
import { reportError } from "@/lib/report-error";
import { buildSentryEnvelope } from "@/lib/sentry";
import { resetDatabase } from "./helpers/db";

/**
 * F-02 / F-23 — nothing that is logged, stored or forwarded may contain bound query
 * parameters, model output, tokens or NUL bytes.
 */
const SECRET_TEXT = "CONFIDENTIAL TENDER TEXT: our price is GBP 1,234,567";
const SESSION_TOKEN = "Zk3vQ9sT7uWxY2aB4cD6eF8gH0jK1mN5";

/** A real failed statement: duplicate primary key, with sensitive values among its parameters. */
async function failedInsert(): Promise<unknown> {
  await db.insert(organizations).values({ id: "dup", name: "first", slug: "s1", createdAt: new Date() });
  return db
    .insert(organizations)
    .values({ id: "dup", name: SECRET_TEXT, slug: "s2", createdAt: new Date(), metadata: SESSION_TOKEN })
    .catch((error: unknown) => error);
}

const latestError = async () => (await db.select().from(errorLog).orderBy(desc(errorLog.createdAt)).limit(1))[0]!;

describe("describeError", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("the raw driver error really does carry the parameters (what we are protecting against)", async () => {
    const error = (await failedInsert()) as Error;
    expect(error.message).toContain("params:");
    expect(error.message).toContain(SECRET_TEXT);
    expect(error.message).toContain(SESSION_TOKEN);
  });

  it("keeps SQL text, SQLSTATE and constraint of a failed query but none of its values", async () => {
    const described = describeError(await failedInsert());
    expect(described.name).toBe("DrizzleQueryError");
    expect(described.code).toBe("23505");
    expect(described.message).toContain('insert into "organizations"');
    expect(described.message).toContain("SQLSTATE 23505 unique_violation");
    expect(described.message).toContain('constraint "organizations_pkey"');
    expect(described.message).toContain('table "organizations"');
    for (const text of [described.message, described.stack ?? ""]) {
      expect(text).not.toContain("params");
      expect(text).not.toContain("CONFIDENTIAL");
      expect(text).not.toContain("1,234,567");
      expect(text).not.toContain(SESSION_TOKEN);
      expect(text).not.toContain("dup");
    }
    // Stack: frames only — the first line of a stack repeats the message.
    expect(described.stack).toMatch(/^\s+at /);
    expect(described.stack?.split("\n").every((line) => /^\s+at /.test(line))).toBe(true);
  });

  it("removes literals that were inlined into the SQL text", () => {
    const described = describeError(Object.assign(new Error("Failed query: x\nparams: a"), { query: "select * from users where email = 'jo@example.com' and token = $1", params: ["t"] }));
    expect(described.message).toContain("where email = '?' and token = $1");
    expect(described.message).not.toContain("jo@example.com");
  });

  it("reduces AI SDK errors to their name and status: no prompt, model output or response body", () => {
    const parse = describeError(new JSONParseError({ text: `{"answer": "${SECRET_TEXT}"`, cause: new Error("Unexpected end") }));
    expect(parse.message).toBe("AI_JSONParseError");
    const validation = describeError(new TypeValidationError({ value: { leaked: SECRET_TEXT }, cause: new Error("bad") }));
    expect(validation.message).toBe("AI_TypeValidationError");
    const call = describeError(
      new APICallError({ message: `Rejected: ${SECRET_TEXT}`, url: "https://gateway.example/v1?key=abc", requestBodyValues: { prompt: SECRET_TEXT }, statusCode: 429, responseBody: SECRET_TEXT }),
    );
    expect(call).toMatchObject({ name: "AI_APICallError", message: "AI_APICallError (HTTP 429, retryable=true)", code: "429" });
    for (const described of [parse, validation, call]) expect(JSON.stringify(described)).not.toContain("CONFIDENTIAL");
  });

  it("scrubs free-text messages: tokens, links, addresses, control characters, length", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImpvQGV4YW1wbGUuY29tIn0.c2lnbmF0dXJlc2lnbmF0dXJl";
    const scrubbed = scrubText(
      `reset for jo.bloggs@supplier.example via https://app.example/api/auth/reset-password/Ab3dEf6hIj9lMn2pQr5tUv8x?callbackURL=%2Fx&token=secret ` +
        `auth Bearer sk_live_123 jwt ${jwt} session ${SESSION_TOKEN} nul\u0000byte id 123e4567-e89b-42d3-a456-426614174000`,
    );
    expect(scrubbed).not.toContain("jo.bloggs");
    expect(scrubbed).toContain("[email]");
    expect(scrubbed).toContain("https://app.example/api/auth/reset-password/[redacted]?[redacted]");
    expect(scrubbed).not.toContain("token=secret");
    expect(scrubbed).not.toContain("sk_live_123");
    expect(scrubbed).not.toContain(jwt);
    expect(scrubbed).not.toContain(SESSION_TOKEN);
    expect(scrubbed).not.toContain("\u0000");
    expect(scrubbed).toContain("123e4567-e89b-42d3-a456-426614174000"); // request/job ids stay searchable
    expect(scrubText("x".repeat(20) + " word ".repeat(1000)).length).toBeLessThanOrEqual(1000);
  });

  it("handles thrown non-errors without echoing objects", () => {
    expect(describeError({ password: "hunter2" }).message).toBe("(no message)");
    expect(describeError(null).message).toBe("Non-error value thrown (null)");
    expect(describeError(42).message).toBe("Non-error value thrown (number)");
    expect(describeError("plain string").message).toBe("plain string");
  });

  describe("every sink", () => {
    it("reportError: error_log row and log line carry no parameters", async () => {
      vi.stubEnv("LOG_LEVEL", "error");
      const logged: string[] = [];
      vi.spyOn(console, "error").mockImplementation((line: unknown) => void logged.push(String(line)));
      await reportError(await failedInsert(), { route: "/api/test", requestId: "req_1", extra: { note: "with\u0000nul" } });

      const row = await latestError();
      expect(row.message).toContain("SQLSTATE 23505");
      expect(row.context).toEqual({ note: "withnul" });
      for (const text of [row.message, row.stack ?? "", ...logged]) {
        expect(text).not.toContain("CONFIDENTIAL");
        expect(text).not.toContain(SESSION_TOKEN);
        expect(text).not.toContain("params:");
      }
      expect(logged.join("\n")).toContain("SQLSTATE 23505");
    });

    it("reportError: a NUL byte in the message no longer loses the error_log row (F-23)", async () => {
      await reportError(new Error("invalid byte sequence near \u0000 in upload"), { route: "/api/upload" });
      const rows = await db.select().from(errorLog);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.message).toContain("invalid byte sequence near");
      expect(rows[0]!.message).not.toContain("\u0000");
    });

    it("the logger sanitises Error values passed as fields", async () => {
      vi.stubEnv("LOG_LEVEL", "error");
      const logged: string[] = [];
      vi.spyOn(console, "error").mockImplementation((line: unknown) => void logged.push(String(line)));
      log.error("query failed", { error: await failedInsert() });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain("SQLSTATE 23505");
      expect(logged[0]).not.toContain("CONFIDENTIAL");
      expect(logged[0]).not.toContain(SESSION_TOKEN);
    });

    it("jobs.last_error: a handler failing on a query stores no parameters", async () => {
      const original = jobHandlers["email.send"];
      jobHandlers["email.send"] = async () => {
        throw await failedInsert();
      };
      try {
        const id = await enqueueJob("email.send", { outboxId: "00000000-0000-4000-8000-000000000000" }, { maxAttempts: 1 });
        await runWorker({ maxJobs: 1 });
        const [job] = await db.select().from(jobs).where(eq(jobs.id, id!));
        expect(job?.status).toBe("failed");
        expect(job?.lastError).toContain("SQLSTATE 23505");
        expect(job?.lastError).not.toContain("CONFIDENTIAL");
        expect(job?.lastError).not.toContain(SESSION_TOKEN);
        expect((await latestError()).message).not.toContain("CONFIDENTIAL");
      } finally {
        jobHandlers["email.send"] = original;
      }
    });

    it("markJobFailed scrubs whatever message it is given", async () => {
      const id = await enqueueJob("maintenance.cleanup", {}, { maxAttempts: 1 });
      await markJobFailed({ id: id!, attempts: 1, maxAttempts: 1 }, `sending to jo@example.com failed, token ${SESSION_TOKEN}`);
      const [job] = await db.select().from(jobs).where(eq(jobs.id, id!));
      expect(job?.lastError).toBe("sending to [email] failed, token [redacted]");
    });

    it("Sentry: the envelope is built from the sanitised description", async () => {
      const envelope = buildSentryEnvelope("https://key@o1.ingest.sentry.io/42", (await failedInsert()) as Error, { route: "/api/test" });
      expect(envelope.body).toContain("SQLSTATE 23505");
      expect(envelope.body).not.toContain("CONFIDENTIAL");
      expect(envelope.body).not.toContain(SESSION_TOKEN);
      expect(envelope.body).not.toContain("params:");
    });
  });
});
