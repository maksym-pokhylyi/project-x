import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Stat row: two to four figures side by side, each a large serif numeral over a small muted
 * label, divided by hairlines — "14 contracts | £6.4m awarded | 9 public buyers".
 *
 * The rule the row exists for: a label never touches a divider. Every tile carries inline
 * padding on BOTH sides of a divider (16 px on phones, 24–28 px from 768 px); only the two
 * outer edges of a `plain` row sit flush with their container. Tiles share the width
 * equally and may shrink; labels wrap onto a second line instead of pushing a neighbour.
 *
 *   card    the row is its own white card (the head of a page):
 *           2 × 2 on phones and tablets, one row from 1024 px
 *   plain   the row sits inside another card (a company card):
 *           one row at every width, between hairlines on phones;
 *           `leadingDivider` draws a hairline before the first tile too (the row follows a title)
 *
 *   <StatRow label="Summary" stats={[{ value: "14", label: "public contracts won" }, …]} />
 *
 * `phoneLabel` is a shorter label under 768 px. Figures use `type-figure` and tabular numerals.
 * Candidate for src/components/ui (swap for the library's StatRow when it lands).
 */
export type StatTile = { value: ReactNode; label: ReactNode; phoneLabel?: ReactNode };

function Label({ stat }: { stat: StatTile }) {
  if (!stat.phoneLabel) return <>{stat.label}</>;
  return (
    <>
      <span className="md:hidden">{stat.phoneLabel}</span>
      <span className="max-md:hidden">{stat.label}</span>
    </>
  );
}

const CARD_EDGES = ["", "border-l", "border-t lg:border-t-0 lg:border-l", "border-t border-l lg:border-t-0"];
const PLAIN_COLUMNS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-2"];

export function StatRow({
  stats,
  label,
  variant = "card",
  leadingDivider = false,
  className,
}: {
  stats: StatTile[];
  /** Accessible name of the list, e.g. "Summary". */
  label: string;
  variant?: "card" | "plain";
  leadingDivider?: boolean;
  className?: string;
}) {
  const tiles = stats.slice(0, 4);
  if (tiles.length === 0) return null;

  if (variant === "plain") {
    return (
      <dl data-slot="stat-row" data-variant="plain" aria-label={label} className={cn("grid border-y border-line tabular-nums md:flex md:border-y-0", PLAIN_COLUMNS[tiles.length], className)}>
        {tiles.map((stat, index) => (
          <div
            key={index}
            className={cn(
              "flex min-w-0 flex-col-reverse justify-end gap-0.5 border-line py-2.5 md:px-7 md:py-0",
              index > 0 && "border-l pl-3",
              index === 0 && (leadingDivider ? "md:border-l" : "md:pl-0"),
              index === tiles.length - 1 && "md:pr-0",
              index < tiles.length - 1 && "pr-3",
              tiles.length === 4 && index >= 2 && "border-t md:border-t-0",
              tiles.length === 4 && index === 2 && "border-l-0 pl-0 md:border-l md:pl-7",
            )}
          >
            <dt className="text-xs text-ink-2 [overflow-wrap:anywhere] md:text-13">
              <Label stat={stat} />
            </dt>
            <dd className="type-figure text-2xl text-ink [overflow-wrap:anywhere] md:text-3xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl data-slot="stat-row" data-variant="card" aria-label={label} className={cn("grid grid-cols-2 rounded-card border border-line bg-surface tabular-nums lg:flex", className)}>
      {tiles.map((stat, index) => (
        <div
          key={index}
          className={cn(
            "flex min-w-0 flex-col-reverse justify-end gap-0.5 border-line px-4 py-3.5 md:px-6 md:py-4.5 lg:flex-1",
            CARD_EDGES[index],
            tiles.length === 3 && index === 2 && "col-span-2 lg:col-span-1",
          )}
        >
          <dt className="text-xs text-ink-2 [overflow-wrap:anywhere] md:text-13">
            <Label stat={stat} />
          </dt>
          <dd className="type-figure text-3xl text-ink [overflow-wrap:anywhere] lg:text-4xl">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
