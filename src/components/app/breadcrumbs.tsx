"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/** Labels for the route segments the shell knows. Feature modules set their own trail (see BreadcrumbTrail). */
const LABELS: Record<string, string> = {
  app: "Radar",
  bids: "Bids",
  new: "New bid",
  library: "Documents",
};

/** Where a section crumb links to when it is not the current page. */
const SECTION_HREF: Record<string, string> = {
  bids: "/app/bids",
  library: "/app/library",
};

function fromPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean).slice(1); // drop "app"
  // Top-level pages need no trail, and Settings shows its place with tabs.
  if (segments.length < 2 || segments[0] === "settings" || segments[0] === "usage") return [];

  return segments.map((segment, index) => {
    const known = LABELS[segment];
    // Opaque ids (a bid, a document) have no readable name here: the page sets it with <BreadcrumbTrail>.
    const label = known ?? (/^[a-z][a-z-]*$/.test(segment) ? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ") : "Details");
    const isLast = index === segments.length - 1;
    return { label, href: isLast ? undefined : (SECTION_HREF[segment] ?? `/app/${segments.slice(0, index + 1).join("/")}`) };
  });
}

const TrailContext = createContext<{ trail: Crumb[] | null; setTrail: (trail: Crumb[] | null) => void } | null>(null);

/** Holds a trail set by the current page. Wraps the app shell. */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[] | null>(null);
  const value = useMemo(() => ({ trail, setTrail }), [trail]);
  return <TrailContext.Provider value={value}>{children}</TrailContext.Provider>;
}

/**
 * Lets a page name its own place above its title, for routes whose segments are ids:
 *
 *   <BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: "Calderbrook MBC", href: … }, { label: "Bid brief" }]} />
 *
 * Renders nothing. The last item is the current page and needs no href.
 */
export function BreadcrumbTrail({ items }: { items: Crumb[] }) {
  const context = useContext(TrailContext);
  const setTrail = context?.setTrail;
  const key = JSON.stringify(items);
  useEffect(() => {
    if (!setTrail) return;
    setTrail(JSON.parse(key) as Crumb[]);
    return () => setTrail(null);
  }, [key, setTrail]);
  return null;
}

/**
 * The page's place, shown above its title as in the bid brief artboard: the full trail from
 * 768 px ("Bids / Calderbrook MBC / Bid brief"), and on phones one link back to the parent
 * ("‹ Bids"). Uses the page's own trail if it set one, otherwise the URL. Top-level pages
 * and Settings render nothing.
 */
export function AppBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const context = useContext(TrailContext);
  const crumbs = context?.trail ?? fromPath(pathname);
  if (crumbs.length < 2) return null;

  const parent = [...crumbs].reverse().find((crumb) => crumb.href);

  return (
    <div className={cn("mb-1 md:mb-3.5", className)}>
      {parent?.href ? (
        <Link href={parent.href} className="link-quiet -mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium md:hidden">
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
            <path d="M10 3L5 8l5 5" />
          </svg>
          {parent.label}
        </Link>
      ) : null}
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <BreadcrumbItem>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {isLast ? null : <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
