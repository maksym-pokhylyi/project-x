import "server-only";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { site } from "@/config/site";
import { env } from "@/env";

let resend: Resend | null = null;

export function emailFrom(): string {
  return env.EMAIL_FROM ?? `${site.emailFromName} <onboarding@resend.dev>`;
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
    await db.update(emailOutbox).set({ status: "failed", error: error.message.slice(0, 500) }).where(eq(emailOutbox.id, outboxId));
    throw new Error(`Resend rejected the e-mail: ${error.message}`);
  }
  // Bodies contain one-time links; do not keep them once the provider has the message.
  await db
    .update(emailOutbox)
    .set({ status: "sent", sentAt: new Date(), providerMessageId: data?.id ?? null, error: null, html: null, text: null })
    .where(eq(emailOutbox.id, outboxId));
}
