import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// This file exercises the "provider configured" path: set the key before any app module loads.
const { sendMock } = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Bidfolio <hello@bidfolio.co.uk>";
  return { sendMock: vi.fn() };
});

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));
// Keep the inline kick out of the way; the tests drive the worker explicitly.
vi.mock("@/lib/background", () => ({ runInBackground: vi.fn() }));
vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));

import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { emailOutbox, jobs, notificationLog } from "@/db/schema";
import { features } from "@/env";
import { cleanEmailHeaders, sendEmail } from "@/lib/email/send";
import { runWorker } from "@/lib/jobs/worker";
import { runMaintenance } from "@/lib/maintenance";
import { resetDatabase } from "../helpers/db";
import { resetProcurement } from "../procurement/helpers/schema";
import { addTender, createWorkspace, daysBefore, logRows, MONDAY, seedAcme, send, WEEK } from "./helpers";

/**
 * The e-mail pipeline carries optional headers from sendEmail() through the outbox to the
 * provider — additive: a call without them produces exactly the payload it did before.
 */
const template = { name: "reset-password", props: { name: "Ada", url: "https://bidfolio.co.uk/reset-password?token=abc" } } as const;
const LIST_HEADERS = { "List-Unsubscribe": "<https://bidfolio.co.uk/api/notifications/unsubscribe?t=abc.def>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };

beforeAll(async () => {
  await resetProcurement();
});

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "resend_123" }, error: null });
});

describe("headers reach the provider", () => {
  it("is in provider mode", () => {
    expect(features.mailDelivery).toBe("resend");
  });

  it("stores them with the outbox row and hands them to Resend unchanged", async () => {
    const outboxId = await sendEmail("ada@example.com", template, { headers: LIST_HEADERS });
    let [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
    expect(row).toMatchObject({ status: "queued", headers: LIST_HEADERS });

    expect(await runWorker()).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0]!;
    expect(payload).toMatchObject({ from: "Bidfolio <hello@bidfolio.co.uk>", to: "ada@example.com", headers: LIST_HEADERS });
    expect(options).toEqual({ idempotencyKey: `outbox-${outboxId}` });
    // Like the bodies, the headers hold a link: they are not kept once the provider has the message.
    [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
    expect(row).toMatchObject({ status: "sent", html: null, text: null, headers: null });
  });

  it("a call without headers sends the payload it always did", async () => {
    const outboxId = await sendEmail("ada@example.com", template);
    expect((await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId)))[0]!.headers).toBeNull();
    await runWorker();
    const [payload] = sendMock.mock.calls[0]!;
    expect(Object.keys(payload).sort()).toEqual(["from", "html", "subject", "text", "to"]);
    // An empty set is no set.
    await sendEmail("ada@example.com", template, { headers: {} });
    await runWorker();
    expect("headers" in sendMock.mock.calls[1]![0]).toBe(false);
  });

  it("refuses headers that could split the message or are not headers at all", () => {
    expect(cleanEmailHeaders(undefined)).toBeNull();
    expect(cleanEmailHeaders({})).toBeNull();
    expect(cleanEmailHeaders(LIST_HEADERS)).toEqual(LIST_HEADERS);
    const refused: Array<Record<string, string>> = [
      { "List-Unsubscribe": "<https://example.com>\r\nBcc: someone@example.com" },
      { "List-Unsubscribe": "line\nbreak" },
      { "Bad Name": "value" },
      { "Name:Injected": "value" },
      { "": "value" },
      { "X-Empty": "" },
      { "X-Long": "x".repeat(2001) },
      { "X-Number": 5 as unknown as string },
    ];
    for (const bad of refused) expect(() => cleanEmailHeaders(bad)).toThrow();
  });

  it("with a transaction, the message and its delivery job commit or vanish together", async () => {
    await expect(
      db.transaction(async (tx) => {
        await sendEmail("ada@example.com", template, { headers: LIST_HEADERS, executor: tx });
        throw new Error("caller rolled back");
      }),
    ).rejects.toThrow("caller rolled back");
    expect(await db.select().from(emailOutbox)).toEqual([]);
    expect(await db.select().from(jobs)).toEqual([]);

    const outboxId = await db.transaction((tx) => sendEmail("ada@example.com", template, { executor: tx }));
    expect(await db.select().from(emailOutbox)).toHaveLength(1);
    expect((await db.select().from(jobs)).map((job) => [job.type, job.dedupeKey])).toEqual([["email.send", `email.send:${outboxId}`]]);
  });

  it("a scheduled digest goes out with the one-click unsubscribe headers and a plain-text part", async () => {
    const workspace = await createWorkspace({ name: "Joanne Pike", supplier: await seedAcme() });
    await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    expect(await send("digest", WEEK, { organizationId: workspace.organizationId, userId: workspace.owner.id }, MONDAY)).toBe("sent");
    // Logged as sent and queued for delivery in one transaction; the provider has not been called yet.
    const [row] = await logRows({ kind: "digest" });
    const [queued] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, row!.outboxId!));
    expect(queued).toMatchObject({ status: "queued", template: "radar-digest" });
    expect(sendMock).not.toHaveBeenCalled();

    await runWorker();
    const digestCall = sendMock.mock.calls.find(([payload]) => payload.subject === "1 new tender for Acme Grounds");
    expect(digestCall).toBeDefined();
    const [payload, options] = digestCall!;
    expect(payload.to).toBe(workspace.owner.email.toLowerCase());
    expect(payload.from).toBe("Bidfolio <hello@bidfolio.co.uk>");
    expect(Object.keys(payload.headers)).toEqual(["List-Unsubscribe", "List-Unsubscribe-Post"]);
    expect(payload.headers["List-Unsubscribe"]).toMatch(/^<http:\/\/localhost:3000\/api\/notifications\/unsubscribe\?t=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}>$/);
    expect(payload.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(payload.html.includes("Open on Bidfolio") && payload.text.includes("Open on Bidfolio:"), "both parts").toBe(true);
    expect(options).toEqual({ idempotencyKey: `outbox-${row!.outboxId}` });
    // Delivering again (a retried job) cannot send it twice: the row is marked sent.
    await runWorker();
    expect(sendMock.mock.calls.filter(([sent]) => sent.subject === payload.subject)).toHaveLength(1);
  });
});

describe("retention", () => {
  it("keeps notification_log for 13 months and unsent headers for 7 days", async () => {
    expect(RETENTION_DAYS.notificationLog).toBe(395);
    const workspace = await createWorkspace({ name: "Joanne Pike" });
    const DAY = 86_400_000;
    const ago = (days: number) => new Date(Date.now() - days * DAY);
    const key = { userId: workspace.owner.id, organizationId: workspace.organizationId, kind: "digest" };
    await db.insert(notificationLog).values([
      { ...key, periodKey: "2025-W40", status: "sent", asOf: ago(396), sentAt: ago(396), createdAt: ago(396) },
      { ...key, periodKey: "2025-W41", status: "skipped_empty", asOf: ago(396), createdAt: ago(396) },
      { ...key, periodKey: "2025-W42", status: "sent", asOf: ago(394), sentAt: ago(394), createdAt: ago(394) },
      { ...key, periodKey: "2026-W47", status: "sent", asOf: ago(1), sentAt: ago(1), createdAt: ago(1) },
    ]);
    await db.delete(emailOutbox);
    await db.insert(emailOutbox).values([
      { toEmail: "a@example.com", subject: "old, never delivered", template: "radar-digest", html: "<p>x</p>", text: "x", headers: LIST_HEADERS, status: "failed", createdAt: ago(8) },
      { toEmail: "b@example.com", subject: "old, headers only", template: "radar-digest", html: null, text: null, headers: LIST_HEADERS, status: "failed", createdAt: ago(8) },
      { toEmail: "c@example.com", subject: "recent", template: "radar-digest", html: "<p>x</p>", text: "x", headers: LIST_HEADERS, status: "outbox", createdAt: ago(6) },
    ]);

    const summary = await runMaintenance();
    expect(summary).toMatchObject({ notificationLog: 2, emailBodies: 2 });
    expect((await logRows()).map((row) => row.periodKey).sort()).toEqual(["2025-W42", "2026-W47"]);
    const outbox = await db.select().from(emailOutbox);
    expect(outbox.filter((row) => row.subject.startsWith("old")).every((row) => row.html === null && row.text === null && row.headers === null)).toBe(true);
    expect(outbox.find((row) => row.subject === "recent")).toMatchObject({ headers: LIST_HEADERS, text: "x" });
    // Idempotent.
    expect(await runMaintenance()).toMatchObject({ notificationLog: 0, emailBodies: 0 });
  });
});
