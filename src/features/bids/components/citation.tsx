"use client";

import "./bid-theme.css";
import { Check, ExternalLink, X } from "lucide-react";
import { Popover } from "radix-ui";
import { VERIFICATION_LABELS, verificationState, type VerificationState } from "@/features/bids/citation-state";
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
  if (page) return `p. ${page[1]}`;
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


const STATE_HEADING: Record<VerificationState, string> = {
  verified: "Quoted from the tender documents",
  check: "Check this against the page",
  unverified: "Not found in the documents",
};

function stateNote(citation: Citation, state: VerificationState): string | null {
  if (citation.issue === "figure_not_in_source") return "We found this quote, but the figure stated for this item is not in the quoted text. Check the level in the document.";
  if (state === "unverified") {
    return citation.match === "none"
      ? "This item came without a quote. Find it in the documents before relying on it."
      : "We could not find this quote in the text of the documents. Find it in the documents before relying on it.";
  }
  if (citation.match === "fuzzy") return "Most of this quote matches the source text (tables and scans rarely match word for word). Read the page.";
  if (citation.match === "relocated") return "The quote was found on a different page than first cited; the reference shows where it is.";
  if (citation.match === "relocated_file") return "The quote was found in a different file than first cited; the reference shows where it is.";
  return null;
}

/** "Vol 1 Instructions.pdf · p. 4" — the full reference; `short` drops the extension and trims. */
export function citationLabel(citation: Citation, short = false): string {
  const name = citation.fileName.split("/").pop() ?? citation.fileName;
  const file = short ? shortFileLabel(name) : name;
  if (!citation.loc) return file;
  const page = /^p(\d+)$/.exec(citation.loc);
  const section = /^s(\d+)$/.exec(citation.loc);
  const where = page ? `p. ${page[1]}` : section ? `section ${section[1]}` : citation.loc.startsWith("sheet:") ? `sheet “${citation.loc.slice(6)}”` : citation.loc;
  return `${file} · ${where}`;
}

/** Tick = verified, amber dot = check, hollow dot = unverified (shape and colour both differ). */
function StateGlyph({ state }: { state: VerificationState }) {
  if (state === "verified") return <Check aria-hidden className="size-3 shrink-0 text-brand" strokeWidth={2.6} />;
  if (state === "check") return <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-(--accent)" />;
  return <span aria-hidden className="size-[7px] shrink-0 rounded-full border-[1.5px] border-ink-2" />;
}

/** The key to the three marks, shown above any list of cited items. */
export function SourceLegend({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-6 gap-y-1 text-13 text-ink-2", className)} data-testid="source-legend">
      <span className="inline-flex items-center gap-1.5">
        <StateGlyph state="verified" />
        Verified: matches the file word for word
      </span>
      <span className="inline-flex items-center gap-1.5">
        <StateGlyph state="check" />
        Check: read it yourself
      </span>
      <span className="inline-flex items-center gap-1.5">
        <StateGlyph state="unverified" />
        Unverified: could not be matched
      </span>
    </p>
  );
}

/**
 * Source chip + popover: the product's core promise in one control. The reference opens
 * the verbatim quote with its file and page and a link that opens the stored source at
 * that page. `variant="chip"` is the boxed reference under a quoted line; `variant="ref"`
 * is the quiet underlined reference used in fact cards and side lists. Both always carry
 * the verification state — a quote our own check could not find never looks verified.
 */
export function CitationMark({
  citation,
  links,
  className,
  variant = "chip",
  short,
}: {
  citation: Citation | null | undefined;
  links: SourceLinks;
  className?: string;
  variant?: "chip" | "ref";
  short?: boolean;
}) {
  if (!citation || (!citation.quote && !citation.fileName)) return null;
  const state = verificationState(citation);
  const label = citationLabel(citation, short ?? variant === "ref");
  const source = sourceHref(citation, links);
  const note = stateNote(citation, state);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-testid="citation-mark"
          data-verified={citation.verified ? "true" : "false"}
          data-state-kind={state}
          aria-label={`Source, ${VERIFICATION_LABELS[state].toLowerCase()}: ${citation.fileName}${citation.loc ? `, ${describeLoc(citation.loc)}` : ""}`}
          className={cn(variant === "chip" ? "bid-chip" : "bid-ref", className)}
        >
          {variant === "chip" ? <StateGlyph state={state} /> : null}
          <span className={variant === "chip" ? "min-w-0 truncate" : "min-w-0 [overflow-wrap:anywhere]"}>{label}</span>
          {variant === "chip" ? null : <StateGlyph state={state} />}
          <span className="sr-only">{VERIFICATION_LABELS[state]}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          data-testid="citation-popover"
          className="bid-pop z-50 w-[min(27rem,calc(100vw-1.5rem))] p-4 text-sm outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <p className={cn("bid-pill", state === "verified" ? "bid-pill-met" : state === "check" ? "bid-pill-amber" : "bid-pill-danger")}>
              <StateGlyph state={state} />
              {STATE_HEADING[state]}
            </p>
            <Popover.Close aria-label="Close" className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded text-ink-2 hover:bg-paper">
              <X aria-hidden className="size-4" />
            </Popover.Close>
          </div>
          {citation.quote ? (
            <blockquote className="bid-serif mt-3 max-h-56 overflow-y-auto rounded-control bg-paper px-3 py-2.5 text-15 leading-[1.45] whitespace-pre-wrap">“{citation.quote}”</blockquote>
          ) : (
            <p className="mt-3 text-ink-2">No quote was given for this item.</p>
          )}
          <p className="bid-mono mt-2 text-xs break-words text-ink-2">{citationLabel(citation)}</p>
          {note ? <p className={cn("mt-2 text-13", state === "verified" ? "text-ink-2" : "")}>{note}</p> : null}
          {source ? (
            <a href={source.href} target="_blank" rel="noopener noreferrer" className="bid-link mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium">
              <ExternalLink aria-hidden className="size-3.5" />
              {citation.page ? `Open source page ${citation.page}` : source.external ? "Open the published document" : "Open source file"}
            </a>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

