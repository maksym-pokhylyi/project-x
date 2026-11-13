import "server-only";
import { log } from "@/lib/logger";
import { sendNotification, type SendPayload } from "./deliver";
import { runFanout, type FanoutPayload } from "./fanout";

/**
 * Job entry points, loaded lazily by src/lib/jobs/handlers.ts.
 * Both are idempotent (see fanout.ts and deliver.ts); throwing retries with backoff.
 */
export async function runNotificationFanout(payload: FanoutPayload): Promise<void> {
  const result = await runFanout(payload);
  if (result.enqueued > 0 || result.status !== "done") log.info("notifications.fanout", { kind: payload.kind, period: payload.period, ...result });
}

export async function runNotificationSend(payload: SendPayload): Promise<void> {
  const outcome = await sendNotification(payload);
  if (outcome !== "sent" && outcome !== "skipped_empty" && outcome !== "already_done") {
    log.info("notifications.send", { kind: payload.kind, period: payload.period, outcome });
  }
}
