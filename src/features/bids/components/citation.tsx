"use client";

import { ExternalLink, FileSearch, SearchCheck, X } from "lucide-react";
import { Popover } from "radix-ui";
import { describeLoc } from "@/features/bids/locations";
import type { Citation } from "@/features/bids/types";
import { cn } from "@/lib/utils";

/**
 * CitationMark + CitationPopover: the product's core promise in one control. A small
 * reference such as [ITT p.14] opens the verbatim quote with its file and page and a link
 * that opens the stored source at that page. A citation whose quote our own check could
 * not find in the documents gets a hollow marker and the words "Verify in documents" —
 * never the same look as a verified one.
 */

export type SourceLinks =
  /** Inside the app: files are served to workspace members by /api/bids/<bid>/files/<file>. */
  | { kind: "app"; bidId: string }
  /** Public sample: link to where the buyer published each document. */
  | { kind: "public"; urls: Record<string, string> }
  | { kind: "none" };

export function shortFileLabel(fileName: string): string {
  const base = (fileName.split("/").pop() ?? fileName).replace(/\.[A-Za-z0-9]{1,8}$/, "");
  const cleaned = base
    .replace(/^\d+[\s_.-]+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ");
  let label = "";
  for (const word of words) {
    if ((label + " " + word).trim().length > 22) break;
    label = (label + " " + word).trim();
  }
  return label || cleaned.slice(0, 22) || "File";
}

export function shortLoc(loc: string): string {
  const page = /^p(\d+)$/.exec(loc);
  if (page) return `p.${page[1]}`;
  const section = /^s(\d+)$/.exec(loc);
  if (section) return `§${section[1]}`;
  if (loc.startsWith("sheet:")) return loc.slice(6, 22);
  return loc;
}

function sourceHref(citation: Citation, links: SourceLinks): { href: string; external: boolean } | null {
  if (!citation.fileId) return null;
  if (links.kind === "app") {
    const anchor = citation.page ? `#page=${citation.page}` : "";
    return { href: `/api/bids/${links.bidId}/files/${citation.fileId}${anchor}`, external: false };
  }
  if (links.kind === "public") {
    const url = links.urls[citation.fileId];
    if (!url) return null;
    return { href: citation.page && /\.pdf($|\?)/i.test(url) ? `${url}#page=${citation.page}` : url, external: true };
  }
  return null;
}

const MATCH_NOTE: Partial<Record<Citation["match"], string>> = {
  relocated: "The quote was found on a different page than first cited; the reference shows where it is.",
  relocated_file: "The quote was found in a different file than first cited; the reference shows where it is.",
  fuzzy: "Most of this quote matches the source text (tables and scans rarely match word for word). Read the page.",
};

export function CitationMark({ citation, links, className }: { citation: Citation | null | undefined; links: SourceLinks; className?: string }) {
  if (!citation || (!citation.quote && !citation.fileName)) return null;
  const verified = citation.verified;
  const label = `${shortFileLabel(citation.fileName)}${citation.loc ? ` ${shortLoc(citation.loc)}` : ""}`;
  const source = sourceHref(citation, links);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-testid="citation-mark"
          data-verified={verified ? "true" : "false"}
          aria-label={`${verified ? "Source" : "Unverified source — verify in documents"}: ${citation.fileName}${citation.loc ? `, ${describeLoc(citation.loc)}` : ""}`}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 align-baseline font-mono text-[11px] leading-4 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2",
            verified
              ? "border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"
              : "border-dashed border-warning bg-background text-warning hover:bg-warning/10",
            className,
          )}
        >
          {verified ? <FileSearch aria-hidden className="size-3 shrink-0" /> : <SearchCheck aria-hidden className="size-3 shrink-0" />}
          <span className="truncate">{verified ? `[${label}]` : `[${label} · verify]`}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          data-testid="citation-popover"
          className="z-50 w-[min(26rem,calc(100vw-1.5rem))] rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-[0_12px_32px_rgb(22_26_29_/_0.14)] outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{verified ? "Quoted from the tender documents" : "Verify in documents"}</p>
            <Popover.Close aria-label="Close" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X aria-hidden className="size-3.5" />
            </Popover.Close>
          </div>
          {citation.quote ? (
            <blockquote className="mt-2 max-h-48 overflow-y-auto rounded-md border-l-2 border-primary/40 bg-muted px-3 py-2 text-[13px] leading-5 whitespace-pre-wrap">“{citation.quote}”</blockquote>
          ) : (
            <p className="mt-2 text-muted-foreground">No quote was given for this item.</p>
          )}
          <p className="mt-2 font-mono text-xs break-words text-muted-foreground">
            {citation.fileName}
            {citation.loc ? ` · ${describeLoc(citation.loc)}` : ""}
          </p>
          {!verified ? (
            <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-foreground">
              {citation.issue === "figure_not_in_source"
                ? "We found this quote, but the figure stated for this item is not in the quoted text. Check the level in the document."
                : citation.match === "none"
                  ? "This item came without a quote. Find it in the documents before relying on it."
                  : "We could not find this quote in the text of your documents. Find it in the documents before relying on it."}
            </p>
          ) : MATCH_NOTE[citation.match] ? (
            <p className="mt-2 text-xs text-muted-foreground">{MATCH_NOTE[citation.match]}</p>
          ) : null}
          {source ? (
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink aria-hidden className="size-3.5" />
              {citation.page ? `Open source page ${citation.page}` : source.external ? "Open the published document" : "Open source file"}
            </a>
          ) : null}
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
