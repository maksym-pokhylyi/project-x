import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { cn } from "@/lib/utils";

/*
 * The hero picture: a supplier page as a visitor would find it, drawn in HTML to the
 * designer's artboard. Fictional sample data. It is exposed to assistive technology as one
 * described image, so nothing inside is focusable or read out line by line.
 */

const stats = [
  { value: "14", label: "public contracts won since 2021", short: "contracts won" },
  { value: "£6.4m", label: "total awarded value", short: "awarded" },
  { value: "9", label: "public buyers", short: "public buyers" },
] as const;

const tenders = [
  {
    title: "Planned and responsive maintenance of corporate buildings 2027–2031",
    buyer: "Calderbrook Metropolitan Borough Council",
    buyerShort: "Calderbrook MBC",
    value: "est. £4.2m",
    closes: "Closes 27 Nov 2026",
    left: "14 days left",
  },
  {
    title: "Void property refurbishment, Lots 1–3",
    buyer: "Wharfedale & Aire Homes",
    buyerShort: "Wharfedale & Aire Homes",
    value: "est. £2.6m",
    closes: "Closes 3 Dec 2026",
    left: "20 days left",
  },
  {
    title: "Fire stopping works to six residential blocks",
    buyer: "Harrowmere Borough Council",
    buyerShort: "Harrowmere BC",
    value: "est. £780,000",
    closes: "Closes 9 Dec 2026",
    left: "26 days left",
  },
] as const;

const rivals = [
  {
    title: "Responsive repairs, Lot 1 (West)",
    meta: "Held by Greaves Hollin Contractors Ltd · Wharfedale & Aire Homes",
    ends: "Ends 31 Mar 2027",
    note: "no extension left",
  },
  {
    title: "Schools reactive maintenance",
    meta: "Held by Northfold Property Maintenance Ltd · Calderbrook MBC",
    ends: "Ends 31 Jul 2027",
    note: "one 12-month extension",
  },
] as const;

export function SupplierPreview({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="Sample supplier page for Aldermoor & Pike Building Services Ltd: 14 public contracts won since 2021, £6.4m total awarded value, 9 public buyers; three open tenders like its past work with their deadlines, and two rival contracts ending soon."
      className={cn("overflow-hidden rounded-card border border-line bg-surface shadow-float", className)}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-paper-deep px-5 py-2.5 font-mono text-xs leading-[1.125rem] text-ink-2">
        <span className="truncate">bidfolio.co.uk/s/aldermoor-pike</span>
        <span className="hidden shrink-0 sm:inline">Updated 13 Nov 2026</span>
      </div>

      <div className="flex flex-col gap-3.5 px-5 pt-[1.125rem] pb-1 sm:gap-[1.125rem] sm:px-6 sm:pt-[1.375rem] sm:pb-2">
        <div>
          <p className="font-display text-[1.375rem] leading-[1.15] font-semibold text-ink sm:text-[1.625rem]">Aldermoor &amp; Pike Building Services Ltd</p>
          <p className="mt-1.5 text-13 text-ink-2">
            Wakefield<span className="hidden sm:inline">, West Yorkshire</span> · Building repairs and refurbishment
          </p>
        </div>

        <div className="grid grid-cols-3 border-y border-line">
          {stats.map((stat, index) => (
            <div key={stat.label} className={cn("py-3", index > 0 && "border-l border-line pl-3 sm:pl-4")}>
              <p className="type-figure text-2xl leading-[1.15] text-ink sm:text-[1.75rem]">{stat.value}</p>
              <p className="mt-0.5 pr-1 text-xs leading-4 text-ink-2 sm:pr-0">
                <span className="sm:hidden">{stat.short}</span>
                <span className="hidden sm:inline">{stat.label}</span>
              </p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3 pb-1.5">
            <p className="text-13 font-semibold text-ink">Open tenders like your past work</p>
            <p className="shrink-0 text-xs text-ink-2">3 open</p>
          </div>
          {tenders.map((tender, index) => (
            <div key={tender.title} className={cn("border-t border-line py-2.5 sm:flex sm:items-start sm:justify-between sm:gap-4", index === 2 && "hidden sm:flex")}>
              <div className="min-w-0">
                <p className="text-sm leading-[1.35] font-semibold text-ink">{tender.title}</p>
                <p className="mt-0.5 text-xs leading-[1.125rem] text-ink-2">
                  <span className="sm:hidden">{tender.buyerShort}</span>
                  <span className="hidden sm:inline">{tender.buyer}</span> · {tender.value}
                </p>
              </div>
              <DeadlineMarker size="sm" left={tender.left} className="mt-1.5 sm:mt-0 sm:shrink-0 sm:flex-col sm:flex-nowrap sm:items-end sm:gap-y-1">
                {tender.closes}
              </DeadlineMarker>
            </div>
          ))}
        </div>

        <div className="hidden sm:block">
          <div className="flex items-baseline justify-between gap-3 pb-1.5">
            <p className="text-13 font-semibold text-ink">Rival contracts ending soon</p>
            <p className="shrink-0 text-xs text-ink-2">likely to be re-tendered</p>
          </div>
          {rivals.map((rival) => (
            <div key={rival.title} className="flex items-start justify-between gap-4 border-t border-line py-2.5">
              <div className="min-w-0">
                <p className="text-sm leading-[1.35] font-semibold text-ink">{rival.title}</p>
                <p className="mt-0.5 text-xs leading-[1.125rem] text-ink-2">{rival.meta}</p>
              </div>
              <p className="shrink-0 text-right text-13 leading-[1.125rem] font-medium whitespace-nowrap text-ink tabular-nums">
                {rival.ends}
                <span className="mt-0.5 block text-xs font-normal text-ink-2">{rival.note}</span>
              </p>
            </div>
          ))}
        </div>

        <p className="-mt-3.5 border-t border-line pt-2.5 pb-3 text-13 text-ink-2 sm:hidden">Then: rival contracts ending soon, and buyers in your trade.</p>
      </div>
    </figure>
  );
}
