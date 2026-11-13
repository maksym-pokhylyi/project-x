"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ showBilling }: { showBilling: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/app/settings/profile", label: "Profile" },
    { href: "/app/settings/workspace", label: "Workspace" },
    { href: "/app/settings/members", label: "Members" },
    ...(showBilling ? [{ href: "/app/settings/billing", label: "Billing" }] : []),
  ];
  return (
    <nav aria-label="Settings" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
