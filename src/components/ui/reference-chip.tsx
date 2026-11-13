import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Reference chip: where a quoted sentence comes from — file, page and clause in mono 12
 * with a hairline edge ("Vol 2 Specification.pdf · p. 31 · §7.4.2"). It is the product's
 * citation, so it is always visible next to the quote, never tucked into a tooltip.
 *
 * Every reference to the buyer's pack carries one of three states (Foundations, "Source
 * reference states"), shown as a small sign before the file name and said in words to
 * assistive technology:
 *
 *   verified     a green tick     the quote matches the file word for word
 *   check        an amber dot     found on the page, but not an exact match: read it yourself
 *   unverified   a muted ring     could not be matched to the file (a scanned page, say)
 *
 * The three signs differ in form, not only in colour. Leave `state` out for a reference
 * that is not a quote (a file in a list, the supplier's own document).
 *
 *   surface   paper (default)  on a white card
 *             white            on paper or on a tint (the page ground, a verdict panel)
 *
 * With `href` it is a link that opens the source at that page; without, a label. A long
 * file name is shortened with an ellipsis; the page and clause never are.
 */
export type ReferenceState = "verified" | "check" | "unverified"

const stateLabel: Record<ReferenceState, string> = { verified: "Verified", check: "Check", unverified: "Unverified" }

function StateSign({ state }: { state: ReferenceState }) {
  return (
    <svg viewBox="0 0 12 12" role="img" aria-label={stateLabel[state]} className="size-3 shrink-0">
      {state === "verified" ? (
        <path d="M2 6.5l2.6 2.6L10 3.5" className="fill-none stroke-brand stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" />
      ) : state === "check" ? (
        <circle cx="6" cy="6" r="3.5" className="fill-accent" />
      ) : (
        <circle cx="6" cy="6" r="3.25" className="fill-none stroke-ink-2 stroke-[1.5]" />
      )}
    </svg>
  )
}

type ReferenceChipProps = {
  /** File name as the buyer sent it. */
  file: React.ReactNode
  /** Page label, without "p." — e.g. "31", or a sheet name in quotes for a spreadsheet. */
  page?: React.ReactNode
  /** Clause or question reference, e.g. "§7.4.2" or "Q2". */
  clause?: React.ReactNode
  /** How well the quote was matched to the file. */
  state?: ReferenceState
  /** The ground the chip sits on decides its fill: `white` on paper and tints. */
  surface?: "paper" | "white"
  /** Opens the source at the page. */
  href?: string
  /** Prefix for a reference to the supplier's own document: "Yours". */
  owner?: string
  className?: string
}

function ReferenceChip({ file, page, clause, state, surface = "paper", href, owner, className }: ReferenceChipProps) {
  const content = (
    <>
      {state ? <StateSign state={state} /> : null}
      {owner ? <span className="shrink-0 text-ink-2">{owner}:</span> : null}
      <span className="min-w-0 truncate">{file}</span>
      {page != null ? (
        <>
          <span aria-hidden className="shrink-0">
            ·
          </span>
          <span className="shrink-0">
            <span aria-hidden>p. </span>
            <span className="sr-only">page </span>
            {page}
          </span>
        </>
      ) : null}
      {clause != null ? (
        <>
          <span aria-hidden className="shrink-0">
            ·
          </span>
          <span className="shrink-0">{clause}</span>
        </>
      ) : null}
    </>
  )
  const classes = cn(
    "type-ref inline-flex max-w-full items-center gap-1.5 rounded-chip border border-line px-2 py-[0.1875rem] text-ink",
    surface === "white" ? "bg-surface" : "bg-paper",
    href && "transition-colors duration-150 hover:border-line-strong hover:text-brand",
    className
  )

  if (href) {
    return (
      <a data-slot="reference-chip" data-state={state} href={href} className={classes}>
        {content}
      </a>
    )
  }
  return (
    <span data-slot="reference-chip" data-state={state} className={classes}>
      {content}
    </span>
  )
}

export { ReferenceChip }
