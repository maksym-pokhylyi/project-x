"use client";

import { ChartNoAxesColumn, CreditCard, Radar, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

/**
 * Primary navigation of the app shell. Add product sections here.
 * Vertical in the sidebar on desktop, a horizontally scrollable row on small screens.
 */
export function AppNav({ canManageBilling, isAdmin }: { canManageBilling: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/app", label: "Radar", icon: Radar, match: (path) => path === "/app" || path.startsWith("/app/tenders") || path.startsWith("/app/radar") },
    { href: "/app/usage", label: "Usage", icon: ChartNoAxesColumn, match: (path) => path.startsWith("/app/usage") },
    { href: "/app/settings/members", label: "Members", icon: Users, match: (path) => path.startsWith("/app/settings/members") },
    ...(canManageBilling
      ? [{ href: "/app/settings/billing", label: "Billing", icon: CreditCard, match: (path: string) => path.startsWith("/app/settings/billing") }]
      : []),
    {
      href: "/app/settings/profile",
      label: "Settings",
      icon: Settings,
      match: (path) => path.startsWith("/app/settings") && !path.startsWith("/app/settings/members") && !path.startsWith("/app/settings/billing"),
    },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck, match: (path: string) => path.startsWith("/admin") }] : []),
  ];

  return (
    <nav aria-label="App" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
