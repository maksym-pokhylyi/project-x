import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/app/page-header";
import { Disclosure } from "@/components/ui/disclosure";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { canAccessDevTools } from "@/server/dev-tools";

export const metadata: Metadata = { title: "Dev outbox", robots: { index: false } };
export const dynamic = "force-dynamic";

function extractLinks(text: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)];
}

/**
 * Development mailbox: shows e-mails that were written to `email_outbox` instead of
 * being sent (no RESEND_API_KEY). Returns 404 unless dev tools are enabled, which is
 * impossible on a Vercel production deployment (see `features.devTools` in src/env.ts).
 * On a production BUILD with DEV_TOOLS=1 it additionally needs a founder session or
 * `?key=<DEV_TOOLS_SECRET>` (src/server/dev-tools.ts): these links are account access.
 *
 * The links listed under each message are read from its plain-text body, in order: the
 * first one is the message's action link (the templates in src/emails guarantee that).
 */
export default async function DevOutboxPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  if (!(await canAccessDevTools((await searchParams).key))) notFound();
  const rows = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(50);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="type-page text-ink">Dev outbox</h1>
      <p className="mt-2 text-15 text-ink-2">The 50 most recent emails stored locally because email delivery is not configured. Newest first.</p>
      {rows.length === 0 ? (
        <EmptyState className="mt-8" title="No emails yet" description="Sign up, reset a password or invite someone: the message appears here." />
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card border border-line bg-surface p-4 sm:p-5" data-testid="outbox-email" data-to={row.toEmail} data-template={row.template}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h2 className="text-15 font-semibold text-ink">{row.subject}</h2>
                <time className="shrink-0 text-13 text-ink-2 tabular-nums" dateTime={row.createdAt.toISOString()}>
                  {row.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                </time>
              </div>
              <p className="mt-0.5 text-sm text-ink-2">
                To <span className="font-medium text-ink">{row.toEmail}</span> · {row.template} · {row.status}
              </p>
              <ul className="mt-3 flex flex-col gap-1">
                {extractLinks(row.text)
                  .filter((link) => !link.includes("mailto:"))
                  .map((link) => (
                    <li key={link}>
                      <a href={link} data-testid="outbox-link" className="link text-sm font-medium break-all">
                        {link}
                      </a>
                    </li>
                  ))}
              </ul>
              {row.text ? (
                <Disclosure size="sm" summary="Plain-text body" className="mt-2">
                  <pre className="max-h-64 overflow-auto rounded-control bg-paper-deep p-3 text-xs whitespace-pre-wrap text-ink">{row.text}</pre>
                </Disclosure>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
