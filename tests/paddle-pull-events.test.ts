import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { subscriptions, webhookEvents } from "@/db/schema";
import { HANDLED_EVENT_TYPES } from "@/lib/billing/paddle-events";
import { PULL_PAGE_SIZE, pullPaddleEvents, type FetchEventsPage, type PulledEvent } from "@/lib/billing/pull-events";
import { getOrgEntitlements } from "@/lib/billing/subscription";
import { resetDatabase } from "./helpers/db";
import { createBillingOrg, oneOffPurchaseEvent, paddleEvent, sandboxLifecycle } from "./helpers/paddle";

/**
 * `pnpm paddle:pull-events`: Paddle's event stream fed through the webhook pipeline, for
 * local development where webhooks cannot arrive.
 */
const ORG = "org_pull";

/** What GET /events returns (checked against the sandbox): the webhook envelope without `notification_id`. */
const asApiEvent = (envelope: { event_id: string; event_type: string; occurred_at: string; data: unknown }) => ({
  event_id: envelope.event_id,
  event_type: envelope.event_type,
  occurred_at: envelope.occurred_at,
  data: envelope.data,
});

/** An event stream: pages of `perPage`, oldest first, starting after `after`. */
function streamOf(events: Array<{ event_id: string }>) {
  const queries: Array<Parameters<FetchEventsPage>[0]> = [];
  const fetchPage: FetchEventsPage = async (query) => {
    queries.push(query);
    const start = query.after ? events.findIndex((event) => event.event_id === query.after) + 1 : 0;
    return events.slice(start, start + query.perPage);
  };
  return { fetchPage, queries };
}

describe("pullPaddleEvents", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createBillingOrg(ORG);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("turns the events of a sandbox checkout into a local subscription and purchase — through the same pipeline as a webhook", async () => {
    const stream = [paddleEvent("customer.created"), paddleEvent("subscription.created", { organizationId: ORG }), paddleEvent("transaction.completed", { organizationId: ORG }), oneOffPurchaseEvent({ organizationId: ORG })].map(asApiEvent);
    const lines: PulledEvent[] = [];
    const { fetchPage, queries } = streamOf(stream);
    const since = new Date(Date.now() - 3_600_000);
    const summary = await pullPaddleEvents({ fetchPage, since, onEvent: (event) => lines.push(event) });

    expect(summary).toEqual({ pulled: 4, processed: 4, duplicates: 0, ignored: 0, failed: 0, lastEventId: stream[3]!.event_id });
    expect(queries).toEqual([{ after: undefined, from: since.toISOString(), eventTypes: HANDLED_EVENT_TYPES, perPage: PULL_PAGE_SIZE }]);
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ organizationId: ORG, status: "active", planKey: "pro" });
    expect((await getOrgEntitlements(ORG)).planKey).toBe("pro");
    // One line per event: type, id, outcome — and nothing else.
    expect(lines.map((line) => [line.eventType, line.outcome])).toEqual([
      ["customer.created", "processed"],
      ["subscription.created", "processed"],
      ["transaction.completed", "processed"],
      ["transaction.completed", "processed"],
    ]);
    expect(lines.every((line) => Object.keys(line).sort().join() === "eventId,eventType,occurredAt,outcome")).toBe(true);
    // Stored like webhook deliveries: a real webhook for the same event would be a duplicate.
    expect(await db.select().from(webhookEvents)).toHaveLength(4);
  });

  it("is idempotent: a second run changes nothing and reports duplicates", async () => {
    const stream = [paddleEvent("subscription.created", { organizationId: ORG }), paddleEvent("transaction.completed", { organizationId: ORG })].map(asApiEvent);
    await pullPaddleEvents({ fetchPage: streamOf(stream).fetchPage });
    const before = await db.select().from(subscriptions);
    const lines: PulledEvent[] = [];
    expect(await pullPaddleEvents({ fetchPage: streamOf(stream).fetchPage, onEvent: (event) => lines.push(event) })).toMatchObject({ pulled: 2, processed: 0, duplicates: 2 });
    expect(lines.map((line) => line.outcome)).toEqual(["duplicate", "duplicate"]);
    expect(await db.select().from(subscriptions)).toEqual(before);
    expect(await db.select().from(webhookEvents)).toHaveLength(2);
  });

  it("replays what the sandbox really emitted for a subscription, in order", async () => {
    const lifecycle = sandboxLifecycle("active", { organizationId: ORG }).map(asApiEvent);
    const summary = await pullPaddleEvents({ fetchPage: streamOf(lifecycle).fetchPage });
    // 13 subscription events are applied; the 4 transaction.updated / .canceled events are types the app does not handle.
    expect(summary).toMatchObject({ pulled: 17, processed: 13, ignored: 4, failed: 0 });
    expect((await db.select().from(subscriptions))[0]).toMatchObject({ status: "canceled", pauseAt: null, cancelAt: null });
    expect(await db.select().from(webhookEvents)).toHaveLength(13);
  });

  it("continues page by page from the last event id, and honours `after` and `limit`", async () => {
    // A full page of events the app does not handle (cheap), then one that matters.
    const filler = Array.from({ length: PULL_PAGE_SIZE }, (_, index) => ({ event_id: `evt_filler_${String(index).padStart(4, "0")}`, event_type: "address.created", occurred_at: new Date().toISOString(), data: { id: `add_${index}` } }));
    const last = asApiEvent(paddleEvent("subscription.created", { organizationId: ORG }));
    const { fetchPage, queries } = streamOf([...filler, last]);
    expect(await pullPaddleEvents({ fetchPage })).toMatchObject({ pulled: PULL_PAGE_SIZE + 1, processed: 1, ignored: PULL_PAGE_SIZE, lastEventId: last.event_id });
    expect(queries.map((query) => query.after)).toEqual([undefined, "evt_filler_0199"]);

    // `after` wins over `since`; `limit` stops early and says where to continue.
    const second = streamOf([...filler, last]);
    const limited = await pullPaddleEvents({ fetchPage: second.fetchPage, after: "evt_filler_0100", since: new Date(), limit: 5 });
    expect(limited).toMatchObject({ pulled: 5, lastEventId: "evt_filler_0105" });
    expect(second.queries).toEqual([{ after: "evt_filler_0100", from: undefined, eventTypes: HANDLED_EVENT_TYPES, perPage: PULL_PAGE_SIZE }]);
  });

  it("an unreadable event or a failing one does not stop the others", async () => {
    const broken = asApiEvent(paddleEvent("subscription.created", { organizationId: ORG, mutate: (data) => void (data.items = []) }));
    const fine = asApiEvent(paddleEvent("customer.created"));
    const lines: PulledEvent[] = [];
    const summary = await pullPaddleEvents({ fetchPage: streamOf([{ event_id: "evt_garbage", nonsense: true } as never, broken, fine]).fetchPage, onEvent: (event) => lines.push(event) });
    expect(summary).toMatchObject({ pulled: 3, processed: 1, ignored: 1, failed: 1 });
    expect(lines.map((line) => line.outcome)).toEqual(["unreadable", "failed", "processed"]);
    expect((await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, broken.event_id)))[0]!.processedAt).toBeNull();
  });

  it("the default fetcher asks the SANDBOX event stream, oldest first, for the handled event types", async () => {
    vi.stubEnv("PADDLE_API_KEY", "pdl_sdbx_apikey_test");
    vi.resetModules();
    const calls: Array<{ url: URL; authorization: string | null }> = [];
    vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
      calls.push({ url: new URL(url), authorization: new Headers(init.headers).get("authorization") });
      return Response.json({ data: [asApiEvent(paddleEvent("customer.created"))], meta: { pagination: { has_more: false } } });
    });
    const { pullPaddleEvents: pull } = await import("@/lib/billing/pull-events");
    expect(await pull({ since: new Date("2026-11-13T10:00:00Z") })).toMatchObject({ pulled: 1, processed: 1 });
    expect(calls).toHaveLength(1);
    const { url, authorization } = calls[0]!;
    expect(`${url.origin}${url.pathname}`).toBe("https://sandbox-api.paddle.com/events");
    expect(Object.fromEntries(url.searchParams)).toEqual({ order_by: "id[ASC]", per_page: "200", event_type: HANDLED_EVENT_TYPES.join(","), from: "2026-11-13T10:00:00.000Z" });
    expect(authorization).toBe("Bearer pdl_sdbx_apikey_test");
  });

  it("needs the API key, and refuses on the production deployment or against live Paddle — before fetching anything", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(pullPaddleEvents()).rejects.toMatchObject({ code: "BILLING_NOT_CONFIGURED" });

    for (const overrides of [{ PADDLE_ENV: "production", PADDLE_API_KEY: "pdl_live_apikey_test" }, { VERCEL_ENV: "production", PADDLE_API_KEY: "pdl_sdbx_apikey_test", ALLOW_SANDBOX_BILLING: "1", RESEND_API_KEY: "re_key", EMAIL_FROM: "no-reply@bidfolio.co.uk" }]) {
      vi.unstubAllEnvs();
      for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
      vi.resetModules();
      const { pullPaddleEvents: pull, PullEventsRefusedError } = await import("@/lib/billing/pull-events");
      const stream = streamOf([asApiEvent(paddleEvent("subscription.created", { organizationId: ORG }))]);
      await expect(pull({ fetchPage: stream.fetchPage })).rejects.toBeInstanceOf(PullEventsRefusedError);
      expect(stream.queries).toHaveLength(0);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await db.select().from(webhookEvents)).toHaveLength(0);
  });
});
