"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { tabListClasses, tabTriggerClasses } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Settings sections as link tabs (same look as the Tabs primitive; real links, so they deep-link). */
export function SettingsNav({ showBilling, className }: { showBilling: boolean; className?: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/app/settings/profile", label: "Profile" },
    { href: "/app/settings/workspace", label: "Workspace" },
    { href: "/app/settings/members", label: "Members" },
    ...(showBilling ? [{ href: "/app/settings/billing", label: "Billing" }] : []),
    { href: "/app/usage", label: "Usage" },
  ];
  return (
    <nav aria-label="Settings" className={cn(tabListClasses, "max-md:-mx-5 max-md:px-5", className)}>
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={tabTriggerClasses}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The frame of every Settings page (and Usage, which lives beside them): the shared title,
 * the tabs under it as on the bid brief, then the page in a 960 px column. Each page starts
 * with <PageHeader level={2} …>.
 */
export function SettingsFrame({ showBilling, children }: { showBilling: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <h1 className="type-title text-ink">Settings</h1>
      <SettingsNav showBilling={showBilling} className="mt-3 md:mt-5" />
      <div className="mt-7 flex max-w-[60rem] flex-col gap-6">{children}</div>
    </div>
  );
}
