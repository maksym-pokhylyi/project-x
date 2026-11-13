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
import { dataRequests, events, orgSupplierLinks, radarItems, radarProfiles, sessions } from "@/db/schema";
import { GET as cpvRoute } from "@/app/api/procurement/cpv/route";
import { GET as searchRoute } from "@/app/api/procurement/search/route";
import { GET as cronIngest } from "@/app/api/cron/ingest/route";
import { claimSupplierAction, dismissTenderAction, removeRadarSourceAction, saveRadarProfileAction, saveTenderAction, submitDataRequestAction } from "@/features/procurement/actions";
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
import { ForbiddenError, NotFoundError, QuotaExceededError, UnauthorizedError, ValidationError } from "@/lib/errors";
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
  await addMember(ownerA.organizationId, memberA, "member");
  await db.update(sessions).set({ activeOrganizationId: ownerA.organizationId }).where(eq(sessions.userId, memberA.id));
  actAs(null);
});

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

  it("claims through the Server Action from the session only, and tracks it", async () => {
    actAs(ownerA);
    await expect(claimSupplierAction(form({ supplierId: acmeId }))).rejects.toThrow(`REDIRECT:/app?claimed=1&profile=${encodeURIComponent(`s:${acmeId}`)}`);
    const links = await db.select().from(orgSupplierLinks);
    expect(links).toEqual([expect.objectContaining({ organizationId: ownerA.organizationId, supplierId: acmeId, createdBy: ownerA.id })]);
    const tracked = await db.select().from(events).where(eq(events.name, "supplier_claimed"));
    expect(tracked).toEqual([expect.objectContaining({ organizationId: ownerA.organizationId, userId: ownerA.id, properties: { supplier: acmeId, method: "email_domain" } })]);
    // A second claim over the limit sends the user back to the claim page with the notice.
    await expect(claimSupplierAction(form({ supplierId: rivalId }))).rejects.toThrow("REDIRECT:/claim/rival-landscapes-ltd-02222222?limit=1");
    actAs(null);
    await expect(claimSupplierAction(form({ supplierId: acmeId }))).rejects.toBeInstanceOf(UnauthorizedError);
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

  it("are written by the Server Actions for the caller's workspace only", async () => {
    const [first, second] = tenderOcids as [string, string];
    actAs(memberA);
    await saveTenderAction(form({ ocid: first }));
    actAs(ownerB);
    await dismissTenderAction(form({ ocid: second }));
    const rows = await db.select().from(radarItems);
    expect(rows.map((row) => [row.organizationId, row.ocid, row.state, row.createdBy]).sort()).toEqual(
      [
        [ownerA.organizationId, first, "saved", memberA.id],
        [ownerB.organizationId, second, "dismissed", ownerB.id],
      ].sort(),
    );
    const names = (await db.select().from(events)).map((event) => event.name);
    expect(names).toEqual(expect.arrayContaining(["tender_saved", "tender_dismissed"]));
    actAs(null);
    await expect(saveTenderAction(form({ ocid: first }))).rejects.toBeInstanceOf(UnauthorizedError);
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
    const view = await loadRadar(ctxA, {}, NOW);
    expect(view.active).toMatchObject({ kind: "supplier", name: "Acme Grounds Ltd" });
    expect(view.access).toMatchObject({ full: false, matchLimit: 10, maxProfiles: 1 });
    expect(view.list).toMatchObject({ tab: "matches", total: 14 });
    if (view.list?.tab !== "matches") throw new Error("unexpected tab");
    expect(view.list.items).toHaveLength(10);
    // Rows beyond the cap are returned for the "locked" list: title and the Find a Tender link only.
    expect(view.list.locked).toHaveLength(4);
    for (const item of [...view.list.items, ...view.list.locked]) expect(item.noticeUrl).toMatch(/^https:\/\/www\.find-tender\.service\.gov\.uk\/Notice\//);

    // Dismissed tenders leave the list; saved ones feed the deadline strip.
    await setRadarItemState(ctxA, tenderOcids[0]!, "dismissed");
    await setRadarItemState(ctxA, tenderOcids[1]!, "saved");
    const after = await loadRadar(ctxA, {}, NOW);
    expect(after.list).toMatchObject({ total: 13 });
    expect(after.deadlines.map((card) => card.ocid)).toEqual([tenderOcids[1]]);
    expect((await loadRadar(ctxA, { tab: "saved" }, NOW)).list).toMatchObject({ tab: "saved", total: 1 });

    const ending = await loadRadar(ctxA, { tab: "ending" }, NOW);
    expect(ending.list).toMatchObject({ tab: "ending", total: 1 });
    const buyers = await loadRadar(ctxA, { tab: "buyers" }, NOW);
    expect(buyers.list).toMatchObject({ tab: "buyers", total: 1 });
    // Filters that match nothing give an empty list, not an error.
    const filtered = await loadRadar(ctxA, { region: "UKN", value: "large" }, NOW);
    expect(filtered).toMatchObject({ hasFilters: true, list: { tab: "matches", total: 0, items: [] } });
    // Garbage in the query string is ignored.
    expect((await loadRadar(ctxA, { tab: "nonsense", division: "'; --", region: "ZZZ", profile: "s:someone-else" }, NOW)).filters).toEqual({ division: null, region: null, value: null, kind: null });
  });

  it("shows onboarding to a workspace with no company, whatever another workspace has claimed", async () => {
    await linkSupplier(await ctxFor(ownerA), acmeId);
    const viewB = await loadRadar(await ctxFor(ownerB), { profile: `s:${acmeId}` }, NOW);
    expect(viewB).toMatchObject({ sources: [], active: null, spec: null, list: null });
    // Members see their workspace's radar.
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

  it("stores correction and removal requests, validated and rate-limited", async () => {
    actAs(null);
    const invalid = await submitDataRequestAction({ status: "idle" }, form({ kind: "removal", email: "not-an-email", message: "short" }));
    expect(invalid).toMatchObject({ status: "error", error: { code: "VALIDATION" } });
    const sent = await submitDataRequestAction({ status: "idle" }, form({ kind: "removal", email: "Director@AcmeGrounds.co.uk", organisationName: "Acme Grounds Ltd", pageUrl: "https://bidfolio.co.uk/suppliers/acme", message: "Please remove this page about our company." }));
    expect(sent).toEqual({ status: "sent" });
    expect(await db.select().from(dataRequests)).toEqual([expect.objectContaining({ kind: "removal", requesterEmail: "director@acmegrounds.co.uk", status: "open", organisationName: "Acme Grounds Ltd" })]);
    // The honeypot swallows bots without storing anything.
    expect(await submitDataRequestAction({ status: "idle" }, form({ email: "bot@example.com", message: "buy cheap things now now now", website: "http://spam" }))).toEqual({ status: "sent" });
    expect(await db.select().from(dataRequests)).toHaveLength(1);
    for (let attempt = 0; attempt < 4; attempt += 1) await submitDataRequestAction({ status: "idle" }, form({ email: "a@acme.co.uk", message: "Please correct the contract value shown." }));
    expect(await submitDataRequestAction({ status: "idle" }, form({ email: "a@acme.co.uk", message: "Please correct the contract value shown." }))).toMatchObject({ status: "error", error: { code: "RATE_LIMITED" } });
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
