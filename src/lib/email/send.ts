import "server-only";
import { db, type DbOrTx } from "@/db";
import { emailOutbox } from "@/db/schema";
import { features } from "@/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { kickWorker } from "@/lib/jobs/worker";
import { log } from "@/lib/logger";
import { renderEmail, type EmailTemplate } from "./templates";

export type SendEmailOptions = {
  /**
   * Extra message headers, e.g. `List-Unsubscribe`. Stored with the outbox row and handed to
   * the provider unchanged. Names are letters, digits and dashes; values are single-line.
   */
  headers?: Record<string, string>;
  /**
   * Write the outbox row (and its delivery job) through this transaction, so the caller's own
   * record of "sent" commits or rolls back together with the message. Default: the pool.
   */
  executor?: DbOrTx;
};

const HEADER_NAME = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/** Validated copy of the caller's headers, or null when there are none. Throws on a header that could split the message. */
export function cleanEmailHeaders(headers: Record<string, string> | undefined): Record<string, string> | null {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0) return null;
  for (const [name, value] of entries) {
    if (!HEADER_NAME.test(name)) throw new Error(`Invalid e-mail header name "${name.slice(0, 40)}"`);
    if (typeof value !== "string" || value.length === 0 || value.length > 2000 || CONTROL_CHARACTER.test(value)) {
      throw new Error(`Invalid value for e-mail header "${name}"`);
    }
  }
  return Object.fromEntries(entries);
}

/**
 * Sends a transactional e-mail.
 *
 * With RESEND_API_KEY: the rendered message is stored in `email_outbox` (status "queued")
 * together with an `email.send` job in ONE transaction, then delivered right after the
 * response (and retried with backoff by the cron worker if that fails).
 *
 * Without it, where dev tools are on (local development, tests, e2e): the message is only
 * stored (status "outbox") and a one-line notice is logged. Read it at /dev/outbox — that
 * is how sign-up, reset and invite flows are exercised locally and in e2e tests.
 *
 * With neither (a production build that cannot deliver mail): nothing can reach the
 * recipient, so the row is stored as "failed" WITHOUT its body (no one-time links at rest)
 * and an error is logged. The flows that depend on e-mail are disabled upstream
 * (see `features.signUpEnabled` / `passwordResetEnabled`).
 *
 * `options` (both optional): extra message `headers`, and an `executor` to make the outbox
 * row part of the caller's transaction.
 *
 * Returns the outbox row id.
 */
export async function sendEmail(to: string, template: EmailTemplate, options: SendEmailOptions = {}): Promise<string> {
  const rendered = await renderEmail(template);
  const recipient = to.trim().toLowerCase();
  const headers = cleanEmailHeaders(options.headers);
  const executor = options.executor ?? db;

  if (features.mailDelivery === "none") {
    const [row] = await executor
      .insert(emailOutbox)
      .values({ toEmail: recipient, subject: rendered.subject, template: template.name, html: null, text: null, status: "failed", error: "no e-mail provider configured" })
      .returning({ id: emailOutbox.id });
    log.error("[email] NOT delivered: RESEND_API_KEY / EMAIL_FROM are not configured", { template: template.name });
    return row!.id;
  }

  if (features.mailDelivery === "outbox") {
    const [row] = await executor
      .insert(emailOutbox)
      .values({ toEmail: recipient, subject: rendered.subject, template: template.name, html: rendered.html, text: rendered.text, headers, status: "outbox" })
      .returning({ id: emailOutbox.id });
    log.info(`[email] RESEND_API_KEY not set — "${rendered.subject}" stored in email_outbox (view at /dev/outbox)`, {
      template: template.name,
    });
    return row!.id;
  }

  const queue = async (tx: DbOrTx) => {
    const [row] = await tx
      .insert(emailOutbox)
      .values({ toEmail: recipient, subject: rendered.subject, template: template.name, html: rendered.html, text: rendered.text, headers, status: "queued" })
      .returning({ id: emailOutbox.id });
    await enqueueJob("email.send", { outboxId: row!.id }, { dedupeKey: `email.send:${row!.id}` }, tx);
    return row!.id;
  };
  // Inside the caller's transaction the job becomes visible when THEY commit; the kick below
  // is then a harmless early look, and the worker or the next cron tick delivers it.
  const outboxId = options.executor ? await queue(options.executor) : await db.transaction(queue);
  kickWorker();
  return outboxId;
}
