import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));

import { notificationsConfig } from "@/features/notifications/config";
import { arrangeNew, buildAlert, buildDigest } from "@/features/notifications/content/digest";
import { enteredWindow, isStrongMatch, seenAfter, selectDigestMatches, STRONG_MATCH } from "@/features/notifications/content/matches";
import type { MatchItem } from "@/features/procurement/queries/matches";
import { getMatchesForSpec } from "@/features/procurement/queries/matches";
import { listRadarSources, specForSource } from "@/features/procurement/radar/data";
import { resetDatabase } from "../helpers/db";
import { resetProcurement } from "../procurement/helpers/schema";
import {
  addRivalContract,
  addTender,
  BRISTOL,
  createWorkspace,
  daysBefore,
  eventsNamed,
  hoursBefore,
  logRows,
  MONDAY,
  NEXT_MONDAY,
  NEXT_WEEK,
  plainText,
  saveTender,
  scheduledEmails,
  seedAcme,
  send,
  setBackfilled,
  setPlan,
  SOFTWARE,
  TUESDAY,
  urlsIn,
  WEEK,
  type Workspace,
} from "./helpers";

/**
 * What a digest or an alert says: only what is NEW for the member since their last e-mail,
 * only strong matches, inside the plan's cap, never padded.
 */
let acme: string;
let workspace: Workspace;
const who = () => ({ organizationId: workspace.organizationId, userId: workspace.owner.id });

beforeAll(async () => {
  await resetProcurement();
});

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
  acme = await seedAcme();
  workspace = await createWorkspace({ name: "Joanne Pike", supplier: acme });
});

describe("new since last time", () => {
  it("the first digest looks back seven days", async () => {
    const recent = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 3), deadlineInDays: 20 });
    const earlier = await addTender({ title: "Cemetery grounds maintenance", firstSeen: daysBefore(MONDAY, 6), deadlineInDays: 12 });
    await addTender({ title: "Verge cutting grounds maintenance", firstSeen: daysBefore(MONDAY, 8) });

    const digest = (await buildDigest(await workspace.ctx(), MONDAY))!;
    expect(digest.since).toEqual({ at: daysBefore(MONDAY, 7), first: true });
    // Soonest closing first.
    expect(digest.matches.shown.map((item) => item.ocid)).toEqual([earlier, recent]);
    expect(digest.matches.total).toBe(2);
    expect(digest.company).toMatchObject({ short: "Acme Grounds", full: "Acme Grounds Ltd" });
  });

  it("the next digest lists only what arrived after the last one, and nothing twice", async () => {
    const first = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 3) });
    // Stored at the very moment the digest was being put together: listed in it.
    const atTheLastMinute = await addTender({ title: "Highways grounds maintenance", firstSeen: hoursBefore(MONDAY, 0.1) });
    expect(await send("digest", WEEK, who(), MONDAY)).toBe("sent");
    const [monday] = await logRows({ kind: "digest" });
    expect(monday).toMatchObject({ status: "sent", periodKey: WEEK, itemCount: 2 });
    expect(monday!.asOf).toEqual(MONDAY);
    expect(monday!.items).toEqual(expect.arrayContaining([{ t: "match", ref: first }, { t: "match", ref: atTheLastMinute }]));

    const later = await addTender({ title: "Schools grounds maintenance", firstSeen: daysBefore(NEXT_MONDAY, 2) });
    // Arrived ten minutes before Monday's digest but was not in it (still being stored): not lost.
    const justMissed = await addTender({ title: "Housing estates grounds maintenance", firstSeen: hoursBefore(MONDAY, 0.15) });

    const next = (await buildDigest(await workspace.ctx(NEXT_MONDAY), NEXT_MONDAY))!;
    expect(next.since).toEqual({ at: MONDAY, first: false });
    expect(next.matches.shown.map((item) => item.ocid).sort()).toEqual([later, justMissed].sort());
    expect(next.matches.total).toBe(2);
  });

  it("an alert continues from the last digest or alert, whichever was later", async () => {
    await setPlan(workspace.organizationId, { planKey: "pro" });
    await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    expect(await send("digest", WEEK, who(), MONDAY)).toBe("sent");
    // Nothing new on Tuesday: no alert, and the log says why.
    expect(await send("alert", "2026-11-17", who(), TUESDAY)).toBe("skipped_empty");

    const wednesday = new Date("2026-11-18T07:30:00Z");
    const overnight = await addTender({ title: "Sports pitches grounds maintenance", firstSeen: hoursBefore(wednesday, 10) });
    const alert = (await buildAlert(await workspace.ctx(wednesday), wednesday))!;
    expect(alert.kind).toBe("alert");
    expect(alert.since).toEqual({ at: TUESDAY, first: false });
    expect(alert.matches.shown.map((item) => item.ocid)).toEqual([overnight]);
    // Alerts carry matches only.
    expect(alert.ending).toEqual({ shown: [], total: 0 });
    expect(alert.saved).toEqual({ shown: [], total: 0 });
  });

  it("a notice that reaches us long after it was published is not announced as new", async () => {
    const backfilled = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 1) });
    await setBackfilled(backfilled, daysBefore(MONDAY, 30), hoursBefore(MONDAY, 2));
    expect(await buildDigest(await workspace.ctx(), MONDAY)).toBeNull();
    // Arriving up to 72 hours after publication is ordinary feed delay: it counts from arrival.
    await setBackfilled(backfilled, daysBefore(MONDAY, 9), daysBefore(MONDAY, 6.5));
    expect((await buildDigest(await workspace.ctx(), MONDAY))?.matches.total).toBe(1);
  });

  it("measures 'since' with a small overlap and against what was already listed (pure)", () => {
    const since = new Date("2026-11-16T07:30:00Z");
    expect(seenAfter(new Date("2026-11-16T07:30:01Z"), since)).toBe(true);
    expect(seenAfter(new Date("2026-11-16T07:15:00Z"), since)).toBe(true); // inside the 20-minute overlap
    expect(seenAfter(new Date("2026-11-16T07:09:59Z"), since)).toBe(false);
    expect(seenAfter(undefined, since)).toBe(false);
    expect(notificationsConfig.overlapMinutes).toBe(20);

    const item = (ocid: string, deadlineAt: string, score = 0.8) => ({ ocid, deadlineAt, score }) as MatchItem;
    const arranged = arrangeNew({
      matches: [item("b", "2026-12-20T12:00:00Z"), item("a", "2026-12-01T12:00:00Z"), item("listed", "2026-11-20T12:00:00Z"), item("saved", "2026-11-21T12:00:00Z"), item("a", "2026-12-01T12:00:00Z", 0.9)],
      ending: [],
      listed: { matches: new Set(["listed"]), ending: new Set() },
      savedOcids: new Set(["saved"]),
    });
    expect(arranged.matches.map((entry) => entry.ocid)).toEqual(["a", "b"]);
    expect(arranged.matches[0]!.score).toBe(0.9); // matched by two radars: counted once, with the better score
  });
});

describe("only strong matches, inside the plan", () => {
  it("leaves out weak matches the radar screen still shows", async () => {
    const strong = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    // Right trade, wrong end of the country.
    const elsewhere = await addTender({ title: "Harbourside grounds maintenance", buyer: BRISTOL, regions: ["UKK"], firstSeen: daysBefore(MONDAY, 2) });
    // A neighbouring trade (tree pruning) in the right region.
    const neighbour = await addTender({ title: "Tree pruning programme", cpv: ["77340000"], firstSeen: daysBefore(MONDAY, 2) });
    // Another trade altogether: not on the radar at all.
    const unrelated = await addTender({ title: "Payroll software", cpv: SOFTWARE, firstSeen: daysBefore(MONDAY, 2) });

    const ctx = await workspace.ctx();
    const [source] = await listRadarSources(ctx);
    const spec = (await specForSource(source!))!;
    const radar = await getMatchesForSpec(spec, { now: MONDAY, limit: 50 });
    const onRadar = new Map(radar.items.map((item) => [item.ocid, item]));
    expect([...onRadar.keys()].sort()).toEqual([strong, elsewhere, neighbour].sort());
    expect(onRadar.has(unrelated)).toBe(false);
    expect(onRadar.get(strong)!.score).toBeGreaterThanOrEqual(STRONG_MATCH.minScore);
    expect(onRadar.get(elsewhere)!.breakdown.regionMatch).toBe("elsewhere");
    expect(onRadar.get(neighbour)!.score).toBeLessThan(STRONG_MATCH.minScore);
    expect(radar.items.filter((item) => isStrongMatch(item, spec)).map((item) => item.ocid)).toEqual([strong]);

    const selected = await selectDigestMatches(ctx, source!, daysBefore(MONDAY, 7), { now: MONDAY });
    expect(selected.fresh.map((item) => item.ocid)).toEqual([strong]);
    expect(selected.locked).toBe(0);
    const digest = (await buildDigest(ctx, MONDAY))!;
    expect(digest.matches.shown.map((item) => item.ocid)).toEqual([strong]);
    expect(digest.matches.total).toBe(1);
  });

  it("decides 'strong' on the score and the region the query already returns (pure)", () => {
    const item = (score: number, regionMatch: "local" | "nationwide" | "unknown" | "elsewhere") => ({ score, breakdown: { regionMatch } }) as unknown as MatchItem;
    const withRegions = { regions: ["UKE"] };
    expect(STRONG_MATCH.minScore).toBe(0.55);
    expect(isStrongMatch(item(0.55, "local"), withRegions)).toBe(true);
    expect(isStrongMatch(item(0.9, "nationwide"), withRegions)).toBe(true);
    expect(isStrongMatch(item(0.5499, "local"), withRegions)).toBe(false);
    expect(isStrongMatch(item(0.9, "elsewhere"), withRegions)).toBe(false);
    expect(isStrongMatch(item(0.9, "unknown"), withRegions)).toBe(false);
    // A profile with no region of its own cannot be "local" anywhere: unknown is then enough.
    expect(isStrongMatch(item(0.9, "unknown"), { regions: [] })).toBe(true);
    expect(isStrongMatch(item(0.9, "elsewhere"), { regions: [] })).toBe(false);
  });

  it("an alert shows eight tenders and counts the rest", async () => {
    await setPlan(workspace.organizationId, { planKey: "pro" });
    // The first alert covers what came in since the previous working day's slot (Monday 07:30).
    for (let index = 0; index < 9; index += 1) await addTender({ firstSeen: hoursBefore(TUESDAY, 6), deadlineInDays: 12 + index });
    await addTender({ title: "Last week's grounds maintenance", firstSeen: daysBefore(TUESDAY, 3) });
    const alert = (await buildAlert(await workspace.ctx(TUESDAY), TUESDAY))!;
    expect(notificationsConfig.alert.maxMatches).toBe(8);
    expect(alert.since).toEqual({ at: MONDAY, first: true });
    expect(alert.matches.shown).toHaveLength(8);
    expect(alert.matches.total).toBe(9);

    expect(await send("alert", "2026-11-17", who(), TUESDAY)).toBe("sent");
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email).toMatchObject({ template: "radar-alert", subject: "9 new tenders for Acme Grounds" });
    expect((email!.html.match(/Open on Bidfolio/g) ?? []).length).toBe(8);
    expect(email!.text.includes("Since yesterday, nine new tenders match Acme Grounds."), "Since yesterday, nine new tenders match Acme Grounds.").toBe(true);
    expect(email!.text.includes("This email lists the first few. Your radar shows 1 more new tender."), "This email lists the first few. Your radar shows 1 more new tender.").toBe(true);
    expect(email!.html.includes("Contracts ending soon"), "Contracts ending soon").toBe(false);
    expect(email!.text.includes("You get this on working days when there is something new because you have a Bidfolio radar for Acme Grounds Ltd."), "You get this on working days when there is something new because you have a Bidfolio radar for Acme Grounds Ltd.").toBe(true);
    expect(await eventsNamed("alert_sent")).toEqual([expect.objectContaining({ properties: { matches: 9, plan: "pro" } })]);
  });

  it("a digest shows five tenders and counts the rest", async () => {
    const ocids: string[] = [];
    for (let index = 0; index < 9; index += 1) ocids.push(await addTender({ firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 40 - index }));
    const soonestFirst = [...ocids].reverse();

    const digest = (await buildDigest(await workspace.ctx(), MONDAY))!;
    expect(notificationsConfig.digest.maxMatches).toBe(5);
    expect(digest.matches.shown.map((item) => item.ocid)).toEqual(soonestFirst.slice(0, 5));
    expect(digest.matches.total).toBe(9);
    // Everything counted as new is remembered, shown or not: none of it is news next week.
    expect(digest.refs.filter((ref) => ref.t === "match").map((ref) => ref.ref).sort()).toEqual([...ocids].sort());

    expect(await send("digest", WEEK, who(), MONDAY)).toBe("sent");
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email!.subject).toBe("9 new tenders for Acme Grounds");
    expect(email!.text.includes("This email lists the first few. Your radar shows 4 more new tenders."), "This email lists the first few. Your radar shows 4 more new tenders.").toBe(true);
    expect((email!.html.match(/Open on Bidfolio/g) ?? []).length).toBe(5);
    // Nothing from Monday's digest comes back the week after, shown or only counted.
    expect(await buildDigest(await workspace.ctx(NEXT_MONDAY), NEXT_MONDAY)).toBeNull();
  });

  it("on Free stays inside the top ten and adds one plain line about the rest", async () => {
    const ocids: string[] = [];
    for (let index = 0; index < 14; index += 1) ocids.push(await addTender({ firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 10 + index }));
    // Weak matches are on the radar too, but they are not what "more matches" counts.
    for (let index = 0; index < 3; index += 1) await addTender({ title: `Harbourside grounds maintenance ${index}`, buyer: BRISTOL, regions: ["UKK"], firstSeen: daysBefore(MONDAY, 2) });

    const ctx = await workspace.ctx();
    expect(ctx.entitlements.planKey).toBe("free");
    const digest = (await buildDigest(ctx, MONDAY))!;
    // The cap is the radar's own: the ten best, here the ten that close soonest.
    expect(digest.matches.total).toBe(10);
    expect(digest.matches.shown.map((item) => item.ocid)).toEqual(ocids.slice(0, 5));
    expect(digest.refs.filter((ref) => ref.t === "match").map((ref) => ref.ref).sort()).toEqual(ocids.slice(0, 10).sort());
    expect(digest.locked).toBe(4);

    expect(await send("digest", WEEK, who(), MONDAY)).toBe("sent");
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email!.subject).toBe("10 new tenders for Acme Grounds");
    for (const body of [email!.html, email!.text]) {
      expect(body.match(/4 more matches are waiting on your radar\./g)).toHaveLength(1);
      expect(body.includes("http://localhost:3000/pricing"), "http://localhost:3000/pricing").toBe(true);
      // One line, no other upsell.
      expect(body).not.toMatch(/upgrade|free trial|unlock|discount|% off|limited time/i);
    }
    expect(urlsIn(email!.html).filter((url) => url.includes("/pricing"))).toHaveLength(1);
    // A tender beyond the cap is not linked from the e-mail.
    for (const locked of ocids.slice(10)) expect(email!.html.includes(locked), locked).toBe(false);
  });

  it("says nothing about a cap when everything fits", async () => {
    await addTender({ firstSeen: daysBefore(MONDAY, 2) });
    expect((await buildDigest(await workspace.ctx(), MONDAY))!.locked).toBe(0);
    await send("digest", WEEK, who(), MONDAY);
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email!.html.includes("waiting on your radar"), "waiting on your radar").toBe(false);
    expect(urlsIn(email!.html).some((url) => url.includes("/pricing"))).toBe(false);
  });
});

describe("nothing new means no e-mail", () => {
  it("logs skipped_empty and sends nothing; the next digest starts from there", async () => {
    await addTender({ title: "Old news grounds maintenance", firstSeen: daysBefore(MONDAY, 20) });
    expect(await buildDigest(await workspace.ctx(), MONDAY)).toBeNull();
    expect(await send("digest", WEEK, who(), MONDAY)).toBe("skipped_empty");
    expect(await scheduledEmails()).toEqual([]);
    const [row] = await logRows({ kind: "digest" });
    expect(row).toMatchObject({ status: "skipped_empty", periodKey: WEEK, itemCount: 0, items: [], sentAt: null, outboxId: null });
    expect(await eventsNamed("digest_sent")).toEqual([]);
    // Asking again for the same week changes nothing.
    expect(await send("digest", WEEK, who(), MONDAY)).toBe("already_done");
    expect(await logRows({ kind: "digest" })).toHaveLength(1);

    const fresh = await addTender({ title: "Fresh grounds maintenance", firstSeen: daysBefore(NEXT_MONDAY, 1) });
    const next = (await buildDigest(await workspace.ctx(NEXT_MONDAY), NEXT_MONDAY))!;
    expect(next.since).toEqual({ at: MONDAY, first: false });
    expect(next.matches.shown.map((item) => item.ocid)).toEqual([fresh]);
  });

  it("a workspace without a radar gets nothing", async () => {
    const empty = await createWorkspace({ name: "No Radar" });
    await addTender({ firstSeen: daysBefore(MONDAY, 1) });
    expect(await buildDigest(await empty.ctx(), MONDAY)).toBeNull();
    expect(await send("digest", WEEK, { organizationId: empty.organizationId, userId: empty.owner.id }, MONDAY)).toBe("skipped_empty");
    expect(await scheduledEmails(empty.owner.email)).toEqual([]);
  });

  it("is never padded: saved tenders alone do not make a digest", async () => {
    const saved = await addTender({ title: "Saved grounds maintenance", firstSeen: daysBefore(MONDAY, 30), deadlineInDays: 10 });
    await saveTender(workspace, saved);
    expect(await buildDigest(await workspace.ctx(), MONDAY)).toBeNull();
    expect(await send("digest", WEEK, who(), MONDAY)).toBe("skipped_empty");
  });
});

describe("the member's own radar", () => {
  it("never mentions a dismissed tender and does not announce a saved one as new", async () => {
    const dismissed = await addTender({ title: "Dismissed grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    const saved = await addTender({ title: "Saved grounds maintenance", firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 12 });
    const savedFarOff = await addTender({ title: "Saved for later grounds maintenance", firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 60 });
    const fresh = await addTender({ title: "Fresh grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    await saveTender(workspace, dismissed, "dismissed");
    await saveTender(workspace, saved);
    await saveTender(workspace, savedFarOff);

    const digest = (await buildDigest(await workspace.ctx(), MONDAY))!;
    expect(digest.matches.shown.map((item) => item.ocid)).toEqual([fresh]);
    // Saved tenders closing within 14 days ride along once there is something to send.
    expect(notificationsConfig.digest.savedClosingDays).toBe(14);
    expect(digest.saved.shown.map((item) => item.ocid)).toEqual([saved]);
    expect(digest.saved.shown[0]).toMatchObject({ reason: null, left: "9 days left" });

    await send("digest", WEEK, who(), MONDAY);
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email!.html.includes("Saved tenders closing soon"), "Saved tenders closing soon").toBe(true);
    expect(email!.html.includes(dismissed), dismissed).toBe(false);
    expect(email!.html.includes("Dismissed grounds maintenance"), "Dismissed grounds maintenance").toBe(false);
    expect(email!.html.includes(savedFarOff), savedFarOff).toBe(false);
  });

  it("gives every tender its buyer, value when published, deadline in UK days, the reason, and one link", async () => {
    const valued = await addTender({ title: "School kitchen refurbishments, Phase 2", value: 640_000, firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 13 });
    const unvalued = await addTender({ title: "Parks grounds maintenance", value: null, firstSeen: daysBefore(MONDAY, 2), deadlineInDays: 40 });

    const digest = (await buildDigest(await workspace.ctx(), MONDAY))!;
    const [first, second] = digest.matches.shown;
    // Seeded Friday 13 Nov 12:00 + 13 days = Thursday 26 Nov, 12:00: ten days after Monday the 16th.
    expect(first).toMatchObject({ ocid: valued, title: "School kitchen refurbishments, Phase 2", buyer: "Leeds City Council", value: "est. £640,000", closes: "Closes 26 Nov 2026", left: "10 days left" });
    // No value published: none shown, none invented.
    expect(second).toMatchObject({ ocid: unvalued, value: null });
    expect(first!.reason).toBeTruthy();
    expect(first!.reason).not.toMatch(/\n/);

    await send("digest", WEEK, who(), MONDAY);
    const [row] = await logRows({ kind: "digest" });
    const [email] = await scheduledEmails(workspace.owner.email);
    for (const ocid of [valued, unvalued]) {
      const link = `http://localhost:3000/tenders/${ocid}?d=${row!.id}`;
      expect(urlsIn(email!.html).filter((url) => url.includes(ocid))).toEqual([link]);
      expect(email!.text.split(link)).toHaveLength(2);
    }
    expect(email!.text.includes("Leeds City Council · est. £640,000"), "Leeds City Council · est. £640,000").toBe(true);
    expect(email!.text.includes("Closes 26 Nov 2026 (10 days left)"), "Closes 26 Nov 2026 (10 days left)").toBe(true);
    expect(email!.text).not.toMatch(/est\. £0|£NaN|undefined|null/);
    expect((email!.html.match(/est\. /g) ?? []).length).toBe(1);
  });
});

describe("contracts ending soon", () => {
  it("lists rivals' contracts that are new to the 12-month window, three at most", async () => {
    expect(notificationsConfig.digest).toMatchObject({ endingSoonMonths: 12, maxEndingSoon: 3 });
    // New to us this week, ending in four months.
    const fresh = await addRivalContract({ rival: "Greaves Hollin Contractors Ltd", firstSeen: daysBefore(MONDAY, 3), endsInDays: 120, value: 2_100_000 });
    // Known for months and well inside the window: old news.
    await addRivalContract({ rival: "Longstanding Landscapes Ltd", firstSeen: daysBefore(MONDAY, 200), endsInDays: 150 });
    // Ends in two years: not "soon".
    await addRivalContract({ rival: "Faraway Grounds Ltd", firstSeen: daysBefore(MONDAY, 3), endsInDays: 800 });
    // Another trade.
    await addRivalContract({ rival: "Code Smiths Ltd", firstSeen: daysBefore(MONDAY, 3), cpv: SOFTWARE, endsInDays: 100 });

    const digest = (await buildDigest(await workspace.ctx(), MONDAY))!;
    expect(digest.matches).toEqual({ shown: [], total: 0 });
    expect(digest.ending.total).toBe(1);
    expect(digest.ending.shown[0]).toMatchObject({ ocid: fresh.ocid, supplierId: fresh.supplierId, heldBy: "Held by Greaves Hollin Contractors Ltd", buyer: "City of York Council", value: "£2,100,000" });
    expect(digest.ending.shown[0]!.ends).toMatch(/^Ends \d{1,2} \w{3} 2027$/);
    // Acme's own contract is never "a rival's".
    expect(digest.refs).toEqual([{ t: "ending", ref: fresh.ocid, supplier: fresh.supplierId }]);

    expect(await send("digest", WEEK, who(), MONDAY)).toBe("sent");
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email!.subject).toBe("1 contract ending soon in your trade · Acme Grounds");
    expect(email!.html.includes("Contracts ending soon"), "Contracts ending soon").toBe(true);
    expect(email!.html.includes("New matches"), "New matches").toBe(false);
    expect(await buildDigest(await workspace.ctx(NEXT_MONDAY), NEXT_MONDAY)).toBeNull();
  });

  it("picks up a known contract when its end date comes inside the window", async () => {
    // Known for a long time; on Monday it ends in 12 months and 3 days: not yet "soon".
    const months12 = new Date(MONDAY);
    months12.setUTCMonth(months12.getUTCMonth() + 12);
    const endsInDays = Math.round((months12.getTime() + 3 * 86_400_000 - new Date("2026-11-13T12:00:00Z").getTime()) / 86_400_000);
    const entering = await addRivalContract({ rival: "Greaves Hollin Contractors Ltd", firstSeen: daysBefore(MONDAY, 200), endsInDays });
    await addTender({ firstSeen: daysBefore(MONDAY, 1) });

    const monday = (await buildDigest(await workspace.ctx(), MONDAY))!;
    expect(monday.ending.total).toBe(0);
    await send("digest", WEEK, who(), MONDAY);
    // A week later it is inside the window: new to "ending soon", although the notice is old.
    const next = (await buildDigest(await workspace.ctx(NEXT_MONDAY), NEXT_MONDAY))!;
    expect(next.ending.shown.map((item) => item.ocid)).toEqual([entering.ocid]);
    expect(await send("digest", NEXT_WEEK, who(), NEXT_MONDAY)).toBe("sent");
    const third = new Date("2026-11-30T07:30:00Z");
    expect(await buildDigest(await workspace.ctx(third), third)).toBeNull();

    // The window test itself (pure): the end date crossed the 12-month line since `since`.
    const since = new Date("2026-11-16T07:30:00Z");
    expect(enteredWindow("2027-11-18T00:00:00Z", since, 12)).toBe(true);
    expect(enteredWindow("2027-11-10T00:00:00Z", since, 12)).toBe(false); // was already inside
    expect(enteredWindow(null, since, 12)).toBe(false);
  });

  it("shows three and counts the rest", async () => {
    for (let index = 0; index < 5; index += 1) await addRivalContract({ firstSeen: daysBefore(MONDAY, 2), endsInDays: 100 + index * 10 });
    const digest = (await buildDigest(await workspace.ctx(), MONDAY))!;
    expect(digest.ending.shown).toHaveLength(3);
    expect(digest.ending.total).toBe(5);
    const ends = digest.ending.shown.map((item) => item.ends);
    expect(ends).toEqual([...ends].sort((a, b) => Date.parse(a.replace("Ends ", "")) - Date.parse(b.replace("Ends ", ""))));
    await send("digest", WEEK, who(), MONDAY);
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email!.subject).toBe("5 contracts ending soon in your trade · Acme Grounds");
    expect(email!.text.includes("This email lists the first few. Your radar shows 2 more contracts ending soon."), "This email lists the first few. Your radar shows 2 more contracts ending soon.").toBe(true);
  });
});

describe("the letter itself", () => {
  it("is one calm e-mail: our own links only, no pixel, the footer, the headers", async () => {
    const tender = await addTender({ title: "Parks grounds maintenance", firstSeen: daysBefore(MONDAY, 2) });
    const rival = await addRivalContract({ rival: "Greaves Hollin Contractors Ltd", firstSeen: daysBefore(MONDAY, 2) });
    expect(await send("digest", WEEK, who(), MONDAY)).toBe("sent");
    const [row] = await logRows({ kind: "digest" });
    const [email] = await scheduledEmails(workspace.owner.email);
    expect(email).toMatchObject({ to: workspace.owner.email.toLowerCase(), template: "radar-digest", status: "outbox", subject: "1 new tender for Acme Grounds · 1 contract ending soon" });
    expect(row!.outboxId).toBe(email!.id);

    // Links: the tender pages (marked with the log id), the radar, settings, the unsubscribe page. Nothing else.
    const links = [...email!.html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1]!.replace(/&amp;/g, "&"));
    const unsubscribe = links.find((url) => url.startsWith("http://localhost:3000/unsubscribe?t="))!;
    expect(new Set(links)).toEqual(
      new Set([`http://localhost:3000/tenders/${tender}?d=${row!.id}`, `http://localhost:3000/tenders/${rival.ocid}?d=${row!.id}`, "http://localhost:3000/app", "http://localhost:3000/app/settings/notifications", unsubscribe]),
    );
    // No redirect service, no tracking parameters, no open pixel: the only images are the two marks.
    expect(links.every((url) => url.startsWith("http://localhost:3000/"))).toBe(true);
    expect(links.join(" ")).not.toMatch(/utm_|click\.|track|redirect/i);
    const images = [...email!.html.matchAll(/<img [^>]*src="([^"]+)"/g)].map((match) => match[1]);
    expect(images).toEqual(["http://localhost:3000/email/mark.png", "http://localhost:3000/email/mark-dark.png"]);
    expect(email!.html).not.toMatch(/width="1"|height="1"|\.gif/);

    // Footer: why, how to stop, who we are (placeholders exactly as the site config has them), the data licence.
    for (const body of [plainText(email!.html), email!.text.replace(/\s+/g, " ")]) {
      expect(body.includes("You get this once a week because you have a Bidfolio radar for Acme Grounds Ltd."), "You get this once a week because you have a Bidfolio radar for Acme Grounds Ltd.").toBe(true);
      expect(body.includes("Reply to this email if anything looks wrong."), "Reply to this email if anything looks wrong.").toBe(true);
      expect(body.includes("Unsubscribe"), "Unsubscribe").toBe(true);
      expect(body.includes("Change what you get"), "Change what you get").toBe(true);
      expect(body.includes("Bidfolio is operated by [[COMPANY_LEGAL_NAME]], an independent sole trader based in Ukraine."), "Bidfolio is operated by [[COMPANY_LEGAL_NAME]], an independent sole trader based in Ukraine.").toBe(true);
      expect(body.includes("UK representative: [[UK REPRESENTATIVE NAME AND ADDRESS]]"), "UK representative: [[UK REPRESENTATIVE NAME AND ADDRESS]]").toBe(true);
      expect(body.includes("Contains public sector information licensed under the Open Government Licence v3.0."), "Contains public sector information licensed under the Open Government Licence v3.0.").toBe(true);
      expect(body.includes("Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government."), "Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government.").toBe(true);
    }
    expect(email!.text.includes(unsubscribe), unsubscribe).toBe(true);
    expect(email!.text).not.toMatch(/<[a-z]/i);

    // RFC 8058 headers, stored with the message for the provider.
    const token = new URL(unsubscribe).searchParams.get("t")!;
    expect(email!.headers).toEqual({
      "List-Unsubscribe": `<http://localhost:3000/api/notifications/unsubscribe?t=${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });

    // The event says how much, never what or to whom.
    const [event] = await eventsNamed("digest_sent");
    expect(event).toMatchObject({ organizationId: workspace.organizationId, userId: workspace.owner.id, properties: { matches: 1, ending: 1, saved: 0, plan: "free" } });
    expect(JSON.stringify(event!.properties)).not.toMatch(/@|grounds|Acme/i);
  });

  it("is HTML built for mail clients: tables, inline styles, 640 px, a dark scheme", async () => {
    await addTender({ firstSeen: daysBefore(MONDAY, 2) });
    await send("digest", WEEK, who(), MONDAY);
    const [email] = await scheduledEmails(workspace.owner.email);
    const html = email!.html;
    // (Booleans, so that a failure does not print the whole message.)
    const has = (pattern: RegExp) => pattern.test(html);
    expect(has(/^<!DOCTYPE html/i)).toBe(true);
    expect(has(/<table role="presentation"/)).toBe(true);
    // A 600 px card inside 20 px gutters: 640 px at most, as on the Digest-640 artboard.
    expect(has(/<td align="center" class="bf-gutter" style="padding:28px 20px 48px">\s*<table [^>]*width="600"[^>]*style="width:100%;max-width:600px/)).toBe(true);
    expect(has(/@media \(prefers-color-scheme: dark\)/)).toBe(true);
    expect(has(/<meta name="color-scheme" content="light dark"/)).toBe(true);
    expect(has(/@media only screen and \(max-width: 480px\)/)).toBe(true);
    expect(has(/<script|<link [^>]*stylesheet|@import|<form|position:\s*(absolute|fixed)|display:\s*(flex|grid)/i)).toBe(false);
    // Headings in a serif, text in a system sans stack: no web font is loaded.
    expect(has(/<h2 [^>]*font-family:[^"]*Georgia[^"]*serif/)).toBe(true);
    expect(has(/<p [^>]*font-family:[^"]*-apple-system[^"]*Arial, sans-serif/)).toBe(true);
    expect(has(/fonts\.googleapis|@font-face/)).toBe(false);
    // Every element is styled inline (mail clients drop style sheets); classes only add the phone and dark overrides.
    expect(has(/<(p|h2|h3|a) (?![^>]*style=)[^>]*>/)).toBe(false);
    expect(Buffer.byteLength(html)).toBeLessThan(102_000); // Gmail clips larger messages
  });
});
