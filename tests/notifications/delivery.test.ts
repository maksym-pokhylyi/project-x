import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
// The real sendEmail, wrapped so that one test can make it fail in the middle of a send.
vi.mock("@/lib/email/send", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/email/send")>();
  return { ...real, sendEmail: vi.fn(real.sendEmail) };
});

import { GET as cronTick } from "@/app/api/cron/jobs/route";
import { db } from "@/db";
import { emailOutbox, jobs, notificationLog, notificationPrefs, organizations, users } from "@/db/schema";
import { features } from "@/env";
import { notificationsConfig } from "@/features/notifications/config";
import { sendDedupeKey } from "@/features/notifications/deliver";
import { runFanout } from "@/features/notifications/fanout";
import { runNotificationFanout, runNotificationSend } from "@/features/notifications/jobs";
import { updateNotificationPrefs } from "@/features/notifications/prefs";
import { fanoutDedupeKey, scheduleNotifications } from "@/features/notifications/schedule";
import { unsubscribe } from "@/features/notifications/unsubscribe";
import { sendEmail } from "@/lib/email/send";
import { runWorker } from "@/lib/jobs/worker";
import { deleteAccount, deleteWorkspace } from "@/server/tenant-data";
import { contractRelease, ingest } from "../procurement/helpers/factory";
import { resetProcurement } from "../procurement/helpers/schema";
import { addMember } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import {
  addTender,
  addWorkspaceMember,
  BRISTOL,
  createWorkspace,
  daysBefore,
  eventsNamed,
  jobsOfType,
  logRows,
  markUnverified,
  MONDAY,
  MONDAY_REMINDERS,
  removeMember,
  saveTender,
  scheduledEmails,
  seedAcme,
  send,
  setPlan,
  SOFTWARE,
  supplierId,
  TUESDAY,
  WEEK,
  type Workspace,
} from "./helpers";

/**
 * From the five-minute tick to the outbox: who gets a send job, and what makes a send safe
 * to run twice, to race, to be retried — and impossible to cross workspaces.
 */
let acme: string;
let a: Workspace;
const of = (workspace: Workspace, user = workspace.owner) => ({ organizationId: workspace.organizationId, userId: user.id });
/** The limits and the pause flag are constants; a few tests turn them down to see the guards work. */
const limits = notificationsConfig.limits as unknown as Record<keyof typeof notificationsConfig.limits, number>;
const flags = features as unknown as { notificationsPaused: boolean };
const originalLimits = { ...notificationsConfig.limits };

beforeAll(async () => {
  await resetProcurement();
});

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
  acme = await seedAcme();
  a = await createWorkspace({ name: "Alice Acme", supplier: acme });
});

afterEach(() => {
  Object.assign(limits, originalLimits);
  flags.notificationsPaused = false;
  vi.mocked(sendEmail).mockClear();
  vi.useRealTimers();
});

describe("the tick schedules one fan-out per period", () => {
  it("enqueues what is due in UK time, once, however often it ticks", async () => {
    expect(await scheduleNotifications(new Date(MONDAY.getTime() - 60_000))).toMatchObject({ status: "ok", due: [], enqueued: [] });
    expect(await scheduleNotifications(MONDAY)).toMatchObject({ status: "ok", enqueued: ["notifications.fanout:digest:2026-W47", "notifications.fanout:alert:2026-11-16"] });
    // The next ticks of the same period add nothing.
    for (const minutes of [5, 10, 25]) expect((await scheduleNotifications(new Date(MONDAY.getTime() + minutes * 60_000))).enqueued).toEqual([]);
    expect((await scheduleNotifications(MONDAY_REMINDERS)).enqueued).toEqual(["notifications.fanout:reminder:2026-11-16", "notifications.fanout:renewal:2026-11-16"]);
    // Tuesday: a new alert, new reminders; the digest's week already has its fan-out.
    expect((await scheduleNotifications(TUESDAY)).enqueued).toEqual(["notifications.fanout:alert:2026-11-17"]);

    const fanouts = await jobsOfType("notifications.fanout");
    expect(fanouts.map((job) => job.dedupeKey).sort()).toEqual(
      ["alert:2026-11-16", "alert:2026-11-17", "digest:2026-W47", "reminder:2026-11-16", "renewal:2026-11-16"].map((key) => `notifications.fanout:${key}`),
    );
    expect(fanoutDedupeKey({ kind: "digest", period: WEEK })).toBe("notifications.fanout:digest:2026-W47");
    expect(fanouts.find((job) => job.payload.kind === "digest")!.payload).toEqual({ kind: "digest", period: WEEK });
  });

  it("NOTIFICATIONS_PAUSED=1 stops the scheduler, the fan-out and a send already queued", async () => {
    await addTender({ firstSeen: daysBefore(MONDAY, 2) });
    flags.notificationsPaused = true;
    expect(await scheduleNotifications(MONDAY)).toEqual({ status: "paused", due: [], enqueued: [] });
    expect(await runFanout({ kind: "digest", period: WEEK }, { now: MONDAY })).toEqual({ status: "paused", enqueued: 0 });
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("paused");
    expect(await db.select().from(jobs)).toEqual([]);
    expect(await scheduledEmails()).toEqual([]);
    expect(await logRows()).toEqual([]);
    // Switched back on inside the catch-up window: the same week still goes out, once.
    flags.notificationsPaused = false;
    expect((await scheduleNotifications(new Date(MONDAY.getTime() + 3_600_000))).enqueued).toContain("notifications.fanout:digest:2026-W47");
    expect(await send("digest", WEEK, of(a), new Date(MONDAY.getTime() + 3_600_000))).toBe("sent");
  });
});

describe("fan-out: one send job per member who should hear from us", () => {
  it("covers members with a radar, the preference on and a verified address", async () => {
    const colleague = await addWorkspaceMember(a, { name: "Colin Colleague" });
    const optedOut = await addWorkspaceMember(a, { name: "Olive Off" });
    const unverified = await addWorkspaceMember(a, { name: "Una Unverified" });
    const stoppedAll = await addWorkspaceMember(a, { name: "Sam Stopped" });
    await updateNotificationPrefs(optedOut.id, a.organizationId, { weeklyDigest: false });
    await markUnverified(unverified.id);
    await unsubscribe({ ...of(a, stoppedAll), kind: "reminder" }, "all", "page");
    const noRadar = await createWorkspace({ name: "Nora NoRadar" });

    expect(await runFanout({ kind: "digest", period: WEEK }, { now: MONDAY })).toEqual({ status: "done", enqueued: 2 });
    const sends = await jobsOfType("notifications.send");
    expect(sends.map((job) => job.payload.userId).sort()).toEqual([a.owner.id, colleague.id].sort());
    expect(sends.every((job) => job.payload.organizationId === a.organizationId && job.payload.kind === "digest" && job.payload.period === WEEK)).toBe(true);
    // The dedupe key named in the brief: digest:<org>:<user>:<iso-week>.
    expect(sends.map((job) => job.dedupeKey).sort()).toEqual([a.owner.id, colleague.id].map((user) => `digest:${a.organizationId}:${user}:2026-W47`).sort());
    expect(sends.some((job) => job.payload.organizationId === noRadar.organizationId)).toBe(false);

    // A second fan-out for the same week (a retry, a second tick) adds nothing.
    expect(await runFanout({ kind: "digest", period: WEEK }, { now: new Date(MONDAY.getTime() + 600_000) })).toEqual({ status: "done", enqueued: 0 });
    expect(await jobsOfType("notifications.send")).toHaveLength(2);
  });

  it("does nothing for a period that is no longer the current one", async () => {
    expect(await runFanout({ kind: "digest", period: "2026-W46" }, { now: MONDAY })).toEqual({ status: "stale", enqueued: 0 });
    // Thursday: Monday's digest is past its catch-up window.
    expect(await runFanout({ kind: "digest", period: WEEK }, { now: new Date("2026-11-19T09:00:00Z") })).toEqual({ status: "stale", enqueued: 0 });
    expect(await jobsOfType("notifications.send")).toEqual([]);
  });

  it("daily alerts go to paid workspaces only, and not on top of Monday's digest", async () => {
    const paid = await createWorkspace({ name: "Paula Paid", supplier: acme, plan: { planKey: "starter" } });
    const alertsOnly = await addWorkspaceMember(paid, { name: "Ahmed AlertsOnly" });
    await updateNotificationPrefs(alertsOnly.id, paid.organizationId, { weeklyDigest: false });

    // Monday: the digest carries the new tenders. Only a member without the digest gets the alert.
    expect(await runFanout({ kind: "alert", period: "2026-11-16" }, { now: MONDAY })).toEqual({ status: "done", enqueued: 1 });
    expect((await jobsOfType("notifications.send")).map((job) => job.payload.userId)).toEqual([alertsOnly.id]);
    // Tuesday: everyone on the paid workspace; nobody on the Free one.
    expect(await runFanout({ kind: "alert", period: "2026-11-17" }, { now: TUESDAY })).toEqual({ status: "done", enqueued: 2 });
    const tuesday = (await jobsOfType("notifications.send")).filter((job) => job.payload.period === "2026-11-17");
    expect(tuesday.map((job) => job.payload.userId).sort()).toEqual([paid.owner.id, alertsOnly.id].sort());
    expect(tuesday.every((job) => job.payload.organizationId === paid.organizationId)).toBe(true);

    // And at send time, whatever a job says: Free has no alerts; Monday's digest stands in for the alert.
    await addTender({ firstSeen: new Date(TUESDAY.getTime() - 3 * 3_600_000) });
    expect(await send("alert", "2026-11-17", of(a), TUESDAY)).toBe("not_eligible");
    expect(await send("alert", "2026-11-16", of(paid), MONDAY)).toBe("not_eligible");
    expect(await send("alert", "2026-11-17", of(paid), TUESDAY)).toBe("sent");
    expect((await scheduledEmails()).map((email) => [email.to, email.template])).toEqual([[paid.owner.email.toLowerCase(), "radar-alert"]]);
  });

  it("works through a long list in pages and spreads the sends over the ticks", async () => {
    const people = [a.owner];
    for (let index = 0; index < 4; index += 1) people.push(await addWorkspaceMember(a));
    limits.fanoutBatch = 2;
    limits.perTick = 2;

    expect(await runFanout({ kind: "digest", period: WEEK }, { now: MONDAY })).toEqual({ status: "continued", enqueued: 2 });
    // Each page hands over to the next through its own job; follow the chain.
    for (let page = 0; page < 5; page += 1) {
      const [next] = (await jobsOfType("notifications.fanout")).filter((job) => job.status === "pending");
      if (!next) break;
      await runFanout(next.payload as Parameters<typeof runFanout>[0], { now: MONDAY });
      await db.update(jobs).set({ status: "succeeded" }).where(eq(jobs.id, next.id));
    }
    const sends = await jobsOfType("notifications.send");
    expect(sends.map((job) => job.payload.userId).sort()).toEqual(people.map((person) => person.id).sort());
    // Two per five-minute tick.
    expect(sends.map((job) => (job.runAfter.getTime() - MONDAY.getTime()) / 60_000)).toEqual([0, 0, 5, 5, 10]);
  });
});

describe("a send is idempotent", () => {
  let parks: string;

  beforeEach(async () => {
    parks = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
  });

  it("the same job twice sends one e-mail", async () => {
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("sent");
    expect(await send("digest", WEEK, of(a), new Date(MONDAY.getTime() + 60_000))).toBe("already_done");
    expect(await send("digest", WEEK, of(a), new Date(MONDAY.getTime() + 3_600_000))).toBe("already_done");
    expect(await scheduledEmails()).toHaveLength(1);
    expect(await logRows()).toHaveLength(1);
    expect(await eventsNamed("digest_sent")).toHaveLength(1);
  });

  it("workers racing for the same e-mail send it once", async () => {
    const outcomes = await Promise.all(Array.from({ length: 6 }, () => send("digest", WEEK, of(a), MONDAY)));
    expect(outcomes.filter((outcome) => outcome === "sent")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "already_done")).toHaveLength(5);
    expect(await scheduledEmails()).toHaveLength(1);
    const rows = await logRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "sent", periodKey: WEEK });
    expect(await eventsNamed("digest_sent")).toHaveLength(1);
  });

  it("a crash between writing the message and committing leaves nothing behind, and the retry sends once", async () => {
    const real = (await vi.importActual<typeof import("@/lib/email/send")>("@/lib/email/send")).sendEmail;
    vi.mocked(sendEmail).mockImplementationOnce(async (...args) => {
      await real(...args); // the outbox row is written inside the transaction…
      throw new Error("worker died"); // …and the worker dies before the commit
    });
    await expect(send("digest", WEEK, of(a), MONDAY)).rejects.toThrow("worker died");
    // Neither "sent" nor a message: the two are one transaction.
    expect(await scheduledEmails()).toEqual([]);
    expect(await logRows()).toEqual([expect.objectContaining({ status: "failed", sentAt: null, outboxId: null, detail: expect.stringContaining("error") })]);
    expect(await eventsNamed("digest_sent")).toEqual([]);

    // The job queue retries: the failed row is taken over, one e-mail goes out.
    expect(await send("digest", WEEK, of(a), new Date(MONDAY.getTime() + 30_000))).toBe("sent");
    const [email] = await scheduledEmails();
    expect(await logRows()).toEqual([expect.objectContaining({ status: "sent", detail: null, outboxId: email!.id })]);
    expect(await send("digest", WEEK, of(a), new Date(MONDAY.getTime() + 60_000))).toBe("already_done");
    expect(await scheduledEmails()).toHaveLength(1);
  });

  it("a failed attempt followed by nothing to say ends as skipped, not as a failure", async () => {
    vi.mocked(sendEmail).mockImplementationOnce(async () => {
      throw new Error("worker died");
    });
    await expect(send("digest", WEEK, of(a), MONDAY)).rejects.toThrow("worker died");
    expect(await logRows()).toEqual([expect.objectContaining({ status: "failed" })]);
    // Before the retry the workspace dismisses the tender: there is nothing new any more.
    await saveTender(a, parks, "dismissed");
    expect(await send("digest", WEEK, of(a), new Date(MONDAY.getTime() + 30_000))).toBe("skipped_empty");
    expect(await logRows()).toEqual([expect.objectContaining({ status: "skipped_empty", detail: null, sentAt: null })]);
    expect(await send("digest", WEEK, of(a), new Date(MONDAY.getTime() + 60_000))).toBe("already_done");
    expect(await scheduledEmails()).toEqual([]);
  });

  it("through the job handlers and the worker: retried on failure, never doubled", async () => {
    // A Monday already in the past for any clock this test runs on, so the worker picks the jobs up.
    const pastMonday = new Date("2026-11-09T07:35:00Z");
    await db.execute(sql`update notices set ingested_at = ${daysBefore(pastMonday, 2).toISOString()}::timestamptz, published_at = ${daysBefore(pastMonday, 2).toISOString()}::timestamptz where stage = 'tender'`);
    vi.useFakeTimers({ now: pastMonday, toFake: ["Date"] });

    await runNotificationFanout({ kind: "digest", period: "2026-W46" });
    vi.mocked(sendEmail).mockImplementationOnce(async () => {
      throw new Error("provider library blew up");
    });
    const first = await runWorker();
    expect(first).toMatchObject({ claimed: 1, succeeded: 0, retried: 1 });
    expect(await scheduledEmails()).toEqual([]);
    // The retry is due after the backoff; run the handler as the worker will.
    const [job] = await jobsOfType("notifications.send");
    expect(job).toMatchObject({ status: "pending", attempts: 1, dedupeKey: `digest:${a.organizationId}:${a.owner.id}:2026-W46` });
    await runNotificationSend(job!.payload as Parameters<typeof runNotificationSend>[0]);
    await runNotificationSend(job!.payload as Parameters<typeof runNotificationSend>[0]);
    expect(await scheduledEmails()).toHaveLength(1);
    expect(await logRows()).toEqual([expect.objectContaining({ status: "sent", periodKey: "2026-W46" })]);
  });

  it("the whole path: cron tick → fan-out → send → outbox; a second tick sends nothing", async () => {
    const pastMonday = new Date("2026-11-09T07:35:00Z");
    await db.execute(sql`update notices set ingested_at = ${daysBefore(pastMonday, 2).toISOString()}::timestamptz, published_at = ${daysBefore(pastMonday, 2).toISOString()}::timestamptz where stage = 'tender'`);
    const colleague = await addWorkspaceMember(a, { name: "Colin Colleague" });
    vi.useFakeTimers({ now: pastMonday, toFake: ["Date"] });

    const tick = () => cronTick(new Request("http://localhost:3000/api/cron/jobs", { headers: { authorization: "Bearer test-cron-secret-0123456789" } }), {});
    expect((await tick()).status).toBe(200);
    const emails = await scheduledEmails();
    expect(emails.map((email) => email.to).sort()).toEqual([a.owner.email, colleague.email].map((email) => email.toLowerCase()).sort());
    expect(emails.every((email) => email.template === "radar-digest" && email.subject === "1 new tender for Acme Grounds")).toBe(true);
    expect((await jobsOfType("notifications.fanout")).map((job) => [job.payload.kind, job.payload.period, job.status]).sort()).toEqual([
      ["alert", "2026-11-09", "succeeded"],
      ["digest", "2026-W46", "succeeded"],
    ]);

    vi.setSystemTime(new Date(pastMonday.getTime() + 5 * 60_000));
    expect((await tick()).status).toBe(200);
    vi.setSystemTime(new Date(pastMonday.getTime() + 10 * 60_000));
    expect((await tick()).status).toBe(200);
    expect(await scheduledEmails()).toHaveLength(2);
    expect(await logRows({ kind: "digest" })).toHaveLength(2);
    // Without the secret the tick does nothing at all.
    expect((await cronTick(new Request("http://localhost:3000/api/cron/jobs"), {})).status).toBe(401);
  });
});

describe("who is eligible is decided at the last moment", () => {
  beforeEach(async () => {
    await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
  });

  it("only a verified address is written to", async () => {
    await markUnverified(a.owner.id);
    expect(await runFanout({ kind: "digest", period: WEEK }, { now: MONDAY })).toEqual({ status: "done", enqueued: 0 });
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("not_eligible");
    expect(await scheduledEmails()).toEqual([]);
    expect(await logRows()).toEqual([]);
  });

  it("a member removed after the fan-out gets nothing", async () => {
    const leaver = await addWorkspaceMember(a, { name: "Leo Leaver" });
    await runFanout({ kind: "digest", period: WEEK }, { now: MONDAY });
    expect((await jobsOfType("notifications.send")).map((job) => job.payload.userId)).toContain(leaver.id);
    await removeMember(a.organizationId, leaver.id);
    expect(await send("digest", WEEK, of(a, leaver), MONDAY)).toBe("not_eligible");
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("sent");
    expect((await scheduledEmails()).map((email) => email.to)).toEqual([a.owner.email.toLowerCase()]);
    expect(await logRows({ userId: leaver.id })).toEqual([]);
  });

  it("a preference switched off after the fan-out is honoured, and logged", async () => {
    await runFanout({ kind: "digest", period: WEEK }, { now: MONDAY });
    await updateNotificationPrefs(a.owner.id, a.organizationId, { weeklyDigest: false });
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("skipped_pref");
    expect(await scheduledEmails()).toEqual([]);
    expect(await logRows()).toEqual([expect.objectContaining({ status: "skipped_pref", kind: "digest", periodKey: WEEK })]);
    // Switching it back on the same week does not resurrect the skipped e-mail.
    await updateNotificationPrefs(a.owner.id, a.organizationId, { weeklyDigest: true });
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("already_done");
  });

  it("a job that outlived its slot sends nothing", async () => {
    expect(await send("digest", "2026-W46", of(a), MONDAY)).toBe("stale");
    expect(await send("digest", WEEK, of(a), new Date("2026-11-18T02:00:00Z"))).toBe("stale"); // Wednesday: Monday 07:30 + 36 h + 6 h has passed
    expect(await send("digest", WEEK, of(a), new Date("2026-11-18T01:00:00Z"))).toBe("sent");
  });

  it("a deleted workspace: nothing is sent, nothing is left", async () => {
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("sent");
    await updateNotificationPrefs(a.owner.id, a.organizationId, { dailyAlerts: false });
    expect(await scheduledEmails()).toHaveLength(1);
    await deleteWorkspace(a.organizationId);

    expect(await db.select().from(notificationLog)).toEqual([]);
    expect(await db.select().from(notificationPrefs)).toEqual([]);
    // The message made for that workspace leaves the mail queue with it.
    expect(await scheduledEmails()).toEqual([]);
    expect(await send("digest", "2026-W48", of(a), new Date("2026-11-23T07:30:00Z"))).toBe("not_eligible");
    expect(await runFanout({ kind: "digest", period: "2026-W48" }, { now: new Date("2026-11-23T07:30:00Z") })).toEqual({ status: "done", enqueued: 0 });
    expect(await db.select().from(notificationLog)).toEqual([]);
    expect(await scheduledEmails()).toEqual([]);
    // The person still exists; their other e-mails are untouched.
    expect(await db.select({ id: users.id }).from(users).where(eq(users.id, a.owner.id))).toHaveLength(1);
  });

  it("a deleted account: nothing is sent, nothing is left", async () => {
    const colleague = await addWorkspaceMember(a, { name: "Colin Colleague" });
    expect(await send("digest", WEEK, of(a, colleague), MONDAY)).toBe("sent");
    await updateNotificationPrefs(colleague.id, a.organizationId, { deadlineReminders: false });
    await deleteAccount(colleague.id);

    expect(await logRows({ userId: colleague.id })).toEqual([]);
    expect(await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, colleague.id))).toEqual([]);
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, colleague.email.toLowerCase()))).toEqual([]);
    expect(await send("digest", "2026-W48", of(a, colleague), new Date("2026-11-23T07:30:00Z"))).toBe("not_eligible");
    // The workspace and its owner carry on.
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("sent");
    expect(await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, a.organizationId))).toHaveLength(1);
  });
});

describe("tenant isolation", () => {
  let b: Workspace;
  let softwareTender: string;
  let groundsTender: string;

  beforeEach(async () => {
    await ingest([contractRelease({ title: "Payroll System Support", buyer: BRISTOL, suppliers: [{ name: "Code Smiths Ltd", coh: "06666666", region: "UKK11" }], cpv: SOFTWARE, regions: ["UKK"], value: 80_000, signedDaysAgo: 90, endsInDays: 600 })]);
    b = await createWorkspace({ name: "Bob Bytes", supplier: await supplierId("06666666") });
    groundsTender = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    softwareTender = await addTender({ title: "Payroll software replacement", buyer: BRISTOL, cpv: SOFTWARE, regions: ["UKK"], value: 90_000, firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 9 });
  });

  it("a member of workspace A never receives anything about workspace B", async () => {
    // B saves a tender and has its own radar; none of it may surface for A.
    const savedByB = await addTender({ title: "Payroll bureau services", buyer: BRISTOL, cpv: SOFTWARE, regions: ["UKK"], value: 70_000, firstSeen: daysBefore(MONDAY, 20), deadlineInDays: 8 });
    await saveTender(b, savedByB);
    await runFanout({ kind: "digest", period: WEEK }, { now: MONDAY });
    for (const job of await jobsOfType("notifications.send")) await runNotificationSendAt(job.payload, MONDAY);

    const toA = await scheduledEmails(a.owner.email);
    const toB = await scheduledEmails(b.owner.email);
    expect(toA).toHaveLength(1);
    expect(toB).toHaveLength(1);
    expect(toA[0]!.subject).toBe("1 new tender for Acme Grounds");
    expect(toB[0]!.subject).toBe("1 new tender for Code Smiths");
    for (const body of [toA[0]!.html, toA[0]!.text, toA[0]!.subject]) {
      expect(body.includes(softwareTender), "B's tender in A's e-mail").toBe(false);
      expect(/payroll|code smiths|bristol/i.test(body), "B's trade in A's e-mail").toBe(false);
    }
    for (const body of [toB[0]!.html, toB[0]!.text, toB[0]!.subject]) {
      expect(body.includes(groundsTender), "A's tender in B's e-mail").toBe(false);
      expect(/grounds|acme|leeds/i.test(body), "A's trade in B's e-mail").toBe(false);
    }
    // Each log row belongs to its own workspace and lists only its own items.
    const [rowA] = await logRows(of(a));
    const [rowB] = await logRows(of(b));
    expect(rowA!.items).toEqual([{ t: "match", ref: groundsTender }]);
    expect(rowB!.items).toEqual([
      { t: "match", ref: softwareTender },
      { t: "saved", ref: savedByB },
    ]);
    expect(toA[0]!.html.includes(savedByB), "B's saved tender in A's e-mail").toBe(false);
    expect((await logRows()).map((row) => `${row.organizationId}:${row.userId}`).sort()).toEqual([`${a.organizationId}:${a.owner.id}`, `${b.organizationId}:${b.owner.id}`].sort());
  });

  it("a send job naming a workspace the person is not in does nothing", async () => {
    // Whatever puts such a job in the queue: the membership is read from the database, not from the job.
    expect(await send("digest", WEEK, { organizationId: b.organizationId, userId: a.owner.id }, MONDAY)).toBe("not_eligible");
    expect(await send("reminder", "2026-11-16", { organizationId: b.organizationId, userId: a.owner.id }, MONDAY_REMINDERS)).toBe("not_eligible");
    expect(await scheduledEmails()).toEqual([]);
    expect(await logRows()).toEqual([]);
  });

  it("someone in both workspaces gets one e-mail per workspace, each about that workspace only", async () => {
    const both = await addWorkspaceMember(a, { name: "Bea Both" });
    await addMember(b.organizationId, both, "member");

    expect(await send("digest", WEEK, of(a, both), MONDAY)).toBe("sent");
    expect(await send("digest", WEEK, of(b, both), MONDAY)).toBe("sent");
    const emails = await scheduledEmails(both.email);
    expect(emails.map((email) => email.subject).sort()).toEqual(["1 new tender for Acme Grounds", "1 new tender for Code Smiths"]);
    const aboutA = emails.find((email) => email.subject.includes("Acme"))!;
    const aboutB = emails.find((email) => email.subject.includes("Code Smiths"))!;
    expect(aboutA.html.includes(softwareTender)).toBe(false);
    expect(aboutB.html.includes(groundsTender)).toBe(false);
    // Preferences are per workspace: switching A's digest off leaves B's alone.
    await updateNotificationPrefs(both.id, a.organizationId, { weeklyDigest: false });
    const nextMonday = new Date("2026-11-23T07:30:00Z");
    await runFanout({ kind: "digest", period: "2026-W48" }, { now: nextMonday });
    const nextWeek = (await jobsOfType("notifications.send")).filter((job) => job.payload.period === "2026-W48" && job.payload.userId === both.id);
    expect(nextWeek.map((job) => job.payload.organizationId)).toEqual([b.organizationId]);
    // The unsubscribe link of A's e-mail names A, not B.
    expect(aboutA.headers!["List-Unsubscribe"]).not.toBe(aboutB.headers!["List-Unsubscribe"]);
  });
});

describe("volume guards", () => {
  beforeEach(async () => {
    await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
  });

  it("no more than two scheduled e-mails a day per member and workspace", async () => {
    expect(notificationsConfig.limits.perMemberWorkspacePerDay).toBe(2);
    await setPlan(a.organizationId, { planKey: "pro", interval: "year", periodEnd: new Date(MONDAY_REMINDERS.getTime() + 7 * 86_400_000) });
    // A normal Monday: the digest at 07:30 and a deadline reminder at 08:00.
    const closing = await addTender({ title: "Closing soon grounds maintenance", firstSeen: daysBefore(MONDAY, 20), deadlineInDays: 5 });
    await saveTender(a, closing);
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("sent");
    expect(await send("reminder", "2026-11-16", of(a), MONDAY_REMINDERS)).toBe("sent");
    // Whatever tries to send a third one that day is refused, and it shows in the log.
    await updateNotificationPrefs(a.owner.id, a.organizationId, { weeklyDigest: false });
    expect(await send("alert", "2026-11-16", of(a), new Date(MONDAY.getTime() + 2 * 3_600_000))).toBe("daily_ceiling");
    expect(await scheduledEmails()).toHaveLength(2);
    expect(await logRows({ kind: "alert" })).toEqual([expect.objectContaining({ status: "failed", detail: "daily_ceiling", sentAt: null })]);
    // The renewal notice is a billing notice and is not held back by the ceiling.
    expect(await send("renewal", "2026-11-23", of(a), MONDAY_REMINDERS)).toBe("sent");
    // Tuesday is a new day.
    await addTender({ title: "Tuesday grounds maintenance", firstSeen: new Date(TUESDAY.getTime() - 3_600_000) });
    expect(await send("alert", "2026-11-17", of(a), TUESDAY)).toBe("sent");
  });

  it("a ceiling per person across all their workspaces", async () => {
    limits.perUserPerDay = 1;
    const second = await createWorkspace({ name: "Second Workspace", supplier: acme });
    await addMember(second.organizationId, a.owner, "member");
    expect(await send("digest", WEEK, of(a), MONDAY)).toBe("sent");
    expect(await send("digest", WEEK, { organizationId: second.organizationId, userId: a.owner.id }, MONDAY)).toBe("daily_ceiling");
    expect(await scheduledEmails(a.owner.email)).toHaveLength(1);
  });

  it("a cap per tick: what does not fit waits for the next tick instead of being dropped", async () => {
    limits.perTick = 2;
    limits.maxDeferrals = 2;
    const people = [a.owner, await addWorkspaceMember(a), await addWorkspaceMember(a)];
    expect(await send("digest", WEEK, of(a, people[0]), MONDAY)).toBe("sent");
    expect(await send("digest", WEEK, of(a, people[1]), MONDAY)).toBe("sent");
    expect(await send("digest", WEEK, of(a, people[2]), MONDAY)).toBe("deferred");
    expect(await scheduledEmails()).toHaveLength(2);
    expect(await logRows({ userId: people[2]!.id })).toEqual([]);
    const [deferred] = await jobsOfType("notifications.send");
    const payload = { kind: "digest", period: WEEK, ...of(a, people[2]) } as const;
    expect(deferred).toMatchObject({ dedupeKey: `${sendDedupeKey(payload)}:defer:1`, payload: { ...payload, deferrals: 1 } });
    expect(deferred!.runAfter.getTime() - MONDAY.getTime()).toBe(5 * 60_000);

    // Five minutes later there is room.
    expect(await runNotificationSendAt(deferred!.payload, new Date(MONDAY.getTime() + 5 * 60_000 + 1000))).toBe("sent");
    expect(await scheduledEmails()).toHaveLength(3);

    // A queue that never drains gives up loudly rather than looping for ever.
    limits.perTick = 1;
    const late = await addWorkspaceMember(a);
    const now = new Date(MONDAY.getTime() + 5 * 60_000 + 2000);
    const lateSend = { kind: "digest", period: WEEK, ...of(a, late) } as const;
    expect(await runNotificationSendAt({ ...lateSend, deferrals: 1 }, now)).toBe("deferred");
    expect((await jobsOfType("notifications.send")).map((job) => job.dedupeKey)).toContain(`${sendDedupeKey(lateSend)}:defer:2`);
    expect(await runNotificationSendAt({ ...lateSend, deferrals: 2 }, now)).toBe("global_cap");
    expect(await logRows({ userId: late.id })).toEqual([expect.objectContaining({ status: "failed", detail: "global_cap" })]);
    expect(await scheduledEmails(late.email)).toEqual([]);
  });
});

describe("trying a moment out (dev tools only)", () => {
  const tick = (query = "") => cronTick(new Request(`http://localhost:3000/api/cron/jobs${query}`, { headers: { authorization: "Bearer test-cron-secret-0123456789" } }), {});
  const devTools = features as unknown as { devTools: boolean };

  afterEach(() => {
    devTools.devTools = true;
  });

  it("?now= runs the tick, the fan-out and the sends as if it were that moment", async () => {
    const parks = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    // Stored after that Monday: not on the radar yet when Monday is looked at, news the week after.
    const later = await addTender({ title: "Schools grounds maintenance", firstSeen: new Date(MONDAY.getTime() + 2 * 86_400_000) });

    expect((await tick(`?now=${MONDAY.toISOString()}`)).status).toBe(200);
    const [first] = await scheduledEmails(a.owner.email);
    expect(first).toMatchObject({ template: "radar-digest", subject: "1 new tender for Acme Grounds" });
    expect(first!.html.includes(parks) && !first!.html.includes(later), "only what was known that Monday").toBe(true);
    expect(await logRows({ kind: "digest" })).toEqual([expect.objectContaining({ status: "sent", periodKey: WEEK, asOf: MONDAY, sentAt: MONDAY })]);
    expect((await jobsOfType("notifications.fanout")).find((job) => job.payload.kind === "digest")!.payload).toEqual({ kind: "digest", period: WEEK, at: MONDAY.toISOString() });

    // The same moment again: nothing more. A week on: the next digest, with what arrived in between.
    await tick(`?now=${MONDAY.toISOString()}`);
    expect(await scheduledEmails(a.owner.email)).toHaveLength(1);
    const nextMonday = new Date("2026-11-23T07:30:00Z");
    await tick(`?now=${nextMonday.toISOString()}`);
    const emails = await scheduledEmails(a.owner.email);
    expect(emails.map((email) => email.subject)).toEqual(["1 new tender for Acme Grounds", "1 new tender for Acme Grounds"]);
    expect(emails[1]!.html.includes(later) && !emails[1]!.html.includes(parks), "what arrived in between").toBe(true);
  });

  it("is ignored where dev tools are off: the tick and every job act at the real time", async () => {
    // A Monday long past: for the real clock that week is over, whenever this test runs.
    const longAgo = new Date("2026-03-02T07:30:00Z");
    await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(longAgo, 2) });
    devTools.devTools = false;
    expect((await tick(`?now=${longAgo.toISOString()}`)).status).toBe(200);
    // Whatever the tick scheduled is for the real clock: no simulated moment, not that week.
    const fanouts = await jobsOfType("notifications.fanout");
    expect(fanouts.every((job) => !("at" in job.payload) && job.payload.period !== "2026-W10" && job.payload.period !== "2026-03-02")).toBe(true);
    // A job that claims a moment is not believed either.
    await runNotificationFanout({ kind: "digest", period: "2026-W10", at: longAgo.toISOString() });
    await runNotificationSend({ kind: "digest", period: "2026-W10", ...of(a), at: longAgo.toISOString() });
    expect((await jobsOfType("notifications.send")).filter((job) => job.payload.period === "2026-W10")).toEqual([]);
    expect((await logRows()).filter((row) => row.periodKey === "2026-W10")).toEqual([]);
    expect((await scheduledEmails()).filter((email) => email.subject.includes("Acme"))).toEqual([]);
    // With dev tools the same job is believed (this is what the e2e journey relies on).
    devTools.devTools = true;
    await runNotificationSend({ kind: "digest", period: "2026-W10", ...of(a), at: longAgo.toISOString() });
    expect((await logRows()).filter((row) => row.periodKey === "2026-W10")).toEqual([expect.objectContaining({ status: "sent", sentAt: longAgo })]);
  });
});

/** Runs a queued send job's payload at a given moment (what the worker does, with the clock held still). */
async function runNotificationSendAt(payload: { kind: string; period: string; organizationId?: string; userId?: string; deferrals?: number }, now: Date) {
  const { sendNotification } = await import("@/features/notifications/deliver");
  return sendNotification(payload as Parameters<typeof sendNotification>[0], { now });
}
