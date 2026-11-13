import { Bookmark } from "lucide-react";
import { SampleButton, SampleDeadline, SampleMatchReason, SampleNotice, SampleStat, VisualFrame } from "./parts";

/**
 * Miniature of a public supplier page: who the company is, what the public record says it has
 * won, open tenders like those wins, and a competitor contract that ends soon.
 */
export function SupplierPageVisual({ elevated = false, className }: { elevated?: boolean; className?: string }) {
  return (
    <VisualFrame
      elevated={elevated}
      className={className}
      title="bidfolio.co.uk/suppliers/harlow-finch-facilities"
      label="Sample supplier page for Harlow & Finch Facilities Ltd: 14 contracts won, 3.2 million pounds of published award value, 6 public buyers. Two open tenders like the ones it has won, with closing dates, and one competitor contract ending on 31 March 2027."
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-13 text-ink-2">Cleaning and facilities management · Leeds</p>
            <p className="font-display text-xl leading-7 font-semibold text-ink">Harlow &amp; Finch Facilities Ltd</p>
          </div>
          <SampleButton variant="primary">Claim this page</SampleButton>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-card border border-line bg-paper px-4 py-3">
          <SampleStat value="14" label="Contracts won" context="Since 2021" />
          <SampleStat value="£3.2m" label="Award value" context="As published" />
          <SampleStat value="6" label="Public buyers" context="4 councils" />
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Open tenders like the ones you&apos;ve won</p>
          <p className="text-xs text-ink-2 tabular-nums">2 of 7</p>
        </div>
        <ul className="mt-2 space-y-2">
          <li className="rounded-card border border-line p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <SampleNotice kind="Tender" />
              <SampleDeadline tone="soon">Closes in 9 days · 22 Nov 2026, 12:00</SampleDeadline>
            </div>
            <p className="mt-1.5 text-sm leading-5 font-medium text-ink underline decoration-ink/25 underline-offset-[0.2em]">
              Cleaning and caretaking services for civic buildings 2027–2030
            </p>
            <p className="mt-0.5 text-13 text-ink-2 tabular-nums">Calderbrook Borough Council · £1.2m · North West</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <SampleMatchReason>You have cleaned council offices for this buyer since 2023.</SampleMatchReason>
              <span className="hidden shrink-0 items-center gap-1 text-13 text-ink-2 sm:inline-flex">
                <Bookmark aria-hidden className="size-3.5" /> Save
              </span>
            </div>
          </li>
          <li className="rounded-card border border-line p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <SampleNotice kind="Framework" />
              <SampleDeadline tone="neutral">Closes in 21 days · 4 Dec 2026, 17:00</SampleDeadline>
            </div>
            <p className="mt-1.5 text-sm leading-5 font-medium text-ink underline decoration-ink/25 underline-offset-[0.2em]">Window cleaning framework, Lot 2: schools</p>
            <p className="mt-0.5 text-13 text-ink-2 tabular-nums">Northmere County Council · £180k · Yorkshire and the Humber</p>
          </li>
        </ul>

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Contracts ending soon in your trade</p>
          <p className="text-xs text-ink-2 tabular-nums">1 of 5</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border border-line p-3">
          <div className="min-w-0">
            <p className="text-sm leading-5 font-medium text-ink">Cleaning of leisure centres and libraries</p>
            <p className="mt-0.5 text-13 text-ink-2 tabular-nums">Wexcombe District Council · held by Brightline Support Services Ltd · £640k</p>
          </div>
          <SampleDeadline tone="neutral">Ends 31 Mar 2027</SampleDeadline>
        </div>
      </div>
    </VisualFrame>
  );
}
