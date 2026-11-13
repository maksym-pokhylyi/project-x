"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export type Crumb = { label: string; href?: string };

/** Labels for the route segments the shell knows. Feature modules set their own trail (see BreadcrumbTrail). */
const LABELS: Record<string, string> = {
  app: "Radar",
  bids: "Bids",
  new: "New bid",
  library: "Library",
  settings: "Settings",
  profile: "Profile",
  workspace: "Workspace",
  members: "Members",
  billing: "Billing",
  success: "Payment confirmation",
  usage: "Usage",
};

/** Where a section crumb links to when it is not the current page. */
const SECTION_HREF: Record<string, string> = {
  bids: "/app/bids",
  library: "/app/library",
  settings: "/app/settings/profile",
};

function fromPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean).slice(1); // drop "app"
  if (segments.length === 0) return [{ label: LABELS.app! }];
  // Usage lives at /app/usage but belongs to Settings.
  if (segments[0] === "usage") return [{ label: LABELS.settings!, href: SECTION_HREF.settings }, { label: LABELS.usage! }];

  const crumbs: Crumb[] = [];
  segments.forEach((segment, index) => {
    const known = LABELS[segment];
    // Opaque ids (a bid, a document) have no readable name here: the page sets it with <BreadcrumbTrail>.
    const label = known ?? (/^[a-z][a-z-]*$/.test(segment) ? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ") : "Details");
    const isLast = index === segments.length - 1;
    crumbs.push({ label, href: isLast ? undefined : (SECTION_HREF[segment] ?? `/app/${segments.slice(0, index + 1).join("/")}`) });
  });
  return crumbs;
}

const TrailContext = createContext<{ trail: Crumb[] | null; setTrail: (trail: Crumb[] | null) => void } | null>(null);

/** Holds a trail set by the current page. Wraps the app shell. */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[] | null>(null);
  const value = useMemo(() => ({ trail, setTrail }), [trail]);
  return <TrailContext.Provider value={value}>{children}</TrailContext.Provider>;
}

/**
 * Lets a page name its own place in the top bar, for routes whose segments are ids:
 *
 *   <BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: bid.title }]} />
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

/** The breadcrumb in the top bar: the page's own trail if it set one, otherwise derived from the URL. */
export function AppBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const context = useContext(TrailContext);
  const crumbs = context?.trail ?? fromPath(pathname);

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem className={isLast ? "min-w-0" : "shrink-0"}>
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
  );
}
