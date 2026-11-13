"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Another page always opens at its very top.
 *
 * The router on its own scrolls only when the top of the part of the page that CHANGED is
 * out of view. That leaves a new page a little scrolled whenever something stands above that
 * part (the logo on the sign-in page, the title and tabs of Settings) or the page is just
 * taller than the screen: the browser clamps the old position and the router sees "in view".
 * So: when the path changes, go to the top, at once. Two cases are left alone:
 *
 *   - Back and Forward: the browser puts the page back where it was left;
 *   - an address with a #section: the router scrolls to that section (globals.css,
 *     "Where a scroll stops", keeps it clear of the sticky bar).
 *
 * Rendered once, after the page, in the root layout: its effect runs after the router's own
 * in the same commit, before the browser paints. Checked by e2e/app.spec.ts and by
 * scripts/design/controls.mjs (rule "scroll").
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  /** True from a Back/Forward until the reader does something else. */
  const traversing = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      traversing.current = true;
    };
    const onAction = () => {
      traversing.current = false;
    };
    window.addEventListener("popstate", onPopState);
    // Capture phase: before a link's own handler starts the navigation.
    window.addEventListener("click", onAction, true);
    window.addEventListener("submit", onAction, true);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("click", onAction, true);
      window.removeEventListener("submit", onAction, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (traversing.current || window.location.hash) return;
    if (window.scrollY !== 0) window.scrollTo({ top: 0, left: window.scrollX, behavior: "instant" });
  }, [pathname]);

  return null;
}
