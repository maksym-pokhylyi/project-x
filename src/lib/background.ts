import "server-only";
import { waitUntil } from "@vercel/functions";
import { reportError } from "./report-error";

/**
 * Runs `task` after the response without blocking it.
 *
 * On Vercel, `waitUntil` keeps the function instance alive until the promise settles.
 * Elsewhere (local `next start`, scripts) the promise simply runs in the long-lived
 * process. Errors are recorded, never thrown. Use it only for work that is ALSO durable
 * some other way (a `jobs` row, an outbox row): the instance can still die mid-task.
 */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const promise = Promise.resolve()
    .then(task)
    .catch((error) => reportError(error, { route: `background:${label}` }));
  waitUntil(promise);
}
