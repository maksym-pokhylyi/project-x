import "server-only";
import { env, features } from "@/env";
import { errorReason } from "@/lib/describe-error";
import { AppError, BillingNotConfiguredError } from "@/lib/errors";
import { HANDLED_EVENT_TYPES, paddleEnvelopeSchema } from "./paddle-events";
import { ingestPaddleEvent } from "./webhooks";

/**
 * Pulling events from Paddle instead of waiting for webhooks.
 *
 * A developer machine cannot receive webhooks. Paddle keeps every event of the last 90 days
 * in its event stream (`GET /events`), so a sandbox checkout made in a local browser can be
 * turned into a local subscription or purchase by listing the recent events and feeding
 * each one through the SAME pipeline a webhook goes through (ingestPaddleEvent): stored in
 * `webhook_events`, de-duplicated on the event id, signed checkout data verified, stale
 * events ignored. Running it twice changes nothing.
 *
 * The events endpoint was checked against the sandbox API: `order_by=id[ASC]` (ids are
 * time-ordered), `after=<event id>` (exclusive), `from=<RFC 3339>`, `event_type=a,b`,
 * `per_page` up to 200; an event is `{ event_id, event_type, occurred_at, data }` — the
 * webhook envelope without `notification_id`.
 *
 * DEVELOPMENT ONLY. It trusts the API key instead of a webhook signature, and production
 * has real webhooks: it refuses to run on the production deployment or against live Paddle.
 */

export const PULL_PAGE_SIZE = 200;
const DEFAULT_LIMIT = 500;

/** One page of the event stream in Paddle's wire format, oldest first. */
export type FetchEventsPage = (query: { after?: string; from?: string; eventTypes: readonly string[]; perPage: number }) => Promise<unknown[]>;

export type PulledEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  /** A webhook outcome (`processed`, `ignored_…`), `duplicate`, `failed` or `unreadable`. */
  outcome: string;
};

export type PullSummary = {
  pulled: number;
  /** Events that changed something or were recorded. */
  processed: number;
  /** Events this database had already processed. */
  duplicates: number;
  ignored: number;
  failed: number;
  /** Pass it as `after` to continue from here. */
  lastEventId: string | null;
};

export type PullOptions = {
  /** Only events after this event id (exclusive). */
  after?: string;
  /** Only events that occurred at or after this time. Ignored when `after` is given. */
  since?: Date;
  /** Stop after this many events (default 500). */
  limit?: number;
  fetchPage?: FetchEventsPage;
  /** Called once per event, in order: for printing a line. Never receives a payload. */
  onEvent?: (event: PulledEvent) => void;
};

/** Thrown when pulling is not allowed where the code is running. */
export class PullEventsRefusedError extends AppError {
  constructor(message: string) {
    super("FORBIDDEN", message, 403);
  }
}

/** Refuses on the production deployment and against live Paddle — whatever else is configured. */
export function assertPullAllowed(): void {
  if (env.VERCEL_ENV === "production") throw new PullEventsRefusedError("Refusing to pull Paddle events on the production deployment (VERCEL_ENV=production): production receives webhooks.");
  if (env.PADDLE_ENV === "production") throw new PullEventsRefusedError("Refusing to pull events from live Paddle (PADDLE_ENV=production): this tool is for the sandbox only.");
}

const SANDBOX_API = "https://sandbox-api.paddle.com";

/** Default fetcher: the sandbox REST API, raw wire format (the same shape webhooks carry). */
export const fetchEventsPageFromPaddle: FetchEventsPage = async (query) => {
  const url = new URL(`${SANDBOX_API}/events`);
  url.searchParams.set("order_by", "id[ASC]");
  url.searchParams.set("per_page", String(query.perPage));
  url.searchParams.set("event_type", query.eventTypes.join(","));
  if (query.after) url.searchParams.set("after", query.after);
  if (query.from) url.searchParams.set("from", query.from);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${env.PADDLE_API_KEY}`, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Paddle API answered ${response.status} for the event stream`);
  const body = (await response.json()) as { data?: unknown };
  return Array.isArray(body.data) ? body.data : [];
};

/**
 * Lists the events Paddle has recorded since `after` / `since` and feeds every one this app
 * handles through the webhook pipeline, oldest first. Idempotent.
 */
export async function pullPaddleEvents(options: PullOptions = {}): Promise<PullSummary> {
  assertPullAllowed();
  if (!options.fetchPage && (!env.PADDLE_API_KEY || !features.paddleApi)) throw new BillingNotConfiguredError();
  const fetchPage = options.fetchPage ?? fetchEventsPageFromPaddle;
  const limit = Math.max(1, Math.trunc(options.limit ?? DEFAULT_LIMIT));
  const summary: PullSummary = { pulled: 0, processed: 0, duplicates: 0, ignored: 0, failed: 0, lastEventId: null };

  let after = options.after;
  const from = after ? undefined : options.since?.toISOString();
  while (summary.pulled < limit) {
    const page = await fetchPage({ after, from, eventTypes: HANDLED_EVENT_TYPES, perPage: PULL_PAGE_SIZE });
    for (const raw of page) {
      if (summary.pulled >= limit) break;
      summary.pulled += 1;
      const parsed = paddleEnvelopeSchema.safeParse(raw);
      const eventId = parsed.success ? parsed.data.event_id : typeof (raw as { event_id?: unknown })?.event_id === "string" ? (raw as { event_id: string }).event_id : null;
      if (eventId) {
        after = eventId;
        summary.lastEventId = eventId;
      }
      if (!parsed.success || !HANDLED_EVENT_TYPES.includes(parsed.data.event_type)) {
        summary.ignored += 1;
        options.onEvent?.({
          eventId: eventId ?? "(no id)",
          eventType: parsed.success ? parsed.data.event_type : "(unreadable)",
          occurredAt: parsed.success ? parsed.data.occurred_at : "",
          outcome: parsed.success ? "ignored_unhandled" : "unreadable",
        });
        continue;
      }

      let outcome: string;
      try {
        const result = await ingestPaddleEvent(parsed.data);
        if (!result.ok) {
          summary.failed += 1;
          outcome = "failed";
        } else if (result.duplicate) {
          summary.duplicates += 1;
          outcome = "duplicate";
        } else if (result.outcome === "processed") {
          summary.processed += 1;
          outcome = "processed";
        } else {
          summary.ignored += 1;
          outcome = result.outcome ?? "ignored";
        }
      } catch (error) {
        summary.failed += 1;
        outcome = `failed (${errorReason(error)})`;
      }
      options.onEvent?.({ eventId: parsed.data.event_id, eventType: parsed.data.event_type, occurredAt: parsed.data.occurred_at, outcome });
    }
    // A short page is the end of the stream. A page without a readable event id cannot be continued from.
    if (page.length < PULL_PAGE_SIZE || !after) break;
  }
  return summary;
}
