import { eq, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
vi.mock("next/cache", async () => (await import("./mocks/next")).cache);

import AdminOverviewPage from "@/app/admin/page";
import { PLAN_CURRENCY, PLANS } from "@/config/plans";
import { db } from "@/db";
import { aiUsage, dataRequests, ingestState, jobs, organizations, orgSupplierLinks, subscriptions, suppliers, users } from "@/db/schema";
import { addSuppressionEntry } from "@/features/outreach/server/suppression-store";
import { getFounderKpis } from "@/server/admin-kpis";
import { actAs, createTestUser, type TestUser } from "../helpers/auth";
import { bidDeskInstalled, FIVE_ELIGIBLE, pageText as text, recordPurchase, resetOutreach, seed, signInFounder, withBidDeskTables } from "./helpers";

/**
 * The founder's numbers on /admin. Every figure is a query: on an empty database they are
 * zeros (and "—" where a module is not installed), never an error; with data they are
 * exactly what the tables say. All data is fictional.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let founder: TestUser;
let now: Date;
const ago = (ms: number) => new Date(now.getTime() - ms);


/** The key numbers of the rendered page, by their data-kpi name: the cell's text. */
function cells(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of html.matchAll(/<div([^>]*data-testid="admin-stat"[^>]*)>(.*?)<\/div>/gs)) {
    const name = /data-kpi="([^"]*)"/.exec(match[1]!)?.[1] ?? `unnamed-${Object.keys(out).length}`;
    out[name] = text(match[2]!);
  }
  return out;
}

/** Workspaces of new customers, one after another. */
async function customerWorkspaces(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) ids.push((await createTestUser({ email: `${name}@customer.example` })).organizationId);
  return ids;
}

describe("founder KPIs", () => {
  beforeEach(async () => {
    await resetOutreach();
    await db.delete(ingestState);
    founder = await signInFounder();
    await db.delete(jobs); // whatever signing up queued is not part of these figures
    now = new Date();
  });

  it("answers on an empty database: zeros, and nothing made up for what is not installed", async () => {
    const kpis = await getFounderKpis(now);
    const installed = await bidDeskInstalled();
    const one = { total: 1, last7Days: 1, last30Days: 1 }; // the founder's own account and workspace
    const none = { total: 0, last7Days: 0, last30Days: 0 };
    expect(kpis).toEqual({
      signups: one,
      verifiedAccounts: one,
      workspaces: one,
      claimedCompanies: none,
      activatedWorkspaces: installed ? none : null,
      paying: { total: 0, trialing: 0, pastDue: 0, byPlan: [] },
      mrr: { minor: 0, currency: "GBP" },
      bidPassSales: { ...none, refunded: 0 },
      aiSpendUsd: { today: 0, last7Days: 0, last30Days: 0, dailyBudget: 1 },
      jobs: { pending: 0, running: 0, failedLast24Hours: 0, oldestPendingAt: null },
      ingestion: { lastSuccessAt: null, lastRunAt: null, lastError: null },
      outreach: { sent: 0, visited: 0, claimed: 0, bidChecks: installed ? 0 : null, optedOut: 0, suppressions: 0, openDataRequests: 0, oldestDataRequestAt: null },
    });
    expect(PLAN_CURRENCY).toBe("GBP");
  });

  it("the page renders those numbers: sixteen cells, a dash where a module is missing", async () => {
    const html = renderToStaticMarkup(await AdminOverviewPage());
    const shown = cells(html);
    expect(Object.keys(shown)).toHaveLength(16);
    expect(Object.keys(shown)[0]).toBe("signups");
    expect(shown.signups).toBe("Sign-ups 1 1 in 7 days · 1 in 30 days");
    expect(shown.mrr).toMatch(/^MRR £0\.00 /);
    expect(shown.paying).toBe("Paying workspaces 0 No paid plans yet · 0 past due · 0 trialing");
    expect(shown.jobs).toBe("Job queue 0 pending 0 failed in 24 hours · 0 running");
    expect(shown.ingestion).toBe("Data ingestion never No successful run recorded Open ingestion");
    expect(shown.outreach).toMatch(/^Outreach 0 sent 0 opened their page · 0 claimed · (—|0) bid checks · 0 opted out Open outreach$/);
    expect(shown.suppressions).toBe("Do-not-contact list 0 Addresses and domains that are never listed or exported Open the list");
    expect(shown["data-requests"]).toBe("Correction and removal requests 0 open Nothing waiting Open the requests");
    expect(shown["bid-pass"]).toBe("Bid Pass sales 0 0 in 7 days · 0 in 30 days");
    if (!(await bidDeskInstalled())) {
      expect(shown.activated).toBe("Activated workspaces — First bid check built — the bid desk is not installed here yet");
    }
    // Each link says where it goes, and looks like a link (the design system's `link`).
    for (const href of ["/admin/ingestion", "/admin/outreach", "/admin/suppressions", "/admin/suppressions#requests"]) {
      const anchor = new RegExp(`<a ([^>]*href="${href}"[^>]*)>Open [a-z ]+</a>`).exec(html);
      expect(anchor?.[1], href).toContain('class="link"');
    }
  });

  it("counts accounts, workspaces and claimed companies, in total and in the last 7 and 30 days", async () => {
    const recent = await createTestUser({ email: "recent@customer.example" });
    const unverified = await createTestUser({ email: "unverified@customer.example" });
    const old = await createTestUser({ email: "old@customer.example" });
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, unverified.id));
    await db.update(users).set({ createdAt: ago(40 * DAY) }).where(eq(users.id, old.id));
    await db.update(organizations).set({ createdAt: ago(40 * DAY) }).where(eq(organizations.id, old.organizationId));
    const tenDays = await createTestUser({ email: "ten-days@customer.example" });
    await db.update(users).set({ createdAt: ago(10 * DAY) }).where(eq(users.id, tenDays.id));
    await db.update(organizations).set({ createdAt: ago(10 * DAY) }).where(eq(organizations.id, tenDays.organizationId));

    // Two workspaces claim the same company (one company), one claimed another company long ago.
    await seed(FIVE_ELIGIBLE);
    const supplier = async (name: string) => (await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, name)))[0]!.id;
    await db.insert(orgSupplierLinks).values([
      { organizationId: recent.organizationId, supplierId: await supplier("Acme Grounds Ltd"), createdBy: recent.id, createdAt: ago(2 * DAY) },
      { organizationId: tenDays.organizationId, supplierId: await supplier("Acme Grounds Ltd"), createdBy: tenDays.id, createdAt: ago(1 * DAY) },
      { organizationId: old.organizationId, supplierId: await supplier("Dale Facilities LLP"), createdBy: old.id, createdAt: ago(40 * DAY) },
      { organizationId: tenDays.organizationId, supplierId: await supplier("Elm Care Ltd"), createdBy: tenDays.id, createdAt: ago(10 * DAY) },
    ]);
    actAs(founder);

    const kpis = await getFounderKpis(now);
    expect(kpis.signups).toEqual({ total: 5, last7Days: 3, last30Days: 4 }); // the founder, recent, unverified | + ten-days | + old
    expect(kpis.verifiedAccounts).toEqual({ total: 4, last7Days: 2, last30Days: 3 });
    expect(kpis.workspaces).toEqual({ total: 5, last7Days: 3, last30Days: 4 });
    expect(kpis.claimedCompanies).toEqual({ total: 3, last7Days: 1, last30Days: 2 }); // by each company's FIRST claim
  });

  it("paying workspaces by plan and MRR at catalogue prices, an annual plan divided by twelve", async () => {
    const orgs = await customerWorkspaces(["a", "b", "c", "d", "e"]);
    await db.insert(subscriptions).values([
      { organizationId: orgs[0]!, status: "active", planKey: "starter", billingInterval: "month", paddleSubscriptionId: "sub_a" },
      { organizationId: orgs[1]!, status: "active", planKey: "pro", billingInterval: "year", paddleSubscriptionId: "sub_b" },
      { organizationId: orgs[2]!, status: "past_due", planKey: "business", billingInterval: "month", paddleSubscriptionId: "sub_c" },
      { organizationId: orgs[3]!, status: "trialing", planKey: "starter", billingInterval: "month", paddleSubscriptionId: "sub_d" },
      { organizationId: orgs[4]!, status: "canceled", planKey: "pro", billingInterval: "month", paddleSubscriptionId: "sub_e" },
    ]);
    actAs(founder);
    const kpis = await getFounderKpis(now);
    expect(kpis.paying).toEqual({
      total: 3,
      trialing: 1,
      pastDue: 1,
      byPlan: [
        { planKey: "pro", name: PLANS.pro.name, paying: 1, trialing: 0 },
        { planKey: "business", name: PLANS.business.name, paying: 1, trialing: 0 },
        { planKey: "starter", name: PLANS.starter.name, paying: 1, trialing: 1 },
      ].sort((a, b) => b.paying - a.paying || a.name.localeCompare(b.name)),
    });
    // A trial and a cancelled subscription bring in nothing; a payment that is late still counts.
    const expected = PLANS.starter.prices!.month + Math.round(PLANS.pro.prices!.year / 12) + PLANS.business.prices!.month;
    expect(kpis.mrr).toEqual({ minor: expected, currency: "GBP" });

    const shown = cells(renderToStaticMarkup(await AdminOverviewPage()));
    expect(shown.mrr).toContain(new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(expected / 100));
    expect(shown.paying).toContain("Paying workspaces 3");
    expect(shown.paying).toContain(`${PLANS.starter.name} 1 (+1 trialing)`);
  });

  it("AI spend against the daily budget, the job queue and how fresh the data is", async () => {
    const org = founder.organizationId;
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await db.insert(aiUsage).values([
      { organizationId: org, feature: "test", model: "test", costUsd: 0.25, createdAt: new Date(startOfToday.getTime() + 1_000) },
      { organizationId: org, feature: "test", model: "test", costUsd: 0.5, createdAt: new Date(startOfToday.getTime() - 3 * DAY) },
      { organizationId: org, feature: "test", model: "test", costUsd: 1, createdAt: ago(20 * DAY) },
      { organizationId: org, feature: "test", model: "test", costUsd: 4, createdAt: ago(40 * DAY) },
    ]);
    await db.insert(jobs).values([
      { type: "test.pending", status: "pending", runAfter: ago(2 * HOUR) },
      { type: "test.pending", status: "pending", runAfter: ago(1 * MINUTE) },
      { type: "test.running", status: "running" },
      { type: "test.failed", status: "failed", updatedAt: ago(2 * HOUR) },
      { type: "test.failed", status: "failed", updatedAt: ago(3 * DAY) },
      { type: "test.done", status: "succeeded", completedAt: ago(1 * HOUR) },
    ]);
    await db.insert(ingestState).values([
      { source: "fts:incremental", lastRunAt: ago(10 * MINUTE), lastSuccessAt: ago(10 * MINUTE) },
      { source: "fts:backfill", lastRunAt: ago(5 * MINUTE), lastSuccessAt: ago(3 * HOUR), lastError: "HTTP 429 from the API" },
    ]);

    const kpis = await getFounderKpis(now);
    // "Today" is the UTC day; whether the 3-day-old row is inside the rolling 7 days depends on the hour, never on today's figure.
    expect(kpis.aiSpendUsd.today).toBe(0.25);
    expect(kpis.aiSpendUsd.last7Days).toBe(0.75);
    expect(kpis.aiSpendUsd.last30Days).toBe(1.75);
    expect(kpis.aiSpendUsd.dailyBudget).toBe(1);
    expect(kpis.jobs).toEqual({ pending: 2, running: 1, failedLast24Hours: 1, oldestPendingAt: ago(2 * HOUR) });
    expect(kpis.ingestion).toEqual({ lastSuccessAt: ago(10 * MINUTE), lastRunAt: ago(5 * MINUTE), lastError: "HTTP 429 from the API" });

    const shown = cells(renderToStaticMarkup(await AdminOverviewPage()));
    expect(shown["ai-spend"]).toMatch(/^AI spend today \$0\.25 of \$1\.00 a day \(25%\) · 7 days \$0\.75 · 30 days \$1\.75 · estimated$/);
    expect(shown.jobs).toMatch(/^Job queue 2 pending 1 failed in 24 hours · 1 running · oldest due 2 hours ago$/);
    expect(shown.ingestion).toMatch(/^Data ingestion \d+ minutes ago Last run reported an error Open ingestion$/);
    expect(JSON.stringify(shown)).not.toContain("429"); // the page says that there was an error, not what a remote server said
  });

  it("summarises outreach: the do-not-contact list and requests that are waiting", async () => {
    await addSuppressionEntry({ kind: "email", value: "tenders@acmegrounds.example", domain: "acmegrounds.example" }, { reason: "optout", source: "optout_link" });
    await db.insert(dataRequests).values([
      { kind: "removal", requesterEmail: "someone@company.example", message: "Remove our page.", createdAt: ago(3 * DAY) },
      { kind: "correction", requesterEmail: "other@company.example", message: "Wrong town.", createdAt: ago(1 * DAY) },
      { kind: "other", requesterEmail: "third@company.example", message: "Done already.", status: "done", createdAt: ago(9 * DAY), resolvedAt: ago(8 * DAY) },
    ]);
    const kpis = await getFounderKpis(now);
    expect(kpis.outreach).toMatchObject({ sent: 0, suppressions: 1, openDataRequests: 2, oldestDataRequestAt: ago(3 * DAY) });
    const html = renderToStaticMarkup(await AdminOverviewPage());
    const shown = cells(html);
    expect(shown.suppressions).toMatch(/^Do-not-contact list 1 /);
    expect(shown["data-requests"]).toBe("Correction and removal requests 2 open Oldest received 3 days ago. Act within five working days. Open the requests");
    // Numbers only: no address from the list or from a request reaches the overview.
    expect(html).not.toMatch(/acmegrounds|company\.example/);
  });

  it("with the bid desk installed: activated workspaces", async () => {
    const [a, b, c] = await customerWorkspaces(["a", "b", "c"]);
    actAs(founder);
    await withBidDeskTables(async () => {
      const iso = (date: Date) => date.toISOString();
      await db.execute(sql`
        insert into bids (organization_id, title, created_at, ready_at) values
          (${a}, 'First check', ${iso(ago(2 * DAY))}::timestamptz, ${iso(ago(2 * DAY))}::timestamptz),
          (${a}, 'Second check', ${iso(ago(1 * DAY))}::timestamptz, ${iso(ago(1 * DAY))}::timestamptz),
          (${b}, 'An old check', ${iso(ago(40 * DAY))}::timestamptz, ${iso(ago(40 * DAY))}::timestamptz),
          (${c}, 'Still processing', ${iso(ago(1 * HOUR))}::timestamptz, null)
      `);
      const kpis = await getFounderKpis(now);
      expect(kpis.activatedWorkspaces).toEqual({ total: 2, last7Days: 1, last30Days: 1 }); // by each workspace's FIRST ready check
      const shown = cells(renderToStaticMarkup(await AdminOverviewPage()));
      expect(shown.activated).toBe("Activated workspaces 2 First bid check built · 1 in 7 days · 1 in 30 days");
    });
  });

  it("Bid Pass sales are the passes of purchases still paid for; refunds are named, not counted", async () => {
    const [a, b, c] = await customerWorkspaces(["a", "b", "c"]);
    actAs(founder);
    await recordPurchase(a!, { at: ago(1 * DAY) });
    await recordPurchase(a!, { at: ago(3 * DAY), quantity: 2 }); // two passes in one purchase
    await recordPurchase(b!, { at: ago(10 * DAY), status: "partially_refunded" }); // the pass stayed with the customer
    await recordPurchase(b!, { at: ago(40 * DAY) });
    await recordPurchase(c!, { at: ago(2 * DAY), status: "refunded" });
    await recordPurchase(c!, { at: ago(2 * DAY), status: "disputed", quantity: 2 });
    // A pass given by hand is not a sale: it has no purchase behind it.
    if (await bidDeskInstalled()) {
      await db.execute(sql`insert into bid_credits (organization_id, kind, source) values (${c}, 'bid_pass', 'admin')`);
    }

    const kpis = await getFounderKpis(now);
    expect(kpis.bidPassSales).toEqual({ total: 5, last7Days: 3, last30Days: 4, refunded: 3 });
    const shown = cells(renderToStaticMarkup(await AdminOverviewPage()));
    expect(shown["bid-pass"]).toBe("Bid Pass sales 5 3 in 7 days · 4 in 30 days · 3 more refunded or disputed");
  });
});
