"use client";

import { useEffect, useRef } from "react";

/*
 * Keeps the current item of a sideways-scrolling row in view. A row of link tabs that is
 * wider than a phone (the radar's tabs) opens scrolled to wherever it was drawn: without
 * this, the tab you are on can be the one that is cut off at the edge.
 *
 * Put it INSIDE the scrolling element, anywhere among its items; it renders nothing. On
 * mount and whenever `watch` changes it finds the item marked current (aria-current, set by
 * <NavLink>) and scrolls the ROW — never the page — just enough to show it whole, with
 * `inset` px to spare for an edge fade. No animation: the row simply starts in the right place.
 *
 *   <nav className="flex overflow-x-auto">
 *     <KeepCurrentInView watch={tab} />
 *     <NavLink variant="tab" …>…</NavLink>
 *   </nav>
 *
 * Candidate for src/components/ui (beside nav-link.tsx).
 */
export function KeepCurrentInView({ watch, inset = 32 }: { /** Re-check when this changes (the current tab's key). */ watch?: string; inset?: number }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const row = marker.current?.parentElement;
    const current = row?.querySelector<HTMLElement>("[aria-current]");
    if (!row || !current || row.scrollWidth <= row.clientWidth) return;
    const rowBox = row.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    if (box.right > rowBox.right - inset) row.scrollLeft += box.right - (rowBox.right - inset);
    else if (box.left < rowBox.left + inset) row.scrollLeft -= rowBox.left + inset - box.left;
  }, [watch, inset]);
  return <span ref={marker} hidden />;
}
