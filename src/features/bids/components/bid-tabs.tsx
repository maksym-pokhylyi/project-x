"use client";

import "./bid-theme.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string; count?: number; exact?: boolean; alsoActive?: string[] };

/** Workspace tabs: Brief / Requirements / Answers / Pack files. Scrolls sideways on small screens. */
export function BidTabs({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Bid sections" className="-mx-4 overflow-x-auto border-b border-(--bid-line) px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-x-8 text-[15px] font-medium">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`) || (tab.alsoActive ?? []).some((prefix) => pathname.startsWith(prefix));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 text-(--bid-ink) no-underline", active ? "border-(--bid-ink)" : "border-transparent hover:border-(--bid-line-strong)")}
              >
                {tab.label}
                {tab.count !== undefined ? <span className="bid-mono text-xs font-normal text-(--bid-muted) tabular-nums">{tab.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
