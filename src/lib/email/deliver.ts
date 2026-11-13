import "server-only";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { site } from "@/config/site";
import { env, features } from "@/env";
import { scrubText } from "@/lib/describe-error";

let resend: Resend | null = null;

/**
 * Sender of every e-mail. A real production deployment must set EMAIL_FROM (an address on
 * a domain verified in Resend); without it `features.emailConfigured` is false and nothing
 * is sent. Resend's shared test sender is only a convenience outside production — it
 * delivers to the Resend account owner and nobody else.
 */
export function emailFrom(): string {
  if (env.EMAIL_FROM) return env.EMAIL_FROM;
  if (features.isRealProduction) throw new Error("EMAIL_FROM is not set; refusing to send from the shared test sender in production");
  return `${site.emailFromName} <onboarding@resend.dev>`;
}

/**
 * Sends one queued e-mail through Resend. Called by the `email.send` job.
 *
 * Idempotent: a row already marked `sent` is skipped, and the outbox id is passed to
 * Resend as the idempotency key, so a retry after a timeout cannot double-send.
 * Throws on provider errors so the job is retried with backoff.
 */
export async function deliverOutboxEmail(outboxId: string): Promise<void> {
  const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
  if (!row) return; // deleted meanwhile: nothing to do
  if (row.status === "sent" || row.status === "outbox") return;
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set; cannot deliver queued e-mail");
  if (!row.html || !row.text) {
    await db.update(emailOutbox).set({ status: "failed", error: "body no longer available" }).where(eq(emailOutbox.id, outboxId));
    return;
  }

  resend ??= new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send(
    { from: emailFrom(), to: row.toEmail, subject: row.subject, html: row.html, text: row.text },
    { idempotencyKey: `outbox-${row.id}` },
  );
  if (error) {
    // Provider messages can quote the recipient or parts of the request.
    const reason = scrubText(error.message, 500);
    await db.update(emailOutbox).set({ status: "failed", error: reason }).where(eq(emailOutbox.id, outboxId));
    throw new Error(`Resend rejected the e-mail: ${reason}`);
  }
  // Bodies contain one-time links; do not keep them once the provider has the message.
  await db
    .update(emailOutbox)
    .set({ status: "sent", sentAt: new Date(), providerMessageId: data?.id ?? null, error: null, html: null, text: null })
    .where(eq(emailOutbox.id, outboxId));
}
