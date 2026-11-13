import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Founder-only area: 403 for everyone whose verified e-mail is not in ADMIN_EMAILS.
 * Every page under /admin ALSO calls requireAdminForPage() itself: Next.js renders a
 * layout and its page in parallel, so a layout check alone does not protect the page.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminForPage();
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-sidebar">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Logo href="/admin" />
            <nav aria-label="Admin" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <Link href="/admin" className="font-medium hover:underline">
                Overview
              </Link>
              <Link href="/admin/organizations" className="font-medium hover:underline">
                Organizations
              </Link>
              <Link href="/admin/outreach" className="font-medium hover:underline">
                Outreach
              </Link>
              <Link href="/admin/outreach/suppressions" className="font-medium hover:underline">
                Suppressions
              </Link>
              <Link href="/admin/ingestion" className="font-medium hover:underline">
                Ingestion
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{user.email}</span>
            <Link href="/app" className="font-medium text-foreground hover:underline">
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
