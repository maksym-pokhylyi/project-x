"use client";

import { FileText, LibraryBig, Radar, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

/** The product's sections. Add a section here and it appears in the sidebar and the tab bar. */
const sections: Item[] = [
  { href: "/app", label: "Radar", icon: Radar, match: (path) => path === "/app" },
  { href: "/app/bids", label: "Bids", icon: FileText, match: (path) => path.startsWith("/app/bids") },
  { href: "/app/library", label: "Library", icon: LibraryBig, match: (path) => path.startsWith("/app/library") },
];

const settings: Item = {
  href: "/app/settings/profile",
  label: "Settings",
  icon: Settings,
  match: (path) => path.startsWith("/app/settings") || path.startsWith("/app/usage"),
};

const admin: Item = { href: "/admin", label: "Admin", icon: ShieldCheck, match: (path) => path.startsWith("/admin") };

/**
 * Primary navigation in the sidebar (1024 px and up): the three sections, then Settings
 * (and Admin for the founder) under a hairline. The active item is brand on brand-tint with
 * aria-current="page".
 */
export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const renderItem = (item: Item) => {
    const active = item.match(pathname);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150",
            active ? "bg-brand-tint text-brand" : "text-ink-2 hover:bg-surface-sunken hover:text-ink",
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="App" className="flex flex-col gap-3">
      <ul className="space-y-1">{sections.map(renderItem)}</ul>
      <ul className="space-y-1 border-t border-line pt-3">{[settings, ...(isAdmin ? [admin] : [])].map(renderItem)}</ul>
    </nav>
  );
}

/**
 * Bottom tab bar below 1024 px: four destinations within thumb reach, each at least 64 × 56 px.
 * Fixed to the bottom edge and padded for the home indicator on phones.
 */
export function AppTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="App"
      data-slot="app-tabbar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {[...sections, settings].map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 text-xs font-medium -outline-offset-2 transition-colors duration-150",
                  active ? "text-brand" : "text-ink-2 hover:text-ink",
                )}
              >
                <span aria-hidden className={cn("absolute inset-x-5 top-0 h-0.5 rounded-b-full", active ? "bg-brand" : "bg-transparent")} />
                <Icon aria-hidden className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
