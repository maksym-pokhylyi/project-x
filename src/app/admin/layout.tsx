import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/ui/nav-link";
import type { NavMatch } from "@/lib/nav";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

/** Sections of the admin bar. Add a page here and it appears in the navigation with the shared current-page marking. */
const adminSections: Array<{ href: string; label: string; match?: NavMatch }> = [
  { href: "/admin", label: "Overview", match: "exact" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/ingestion", label: "Ingestion" },
  { href: "/admin/notifications", label: "Notifications" },
];

/**
 * Founder-only area: 403 for everyone whose verified e-mail is not in ADMIN_EMAILS.
 * Every page under /admin ALSO calls requireAdminForPage() itself: Next.js renders a
 * layout and its page in parallel, so a layout check alone does not protect the page.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminForPage();
  return (
    <div className="flex min-h-dvh flex-col text-15">
      <header data-slot="admin-topbar" className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="container-app flex min-h-14 flex-wrap items-center justify-between gap-x-8 md:min-h-[3.75rem]">
          <div className="flex min-w-0 items-center gap-x-5 md:gap-x-7">
            <Logo href="/admin" size="sm" className="shrink-0" />
            <span className="hidden rounded-chip bg-paper-deep px-2 py-0.5 text-xs font-medium text-ink sm:inline">Admin</span>
            <nav aria-label="Admin" className="flex min-w-0 items-stretch gap-x-6 overflow-x-auto md:gap-x-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {adminSections.map((item) => (
                <NavLink key={item.href} href={item.href} match={item.match}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-ink-2">
            <span className="hidden lg:inline">{user.email}</span>
            <Link href="/app" className="link inline-flex min-h-11 items-center text-ink">
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="container-app flex-1 pt-6 pb-12 md:pt-8 md:pb-[4.5rem]">
        {children}
      </main>
    </div>
  );
}
