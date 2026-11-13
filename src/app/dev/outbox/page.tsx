import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
 */
export default async function DevOutboxPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  if (!(await canAccessDevTools((await searchParams).key))) notFound();
  const rows = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(50);

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dev outbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The 50 most recent e-mails stored locally because e-mail delivery is not configured. Newest first.
      </p>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No e-mails yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border bg-card p-4" data-testid="outbox-email" data-to={row.toEmail} data-template={row.template}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="font-medium">{row.subject}</h2>
                <time className="text-xs text-muted-foreground" dateTime={row.createdAt.toISOString()}>
                  {row.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                </time>
              </div>
              <p className="text-sm text-muted-foreground">
                To <span className="font-medium text-foreground">{row.toEmail}</span> · {row.template} · {row.status}
              </p>
              <ul className="mt-3 space-y-1">
                {extractLinks(row.text)
                  .filter((link) => !link.includes("mailto:"))
                  .map((link) => (
                    <li key={link}>
                      <a href={link} data-testid="outbox-link" className="break-all text-sm font-medium underline underline-offset-4">
                        {link}
                      </a>
                    </li>
                  ))}
              </ul>
              {row.text ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Plain-text body</summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{row.text}</pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
