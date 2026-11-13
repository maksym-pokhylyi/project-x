"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavLink } from "@/components/ui/nav-link";
import { tabListClasses } from "@/components/ui/tab-classes";
import { BILLING_PATH } from "@/lib/billing/handoff";
import { cn } from "@/lib/utils";

/**
 * Settings sections as link tabs (same look as the Tabs primitive; real links, so they
 * deep-link). Billing is not one of them: it is a page of its own, as on the Billing
 * artboard, reached from the account menu.
 */
export function SettingsNav({ className }: { className?: string }) {
  const tabs = [
    { href: "/app/settings/profile", label: "Profile" },
    { href: "/app/settings/workspace", label: "Workspace" },
    { href: "/app/settings/members", label: "Members" },
    { href: "/app/usage", label: "Usage" },
  ];
  return (
    <nav aria-label="Settings" className={cn(tabListClasses, "max-md:-mx-5 max-md:px-5", className)}>
      {tabs.map((tab) => (
        <NavLink key={tab.href} href={tab.href} variant="tab">
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * The frame of every Settings page (and Usage, which lives beside them): the shared title,
 * the tabs under it as on the bid brief, then the page in a 960 px column. Each page starts
 * with <PageHeader level={2} …>.
 *
 * Billing and the checkout confirmation live under /app/settings/billing for their address
 * only: they are full-width pages with their own title, so the frame steps aside for them.
 */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === BILLING_PATH || pathname.startsWith(`${BILLING_PATH}/`)) return <>{children}</>;
  return (
    <div className="flex flex-col">
      <h1 className="type-page text-ink">Settings</h1>
      <SettingsNav className="mt-3 md:mt-5" />
      <div className="mt-7 flex max-w-[60rem] flex-col gap-6">{children}</div>
    </div>
  );
}
