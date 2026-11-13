import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { Stat, StatRow } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

/*
 * The hero picture: a supplier page as a visitor would find it, drawn in HTML to the
 * designer's artboard (Landing-1440; the shorter cut of Landing-390 on phones). Fictional
 * sample data. It is exposed to assistive technology as one described image, so nothing
 * inside is focusable or read out line by line.
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

const small = "text-xs leading-[1.5] text-ink-2";
const rowTitle = "text-sm leading-[1.35] font-semibold text-ink";

function BlockHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-1.5">
      <p className="text-13 leading-[1.5] font-semibold text-ink">{title}</p>
      <p className={cn("shrink-0", small)}>{note}</p>
    </div>
  );
}

export function SupplierPreview({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="Sample supplier page for Aldermoor & Pike Building Services Ltd: 14 public contracts won since 2021, £6.4m total awarded value, 9 public buyers; open tenders like its past work with their deadlines, and two rival contracts ending soon."
      className={cn("overflow-hidden rounded-card border border-line bg-surface shadow-float max-sm:shadow-[0_1px_2px_rgb(22_26_29/0.06),0_22px_44px_-28px_rgb(22_26_29/0.3)]", className)}
    >
      <div className="flex flex-wrap justify-between gap-3 border-b border-line bg-paper-deep px-[1.125rem] py-[0.5625rem] font-mono text-xs leading-[1.5] text-ink-2 sm:px-5 sm:py-2.5">
        <span className="truncate">bidfolio.co.uk/s/aldermoor-pike</span>
        <span className="hidden shrink-0 sm:inline">Updated 13 Nov 2026</span>
      </div>

      <div className="flex flex-col gap-4 px-[1.125rem] pt-[1.125rem] pb-1 sm:gap-[1.125rem] sm:px-6 sm:pt-[1.375rem] sm:pb-2">
        <div className="flex flex-col gap-1">
          <p className="font-display text-22 leading-[1.2] font-semibold tracking-[-0.01em] text-ink sm:text-26 sm:leading-[1.15]">Aldermoor &amp; Pike Building Services Ltd</p>
          <p className="text-13 leading-[1.5] text-ink-2">
            Wakefield<span className="hidden sm:inline">, West Yorkshire</span> · Building repairs and refurbishment
          </p>
        </div>

        <StatRow frame="rules" size="sm">
          {stats.map((stat) => (
            <Stat
              key={stat.label}
              value={stat.value}
              label={
                <>
                  <span className="sm:hidden">{stat.short}</span>
                  <span className="hidden sm:inline">{stat.label}</span>
                </>
              }
            />
          ))}
        </StatRow>

        <div className="flex flex-col">
          <BlockHead title="Open tenders like your past work" note="4 open" />
          {tenders.map((tender, index) => (
            <div
              key={tender.title}
              className={cn(
                "flex flex-col gap-0.5 border-t border-line py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                /* Phones show two tenders; the second closes the card. */
                index === 1 && "max-sm:pb-3.5",
                index === 2 && "max-sm:hidden",
              )}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={rowTitle}>{tender.title}</span>
                <span className={small}>
                  <span className="sm:hidden">{tender.buyerShort}</span>
                  <span className="hidden sm:inline">{tender.buyer}</span> · {tender.value}
                </span>
              </div>
              <DeadlineMarker size="sm" left={tender.left} className="max-sm:pt-1 sm:shrink-0 sm:flex-col sm:flex-nowrap sm:items-end sm:gap-y-1">
                {tender.closes}
              </DeadlineMarker>
            </div>
          ))}
        </div>

        <div className="hidden flex-col sm:flex">
          <BlockHead title="Rival contracts ending soon" note="likely to be re-tendered" />
          {rivals.map((rival) => (
            <div key={rival.title} className="flex items-start justify-between gap-4 border-t border-line py-2.5">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={rowTitle}>{rival.title}</span>
                <span className={small}>{rival.meta}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-13 leading-[1.5] font-medium whitespace-nowrap text-ink">{rival.ends}</span>
                <span className={small}>{rival.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
