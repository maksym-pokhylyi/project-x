"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string; count?: number; exact?: boolean };

/** Workspace tabs: Brief / Requirements / Questions / Export. Scrolls sideways on small screens. */
export function BidTabs({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Bid sections" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count !== undefined ? <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground tabular-nums">{tab.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
