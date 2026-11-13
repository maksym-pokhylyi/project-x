"use client";

import "./bid-theme.css";
import { NavLink } from "@/components/ui/nav-link";
import { tabListClasses } from "@/components/ui/tab-classes";
import { TabsCount } from "@/components/ui/tabs";
import type { NavMatch } from "@/lib/nav";
import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string; count?: number; exact?: boolean; alsoActive?: string[] };

function matchFor(tab: TabItem): NavMatch {
  if (tab.exact) return "exact";
  const also = tab.alsoActive ?? [];
  if (also.length === 0) return "prefix";
  return (pathname) => pathname === tab.href || pathname.startsWith(`${tab.href}/`) || also.some((prefix) => pathname.startsWith(prefix));
}

/** Workspace tabs: Brief / Requirements / Answers / Coverage. Link tabs from the design system (NavLink marks the current one). */
export function BidTabs({ tabs }: { tabs: TabItem[] }) {
  return (
    <nav aria-label="Bid sections" className={cn(tabListClasses, "max-sm:-mx-4 max-sm:px-4")}>
      {tabs.map((tab) => (
        <NavLink key={tab.href} href={tab.href} variant="tab" match={matchFor(tab)}>
          {tab.label}
          {tab.count !== undefined ? <TabsCount className="tabular-nums">{tab.count}</TabsCount> : null}
        </NavLink>
      ))}
    </nav>
  );
}
