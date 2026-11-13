import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Reference chip: where a quoted sentence comes from — file, page and clause in mono 12 on
 * paper with a hairline edge ("Vol 2 Specification.pdf · p. 31 · §7.4.2"). It is the product's
 * citation, so it is always visible next to the quote, never tucked into a tooltip.
 *
 * With `href` it is a link that opens the source at that page; without, a label.
 * A long file name is shortened with an ellipsis; the page and clause never are.
 *
 * `state` adds what our own check found for the quote, as a mark whose SHAPE differs as well
 * as its colour: verified = green tick, check = amber dot ("read it yourself"), unverified =
 * hollow dot. A quote that could not be found never looks verified. `ReferenceStateMark` is
 * the same mark on its own, for a legend.
 *
 * `surface` is the ground the chip sits on: `paper` (default) on a white card, `white` on
 * paper or on a tint (the page ground, a verdict panel).
 *
 * `ReferenceChipButton` is the chip as a button — the trigger of the popover that shows the
 * quote. `quiet` drops the box: an underlined reference for fact cards and side lists.
 */
type ReferenceChipProps = {
  /** File name as the buyer sent it. */
  file: React.ReactNode
  /** Page label, without "p." — e.g. "31", or a sheet name in quotes for a spreadsheet. */
  page?: React.ReactNode
  /** Clause or question reference, e.g. "§7.4.2" or "Q2". */
  clause?: React.ReactNode
  /** Opens the source at the page. */
  href?: string
  /** Prefix for a reference to the supplier's own document: "Yours". */
  owner?: string
  /** What our own check found for the quote (see the header). */
  state?: ReferenceState
  /** Without the box: an underlined reference with the mark after it. */
  quiet?: boolean
  /** The ground the chip sits on decides its fill: `white` on paper and tints. */
  surface?: "paper" | "white"
  className?: string
}

type ReferenceState = "verified" | "check" | "unverified"

const stateWords: Record<ReferenceState, string> = { verified: "Verified", check: "Check", unverified: "Unverified" }

/** Tick = verified, amber dot = check, hollow dot = unverified. */
function ReferenceStateMark({ state, className }: { state: ReferenceState; className?: string }) {
  if (state === "verified") {
    return (
      <svg viewBox="0 0 12 12" aria-hidden data-state={state} className={cn("size-3 shrink-0 fill-none stroke-brand stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]", className)}>
        <path d="M2 6.5l2.6 2.6L10 3.4" />
      </svg>
    )
  }
  return (
    <span
      aria-hidden
      data-state={state}
      className={cn("size-[0.4375rem] shrink-0 rounded-full", state === "check" ? "bg-(--color-accent)" : "border-[1.5px] border-ink-2", className)}
    />
  )
}

function chipClasses(quiet: boolean | undefined, interactive: boolean, className?: string, surface: "paper" | "white" = "paper") {
  return cn(
    quiet
      ? "type-ref inline-flex max-w-full items-center gap-1.5 text-ink underline decoration-line-strong decoration-1 underline-offset-[3px]"
      : cn("type-ref inline-flex max-w-full items-center gap-1.5 rounded-chip border border-line px-2 py-[0.1875rem] text-ink", surface === "white" ? "bg-surface" : "bg-paper"),
    interactive && (quiet ? "cursor-pointer transition-colors duration-150 hover:text-brand hover:decoration-brand" : "cursor-pointer transition-colors duration-150 hover:border-line-strong hover:text-brand"),
    className
  )
}

function ReferenceChip({ file, page, clause, href, owner, state, quiet, surface, className }: ReferenceChipProps) {
  const content = <ReferenceContent file={file} page={page} clause={clause} owner={owner} state={state} quiet={quiet} />
  const classes = chipClasses(quiet, Boolean(href), className, surface)
  if (href) {
    return (
      <a data-slot="reference-chip" data-state-kind={state} href={href} className={classes}>
        {content}
      </a>
    )
  }
  return (
    <span data-slot="reference-chip" data-state-kind={state} className={classes}>
      {content}
    </span>
  )
}

/** The chip as a button (a popover trigger): takes every button prop, including `ref`. */
function ReferenceChipButton({
  file,
  page,
  clause,
  owner,
  state,
  quiet,
  surface,
  className,
  ...props
}: Omit<ReferenceChipProps, "href"> & Omit<React.ComponentProps<"button">, "type" | "children">) {
  return (
    <button type="button" data-slot="reference-chip" data-state-kind={state} className={chipClasses(quiet, true, className, surface)} {...props}>
      <ReferenceContent file={file} page={page} clause={clause} owner={owner} state={state} quiet={quiet} />
    </button>
  )
}

function ReferenceContent({ file, page, clause, owner, state, quiet }: Pick<ReferenceChipProps, "file" | "page" | "clause" | "owner" | "state" | "quiet">) {
  return (
    <>
      {state && !quiet ? <ReferenceStateMark state={state} /> : null}
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
      {state && quiet ? <ReferenceStateMark state={state} /> : null}
      {state ? <span className="sr-only">{stateWords[state]}</span> : null}
    </>
  )
}

export { ReferenceChip, ReferenceChipButton, ReferenceStateMark }
export type { ReferenceState }
