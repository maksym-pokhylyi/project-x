import { sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));

import { db } from "@/db";
import { notificationsConfig } from "@/features/notifications/config";
import { bidsDeadlineSource, buildReminder, deadlineSources, registerDeadlineSource } from "@/features/notifications/content/reminders";
import { reminderRanges, runFanout } from "@/features/notifications/fanout";
import { updateNotificationPrefs } from "@/features/notifications/prefs";
import { resetDatabase } from "../helpers/db";
import { resetProcurement } from "../procurement/helpers/schema";
import { addTender, addWorkspaceMember, createWorkspace, eventsNamed, jobsOfType, logRows, plainText, saveTender, scheduledEmails, SEEDED, seedAcme, send, urlsIn, type Workspace } from "./helpers";

/**
 * Deadline reminders: 7 and 2 calendar days (UK) before a saved tender closes, at 08:00,
 * one e-mail per member per day, each (member, tender, offset) once.
 */
const at = (iso: string) => new Date(iso);
const eight = (day: string) => at(`${day}T08:00:00Z`); // 08:00 UK time in winter
let a: Workspace;
let tender: string;
const of = (workspace: Workspace, user = workspace.owner) => ({ organizationId: workspace.organizationId, userId: user.id });
const setDeadline = (ocid: string, deadline: Date) => db.execute(sql`update notices set deadline_at = ${deadline.toISOString()}::timestamptz where ocid = ${ocid}`);

beforeAll(async () => {
  await resetProcurement();
});

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
  a = await createWorkspace({ name: "Joanne Pike", supplier: await seedAcme() });
  // Closes Thursday 26 November 2026 at noon (13 days after the seeded Friday).
  tender = await addTender({ title: "School kitchen refurbishments, Phase 2", firstSeen: SEEDED, deadlineInDays: 13 });
  await saveTender(a, tender);
});

afterEach(() => {
  registerDeadlineSource(bidsDeadlineSource);
});

describe("which days", () => {
  it("is due exactly 7 and 2 calendar days before the closing date, and on no other day", async () => {
    expect(notificationsConfig.reminder.offsets).toEqual([7, 2]);
    const due: string[] = [];
    for (let day = 14; day <= 26; day += 1) {
      const now = eight(`2026-11-${day}`);
      const content = await buildReminder(await a.ctx(now), now);
      if (content) due.push(`${day}: ${content.items.map((item) => `${item.daysLeft} days`).join(", ")}`);
    }
    expect(due).toEqual(["19: 7 days", "24: 2 days"]);
  });

  it("counts days in UK time whatever the hour of the deadline, including midnight", async () => {
    // "Midnight, start of the day" on Thursday the 26th belongs to Thursday.
    await setDeadline(tender, at("2026-11-26T00:00:00Z"));
    const tuesday = eight("2026-11-24");
    const content = (await buildReminder(await a.ctx(tuesday), tuesday))!;
    expect(content.items[0]).toMatchObject({ daysLeft: 2, moment: "Thu 26 Nov 2026, 00:00 (midnight, start of the day)" });
    // One minute before midnight is still Wednesday the 25th: two days after Monday.
    await setDeadline(tender, at("2026-11-25T23:59:00Z"));
    expect(await buildReminder(await a.ctx(tuesday), tuesday)).toBeNull();
    const monday = eight("2026-11-23");
    expect((await buildReminder(await a.ctx(monday), monday))!.items[0]).toMatchObject({ daysLeft: 2, moment: "Wed 25 Nov 2026, 23:59" });
  });

  it("stays right across the clock change (deadline Tuesday 30 March 2027, noon BST)", async () => {
    await setDeadline(tender, at("2027-03-30T11:00:00Z"));
    const seven = at("2027-03-23T08:00:00Z"); // Tuesday 08:00 GMT
    const two = at("2027-03-28T07:00:00Z"); // Sunday 08:00 BST: the day the clocks go forward
    expect((await buildReminder(await a.ctx(seven), seven))!.items[0]).toMatchObject({ daysLeft: 7, moment: "Tue 30 Mar 2027, 12:00 noon" });
    expect((await buildReminder(await a.ctx(two), two))!.items[0]).toMatchObject({ daysLeft: 2 });
    for (const other of ["2027-03-22T08:00:00Z", "2027-03-24T08:00:00Z", "2027-03-27T08:00:00Z", "2027-03-29T07:00:00Z"]) {
      expect(await buildReminder(await a.ctx(at(other)), at(other))).toBeNull();
    }
    // The fan-out looks for deadlines on the UK days today+7 and today+2: on the Sunday, Tuesday the 30th in BST.
    expect(reminderRanges(two).map((range) => [range.from.toISOString(), range.to.toISOString()])).toEqual([
      ["2027-04-03T23:00:00.000Z", "2027-04-04T23:00:00.000Z"],
      ["2027-03-29T23:00:00.000Z", "2027-03-30T23:00:00.000Z"],
    ]);
    expect(await runFanout({ kind: "reminder", period: "2027-03-28" }, { now: two })).toEqual({ status: "done", enqueued: 1 });
    // 00:30 BST on Wednesday the 31st is not "Tuesday".
    await setDeadline(tender, at("2027-03-30T23:30:00Z"));
    await db.execute(sql`delete from jobs`);
    expect(await runFanout({ kind: "reminder", period: "2027-03-28" }, { now: two })).toEqual({ status: "done", enqueued: 0 });
  });
});

describe("the e-mail", () => {
  it("states the deadline as a fact and links to the tender and the official notice", async () => {
    const thursday = eight("2026-11-19");
    expect(await send("reminder", "2026-11-19", of(a), thursday)).toBe("sent");
    const [row] = await logRows({ kind: "reminder" });
    expect(row).toMatchObject({ status: "sent", periodKey: "2026-11-19", itemCount: 1, items: [{ t: "deadline", ref: tender, offset: 7 }] });
    const [email] = await scheduledEmails(a.owner.email);
    expect(email).toMatchObject({ template: "deadline-reminder", subject: "Closes in 7 days: School kitchen refurbishments, Phase 2" });

    const body = plainText(email!.html);
    for (const text of [body, email!.text.replace(/\s+/g, " ")]) {
      expect(text.includes("Joanne,"), "greeting").toBe(true);
      expect(text.includes("This tender closes in 7 days."), "headline").toBe(true);
      expect(text.includes("School kitchen refurbishments, Phase 2"), "title").toBe(true);
      expect(text.includes("Leeds City Council"), "buyer").toBe(true);
      expect(text.includes("Closes Thu 26 Nov 2026, 12:00 noon"), "moment").toBe(true);
      expect(text.includes("Bids go in through the buyer’s own portal. Leave time to upload."), "portal note").toBe(true);
      expect(text.includes("You get deadline reminders for tenders you have saved, 7 days and 2 days before each one closes."), "reason").toBe(true);
      expect(text.includes("Reply to this email if anything looks wrong."), "sign-off").toBe(true);
      // Factual: no countdown language, no encouragement, nothing that implies a win.
      expect(/hurry|don.t miss|last chance|act now|!|win\b/i.test(text), "urgency").toBe(false);
    }
    const links = urlsIn(email!.html).filter((url) => !url.includes("/email/mark"));
    expect(links).toEqual([`http://localhost:3000/tenders/${tender}?d=${row!.id}`, expect.stringMatching(/^https:\/\/www\.find-tender\.service\.gov\.uk\/Notice\/\d+-2026$/), "http://localhost:3000/app/settings/notifications"]);
    expect(email!.text.includes(`Open on Bidfolio: http://localhost:3000/tenders/${tender}?d=${row!.id}`), "text link").toBe(true);
    expect(email!.text.includes("Notice on Find a Tender: https://www.find-tender.service.gov.uk/Notice/"), "text notice link").toBe(true);
    // One-click unsubscribe for mail clients, although the footer only offers "Change what you get".
    expect(email!.headers).toMatchObject({ "List-Unsubscribe": expect.stringMatching(/^<http:\/\/localhost:3000\/api\/notifications\/unsubscribe\?t=[\w.-]+>$/), "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    expect(await eventsNamed("reminder_sent")).toEqual([expect.objectContaining({ organizationId: a.organizationId, userId: a.owner.id, properties: { type: "deadline", items: 1 } })]);
  });

  it("combines everything due that day into one e-mail, soonest first", async () => {
    const later = await addTender({ title: "Parks grounds maintenance", firstSeen: SEEDED, deadlineInDays: 18 }); // Tue 1 Dec
    await saveTender(a, later);
    await addTender({ title: "Not saved grounds maintenance", firstSeen: SEEDED, deadlineInDays: 13 });
    const notDue = await addTender({ title: "Closing another day", firstSeen: SEEDED, deadlineInDays: 15 });
    await saveTender(a, notDue);
    // Tuesday 24 November: the kitchen tender closes in 2 days, the parks tender in 7.
    const tuesday = eight("2026-11-24");
    expect(await send("reminder", "2026-11-24", of(a), tuesday)).toBe("sent");
    const emails = await scheduledEmails(a.owner.email);
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toBe("Closes in 2 days: School kitchen refurbishments, Phase 2 (+1 more)");
    const body = plainText(emails[0]!.html);
    expect(body.includes("Two tenders are closing: one in 2 days and one in 7 days."), "headline").toBe(true);
    expect(body.includes("Closes in 2 days: Thu 26 Nov 2026, 12:00 noon"), "first line").toBe(true);
    expect(body.includes("Closes in 7 days: Tue 1 Dec 2026, 12:00 noon"), "second line").toBe(true);
    expect(body.indexOf("School kitchen")).toBeLessThan(body.indexOf("Parks grounds"));
    expect(body.includes("Not saved") || body.includes("Closing another day"), "tenders that are not due").toBe(false);
    const [row] = await logRows({ kind: "reminder" });
    expect(row!.items).toEqual([
      { t: "deadline", ref: tender, offset: 2 },
      { t: "deadline", ref: later, offset: 7 },
    ]);
    expect((await eventsNamed("reminder_sent"))[0]!.properties).toEqual({ type: "deadline", items: 2 });
  });
});

describe("once per member, tender and offset", () => {
  it("does not repeat an offset, even when the buyer moves the deadline", async () => {
    expect(await send("reminder", "2026-11-19", of(a), eight("2026-11-19"))).toBe("sent");
    expect(await send("reminder", "2026-11-19", of(a), at("2026-11-19T09:00:00Z"))).toBe("already_done");
    // The buyer extends the deadline by a day: on Friday it is "7 days" again. Not said twice.
    await setDeadline(tender, at("2026-11-27T12:00:00Z"));
    const friday = eight("2026-11-20");
    expect(await buildReminder(await a.ctx(friday), friday)).toBeNull();
    expect(await send("reminder", "2026-11-20", of(a), friday)).toBe("skipped_empty");
    // The 2-day reminder follows the new date.
    expect(await send("reminder", "2026-11-25", of(a), eight("2026-11-25"))).toBe("sent");
    expect((await scheduledEmails(a.owner.email)).map((email) => email.subject)).toEqual([
      "Closes in 7 days: School kitchen refurbishments, Phase 2",
      "Closes in 2 days: School kitchen refurbishments, Phase 2",
    ]);
    expect((await logRows({ kind: "reminder" })).map((row) => [row.periodKey, row.status])).toEqual([
      ["2026-11-19", "sent"],
      ["2026-11-20", "skipped_empty"],
      ["2026-11-25", "sent"],
    ]);
  });

  it("goes to each member who wants it; a workspace with nothing due is not visited", async () => {
    const colleague = await addWorkspaceMember(a, { name: "Colin Colleague" });
    const optedOut = await addWorkspaceMember(a, { name: "Olive Off" });
    await updateNotificationPrefs(optedOut.id, a.organizationId, { deadlineReminders: false });
    // Another workspace saved a tender that closes on a different day.
    const other = await createWorkspace({ name: "Other Workspace" });
    await saveTender(other, await addTender({ title: "Elsewhere grounds maintenance", firstSeen: SEEDED, deadlineInDays: 11 }));

    const thursday = eight("2026-11-19");
    expect(await runFanout({ kind: "reminder", period: "2026-11-19" }, { now: thursday })).toEqual({ status: "done", enqueued: 2 });
    const sends = await jobsOfType("notifications.send");
    expect(sends.map((job) => job.payload.userId).sort()).toEqual([a.owner.id, colleague.id].sort());
    expect(sends.map((job) => job.dedupeKey).sort()).toEqual([a.owner.id, colleague.id].map((user) => `reminder:${a.organizationId}:${user}:2026-11-19`).sort());
    for (const job of sends) expect(await send("reminder", "2026-11-19", { organizationId: job.payload.organizationId!, userId: job.payload.userId! }, thursday)).toBe("sent");
    expect((await scheduledEmails()).map((email) => email.to).sort()).toEqual([a.owner.email, colleague.email].map((email) => email.toLowerCase()).sort());
    // A member who switched reminders off, asked directly: logged, not sent.
    expect(await send("reminder", "2026-11-19", of(a, optedOut), thursday)).toBe("skipped_pref");
    // Nothing is due for the other workspace on any of these days.
    expect(await send("reminder", "2026-11-19", of(other), thursday)).toBe("skipped_empty");
  });

  it("says nothing about a tender that has closed or was withdrawn", async () => {
    await db.execute(sql`update notices set status = 'cancelled' where ocid = ${tender}`);
    expect(await buildReminder(await a.ctx(eight("2026-11-19")), eight("2026-11-19"))).toBeNull();
    await db.execute(sql`update notices set status = 'active' where ocid = ${tender}`);
    const after = at("2026-11-26T12:00:01Z");
    expect(await buildReminder(await a.ctx(after), after)).toBeNull();
  });
});

describe("the seam for bids in progress", () => {
  it("is empty until the bids module fills it", async () => {
    expect(deadlineSources().map((source) => source.name)).toEqual(["radar", "bids"]);
    expect(await bidsDeadlineSource.list(await a.ctx(), new Date())).toEqual([]);
    expect(await bidsDeadlineSource.organizations([])).toEqual([]);
  });

  it("a registered source adds its deadlines; a tender in two sources is mentioned once, with the bid's link", async () => {
    const tuesday = eight("2026-11-24");
    registerDeadlineSource({
      name: "bids",
      organizations: async () => [a.organizationId],
      list: async (ctx) =>
        ctx.organization.id !== a.organizationId
          ? []
          : [
              // A bid for the tender the workspace also saved…
              { ref: "bid_1", ocid: tender, title: "School kitchen refurbishments, Phase 2", buyer: "Leeds City Council", deadlineAt: at("2026-11-26T12:00:00Z"), url: "/app/bids/bid_1", openLabel: "Open the bid", noticeUrl: null, progress: ["4 of 6 answers drafted and marked", "2 gaps: no evidence found"] },
              // …and one for a tender that is not on the radar at all.
              { ref: "bid_2", ocid: null, title: "Housing repairs framework", buyer: "City of York Council", deadlineAt: at("2026-12-01T17:00:00Z"), url: "https://bidfolio.co.uk/app/bids/bid_2", openLabel: "Open the bid", noticeUrl: "https://www.find-tender.service.gov.uk/Notice/123456-2026" },
            ],
    });
    expect(deadlineSources().map((source) => source.name)).toEqual(["radar", "bids"]); // replaced, not added twice

    // Thursday the 19th: the kitchen tender, now a bid, closes in 7 days. One tender: the artboard's layout.
    const thursday = eight("2026-11-19");
    expect(await send("reminder", "2026-11-19", of(a), thursday)).toBe("sent");
    const [single] = await scheduledEmails(a.owner.email);
    const singleBody = plainText(single!.html);
    expect(singleBody.includes("This tender closes in 7 days."), "headline").toBe(true);
    expect(singleBody.includes("Where your bid stands"), "progress heading").toBe(true);
    expect(singleBody.includes("4 of 6 answers drafted and marked") && singleBody.includes("2 gaps: no evidence found"), "progress lines").toBe(true);
    expect(urlsIn(single!.html).filter((url) => !url.includes("/email/mark"))).toEqual(["http://localhost:3000/app/bids/bid_1", "http://localhost:3000/app/settings/notifications"]);
    expect(single!.text.includes("Where your bid stands:\n- 4 of 6 answers drafted and marked\n- 2 gaps: no evidence found\nOpen the bid: http://localhost:3000/app/bids/bid_1"), "text version").toBe(true);

    // Tuesday the 24th: that bid closes in 2 days and the other one in 7.
    const content = (await buildReminder(await a.ctx(tuesday), tuesday))!;
    expect(content.items.map((item) => [item.key, item.daysLeft])).toEqual([
      [tender, 2],
      ["bids:bid_2", 7],
    ]);
    expect(await send("reminder", "2026-11-24", of(a), tuesday)).toBe("sent");
    const [, email] = await scheduledEmails(a.owner.email);
    const body = plainText(email!.html);
    expect(body.includes("4 of 6 answers drafted and marked"), "progress line").toBe(true);
    expect(body.includes("Closes in 7 days: Tue 1 Dec 2026, 17:00"), "bid deadline").toBe(true);
    const links = urlsIn(email!.html);
    expect(links).toContain("http://localhost:3000/app/bids/bid_1");
    expect(links).toContain("https://bidfolio.co.uk/app/bids/bid_2");
    expect(links).toContain("https://www.find-tender.service.gov.uk/Notice/123456-2026");
    expect(links.some((url) => url.includes(`/tenders/${tender}`)), "the tender page is replaced by the bid's page").toBe(false);
    expect((email!.html.match(/Open the bid/g) ?? []).length).toBe(2);
    expect((await logRows({ kind: "reminder" })).map((row) => row.items)).toEqual([
      [{ t: "deadline", ref: tender, offset: 7 }],
      [
        { t: "deadline", ref: tender, offset: 2 },
        { t: "deadline", ref: "bids:bid_2", offset: 7 },
      ],
    ]);
    // The fan-out asks every source which workspaces to visit.
    await db.execute(sql`delete from jobs`);
    await db.execute(sql`delete from radar_items`);
    expect(await runFanout({ kind: "reminder", period: "2026-11-24" }, { now: tuesday })).toEqual({ status: "done", enqueued: 1 });
  });
});
