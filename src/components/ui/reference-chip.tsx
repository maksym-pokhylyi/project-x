import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Reference chip: where a quoted sentence comes from — file, page and clause in mono 12 on
 * paper with a hairline edge ("Vol 2 Specification.pdf · p. 31 · §7.4.2"). It is the product's
 * citation, so it is always visible next to the quote, never tucked into a tooltip.
 *
 * With `href` it is a link that opens the source at that page; without, a label.
 * A long file name is shortened with an ellipsis; the page and clause never are.
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
  className?: string
}

function ReferenceChip({ file, page, clause, href, owner, className }: ReferenceChipProps) {
  const content = (
    <>
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
    "type-ref inline-flex max-w-full items-center gap-1.5 rounded-chip border border-line bg-paper px-2 py-[0.1875rem] text-ink",
    href && "transition-colors duration-150 hover:border-line-strong hover:text-brand",
    className
  )

  if (href) {
    return (
      <a data-slot="reference-chip" href={href} className={classes}>
        {content}
      </a>
    )
  }
  return (
    <span data-slot="reference-chip" className={classes}>
      {content}
    </span>
  )
}

export { ReferenceChip }
