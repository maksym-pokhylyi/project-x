import "server-only";
import { features } from "@/env";
import { log } from "@/lib/logger";
import { sendNotification, type SendPayload } from "./deliver";
import { runFanout, type FanoutPayload } from "./fanout";

/**
 * Job entry points, loaded lazily by src/lib/jobs/handlers.ts.
 * Both are idempotent (see fanout.ts and deliver.ts); throwing retries with backoff.
 *
 * `payload.at` is the simulated moment of a dev-tools run (see scheduleFromCron): it is
 * honoured only where dev tools are on, which a production deployment never has. Anywhere
 * else a job acts at the real time, whatever its payload says.
 */
function actingAt(payload: { at?: string }): Date | undefined {
  if (!features.devTools || !payload.at) return undefined;
  const at = new Date(payload.at);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

export async function runNotificationFanout(payload: FanoutPayload): Promise<void> {
  const result = await runFanout(payload, { now: actingAt(payload) });
  if (result.enqueued > 0 || result.status !== "done") log.info("notifications.fanout", { kind: payload.kind, period: payload.period, ...result });
}

export async function runNotificationSend(payload: SendPayload): Promise<void> {
  const outcome = await sendNotification(payload, { now: actingAt(payload) });
  if (outcome !== "sent" && outcome !== "skipped_empty" && outcome !== "already_done") {
    log.info("notifications.send", { kind: payload.kind, period: payload.period, outcome });
  }
}
