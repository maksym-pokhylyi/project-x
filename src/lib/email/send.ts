import "server-only";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { features } from "@/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { kickWorker } from "@/lib/jobs/worker";
import { log } from "@/lib/logger";
import { renderEmail, type EmailTemplate } from "./templates";

/**
 * Sends a transactional e-mail.
 *
 * With RESEND_API_KEY: the rendered message is stored in `email_outbox` (status "queued")
 * together with an `email.send` job in ONE transaction, then delivered right after the
 * response (and retried with backoff by the cron worker if that fails).
 *
 * Without it: the message is only stored (status "outbox") and a one-line notice is
 * logged. Read it at /dev/outbox — that is how sign-up, reset and invite flows are
 * exercised locally and in e2e tests.
 *
 * Returns the outbox row id.
 */
export async function sendEmail(to: string, template: EmailTemplate): Promise<string> {
  const rendered = await renderEmail(template);
  const recipient = to.trim().toLowerCase();

  if (!features.emailConfigured) {
    const [row] = await db
      .insert(emailOutbox)
      .values({ toEmail: recipient, subject: rendered.subject, template: template.name, html: rendered.html, text: rendered.text, status: "outbox" })
      .returning({ id: emailOutbox.id });
    log.info(`[email] RESEND_API_KEY not set — "${rendered.subject}" stored in email_outbox (view at /dev/outbox)`, {
      template: template.name,
    });
    return row!.id;
  }

  const outboxId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(emailOutbox)
      .values({ toEmail: recipient, subject: rendered.subject, template: template.name, html: rendered.html, text: rendered.text, status: "queued" })
      .returning({ id: emailOutbox.id });
    await enqueueJob("email.send", { outboxId: row!.id }, { dedupeKey: `email.send:${row!.id}` }, tx);
    return row!.id;
  });
  kickWorker();
  return outboxId;
}
