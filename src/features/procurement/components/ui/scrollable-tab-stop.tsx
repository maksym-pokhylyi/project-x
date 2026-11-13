"use client";

import { useEffect, useRef } from "react";

/*
 * Keyboard access for a row that scrolls sideways (WCAG 2.1.1). A scroll area holding only
 * text — a line of chips — cannot be moved with the keyboard unless it can take focus.
 * Rendered right AFTER such a row, this makes the row a Tab stop while it overflows and has
 * nothing focusable inside, and removes the stop again when it fits (a wider screen, where
 * the row wraps) — so nobody tabs through rows that have nothing to scroll. The arrow keys
 * then scroll the row, as for any focused scroll area. Give the row an accessible name.
 *
 *   <ul aria-label="Why this matches" className="flex overflow-x-auto">…</ul>
 *   <ScrollableTabStop />
 *
 * Candidate for src/components/ui (no dependencies).
 */
const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

export function ScrollableTabStop() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = marker.current?.previousElementSibling;
    if (!(row instanceof HTMLElement)) return;
    const update = () => {
      const scrolls = row.scrollWidth > row.clientWidth + 1;
      if (scrolls && !row.querySelector(FOCUSABLE)) row.tabIndex = 0;
      else row.removeAttribute("tabindex");
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  return <span ref={marker} hidden />;
}
