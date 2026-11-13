import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { aiUsage, auditLog, billingPurchases, emailOutbox, errorLog, events, invitations, jobs, sessions, verifications, webhookEvents } from "@/db/schema";
import { ingestPaddleEvent, processStoredEvent } from "@/lib/billing/webhooks";
import { enqueueJob } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/worker";
import { runMaintenance } from "@/lib/maintenance";
import { createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, paddleEvent } from "./helpers/paddle";

/**
 * F-14 — operational tables must not grow without bound or keep personal data forever.
 * For each table: a row just INSIDE the retention period stays, one just outside goes.
 */
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const inside = (days: number) => ago(days - 1);
const outside = (days: number) => ago(days + 1);

describe("data retention (F-14)", () => {
  beforeEach(resetDatabase);

  it("documents a retention period for every operational table", () => {
    expect(RETENTION_DAYS).toEqual({
      jobsSucceeded: 14,
      jobsFailed: 90,
      events: 395,
      errorLog: 90,
      webhookPayload: 90,
      webhookEvents: 400,
      emailBodies: 7,
      emailOutbox: 90,
      sessionsExpired: 7,
      verificationsExpired: 1,
      invitationsClosed: 90,
      aiUsage: 395,
      auditLog: 730,
      checkoutNonces: 90,
      bidWorkFiles: 14,
      purchasePayload: 90,
      notificationLog: 395,
      outreachProspects: 365,
      outreachNamedAddresses: 90,
      outreachAudit: 730,
    });
  });

  it("a one-off purchase keeps its row; only the stored Paddle transaction is dropped after 90 days", async () => {
    const user = await createTestUser({ email: "owner@example.com" });
    const purchase = (transactionId: string, createdAt: Date) => ({
      organizationId: user.organizationId,
      userId: user.id,
      kind: "bid_pass",
      paddleTransactionId: transactionId,
      priceId: "pri_test_bid_pass",
      amountMinor: 9900,
      currency: "GBP",
      paddleEnvironment: "sandbox",
      raw: { id: transactionId, status: "completed" },
      createdAt,
    });
    await db.insert(billingPurchases).values([purchase("txn_old", outside(RETENTION_DAYS.purchasePayload)), purchase("txn_recent", inside(RETENTION_DAYS.purchasePayload))]);
    expect(await runMaintenance()).toMatchObject({ purchasePayloads: 1 });
    const rows = await db.select().from(billingPurchases);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.paddleTransactionId === "txn_old")).toMatchObject({ raw: null, kind: "bid_pass", amountMinor: 9900 });
    expect(rows.find((row) => row.paddleTransactionId === "txn_recent")!.raw).toEqual({ id: "txn_recent", status: "completed" });
    expect(await runMaintenance()).toMatchObject({ purchasePayloads: 0 });
  });

  it("removes what is past its retention period and keeps what is not", async () => {
    const user = await createTestUser({ email: "owner@example.com" });
    const org = user.organizationId;
    const d = RETENTION_DAYS;
    await db.delete(events);
    await db.delete(emailOutbox);

    // events, error_log, ai_usage, audit_log
    await db.insert(events).values([{ name: "old", createdAt: outside(d.events) }, { name: "recent", createdAt: inside(d.events) }]);
    await db.insert(errorLog).values([{ message: "old", createdAt: outside(d.errorLog) }, { message: "recent", createdAt: inside(d.errorLog) }]);
    await db.insert(aiUsage).values([
      { organizationId: org, feature: "old", model: "m", createdAt: outside(d.aiUsage) },
      { organizationId: org, feature: "recent", model: "m", createdAt: inside(d.aiUsage) },
    ]);
    await db.insert(auditLog).values([
      { organizationId: org, actorType: "system", action: "old", createdAt: outside(d.auditLog) },
      { organizationId: org, actorType: "system", action: "recent", createdAt: inside(d.auditLog) },
    ]);
    // jobs
    await db.insert(jobs).values([
      { type: "email.send", status: "succeeded", completedAt: outside(d.jobsSucceeded), dedupeKey: "ok-old" },
      { type: "email.send", status: "succeeded", completedAt: inside(d.jobsSucceeded), dedupeKey: "ok-recent" },
      { type: "email.send", status: "failed", updatedAt: outside(d.jobsFailed), dedupeKey: "failed-old" },
      { type: "email.send", status: "failed", updatedAt: inside(d.jobsFailed), dedupeKey: "failed-recent" },
      { type: "email.send", status: "pending", runAfter: new Date(Date.now() + DAY), createdAt: ago(500), updatedAt: ago(500), dedupeKey: "pending-ancient" },
    ]);
    // e-mail outbox: bodies after 7 days, rows after 90
    await db.insert(emailOutbox).values([
      { toEmail: "a@example.com", subject: "old", template: "invitation", html: "<a>link</a>", text: "link", status: "sent", createdAt: outside(d.emailOutbox) },
      { toEmail: "b@example.com", subject: "body-expired", template: "reset-password", html: "<a>link</a>", text: "link", status: "failed", createdAt: outside(d.emailBodies) },
      { toEmail: "c@example.com", subject: "fresh", template: "verify-email", html: "<a>link</a>", text: "link", status: "outbox", createdAt: inside(d.emailBodies) },
    ]);
    // sessions and verification tokens
    const stamp = new Date();
    await db.insert(sessions).values([
      { id: "s-old", token: "t-old", userId: user.id, expiresAt: outside(d.sessionsExpired), createdAt: stamp, updatedAt: stamp, ipAddress: "203.0.113.5" },
      { id: "s-just-expired", token: "t-just", userId: user.id, expiresAt: inside(d.sessionsExpired), createdAt: stamp, updatedAt: stamp },
    ]);
    await db.delete(verifications);
    await db.insert(verifications).values([
      { id: "v-old", identifier: "reset-password:old", value: user.id, expiresAt: outside(d.verificationsExpired) },
      { id: "v-live", identifier: "reset-password:live", value: user.id, expiresAt: new Date(Date.now() + 3_600_000) },
    ]);
    // invitations
    await db.insert(invitations).values([
      { id: "i-accepted-old", organizationId: org, email: "x@example.com", role: "member", status: "accepted", expiresAt: ago(100), createdAt: outside(d.invitationsClosed), inviterId: user.id },
      { id: "i-expired-old", organizationId: org, email: "y@example.com", role: "member", status: "pending", expiresAt: outside(d.invitationsClosed), createdAt: ago(200), inviterId: user.id },
      { id: "i-pending", organizationId: org, email: "z@example.com", role: "member", status: "pending", expiresAt: new Date(Date.now() + DAY), createdAt: new Date(), inviterId: user.id },
      { id: "i-canceled-recent", organizationId: org, email: "w@example.com", role: "member", status: "canceled", expiresAt: new Date(Date.now() + DAY), createdAt: inside(d.invitationsClosed), inviterId: user.id },
    ]);
    // rate limits
    await db.execute(sql`insert into rate_limits (key, window_start, count, expires_at) values ('auth:sign-in:ip:203.0.113.5', now() - interval '2 hours', 1, now() - interval '1 hour'), ('live', now(), 1, now() + interval '1 hour')`);

    const summary = await runMaintenance();
    expect(summary).toMatchObject({ events: 1, errorLog: 1, aiUsage: 1, auditLog: 1, jobsSucceeded: 1, jobsFailed: 1, emailOutbox: 1, emailBodies: 1, sessions: 1, verifications: 1, invitations: 2, rateLimits: 1 });

    expect((await db.select().from(events)).map((row) => row.name)).toEqual(["recent"]);
    expect((await db.select().from(errorLog)).map((row) => row.message)).toEqual(["recent"]);
    expect((await db.select().from(aiUsage)).map((row) => row.feature)).toEqual(["recent"]);
    expect((await db.select().from(auditLog)).map((row) => row.action)).toEqual(["recent"]);
    expect((await db.select().from(jobs)).map((row) => row.dedupeKey).sort()).toEqual(["failed-recent", "ok-recent", "pending-ancient"]);
    const outbox = await db.select().from(emailOutbox);
    expect(outbox.map((row) => row.subject).sort()).toEqual(["body-expired", "fresh"]);
    expect(outbox.find((row) => row.subject === "body-expired")).toMatchObject({ html: null, text: null });
    expect(outbox.find((row) => row.subject === "fresh")?.text).toBe("link");
    expect((await db.select().from(sessions).where(eq(sessions.userId, user.id))).map((row) => row.id).sort()).toEqual(expect.arrayContaining(["s-just-expired"]));
    expect((await db.select().from(sessions)).some((row) => row.id === "s-old")).toBe(false);
    expect((await db.select().from(verifications)).map((row) => row.id)).toEqual(["v-live"]);
    expect((await db.select().from(invitations)).map((row) => row.id).sort()).toEqual(["i-canceled-recent", "i-pending"]);
    expect((await db.execute<{ key: string }>(sql`select key from rate_limits`)).map((row) => row.key)).toEqual(["live"]);

    // Idempotent.
    const again = await runMaintenance();
    expect(Object.values(again).every((count) => count === 0)).toBe(true);
  });

  it("webhook payloads are reduced to a stub after 90 days, and the row is removed after 400", async () => {
    await createBillingOrg("org_retention");
    const old = paddleEvent("subscription.created", { organizationId: "org_retention" });
    const recent = paddleEvent("customer.created");
    const ancient = paddleEvent("customer.updated");
    for (const envelope of [old, recent, ancient]) await ingestPaddleEvent(envelope);
    await db.update(webhookEvents).set({ receivedAt: outside(RETENTION_DAYS.webhookPayload) }).where(eq(webhookEvents.eventId, old.event_id));
    await db.update(webhookEvents).set({ receivedAt: outside(RETENTION_DAYS.webhookEvents) }).where(eq(webhookEvents.eventId, ancient.event_id));

    expect(await runMaintenance()).toMatchObject({ webhookPayloadsRedacted: 2, webhookEvents: 1 });
    const rows = await db.select().from(webhookEvents);
    expect(rows.map((row) => row.eventId).sort()).toEqual([old.event_id, recent.event_id].sort());

    const stub = rows.find((row) => row.eventId === old.event_id)!;
    expect(stub.payload).toEqual({ event_id: old.event_id, event_type: "subscription.created", occurred_at: old.occurred_at, data: { id: "sub_01hv8x29kz0t586xy6zn1a62ny" }, redacted: true });
    expect(JSON.stringify(stub.payload)).not.toContain("ctm_"); // no customer data left
    expect(stub.outcome).toBe("processed"); // idempotency information survives
    expect((rows.find((row) => row.eventId === recent.event_id)!.payload as { data: { email?: string } }).data.email).toBe("jo@example.com");

    // A redelivery of the old event is still recognised as a duplicate…
    expect(await ingestPaddleEvent(old)).toEqual({ ok: true, duplicate: true, outcome: "processed" });
    // …and replaying a stub fails with a clear message instead of corrupting state.
    const replay = await processStoredEvent(old.event_id, { force: true });
    expect(replay).toMatchObject({ ok: false });
    expect(!replay.ok && replay.error).toMatch(/removed by data retention/);
    expect(await runMaintenance()).toMatchObject({ webhookPayloadsRedacted: 0 });
  });

  it("works through a backlog in batches", async () => {
    await db.execute(sql`insert into events (name, created_at) select 'bulk', now() - interval '500 days' from generate_series(1, 55)`);
    expect((await runMaintenance({ batchSize: 10, maxBatches: 3 })).events).toBe(30); // bounded per run
    expect((await runMaintenance({ batchSize: 10, maxBatches: 3 })).events).toBe(25); // the next run continues
    expect(await db.select().from(events)).toHaveLength(0);
  });

  it("runs as the daily maintenance.cleanup job", async () => {
    await db.insert(errorLog).values({ message: "old", createdAt: outside(RETENTION_DAYS.errorLog) });
    await enqueueJob("maintenance.cleanup", {});
    expect(await runWorker()).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(await db.select().from(errorLog)).toHaveLength(0);
  });
});
