import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// `after()` runs its task once the response has gone out; here the tasks are collected and awaited.
const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as Array<Promise<unknown>> }));
vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => {
    afterTasks.push(Promise.resolve().then(task));
  },
}));

import { db } from "@/db";
import { notificationLog } from "@/db/schema";
import { cleanNotificationId, recordDigestClick, registerClick } from "@/features/notifications/clicks";
import { requestState } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { resetProcurement } from "../procurement/helpers/schema";
import { addTender, createWorkspace, daysBefore, eventsNamed, logRows, MONDAY, saveTender, seedAcme, send, SEEDED, WEEK, type Workspace } from "./helpers";

/**
 * "Opened from an e-mail": counted on the server when the tender page is requested with
 * ?d=<notification_log id>. Once per tender per e-mail, only for a tender that e-mail
 * listed, never for crawlers — and with nothing in the event but the kind and the tender.
 */
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
let a: Workspace;
let first: string;
let second: string;
let logId: string;

const request = (headers: Record<string, string> = { "user-agent": BROWSER }) => {
  requestState.headers = new Headers(headers);
};
const settle = async () => {
  await Promise.all(afterTasks.splice(0));
};
const clickedRow = async () => (await db.select().from(notificationLog).where(eq(notificationLog.id, logId)))[0]!;

beforeAll(async () => {
  await resetProcurement();
});

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
  afterTasks.length = 0;
  a = await createWorkspace({ name: "Joanne Pike", supplier: await seedAcme() });
  first = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 20 });
  second = await addTender({ title: "Schools grounds maintenance", firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 25 });
  expect(await send("digest", WEEK, { organizationId: a.organizationId, userId: a.owner.id }, MONDAY)).toBe("sent");
  logId = (await logRows({ kind: "digest" }))[0]!.id;
  request();
});

describe("registering a click", () => {
  it("counts each tender of an e-mail once", async () => {
    expect(await registerClick(logId, first)).toEqual({ kind: "digest", userId: a.owner.id, organizationId: a.organizationId });
    const afterFirst = await clickedRow();
    expect(afterFirst.clicked).toEqual([first]);
    expect(afterFirst.firstClickedAt).toBeInstanceOf(Date);

    expect(await registerClick(logId, first)).toBeNull();
    expect(await registerClick(logId, second)).toMatchObject({ kind: "digest" });
    expect(await registerClick(logId, second)).toBeNull();
    const done = await clickedRow();
    expect(done.clicked).toEqual([first, second]);
    expect(done.firstClickedAt).toEqual(afterFirst.firstClickedAt);
  });

  it("only for a tender that e-mail listed, and only for an e-mail that was sent", async () => {
    const notListed = await addTender({ title: "Arrived later grounds maintenance", firstSeen: MONDAY });
    expect(await registerClick(logId, notListed)).toBeNull();
    expect(await registerClick(logId, "ocds-h6vhtk-doesnotexist")).toBeNull();
    expect(await registerClick("00000000-0000-4000-8000-000000000000", first)).toBeNull();
    // A week with nothing to send has a log row too; it lists nothing.
    const quiet = await createWorkspace({ name: "Quiet Workspace" });
    expect(await send("digest", WEEK, { organizationId: quiet.organizationId, userId: quiet.owner.id }, MONDAY)).toBe("skipped_empty");
    const [skipped] = await logRows({ organizationId: quiet.organizationId });
    expect(await registerClick(skipped!.id, first)).toBeNull();
    expect((await clickedRow()).clicked).toEqual([]);
  });

  it("two requests at the same moment count one click", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => registerClick(logId, first)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await clickedRow()).clicked).toEqual([first]);
  });
});

describe("the tender page's hook", () => {
  it("records digest_clicked for the member the e-mail was sent to, with the kind and the tender only", async () => {
    await recordDigestClick({ ocid: first, notification: logId });
    await settle();
    const events = await eventsNamed("digest_clicked");
    expect(events).toEqual([expect.objectContaining({ organizationId: a.organizationId, userId: a.owner.id, properties: { kind: "digest", ocid: first } })]);
    expect(JSON.stringify(events[0]!.properties)).not.toMatch(/@|Parks|Joanne/);

    // Opening the link again, or reloading, is not a second click.
    await recordDigestClick({ ocid: first, notification: logId });
    await recordDigestClick({ ocid: first, notification: [logId.toUpperCase()] });
    await settle();
    expect(await eventsNamed("digest_clicked")).toHaveLength(1);
    // Another tender from the same e-mail is.
    await recordDigestClick({ ocid: second, notification: logId });
    await settle();
    expect((await eventsNamed("digest_clicked")).map((event) => (event.properties as { ocid: string }).ocid)).toEqual([first, second]);
  });

  it("ignores a missing or malformed d, and a d that does not belong to the tender", async () => {
    for (const notification of [undefined, null, "", "abc", "1; drop table", `${logId}x`, ["not-a-uuid"], []]) {
      await recordDigestClick({ ocid: first, notification });
    }
    expect(afterTasks).toHaveLength(0); // nothing was even scheduled
    const other = await addTender({ title: "Someone else's grounds maintenance", firstSeen: MONDAY });
    await recordDigestClick({ ocid: other, notification: logId });
    await settle();
    expect(await eventsNamed("digest_clicked")).toEqual([]);
    expect(cleanNotificationId(logId.toUpperCase())).toBe(logId);
    expect(cleanNotificationId("69c5f7d7-146a-4a66-9068")).toBeNull();
  });

  it("does not count crawlers, link scanners or prefetches", async () => {
    const quiet: Array<Record<string, string>> = [
      {},
      { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      { "user-agent": "curl/8.5.0" },
      { "user-agent": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0 Safari/537.36" },
      { "user-agent": "Barracuda Sentinel (EE)" },
      { "user-agent": BROWSER, "next-router-prefetch": "1" },
      { "user-agent": BROWSER, purpose: "prefetch" },
      { "user-agent": BROWSER, "sec-purpose": "prefetch;prerender" },
    ];
    for (const headers of quiet) {
      request(headers);
      await recordDigestClick({ ocid: first, notification: logId });
    }
    await settle();
    expect(await eventsNamed("digest_clicked")).toEqual([]);
    expect((await clickedRow()).clicked).toEqual([]);
    request();
    await recordDigestClick({ ocid: first, notification: logId });
    await settle();
    expect(await eventsNamed("digest_clicked")).toHaveLength(1);
  });

  it("counts a link in a deadline reminder the same way, under its own kind", async () => {
    const closing = await addTender({ title: "Closing grounds maintenance", firstSeen: SEEDED, deadlineInDays: 13 });
    await saveTender(a, closing);
    const thursday = new Date("2026-11-19T08:00:00Z");
    expect(await send("reminder", "2026-11-19", { organizationId: a.organizationId, userId: a.owner.id }, thursday)).toBe("sent");
    const [reminder] = await logRows({ kind: "reminder" });
    await recordDigestClick({ ocid: closing, notification: reminder!.id });
    await settle();
    expect(await eventsNamed("digest_clicked")).toEqual([expect.objectContaining({ properties: { kind: "reminder", ocid: closing } })]);
  });
});
