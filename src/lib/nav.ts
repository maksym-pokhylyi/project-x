/**
 * Is `href` the page (or section) the visitor is on? PURE — shared by every navigation
 * component through <NavLink> (src/components/ui/nav-link.tsx).
 *
 *   "exact"   only the very same path                      (/admin is not current on /admin/organizations)
 *   "prefix"  the path itself or anything below it         (/app/bids is current on /app/bids/123)
 *   function  custom rule for sections that span several paths
 *
 * Links to an anchor (#…) are never "the current page"; query strings are ignored.
 */
export type NavMatch = "exact" | "prefix" | ((pathname: string) => boolean);

export function isCurrentPath(pathname: string, href: string, match: NavMatch = "prefix"): boolean {
  if (typeof match === "function") return match(pathname);
  if (href.includes("#")) return false;
  const path = href.split("?")[0] ?? "";
  if (!path.startsWith("/")) return false;
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const target = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (match === "exact" || target === "/") return current === target;
  return current === target || current.startsWith(`${target}/`);
}
