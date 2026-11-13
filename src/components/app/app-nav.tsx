"use client";

import type { ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { MenuSheet } from "@/components/ui/menu-sheet";
import { NavLink } from "@/components/ui/nav-link";

type Item = { href: string; label: string; match: (path: string) => boolean };

/**
 * The product's sections, in the order of the top bar. "Documents" is the library at
 * /app/library. Add a section here and it appears in the bar and in the phone menu.
 */
const sections: Item[] = [
  { href: "/app", label: "Radar", match: (path) => path === "/app" || path.startsWith("/app/tenders") || path.startsWith("/app/radar") },
  { href: "/app/bids", label: "Bids", match: (path) => path.startsWith("/app/bids") },
  { href: "/app/library", label: "Documents", match: (path) => path.startsWith("/app/library") },
];

const settings: Item = {
  href: "/app/settings/profile",
  label: "Settings",
  match: (path) => path.startsWith("/app/settings") || path.startsWith("/app/usage"),
};

/**
 * Primary navigation in the top bar (768 px and up): three links, 15 px. The current one is
 * marked by <NavLink> (ink, semibold, 2 px ink rule on the bar's bottom edge,
 * aria-current="page"); the others are muted. Settings is reached from the account menu.
 */
export function AppNav() {
  return (
    <nav aria-label="App" className="hidden items-stretch gap-7 md:flex">
      {sections.map((item) => (
        <NavLink key={item.href} href={item.href} match={item.match}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * The same navigation below 768 px: the three-line button at the right of the bar opens
 * the menu sheet (src/components/ui/menu-sheet.tsx) with the sections, Settings and the
 * workspace switcher. Rows are 52 px tall.
 */
export function AppMenu({ workspace }: { workspace: ReactNode }) {
  return (
    <MenuSheet brand={<Wordmark size="sm" />} triggerProps={{ "data-testid": "app-menu" }} data-slot="app-menu">
      {(close) => (
        <>
          <nav aria-label="App" className="px-5 pt-1">
            <ul className="divide-y divide-line border-b border-line">
              {[...sections, settings].map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} match={item.match} variant="menu" onClick={close}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="px-5 pt-4 pb-6">
            <p className="pb-2 text-13 text-ink-2">Workspace</p>
            {workspace}
          </div>
        </>
      )}
    </MenuSheet>
  );
}
