"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabListClasses, tabTriggerClasses } from "@/components/ui/tabs";

/** Settings sections as link tabs (same look as the Tabs primitive; real links, so they deep-link). */
export function SettingsNav({ showBilling }: { showBilling: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/app/settings/profile", label: "Profile" },
    { href: "/app/settings/workspace", label: "Workspace" },
    { href: "/app/settings/members", label: "Members" },
    ...(showBilling ? [{ href: "/app/settings/billing", label: "Billing" }] : []),
    { href: "/app/usage", label: "Usage" },
  ];
  return (
    <nav aria-label="Settings" className={tabListClasses}>
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
