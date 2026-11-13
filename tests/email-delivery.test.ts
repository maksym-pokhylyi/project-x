import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// This file exercises the "provider configured" path: set the key before any app module loads.
const { sendMock } = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Bidfolio <no-reply@bidfolio.co.uk>";
  return { sendMock: vi.fn() };
});

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));
// Keep the inline kick out of the way; the tests drive the worker explicitly.
vi.mock("@/lib/background", () => ({ runInBackground: vi.fn() }));

import { db } from "@/db";
import { emailOutbox, jobs } from "@/db/schema";
import { features } from "@/env";
import { sendEmail } from "@/lib/email/send";
import { runWorker } from "@/lib/jobs/worker";
import { resetDatabase } from "./helpers/db";

const template = { name: "reset-password", props: { name: "Ada", url: "https://bidfolio.co.uk/reset-password?token=abc" } } as const;

describe("email delivery through Resend (mocked)", () => {
  beforeEach(async () => {
    await resetDatabase();
    sendMock.mockReset();
  });

  it("is in provider mode", () => {
    expect(features.emailConfigured).toBe(true);
    expect(features.requireEmailVerification).toBe(true);
  });

  it("queues the email with a job, sends it once and clears the stored body", async () => {
    sendMock.mockResolvedValue({ data: { id: "resend_123" }, error: null });
    const outboxId = await sendEmail("Ada@Example.com", template);

    let [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
    expect(row).toMatchObject({ status: "queued", toEmail: "ada@example.com", template: "reset-password" });
    expect(row?.html).toContain("https://bidfolio.co.uk/reset-password?token=abc");
    expect(await db.select().from(jobs)).toHaveLength(1);
    expect(sendMock).not.toHaveBeenCalled();

    expect(await runWorker()).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0]!;
    expect(payload).toMatchObject({ from: "Bidfolio <no-reply@bidfolio.co.uk>", to: "ada@example.com", subject: expect.stringContaining("Reset your") });
    expect(payload.html).toContain("token=abc");
    expect(payload.text).toContain("token=abc");
    expect(options).toEqual({ idempotencyKey: `outbox-${outboxId}` });

    [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
    expect(row).toMatchObject({ status: "sent", providerMessageId: "resend_123", html: null, text: null, error: null });
    expect(row?.sentAt).toBeInstanceOf(Date);
  });

  it("retries with backoff when the provider fails, then delivers", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "rate limited", name: "rate_limit_exceeded" } });
    sendMock.mockResolvedValueOnce({ data: { id: "resend_456" }, error: null });
    const outboxId = await sendEmail("ada@example.com", template);

    expect(await runWorker()).toMatchObject({ claimed: 1, retried: 1 });
    let [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
    expect(row).toMatchObject({ status: "failed", error: "rate limited" });
    expect(row?.html).toBeTruthy(); // kept for the retry
    const [job] = await db.select().from(jobs);
    expect(job).toMatchObject({ status: "pending", attempts: 1 });
    expect(job!.runAfter.getTime()).toBeGreaterThan(Date.now() + 20_000);

    await db.update(jobs).set({ runAfter: new Date(Date.now() - 1000) });
    expect(await runWorker()).toMatchObject({ claimed: 1, succeeded: 1 });
    [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
    expect(row).toMatchObject({ status: "sent", providerMessageId: "resend_456" });
    // Same idempotency key on both attempts: the provider can de-duplicate.
    expect(sendMock.mock.calls.map((call) => call[1])).toEqual([
      { idempotencyKey: `outbox-${outboxId}` },
      { idempotencyKey: `outbox-${outboxId}` },
    ]);
  });

  it("does not send twice if the job runs again after success", async () => {
    sendMock.mockResolvedValue({ data: { id: "resend_789" }, error: null });
    const outboxId = await sendEmail("ada@example.com", template);
    await runWorker();
    await db.update(jobs).set({ status: "pending", runAfter: new Date(Date.now() - 1000), attempts: 0 });
    expect(await runWorker()).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
    expect(row?.status).toBe("sent");
  });
});
