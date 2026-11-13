import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `after()` runs its task once the response has gone out; here the tasks are collected and awaited.
const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as Array<Promise<unknown>> }));
vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: unknown) => fn }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => {
    afterTasks.push(Promise.resolve().then(task));
  },
}));
// Redirects and "not found" end a request by throwing; here they throw something a test can read.
vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  permanentRedirect: (url: string): never => {
    throw new Error(`PERMANENT_REDIRECT:${url}`);
  },
}));

import BuyerPage from "@/app/(data)/buyers/[slug]/page";
import SupplierPage from "@/app/(data)/suppliers/[slug]/page";
import TenderPage from "@/app/(data)/tenders/[id]/page";
import { db } from "@/db";
import { cleanRefCode, recordPageVisit, type PageVisitInput } from "@/features/procurement/visits";
import { requestState } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { contractRelease, ingest } from "./helpers/factory";
import { resetProcurement } from "./helpers/schema";

/**
 * A visit to a public page, counted on the server. The `?r=` code of an outreach link
 * identifies ONE prospect, so it stays first-party: it is written to `page_visits` (what the
 * outreach results read) and it never appears in an analytics event, which may be forwarded
 * to a third party. A redirect to the page's canonical address must not lose it either.
 * All data is fictional.
 */
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const CODE = "Ab3dE6gH9k";
const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA" };
const ROOFING = ["45261000"];

const request = (headers: Record<string, string> = { "user-agent": BROWSER }) => {
  requestState.headers = new Headers(headers);
};
const settle = async () => {
  await Promise.all(afterTasks.splice(0));
};
/** One request for a page, and what the server does once the response has gone out. */
const visit = async (input: PageVisitInput, record: typeof recordPageVisit = recordPageVisit) => {
  await record(input);
  await settle();
};
type Visit = { page_type: string; entity_id: string; ref_code: string | null; is_bot: boolean };
const visits = () => db.execute<Visit>(sql`select page_type, entity_id, ref_code, is_bot from page_visits order by created_at, id`);
const eventRows = () => db.execute<{ name: string; properties: Record<string, unknown> }>(sql`select name, properties from events where name = 'supplier_page_viewed' order by created_at, id`);
/** Where a page sends the browser, or null when it renders. */
async function redirectOf(render: () => Promise<unknown>): Promise<string | null> {
  try {
    await render();
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("PERMANENT_REDIRECT:")) return message.slice("PERMANENT_REDIRECT:".length);
    throw error;
  }
}

beforeEach(async () => {
  await resetDatabase();
  await resetProcurement();
  afterTasks.length = 0;
  request();
});

describe("the outreach code of a link", () => {
  it("is read from the query only when it is a short URL-safe token", () => {
    expect(cleanRefCode(CODE)).toBe(CODE);
    expect(cleanRefCode([CODE, "second"])).toBe(CODE);
    for (const bad of [undefined, null, "", "has space", "a&b=c", "x".repeat(41), "<script>", "ü"]) expect(cleanRefCode(bad)).toBeNull();
  });
});

describe("recording a visit", () => {
  it("keeps the code in page_visits and out of the analytics event", async () => {
    await visit({ pageType: "supplier", entityId: "sup_acme", refCode: CODE });
    await visit({ pageType: "supplier", entityId: "sup_acme", refCode: null });

    // First-party: the row the outreach results join on.
    expect(await visits()).toEqual([
      { page_type: "supplier", entity_id: "sup_acme", ref_code: CODE, is_bot: false },
      { page_type: "supplier", entity_id: "sup_acme", ref_code: null, is_bot: false },
    ]);
    // The event says how the visitor arrived — and nothing that singles out a prospect.
    const stored = await eventRows();
    expect(stored.map((row) => row.properties)).toEqual([
      { supplier: "sup_acme", via: "outreach" },
      { supplier: "sup_acme", via: "direct" },
    ]);
    expect(JSON.stringify(stored)).not.toContain(CODE);
    const [anywhere] = await db.execute<{ n: number }>(sql`select count(*)::int as n from events where properties::text like ${`%${CODE}%`}`);
    expect(anywhere!.n).toBe(0);
  });

  it("records buyer and tender pages without an event, flags crawlers and ignores prefetches", async () => {
    await visit({ pageType: "buyer", entityId: "buy_leeds", refCode: CODE });
    await visit({ pageType: "tender", entityId: "ocds-h6vhtk-000001", refCode: null });
    request({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
    await visit({ pageType: "supplier", entityId: "sup_acme", refCode: CODE });
    request({ "user-agent": BROWSER, "next-router-prefetch": "1" });
    await visit({ pageType: "supplier", entityId: "sup_acme", refCode: CODE });
    request({ "user-agent": BROWSER, "sec-purpose": "prefetch;prerender" });
    await visit({ pageType: "supplier", entityId: "sup_acme", refCode: CODE });

    expect(await visits()).toEqual([
      { page_type: "buyer", entity_id: "buy_leeds", ref_code: CODE, is_bot: false },
      { page_type: "tender", entity_id: "ocds-h6vhtk-000001", ref_code: null, is_bot: false },
      { page_type: "supplier", entity_id: "sup_acme", ref_code: CODE, is_bot: true },
    ]);
    expect(await eventRows()).toHaveLength(0);
  });

  describe("with PostHog switched on", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
      vi.doUnmock("posthog-node");
    });

    it("forwards the event without the code", async () => {
      const forwarded: unknown[] = [];
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
      vi.resetModules();
      vi.doMock("posthog-node", () => ({
        PostHog: class {
          async captureImmediate(payload: unknown) {
            forwarded.push(payload);
          }
        },
      }));
      const reloaded = await import("@/features/procurement/visits");

      await visit({ pageType: "supplier", entityId: "sup_acme", refCode: CODE }, reloaded.recordPageVisit);
      await vi.waitFor(() => expect(forwarded).toHaveLength(1));

      expect(forwarded[0]).toMatchObject({ event: "supplier_page_viewed", properties: { supplier: "sup_acme", via: "outreach" } });
      expect(JSON.stringify(forwarded)).not.toContain(CODE);
      expect((await visits())[0]).toMatchObject({ ref_code: CODE }); // and it is still counted for the campaign
    });
  });

  it("a failure is logged without the values of the failed statement", async () => {
    const warned: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation((...parts: unknown[]) => {
      warned.push(parts.map(String).join(" "));
    });
    vi.stubEnv("LOG_LEVEL", "warn");
    try {
      // A NUL byte cannot be stored in a text column: the insert fails and the driver's message quotes every bound value.
      await visit({ pageType: "supplier", entityId: `sup_acme\u0000`, refCode: CODE });
    } finally {
      vi.unstubAllEnvs();
      warn.mockRestore();
    }
    const lines = warned.filter((line) => line.includes("page visit not recorded"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Failed query"); // what went wrong is still said
    expect(lines[0]).not.toContain(CODE);
    expect(lines[0]).not.toContain("sup_acme");
    expect(await visits()).toHaveLength(0);
  });
});

describe("a redirect to the page's canonical address keeps the code", () => {
  const supplierPage = (slug: string, r?: string | string[]) => SupplierPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(r === undefined ? {} : { r }) });

  /** Two supplier rows that turn out to be one company: the older row is merged into the one with the company number. */
  async function mergedSupplier(): Promise<{ from: string; into: string; intoId: string }> {
    await ingest([contractRelease({ title: "A", buyer: LEEDS, suppliers: [{ name: "Northern Roofing", ppon: "PNRF-2222-BBBB" }], cpv: ROOFING })], { profiles: false });
    await ingest([contractRelease({ title: "B", buyer: LEEDS, suppliers: [{ name: "Northern Roofing Contractors Limited", coh: "07770002" }], cpv: ROOFING })], { profiles: false });
    const summary = await ingest([contractRelease({ title: "C", buyer: LEEDS, suppliers: [{ name: "Northern Roofing Contractors Limited", coh: "07770002", ppon: "PNRF-2222-BBBB" }], cpv: ROOFING })]);
    expect(summary.merges).toBe(1);
    const rows = await db.execute<{ id: string; slug: string; merged: boolean }>(sql`select id, slug, merged_into is not null as merged from suppliers order by merged`);
    return { from: rows.find((row) => row.merged)!.slug, into: rows.find((row) => !row.merged)!.slug, intoId: rows.find((row) => !row.merged)!.id };
  }

  it("a merged supplier's page: a valid code travels with the redirect, and the visit is counted where it lands", async () => {
    const { from, into, intoId } = await mergedSupplier();
    expect(into).toBe("northern-roofing-contractors-limited-07770002");

    expect(await redirectOf(() => supplierPage(from, CODE))).toBe(`/suppliers/${into}?r=${CODE}`);
    expect(await redirectOf(() => supplierPage(from, [CODE, "other"]))).toBe(`/suppliers/${into}?r=${CODE}`);
    await settle();
    expect(await visits()).toHaveLength(0); // the redirect itself is not a visit

    // The browser follows it: the surviving company's page records the visit under the code.
    expect(await redirectOf(() => supplierPage(into, CODE))).toBeNull();
    await settle();
    expect(await visits()).toEqual([{ page_type: "supplier", entity_id: intoId, ref_code: CODE, is_bot: false }]);
    expect((await eventRows()).map((row) => row.properties)).toEqual([{ supplier: intoId, via: "outreach" }]);
  });

  it("a merged supplier's page: an invalid code is dropped, and no code adds none", async () => {
    const { from, into } = await mergedSupplier();
    for (const bad of ["bad code", "a&next=//evil.example", "x".repeat(41), "<script>alert(1)</script>", ""]) {
      expect(await redirectOf(() => supplierPage(from, bad)), bad).toBe(`/suppliers/${into}`);
    }
    expect(await redirectOf(() => supplierPage(from))).toBe(`/suppliers/${into}`);
  });

  it("a merged buyer's page and a tender opened by its notice number do the same", async () => {
    const release = contractRelease({ title: "Roof repairs", buyer: LEEDS, suppliers: [{ name: "Castle Roofing Ltd", coh: "03333333" }], cpv: ROOFING });
    await ingest([release, contractRelease({ title: "Gutters", buyer: { name: "Leeds Council (old record)", ppon: "PLDS-9999-ZZZZ" }, suppliers: [{ name: "Castle Roofing Ltd", coh: "03333333" }], cpv: ROOFING })]);
    const buyers = await db.execute<{ id: string; slug: string; ppon: string }>(sql`select id, slug, ppon from buyers`);
    const current = buyers.find((buyer) => buyer.ppon === "PLDS-1111-AAAA")!;
    const old = buyers.find((buyer) => buyer.ppon === "PLDS-9999-ZZZZ")!;
    await db.execute(sql`update buyers set merged_into = ${current.id} where id = ${old.id}`);

    const buyerPage = (slug: string, r?: string) => BuyerPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(r === undefined ? {} : { r }) });
    expect(await redirectOf(() => buyerPage(old.slug, CODE))).toBe(`/buyers/${current.slug}?r=${CODE}`);
    expect(await redirectOf(() => buyerPage(old.slug, "bad code"))).toBe(`/buyers/${current.slug}`);
    expect(await redirectOf(() => buyerPage(old.slug))).toBe(`/buyers/${current.slug}`);

    const tenderPage = (id: string, r?: string) => TenderPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(r === undefined ? {} : { r }) });
    expect(await redirectOf(() => tenderPage(release.id!, CODE))).toBe(`/tenders/${release.ocid}?r=${CODE}`);
    expect(await redirectOf(() => tenderPage(release.id!, "bad code"))).toBe(`/tenders/${release.ocid}`);
    expect(await redirectOf(() => tenderPage(release.id!))).toBe(`/tenders/${release.ocid}`);
    // At its canonical address the page renders, and the visit carries the code.
    expect(await redirectOf(() => tenderPage(release.ocid!, CODE))).toBeNull();
    await settle();
    expect(await visits()).toEqual([{ page_type: "tender", entity_id: release.ocid, ref_code: CODE, is_bot: false }]);
  });
});
