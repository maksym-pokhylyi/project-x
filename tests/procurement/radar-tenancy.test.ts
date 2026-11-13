import { and, eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  unstable_rethrow: () => undefined,
}));

import { db } from "@/db";
import { dataRequests, events, libraryDocs, orgSupplierLinks, radarItems, radarProfiles, sessions, subscriptions } from "@/db/schema";
import { GET as cpvRoute } from "@/app/api/procurement/cpv/route";
import { GET as searchRoute } from "@/app/api/procurement/search/route";
import { GET as cronIngest } from "@/app/api/cron/ingest/route";
import {
  claimSupplierAction,
  countRadarMatchesAction,
  dismissFirstRunAction,
  removeRadarSourceAction,
  saveRadarChoicesAction,
  saveRadarProfileAction,
  setTenderStateAction,
  setUpRadarAction,
  submitDataRequestAction,
} from "@/features/procurement/actions";
import {
  createRadarProfile,
  deleteRadarProfile,
  getRadarItemStates,
  getRadarProfile,
  getSavedTenders,
  hasSupplierLink,
  linkSupplier,
  listRadarSources,
  pickSource,
  setRadarItemState,
  updateRadarProfile,
} from "@/features/procurement/radar/data";
import { parseReasons } from "@/features/procurement/radar/reasons-ai";
import { loadRadar } from "@/features/procurement/radar/view";
import { ForbiddenError, NotFoundError, QuotaExceededError, ValidationError } from "@/lib/errors";
import { requireOrg } from "@/server/session";
import { actAs, addMember, createTestUser, headersFor, type TestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { contractRelease, ingest, NOW, tenderRelease } from "./helpers/factory";
import { resetProcurement } from "./helpers/schema";

/**
 * Two workspaces, A and B. Everything the Radar stores per workspace — the claimed
 * company, manual profiles, saved and dismissed tenders — must be invisible and
 * untouchable from the other workspace, through data access, Server Actions and routes.
 */
const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA" };
const GROUNDS = ["77314000"];
const profileInput = { name: "Acme radar", cpvCodes: GROUNDS, keywords: ["grass cutting"], regions: ["UKE"], valueMin: null, valueMax: null };

let ownerA: TestUser;
let ownerB: TestUser;
let memberA: TestUser;
let acmeId: string;
let rivalId: string;
let tenderOcids: string[];

const form = (values: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  return data;
};
const ctxFor = async (user: TestUser) => {
  actAs(user);
  return requireOrg();
};

beforeAll(async () => {
  await resetProcurement();
});

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
  tenderOcids = Array.from({ length: 14 }, (_, index) => `ocds-h6vhtk-x${String(index).padStart(5, "0")}`);
  await ingest([
    contractRelease({ title: "Grounds Maintenance Services", buyer: LEEDS, suppliers: [{ name: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.co.uk" }], cpv: GROUNDS, value: 120_000 }),
    contractRelease({ title: "Cemetery Grounds Maintenance", buyer: LEEDS, suppliers: [{ name: "Rival Landscapes Ltd", coh: "02222222" }], cpv: GROUNDS, value: 90_000, endsInDays: 100 }),
    ...tenderOcids.map((ocid, index) => tenderRelease({ ocid, title: `Grounds Maintenance Contract ${index + 1}`, buyer: LEEDS, cpv: GROUNDS, value: 100_000 + index * 1000, deadlineInDays: 5 + index })),
  ]);
  const rows = await db.execute<{ id: string; coh: string }>(sql`select id, coh from suppliers`);
  acmeId = rows.find((row) => row.coh === "01111111")!.id;
  rivalId = rows.find((row) => row.coh === "02222222")!.id;
  ownerA = await createTestUser({ name: "Alice A", email: `alice-${Date.now()}@acmegrounds.co.uk` });
  ownerB = await createTestUser({ name: "Bob B" });
  memberA = await createTestUser({ name: "Mia Member" });
  actAs(null);
});

/**
 * Mia joins workspace A. A Free workspace has one seat and is read-only while it holds more
 * members than that, so A moves to a plan with a second seat first.
 */
async function miaJoinsA(): Promise<void> {
  const day = 86_400_000;
  await db.insert(subscriptions).values({
    organizationId: ownerA.organizationId,
    status: "active",
    planKey: "starter",
    paddleSubscriptionId: `sub_${ownerA.organizationId}`,
    billingInterval: "month",
    currentPeriodStart: new Date(Date.now() - 5 * day),
    currentPeriodEnd: new Date(Date.now() + 25 * day),
  });
  await addMember(ownerA.organizationId, memberA, "member");
  await db.update(sessions).set({ activeOrganizationId: ownerA.organizationId }).where(eq(sessions.userId, memberA.id));
}

describe("claiming a company", () => {
  it("links the signed-in workspace, once, and records how", async () => {
    const ctxA = await ctxFor(ownerA);
    // The claimant's e-mail domain matches the domain the supplier published.
    expect(await linkSupplier(ctxA, acmeId)).toEqual({ created: true, method: "email_domain" });
    expect(await linkSupplier(ctxA, acmeId)).toEqual({ created: false, method: "existing" });
    expect(await hasSupplierLink(ctxA, acmeId)).toBe(true);
    const sources = await listRadarSources(ctxA);
    expect(sources).toEqual([expect.objectContaining({ kind: "supplier", key: `s:${acmeId}`, name: "Acme Grounds Ltd", awardsCount: 1 })]);

    const ctxB = await ctxFor(ownerB);
    expect(await hasSupplierLink(ctxB, acmeId)).toBe(false);
    expect(await listRadarSources(ctxB)).toEqual([]);
    // Another workspace may follow the same company; the links stay separate.
    expect(await linkSupplier(ctxB, acmeId)).toEqual({ created: true, method: "self_declared" });
    expect(await db.select().from(orgSupplierLinks)).toHaveLength(2);
  });

  it("enforces the plan's profile limit (Free: one radar source)", async () => {
    const ctxA = await ctxFor(ownerA);
    await linkSupplier(ctxA, acmeId);
    await expect(linkSupplier(ctxA, rivalId)).rejects.toBeInstanceOf(QuotaExceededError);
    await expect(createRadarProfile(ctxA, profileInput)).rejects.toBeInstanceOf(QuotaExceededError);
    await expect(linkSupplier(ctxA, "sup_missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("claims through the Server Action from the session only, with the tick, and tracks it", async () => {
    actAs(ownerA);
    // Without "I am authorised to act for this company" nothing is linked.
    await expect(claimSupplierAction(form({ supplierId: acmeId }))).rejects.toThrow("REDIRECT:/claim/acme-grounds-ltd-01111111?confirm=missing");
    expect(await db.select().from(orgSupplierLinks)).toHaveLength(0);

    await expect(claimSupplierAction(form({ supplierId: acmeId, authorised: "on" }))).rejects.toThrow(`REDIRECT:/app?claimed=1&profile=${encodeURIComponent(`s:${acmeId}`)}`);
    const links = await db.select().from(orgSupplierLinks);
    // A new claim opens on the first-run guide.
    expect(links).toEqual([expect.objectContaining({ organizationId: ownerA.organizationId, supplierId: acmeId, createdBy: ownerA.id, firstRunPending: true })]);
    const tracked = await db.select().from(events).where(eq(events.name, "supplier_claimed"));
    expect(tracked).toEqual([expect.objectContaining({ organizationId: ownerA.organizationId, userId: ownerA.id, properties: { supplier: acmeId, method: "email_domain" } })]);
    // A second claim over the limit sends the user back to the claim page with the notice.
    await expect(claimSupplierAction(form({ supplierId: rivalId, authorised: "on" }))).rejects.toThrow("REDIRECT:/claim/rival-landscapes-ltd-02222222?limit=1");
    // Signed out: to sign-in and back to the claim page; an unknown company: to the search.
    actAs(null);
    await expect(claimSupplierAction(form({ supplierId: acmeId, authorised: "on" }))).rejects.toThrow(`REDIRECT:/sign-in?redirect=${encodeURIComponent("/claim/acme-grounds-ltd-01111111")}`);
    await expect(claimSupplierAction(form({ supplierId: "sup_missing", authorised: "on" }))).rejects.toThrow("REDIRECT:/app/radar/find");
    expect(await db.select().from(orgSupplierLinks)).toHaveLength(1);
  });
});

describe("saved and dismissed tenders", () => {
  it("are stored per workspace and survive a notice update", async () => {
    const [first, second] = tenderOcids as [string, string];
    const ctxA = await ctxFor(ownerA);
    await setRadarItemState(ctxA, first, "saved");
    await setRadarItemState(ctxA, second, "dismissed");
    const ctxB = await ctxFor(ownerB);
    await setRadarItemState(ctxB, first, "dismissed");

    expect(Object.fromEntries(await getRadarItemStates(await ctxFor(ownerA)))).toEqual({ [first]: "saved", [second]: "dismissed" });
    expect(Object.fromEntries(await getRadarItemStates(await ctxFor(ownerB)))).toEqual({ [first]: "dismissed" });
    expect((await getSavedTenders(await ctxFor(ownerA))).map((card) => card.ocid)).toEqual([first]);
    expect(await getSavedTenders(await ctxFor(ownerB))).toEqual([]);

    // The buyer updates the notice: the saved state follows the procurement, not the notice version.
    await ingest([tenderRelease({ ocid: first, title: "Grounds Maintenance Contract 1 (updated)", buyer: LEEDS, cpv: GROUNDS, deadlineInDays: 30, publishedDaysAgo: 0, tag: ["tenderUpdate"] })]);
    expect((await getSavedTenders(await ctxFor(ownerA))).map((card) => card.title)).toEqual(["Grounds Maintenance Contract 1 (updated)"]);

    // Clearing in B does not touch A.
    await setRadarItemState(await ctxFor(ownerB), first, null);
    expect((await getRadarItemStates(await ctxFor(ownerA))).get(first)).toBe("saved");
    await expect(setRadarItemState(await ctxFor(ownerA), "ocds-h6vhtk-nothere", "saved")).rejects.toBeInstanceOf(NotFoundError);
    await expect(setRadarItemState(await ctxFor(ownerA), "'; drop table radar_items; --", "saved")).rejects.toBeInstanceOf(ValidationError);
  });

  it("are written by the Server Action for the caller's workspace only", async () => {
    const [first, second] = tenderOcids as [string, string];
    await miaJoinsA();
    actAs(memberA);
    // The action answers with what it stored, so the screen can settle its optimistic state.
    expect(await setTenderStateAction({ ocid: first, state: "saved" })).toEqual({ ok: true, data: { ocid: first, state: "saved" } });
    actAs(ownerB);
    expect(await setTenderStateAction({ ocid: second, state: "dismissed" })).toMatchObject({ ok: true });
    const rows = await db.select().from(radarItems);
    expect(rows.map((row) => [row.organizationId, row.ocid, row.state, row.createdBy]).sort()).toEqual(
      [
        [ownerA.organizationId, first, "saved", memberA.id],
        [ownerB.organizationId, second, "dismissed", ownerB.id],
      ].sort(),
    );
    const names = (await db.select().from(events)).map((event) => event.name);
    expect(names).toEqual(expect.arrayContaining(["tender_saved", "tender_dismissed"]));

    // Undo: `null` clears the caller's own state and nobody else's.
    expect(await setTenderStateAction({ ocid: second, state: null })).toEqual({ ok: true, data: { ocid: second, state: null } });
    expect(await setTenderStateAction({ ocid: first, state: null })).toMatchObject({ ok: true });
    expect((await db.select().from(radarItems)).map((row) => [row.organizationId, row.ocid, row.state])).toEqual([[ownerA.organizationId, first, "saved"]]);

    // A failure comes back as a message for the row to roll back on, never as an error page.
    expect(await setTenderStateAction({ ocid: "not-an-ocid", state: "saved" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await setTenderStateAction({ ocid: "ocds-h6vhtk-nothere", state: "saved" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await setTenderStateAction({ ocid: first, state: "archived" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    actAs(null);
    expect(await setTenderStateAction({ ocid: first, state: "saved" })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });
});

describe("manual radar profiles", () => {
  it("cannot be read, changed or deleted from another workspace", async () => {
    const ctxA = await ctxFor(ownerA);
    const profileId = await createRadarProfile(ctxA, profileInput);
    expect(await getRadarProfile(ctxA, profileId)).toMatchObject({ name: "Acme radar", cpvCodes: GROUNDS, keywords: ["grass cutting"], regions: ["UKE"] });

    const ctxB = await ctxFor(ownerB);
    expect(await getRadarProfile(ctxB, profileId)).toBeNull();
    await expect(updateRadarProfile(ctxB, profileId, { ...profileInput, name: "Hijacked" })).rejects.toBeInstanceOf(NotFoundError);
    await deleteRadarProfile(ctxB, profileId);
    expect(await listRadarSources(ctxB)).toEqual([]);
    // A profile key from another workspace in the URL is ignored.
    expect(pickSource(await listRadarSources(ctxB), `r:${profileId}`)).toBeNull();

    const stillThere = await getRadarProfile(await ctxFor(ownerA), profileId);
    expect(stillThere?.name).toBe("Acme radar");
    await updateRadarProfile(await ctxFor(ownerA), profileId, { ...profileInput, name: "Acme radar v2", regions: ["UKE", "XX"] });
    expect(await getRadarProfile(await ctxFor(ownerA), profileId)).toMatchObject({ name: "Acme radar v2", regions: ["UKE"] });
  });

  it("validates input and saves through the form action", async () => {
    const ctxA = await ctxFor(ownerA);
    await expect(createRadarProfile(ctxA, { ...profileInput, name: " ", cpvCodes: ["not-a-code"], keywords: [] })).rejects.toBeInstanceOf(ValidationError);
    actAs(ownerA);
    const invalid = await saveRadarProfileAction({ error: null }, form({ name: "", keywords: "" }));
    expect(invalid.error).toMatchObject({ code: "VALIDATION", details: { fieldErrors: { name: expect.any(Array), cpvCodes: expect.any(Array) } } });
    await expect(saveRadarProfileAction({ error: null }, form({ name: "New Start Gardens", cpv: GROUNDS, region: ["UKE"], keywords: "grass cutting, hedges", valueMax: "250000" }))).rejects.toThrow(/^REDIRECT:\/app\?profile=r%3A/);
    const [saved] = await db.select().from(radarProfiles);
    expect(saved).toMatchObject({ organizationId: ownerA.organizationId, name: "New Start Gardens", cpvCodes: GROUNDS, keywords: ["grass cutting", "hedges"], valueMax: 250_000, createdBy: ownerA.id });
  });

  it("lets only admins remove a radar source, and only their own", async () => {
    const profileId = await createRadarProfile(await ctxFor(ownerA), profileInput);
    await miaJoinsA();
    actAs(memberA);
    await expect(removeRadarSourceAction(form({ key: `r:${profileId}` }))).rejects.toBeInstanceOf(ForbiddenError);
    actAs(ownerB);
    await expect(removeRadarSourceAction(form({ key: `r:${profileId}` }))).rejects.toThrow("REDIRECT:/app");
    expect(await db.select().from(radarProfiles).where(eq(radarProfiles.id, profileId))).toHaveLength(1);
    actAs(ownerA);
    await expect(removeRadarSourceAction(form({ key: `r:${profileId}` }))).rejects.toThrow("REDIRECT:/app");
    expect(await db.select().from(radarProfiles)).toHaveLength(0);
  });
});

describe("the Radar view", () => {
  it("shows a pre-populated radar after a claim, capped at ten matches on the Free plan", async () => {
    const ctxA = await ctxFor(ownerA);
    await linkSupplier(ctxA, acmeId);
    const view = await loadRadar(ctxA, { tab: "matches" }, NOW);
    expect(view.active).toMatchObject({ kind: "supplier", name: "Acme Grounds Ltd" });
    expect(view.access).toMatchObject({ full: false, matchLimit: 10, maxProfiles: 1 });
    expect(view.counts).toMatchObject({ matches: 14, ending: 1, buyers: 1 });
    expect(view.list).toMatchObject({ tab: "matches", total: 14, lockedTotal: 4, wider: 0, showingWider: false, page: 1, pages: 1 });
    if (view.list?.tab !== "matches") throw new Error("unexpected tab");
    // The ten best, all strong, soonest deadline first, each with its way to the notice.
    expect(view.list.items).toHaveLength(10);
    expect(view.list.items.every((item) => item.tier === "strong")).toBe(true);
    expect(view.list.items.map((item) => item.deadlineAt)).toEqual(view.list.items.map((item) => item.deadlineAt).sort());
    for (const item of view.list.items) expect(item.noticeUrl).toMatch(/^https:\/\/www\.find-tender\.service\.gov\.uk\/Notice\//);
    // Beyond the cap two rows are previewed, reduced to a place and a closing date: no title, buyer, link or id.
    expect(view.list.locked.map((row) => row.rank)).toEqual([11, 12]);
    for (const row of view.list.locked) expect(Object.keys(row).sort()).toEqual(["deadlineAt", "futureNoticeAt", "place", "rank"]);
    // What the radar matches on, and what its edit form starts from.
    expect(view.matching?.trades).toEqual([expect.objectContaining({ code: "77310000", source: "wins" })]);
    expect(view.edit).toMatchObject({ source: `s:${acmeId}`, kind: "supplier", count: 14, own: [{ code: "77310000", checked: true }] });

    // Filters are applied to the data, after the cap: they can only narrow what the plan shows.
    const closing = await loadRadar(ctxA, { tab: "matches", closing: "7" }, NOW);
    if (closing.list?.tab !== "matches") throw new Error("unexpected tab");
    expect(closing).toMatchObject({ hasFilters: true, filters: { closing: 7 } });
    expect(closing.list.total).toBe(3);
    expect(closing.list.items.length + closing.list.lockedTotal).toBe(3);
    expect(closing.list.items.every((item) => view.list?.tab === "matches" && view.list.items.some((shown) => shown.ocid === item.ocid))).toBe(true);
    // Filters that match nothing give an empty list, not an error.
    const filtered = await loadRadar(ctxA, { region: "UKN", value: "large" }, NOW);
    expect(filtered).toMatchObject({ hasFilters: true, list: { tab: "matches", total: 0, items: [], lockedTotal: 0 } });
    // A filter another tab owns is ignored on this one.
    expect((await loadRadar(ctxA, { tab: "buyers", closing: "7", value: "small", region: "UKE", sort: "median" }, NOW)).filters).toEqual({ category: null, region: "UKE", value: null, closing: null, ending: null, sort: "median" });
    // Garbage in the query string is ignored.
    const garbage = await loadRadar(ctxA, { tab: "nonsense", category: "'; --", region: "ZZZ", value: "huge", closing: "5", ending: "99", sort: "evil", profile: "s:someone-else", page: "-3", wider: "1" }, NOW);
    expect(garbage).toMatchObject({ tab: "matches", hasFilters: false, filters: { category: null, region: null, value: null, closing: null, ending: null, sort: "awards" }, list: { showingWider: false, page: 1 } });

    // Dismissed tenders leave the list; saved ones feed the deadline strip.
    await setRadarItemState(ctxA, tenderOcids[0]!, "dismissed");
    await setRadarItemState(ctxA, tenderOcids[1]!, "saved");
    const after = await loadRadar(ctxA, { tab: "matches" }, NOW);
    expect(after.list).toMatchObject({ total: 13 });
    expect(after.counts).toMatchObject({ matches: 13 });
    expect(after.deadlines.map((card) => card.ocid)).toEqual([tenderOcids[1]]);
    expect((await loadRadar(ctxA, { tab: "saved" }, NOW)).list).toMatchObject({ tab: "saved", total: 1 });

    const ending = await loadRadar(ctxA, { tab: "ending" }, NOW);
    expect(ending.list).toMatchObject({ tab: "ending", total: 1, hidden: 0 });
    const buyers = await loadRadar(ctxA, { tab: "buyers" }, NOW);
    expect(buyers.list).toMatchObject({ tab: "buyers", total: 1, hidden: 0 });
  });

  it("lists every strong match on a paid plan, and the wider ones only on request", async () => {
    // The same work in a region the company has never worked in: a wider match.
    const BRISTOL = { name: "Bristol City Council", ppon: "PBRS-3333-CCCC", region: "UKK11" };
    await ingest([
      tenderRelease({ ocid: "ocds-h6vhtk-w00001", title: "Grounds Maintenance in Bristol", buyer: BRISTOL, cpv: GROUNDS, regions: ["UKK"], deadlineInDays: 9 }),
      tenderRelease({ ocid: "ocds-h6vhtk-w00002", title: "Grounds Maintenance in Bath", buyer: BRISTOL, cpv: GROUNDS, regions: ["UKK"], deadlineInDays: 12 }),
    ]);
    const ctxA = await ctxFor(ownerA);
    await linkSupplier(ctxA, acmeId);

    // Free: the wider matches are counted and never listed, whatever the address asks for.
    const free = await loadRadar(ctxA, { tab: "matches", wider: "1", page: "2" }, NOW);
    expect(free.list).toMatchObject({ total: 14, wider: 2, showingWider: false, page: 1, pages: 1 });
    expect(free.counts).toMatchObject({ matches: 14 });
    if (free.list?.tab !== "matches") throw new Error("unexpected tab");
    expect(free.list.items.map((item) => item.ocid)).not.toContain("ocds-h6vhtk-w00001");

    const paidCtx = { ...ctxA, entitlements: { ...ctxA.entitlements, features: { ...ctxA.entitlements.features, "radar.full": true } } } as typeof ctxA;
    const paid = await loadRadar(paidCtx, { tab: "matches" }, NOW);
    expect(paid.access).toMatchObject({ full: true, matchLimit: null });
    expect(paid.list).toMatchObject({ total: 14, locked: [], lockedTotal: 0, wider: 2, showingWider: false });
    if (paid.list?.tab !== "matches") throw new Error("unexpected tab");
    expect(paid.list.items).toHaveLength(14);

    // "Show wider matches": the strong ones first, then the wider ones, each marked by its tier.
    const all = await loadRadar(paidCtx, { tab: "matches", wider: "1" }, NOW);
    expect(all.list).toMatchObject({ total: 14, wider: 2, showingWider: true });
    if (all.list?.tab !== "matches") throw new Error("unexpected tab");
    expect(all.list.items.map((item) => item.tier)).toEqual([...Array.from({ length: 14 }, () => "strong"), "wider", "wider"]);
    expect(all.list.items.slice(14).map((item) => item.ocid)).toEqual(["ocds-h6vhtk-w00001", "ocds-h6vhtk-w00002"]);
    // The tab still counts the strong ones only.
    expect(all.counts).toMatchObject({ matches: 14 });
  });

  it("opens on the first-run guide until it is hidden or done, per workspace", async () => {
    actAs(ownerA);
    await expect(claimSupplierAction(form({ supplierId: acmeId, authorised: "on" }))).rejects.toThrow(/^REDIRECT:\/app\?claimed=1/);
    const ctxA = await ctxFor(ownerA);
    const guide = await loadRadar(ctxA, {}, NOW);
    expect(guide.list).toBeNull();
    expect(guide.firstRun).toMatchObject({ total: 14, steps: { profile: false, documents: false, check: false } });
    // The three best matches, soonest deadline first.
    expect(guide.firstRun?.matches).toHaveLength(3);
    expect(guide.firstRun?.matches.map((item) => item.deadlineAt)).toEqual(guide.firstRun?.matches.map((item) => item.deadlineAt).sort());
    // "See all matches", a tab or a filter asks for the lists without ending the guide.
    expect((await loadRadar(ctxA, { tab: "matches" }, NOW)).firstRun).toBeNull();
    expect((await loadRadar(ctxA, { closing: "30" }, NOW)).firstRun).toBeNull();
    expect((await loadRadar(ctxA, {}, NOW)).firstRun).not.toBeNull();

    // Another workspace cannot hide it.
    actAs(ownerB);
    await expect(dismissFirstRunAction(form({ key: `s:${acmeId}` }))).rejects.toThrow(/^REDIRECT:\/app\?tab=matches/);
    expect((await loadRadar(await ctxFor(ownerA), {}, NOW)).firstRun).not.toBeNull();

    // A document in the library ticks step 2 (the workspace's own rows only).
    await db.insert(libraryDocs).values({ organizationId: ownerA.organizationId, title: "Insurance schedule", storageKey: `test/${ownerA.organizationId}/insurance.pdf`, fileName: "insurance.pdf", mime: "application/pdf", size: 1024 });
    expect((await loadRadar(await ctxFor(ownerA), {}, NOW)).firstRun?.steps).toEqual({ profile: false, documents: true, check: false });

    // "Hide this guide" is remembered for the workspace, whoever asks next.
    await miaJoinsA();
    actAs(memberA);
    await expect(dismissFirstRunAction(form({ key: `s:${acmeId}` }))).rejects.toThrow(`REDIRECT:/app?tab=matches&profile=${encodeURIComponent(`s:${acmeId}`)}`);
    const hidden = await loadRadar(await ctxFor(ownerA), {}, NOW);
    expect(hidden.firstRun).toBeNull();
    expect(hidden.list).toMatchObject({ tab: "matches", total: 14 });
    expect(await db.select({ pending: orgSupplierLinks.firstRunPending }).from(orgSupplierLinks)).toEqual([{ pending: false }]);
    expect((await db.select().from(events).where(eq(events.name, "radar_first_run_dismissed"))).map((event) => event.organizationId).sort()).toEqual([ownerA.organizationId, ownerB.organizationId].sort());
  });

  it("stores a workspace's own trades and regions for a claimed company, for that workspace only", async () => {
    const BRISTOL = { name: "Bristol City Council", ppon: "PBRS-3333-CCCC", region: "UKK11" };
    await ingest([tenderRelease({ ocid: "ocds-h6vhtk-w00001", title: "Grounds Maintenance in Bristol", buyer: BRISTOL, cpv: GROUNDS, regions: ["UKK"], deadlineInDays: 9 })]);
    const source = `s:${acmeId}`;
    const asIs = { source, ownAll: "77310000", own: "77310000", region: ["UKE"] };
    await linkSupplier(await ctxFor(ownerA), acmeId);

    // A workspace that has not claimed the company can neither save nor learn anything about its radar.
    actAs(ownerB);
    expect(await saveRadarChoicesAction(form(asIs))).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await countRadarMatchesAction(form(asIs))).toEqual({ ok: true, data: { count: 0 } });
    await linkSupplier(await ctxFor(ownerB), acmeId);

    actAs(ownerA);
    // The count answers "what would these ticks match?" without saving anything.
    expect(await countRadarMatchesAction(form(asIs))).toEqual({ ok: true, data: { count: 14 } });
    expect(await countRadarMatchesAction(form({ ...asIs, region: ["UKE", "UKK"] }))).toEqual({ ok: true, data: { count: 15 } });
    expect(await countRadarMatchesAction(form({ source, ownAll: "77310000", region: ["UKE"] }))).toEqual({ ok: true, data: { count: 0 } });
    expect(await db.select({ regions: orgSupplierLinks.regions, extra: orgSupplierLinks.extraCpvCodes, excluded: orgSupplierLinks.excludedCpvCodes }).from(orgSupplierLinks).where(eq(orgSupplierLinks.organizationId, ownerA.organizationId))).toEqual([
      { regions: null, extra: [], excluded: [] },
    ]);

    // Saved as they are, the regions keep following the company's awards (null), and step 1 of the guide is done.
    expect(await saveRadarChoicesAction(form(asIs))).toEqual({ ok: true, data: { source } });
    expect((await db.select({ regions: orgSupplierLinks.regions }).from(orgSupplierLinks).where(eq(orgSupplierLinks.organizationId, ownerA.organizationId)))[0]).toEqual({ regions: null });
    expect((await loadRadar(await ctxFor(ownerA), {}, NOW)).firstRun?.steps).toMatchObject({ profile: true });

    // A region and a trade added, for this workspace only.
    expect(await saveRadarChoicesAction(form({ ...asIs, region: ["UKE", "UKK", "XX"], trade: ["roofing", "not-a-trade"] }))).toEqual({ ok: true, data: { source } });
    expect(await db.select({ organizationId: orgSupplierLinks.organizationId, regions: orgSupplierLinks.regions, extra: orgSupplierLinks.extraCpvCodes }).from(orgSupplierLinks).orderBy(orgSupplierLinks.createdAt)).toEqual([
      { organizationId: ownerA.organizationId, regions: ["UKE", "UKK"], extra: ["45261000"] },
      { organizationId: ownerB.organizationId, regions: null, extra: [] },
    ]);
    const mine = await loadRadar(await ctxFor(ownerA), { tab: "matches" }, NOW);
    expect(mine.list).toMatchObject({ total: 15 });
    expect(mine.matching?.trades.map((trade) => [trade.label, trade.source])).toEqual([[expect.any(String), "wins"], ["Roofing", "chosen"]]);
    expect(mine.edit?.regions.filter((region) => region.checked).map((region) => region.code)).toEqual(["UKE", "UKK"]);
    expect((await loadRadar(await ctxFor(ownerB), { tab: "matches" }, NOW)).list).toMatchObject({ total: 14 });

    // Its own trade switched off: nothing in that trade matches any more — here, and only here.
    actAs(ownerA);
    expect(await saveRadarChoicesAction(form({ source, ownAll: "77310000", region: ["UKE", "UKK"] }))).toMatchObject({ ok: true });
    const muted = await loadRadar(await ctxFor(ownerA), { tab: "matches" }, NOW);
    expect(muted.list).toMatchObject({ total: 0 });
    expect(muted.edit?.own).toEqual([expect.objectContaining({ code: "77310000", checked: false })]);
    expect(muted.matching?.trades).toEqual([]);
    expect((await loadRadar(await ctxFor(ownerB), { tab: "matches" }, NOW)).list).toMatchObject({ total: 14 });
    actAs(null);
    expect(await saveRadarChoicesAction(form(asIs))).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(await countRadarMatchesAction(form(asIs))).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });

  it("carries a manual set-up through sign-up without storing anything", async () => {
    actAs(null);
    const empty = await setUpRadarAction({ error: null }, form({ name: "T", email: "nobody" }));
    expect(empty).toMatchObject({ attempt: 1, selection: { name: "T", trades: [], cpv: [], regions: [] }, error: { code: "VALIDATION", details: { fieldErrors: { name: expect.any(Array), cpvCodes: expect.any(Array) } } } });
    // The selection travels in the address of the set-up page, by way of sign-up; anything the form could not have produced is dropped.
    const target = new URLSearchParams({ redirect: "/app/radar/setup?name=Tidewell+Roofing+Ltd&trade=roofing&region=UKE", email: "jo@tidewell.example" });
    await expect(setUpRadarAction(empty, form({ name: "Tidewell Roofing Ltd", trade: ["roofing", "not-a-trade"], region: ["UKE", "XX"], email: "Jo@Tidewell.example" }))).rejects.toThrow(`REDIRECT:/sign-up?${target.toString()}`);
    expect(await db.select().from(radarProfiles)).toHaveLength(0);

    // Signed in, the same form creates the radar, which opens on its first-run guide.
    actAs(ownerA);
    await expect(setUpRadarAction({ error: null }, form({ name: "Tidewell Roofing Ltd", trade: ["roofing"], region: ["UKE"] }))).rejects.toThrow(/^REDIRECT:\/app\?profile=r%3A/);
    expect(await db.select().from(radarProfiles)).toEqual([expect.objectContaining({ organizationId: ownerA.organizationId, name: "Tidewell Roofing Ltd", cpvCodes: ["45261000"], regions: ["UKE"], firstRunPending: true })]);
    const view = await loadRadar(await ctxFor(ownerA), {}, NOW);
    expect(view.active).toMatchObject({ kind: "manual", name: "Tidewell Roofing Ltd" });
    expect(view.firstRun).not.toBeNull();
    expect(view.matching).toMatchObject({ trades: [{ label: "Roofing", source: "chosen" }], regions: ["Yorkshire and the Humber"] });
  });

  it("shows onboarding to a workspace with no company, whatever another workspace has claimed", async () => {
    await linkSupplier(await ctxFor(ownerA), acmeId);
    const viewB = await loadRadar(await ctxFor(ownerB), { profile: `s:${acmeId}` }, NOW);
    expect(viewB).toMatchObject({ sources: [], active: null, spec: null, list: null });
    // Members see their workspace's radar.
    await miaJoinsA();
    const viewMember = await loadRadar(await ctxFor(memberA), {}, NOW);
    expect(viewMember.active).toMatchObject({ name: "Acme Grounds Ltd" });
  });

  it("deletes a workspace's radar data with the workspace", async () => {
    const ctxA = await ctxFor(ownerA);
    await linkSupplier(ctxA, acmeId);
    await setRadarItemState(ctxA, tenderOcids[0]!, "saved");
    await db.execute(sql`delete from organizations where id = ${ownerA.organizationId}`);
    expect(await db.select().from(orgSupplierLinks).where(eq(orgSupplierLinks.organizationId, ownerA.organizationId))).toEqual([]);
    expect(await db.select().from(radarItems).where(and(eq(radarItems.organizationId, ownerA.organizationId)))).toEqual([]);
    // Shared data is untouched.
    expect(Number((await db.execute<{ n: string }>(sql`select count(*) as n from suppliers`))[0]!.n)).toBe(2);
  });
});

describe("routes", () => {
  it("search returns company-level fields only and hides unpublished suppliers from anonymous callers", async () => {
    await ingest([contractRelease({ title: "Grass Cutting Rounds", buyer: LEEDS, suppliers: [{ name: "John Smith Gardening", email: "john.smith@gmail.com" }], cpv: GROUNDS })]);
    const call = async (path: string, user: TestUser | null) => {
      actAs(user);
      const response = await searchRoute(new Request(`http://localhost:3000${path}`, { headers: user ? headersFor(user) : {} }), {});
      return { status: response.status, body: (await response.json()) as { results: Array<Record<string, unknown>> } };
    };
    const anonymous = await call("/api/procurement/search?q=acme", null);
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.results).toEqual([{ slug: "acme-grounds-ltd-01111111", name: "Acme Grounds Ltd", companyNumber: "01111111", locality: "Supplierville", awardsCount: 1, isPublic: true }]);
    expect(JSON.stringify(anonymous.body)).not.toContain("@");
    expect((await call("/api/procurement/search?q=john%20smith&scope=all", null)).body.results).toEqual([]);
    const signedIn = await call("/api/procurement/search?q=john%20smith&scope=all", ownerA);
    expect(signedIn.body.results).toEqual([expect.objectContaining({ name: "John Smith Gardening", isPublic: false })]);
    expect(JSON.stringify(signedIn.body)).not.toContain("gmail");
  });

  it("the trade picker needs a session", async () => {
    actAs(null);
    expect((await cpvRoute(new Request("http://localhost:3000/api/procurement/cpv?q=grounds"), {})).status).toBe(401);
    actAs(ownerA);
    const response = await cpvRoute(new Request("http://localhost:3000/api/procurement/cpv?q=grounds", { headers: headersFor(ownerA) }), {});
    expect(response.status).toBe(200);
    expect(((await response.json()) as { results: unknown[] }).results[0]).toEqual({ code: "77000000", label: "Grounds, forestry and horticultural services" });
  });

  it("the ingest cron is protected exactly like the jobs cron", async () => {
    expect((await cronIngest(new Request("http://localhost:3000/api/cron/ingest"), {})).status).toBe(401);
    expect((await cronIngest(new Request("http://localhost:3000/api/cron/ingest", { headers: { authorization: "Bearer wrong-secret-0123456789" } }), {})).status).toBe(401);
    // With the right secret it runs; here another run "holds the lease", so nothing is fetched.
    await db.execute(sql`insert into ingest_state (source, locked_until) values ('fts:incremental', now() + interval '5 minutes')`);
    const ok = await cronIngest(new Request("http://localhost:3000/api/cron/ingest", { headers: { authorization: "Bearer test-cron-secret-0123456789" } }), {});
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, status: "skipped" });
  });

  it("stores flagged mistakes, validated; five requests an hour from one address", async () => {
    actAs(null);
    // What came back with an error keeps every answer, and says which fields to look at.
    const invalid = await submitDataRequestAction({ status: "idle" }, form({ issue: "not_ours", detail: "", correction: "short", name: "", email: "not-an-email" }));
    expect(invalid).toMatchObject({
      status: "error",
      attempt: 1,
      values: { issue: "not_ours", correction: "short", email: "not-an-email" },
      error: { code: "VALIDATION", details: { fieldErrors: { name: expect.any(Array), email: expect.any(Array), authorised: expect.any(Array) } } },
    });
    // A correction must say which contract, and what is right.
    const vague = await submitDataRequestAction(invalid, form({ issue: "not_ours", detail: "", correction: "short", name: "Dana Director", email: "director@acmegrounds.co.uk", authorised: "on" }));
    expect(vague).toMatchObject({ status: "error", attempt: 2, error: { code: "VALIDATION", details: { fieldErrors: { detail: expect.any(Array), correction: expect.any(Array) } } } });
    expect(await db.select().from(dataRequests)).toHaveLength(0);

    const request = {
      page: "https://bidfolio.co.uk/suppliers/acme-grounds-ltd-01111111?r=abc",
      issue: "not_ours",
      detail: "Cemetery Grounds Maintenance",
      correction: "This contract was awarded to another company with a similar name, not to us.",
      evidence: "",
      name: "Dana Director",
      email: "Director@AcmeGrounds.co.uk",
      authorised: "on",
    };
    // The page is stored as a path of ours, whatever address was pasted.
    expect(await submitDataRequestAction(vague, form(request))).toEqual({ status: "sent", page: "/suppliers/acme-grounds-ltd-01111111" });
    const [stored] = await db.select().from(dataRequests);
    expect(stored).toMatchObject({ kind: "correction", requesterEmail: "director@acmegrounds.co.uk", status: "open", pageUrl: "/suppliers/acme-grounds-ltd-01111111" });
    expect(stored?.message).toContain("Cemetery Grounds Maintenance");
    expect(stored?.message).toContain("Dana Director");

    // "Hide the whole page" is a removal, and needs neither a detail nor a wording.
    expect(await submitDataRequestAction({ status: "idle" }, form({ ...request, issue: "hide_page", detail: "", correction: "" }))).toMatchObject({ status: "sent" });
    expect((await db.select().from(dataRequests)).map((row) => row.kind).sort()).toEqual(["correction", "removal"]);
    // A link, when given, must be a link.
    expect(await submitDataRequestAction({ status: "idle" }, form({ ...request, evidence: "see our website" }))).toMatchObject({ status: "error", error: { details: { fieldErrors: { evidence: expect.any(Array) } } } });

    // The honeypot swallows bots without storing anything.
    expect(await submitDataRequestAction({ status: "idle" }, form({ ...request, website: "http://spam" }))).toMatchObject({ status: "sent" });
    expect(await db.select().from(dataRequests)).toHaveLength(2);
    // Five requests an hour from one address. The three forms above that came back with errors were not counted…
    for (const detail of ["Parks Mowing 2025", "Verge Cutting 2026", "Sports Pitches 2026"]) {
      expect(await submitDataRequestAction({ status: "idle" }, form({ ...request, detail }))).toMatchObject({ status: "sent" });
    }
    expect(await db.select().from(dataRequests)).toHaveLength(5);
    // …the sixth request is turned away, with the answers kept for later; nothing is stored.
    expect(await submitDataRequestAction({ status: "idle" }, form(request))).toMatchObject({ status: "error", error: { code: "RATE_LIMITED" }, values: { detail: "Cemetery Grounds Maintenance" } });
    // A form with a mistake still gets its own message, not the limit's.
    expect(await submitDataRequestAction({ status: "idle" }, form({ ...request, name: "" }))).toMatchObject({ status: "error", error: { code: "VALIDATION" } });
    expect(await db.select().from(dataRequests)).toHaveLength(5);
  });
});

describe("model-written reasons", () => {
  it("accepts well-formed output and drops everything else", () => {
    const text = '```json\n[{"i": 1, "reason": "Same grounds maintenance work as your £120k contract with Leeds City Council."}, {"i": 2, "reason": "Perfect fit, you will win!"}, {"i": 9, "reason": "Out of range index should be ignored entirely."}, {"i": 3}]\n```';
    expect([...parseReasons(text, 3)]).toEqual([[0, "Same grounds maintenance work as your £120k contract with Leeds City Council."]]);
    expect(parseReasons("Sorry, I cannot help with that.", 3).size).toBe(0);
    expect(parseReasons("[not json", 3).size).toBe(0);
  });
});
