import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SampleDeadline, SampleNotice } from "./parts";

function Mini({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <figure role="img" aria-label={label} className={cn("rounded-card border border-line bg-surface p-4", className)}>
      {children}
    </figure>
  );
}

/** A past win and the open tender it matches, with the reason. */
export function MatchMini({ className }: { className?: string }) {
  return (
    <Mini
      className={className}
      label="A contract you won in 2023, cleaning of council offices for Calderbrook Borough Council, matched to an open tender from the same buyer that closes in 9 days."
    >
      <div className="rounded-control bg-surface-sunken p-3">
        <div className="flex items-center justify-between gap-2">
          <SampleNotice kind="Award" />
          <span className="text-xs text-ink-2 tabular-nums">You won · Mar 2023</span>
        </div>
        <p className="mt-1.5 text-sm leading-5 font-medium text-ink">Cleaning of council offices</p>
        <p className="text-13 text-ink-2 tabular-nums">Calderbrook Borough Council · £410k</p>
      </div>
      <div className="flex items-center gap-2 py-2 pl-3">
        <ArrowDown aria-hidden className="size-4 text-ink-3" />
        <span className="text-xs text-ink-2">
          Same buyer · same code <span className="type-ref text-ink-2">CPV 90911200</span>
        </span>
      </div>
      <div className="rounded-control border border-line p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SampleNotice kind="Tender" />
          <SampleDeadline tone="soon">Closes in 9 days</SampleDeadline>
        </div>
        <p className="mt-1.5 text-sm leading-5 font-medium text-ink">Cleaning and caretaking services for civic buildings</p>
        <p className="text-13 text-ink-2 tabular-nums">Calderbrook Borough Council · £1.2m</p>
      </div>
    </Mini>
  );
}

const ending = [
  { title: "Leisure centres and libraries", buyer: "Wexcombe District Council", holder: "Brightline Support Services Ltd", value: "£640k", end: "31 Mar 2027", left: 30 },
  { title: "Schools window cleaning", buyer: "Northmere County Council", holder: "Clearview Property Care Ltd", value: "£180k", end: "30 Jun 2027", left: 52 },
  { title: "Sheltered housing, communal areas", buyer: "Tidewell Housing Association", holder: "Pennine Hygiene Group Ltd", value: "£95k", end: "31 Aug 2027", left: 68 },
];

/** Competitor contracts in your trade, ordered by end date. */
export function EndingSoonMini({ className }: { className?: string }) {
  return (
    <Mini
      className={className}
      label="Three cleaning contracts held by other suppliers that end in 2027: Wexcombe District Council on 31 March, Northmere County Council on 30 June and Tidewell Housing Association on 31 August."
    >
      <ul className="-my-3 divide-y divide-line">
        {ending.map((item) => (
          <li key={item.title} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm leading-5 font-medium text-ink">{item.title}</p>
              <span className="shrink-0 text-13 font-medium text-ink tabular-nums">Ends {item.end}</span>
            </div>
            <p className="truncate text-13 text-ink-2 tabular-nums">
              {item.buyer} · {item.value}
            </p>
            <p className="truncate text-xs text-ink-2">Held by {item.holder}</p>
            <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${100 - item.left}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </Mini>
  );
}

const buyers = [
  { name: "Calderbrook Borough Council", count: 7, typical: "£18k" },
  { name: "Marlow Heath Academy Trust", count: 4, typical: "£9k" },
  { name: "Wexcombe District Council", count: 3, typical: "£27k" },
];

/** Buyers that place work in your trade directly, without a tender. */
export function DirectAwardsMini({ className }: { className?: string }) {
  return (
    <Mini
      className={className}
      label="Buyers that awarded cleaning contracts without a tender in the last 12 months: Calderbrook Borough Council 7 direct awards, Marlow Heath Academy Trust 4, Wexcombe District Council 3."
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <SampleNotice kind="Direct award" />
        <span className="text-xs text-ink-2">Cleaning services · last 12 months</span>
      </div>
      <ul className="mt-3 space-y-3">
        {buyers.map((buyer) => (
          <li key={buyer.name}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm leading-5 font-medium text-ink">{buyer.name}</p>
              <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">{buyer.count}</span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${(buyer.count / 7) * 100}%` }} />
              </span>
              <span className="w-24 shrink-0 text-right text-xs text-ink-2 tabular-nums">typical {buyer.typical}</span>
            </div>
          </li>
        ))}
      </ul>
    </Mini>
  );
}
