import Link from "next/link";
import { cn } from "@/lib/utils";
import { INDEPENDENCE_STATEMENT, OGL_ATTRIBUTION, OGL_URL } from "../config";

/**
 * Footer line for every page that shows public data: the OGL attribution, the
 * independence statement and the correction/removal link. Keep the two sentences verbatim
 * (the licence ends automatically if the attribution is dropped — OGL v3.0).
 */
export function DataAttribution({ pagePath, className }: { pagePath?: string; className?: string }) {
  const requestHref = pagePath ? `/about-the-data?page=${encodeURIComponent(pagePath)}#request` : "/about-the-data#request";
  return (
    <aside aria-label="About this data" className={cn("border-t pt-6 text-xs leading-5 text-muted-foreground", className)} data-testid="data-attribution">
      <p>
        Contract data: Find a Tender service, © Crown copyright.{" "}
        <a href={OGL_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {OGL_ATTRIBUTION}
        </a>
      </p>
      <p className="mt-1">{INDEPENDENCE_STATEMENT}</p>
      <p className="mt-1">
        Figures are as published by each buyer and are not verified by Bidfolio.{" "}
        <Link href="/about-the-data" className="underline underline-offset-2">
          About the data
        </Link>{" "}
        ·{" "}
        <Link href={requestHref} className="underline underline-offset-2" data-testid="correction-link">
          Request a correction or removal
        </Link>
      </p>
    </aside>
  );
}
