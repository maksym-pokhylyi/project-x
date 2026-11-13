import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDate, formatMonth, formatTerm } from "../domain/format";
import { formatMoney } from "../domain/money";
import { reasonChips, type MatchFacts } from "../domain/reasons";
import { placeLabel } from "../domain/regions";
import type { MatchItem } from "../queries/matches";
import type { NoticeCard } from "../queries/shared";
import { Closes, Money, NoticeRef, noticeLabel, NoticeTypeChip, ReasonChips } from "./notice-bits";

/**
 * One tender in a list, as the Radar and Supplier artboards draw it — the same row on the
 * public page, the radar and the first-run guide. The row is NOT a link; its title is.
 *
 * It lays itself out from the width of the list it sits in (container queries), not the
 * screen, so it is right in a full-width radar, a narrower page column and a phone alike:
 *
 *   under 672 px    a card: title (with its rank), buyer, the closing line, "Est. £4.2m ·
 *                   4 years", the reason chips on one scrolling line, then the actions
 *   672–1023 px     rank · title block with value and closing date under it · actions
 *   from 1024 px    rank · title block · Estimated value · Closes · actions, on one line
 *
 * `signal` turns it into an early notice: no closing date, "Expected to be published".
 * No hooks: the interactive list (radar-list.tsx) passes its own `actions`.
 */
export type MatchRowItem = Pick<
  MatchItem,
  | "ocid"
  | "title"
  | "buyerName"
  | "releaseId"
  | "noticeUrl"
  | "stage"
  | "noticeType"
  | "aboveThreshold"
  | "isFramework"
  | "status"
  | "valueAmount"
  | "currency"
  | "deadlineAt"
  | "futureNoticeAt"
  | "engagementDeadlineAt"
  | "contractStart"
  | "contractEnd"
  | "regions"
  | "regionCodes"
  | "regionSource"
  | "facts"
  | "tier"
>;

/**
 * A list of tender rows: separate cards on phones, the rows of ONE card from 768 px (the
 * caller draws that card, so a toolbar or a foot can be rows of it too). Put
 * `tenderListClasses` on the <ol>/<ul> and `tenderListItemClasses` on each <li>.
 */
export const tenderListClasses = "flex flex-col gap-3 md:gap-0";
/* The hairline between rows is the item's own bottom border: `divide-y` on the list would lose to the card border the item resets. */
export const tenderListItemClasses = "@container rounded-card border border-line bg-surface md:rounded-none md:border-0 md:border-b md:bg-transparent md:last:border-b-0";
/** The card that frames such a list from 768 px. */
export const tenderListFrameClasses = "md:rounded-card md:border md:border-line md:bg-surface";

/*
 * Grid placement, spelled out for both breakpoints: an item with only its row fixed would be
 * auto-placed before the others and land in the wrong column.
 */
const WITH_RANK = {
  grid: "@2xl:grid-cols-[1.5rem_minmax(0,1fr)_10rem] @5xl:grid-cols-[1.5rem_minmax(0,1fr)_10.625rem_11.25rem_10rem]",
  main: "@2xl:col-start-2 @2xl:row-start-1",
  facts: "@2xl:col-start-2 @2xl:row-start-2",
  value: "@5xl:col-start-3 @5xl:row-start-1",
  date: "@5xl:col-start-4 @5xl:row-start-1",
  actions: "@2xl:col-start-3 @5xl:col-start-5",
} as const;
const WITHOUT_RANK = {
  grid: "@2xl:grid-cols-[minmax(0,1fr)_10rem] @5xl:grid-cols-[minmax(0,1fr)_10.625rem_11.25rem_10rem]",
  main: "@2xl:col-start-1 @2xl:row-start-1",
  facts: "@2xl:col-start-1 @2xl:row-start-2",
  value: "@5xl:col-start-2 @5xl:row-start-1",
  date: "@5xl:col-start-3 @5xl:row-start-1",
  actions: "@2xl:col-start-2 @5xl:col-start-4",
} as const;

/** No rank and a narrow actions column (one button and one link): the public supplier page, as Supplier-1440 draws it. */
const WITHOUT_RANK_COMPACT = {
  ...WITHOUT_RANK,
  grid: "@2xl:grid-cols-[minmax(0,1fr)_8.5rem] @5xl:grid-cols-[minmax(0,1fr)_10.625rem_11.25rem_8.5rem]",
} as const;

const NO_FACTS: MatchFacts = { wins: 0, buyerWins: 0, newBuyer: false, sameWorkWins: 0, relatedWorkWins: 0, trade: null, keyword: null, buyerContracts: [], sameWorkLabels: [] };

/** A notice that is listed for its own sake (a saved tender, a buyer's open tenders), not as a match: a row with no reasons but its place. */
export function plainRow(card: NoticeCard): MatchRowItem {
  return { ...card, facts: NO_FACTS, tier: "strong" };
}

/** "4 years", "9 months" — the planned length of the contract, when the notice states both dates. */
function termOf(item: Pick<MatchRowItem, "contractStart" | "contractEnd">): string | null {
  return formatTerm(item.contractStart, item.contractEnd);
}

/** Where the work is, as a chip: delivery places when the notice gives them; the buyer's own region is said to be that. */
export function placeOf(item: Pick<MatchRowItem, "regions" | "regionCodes" | "regionSource">): { label: string | null; note?: string } {
  const label = placeLabel(item.regionCodes, item.regions);
  return { label, note: label && item.regionSource === "buyer" ? "the buyer's address; the notice gives no place of delivery" : undefined };
}

export function MatchRow({
  item,
  now,
  href,
  actions,
  rank,
  signal = false,
  typeAs = "chip",
  showWider = false,
  chips: chipsLayout = "scroll",
  compactActions = false,
  refAsLink = true,
  className,
}: {
  item: MatchRowItem;
  now: Date;
  /** The tender page the title links to. */
  href: string;
  /** The actions column: buttons and links of the screen the row sits on. */
  actions: ReactNode;
  rank?: number;
  signal?: boolean;
  /** The kind of notice as an info chip (lists in the app) or as plain muted words (the public page). */
  typeAs?: "chip" | "text";
  /** Mark a wider match with its chip (lists that mix both tiers). */
  showWider?: boolean;
  /** The reason chips inside a phone card: one scrolling line (the radar) or wrapped (the public page, where the reasons are the pitch). */
  chips?: "scroll" | "wrap";
  /** The actions are one button over one small link: a 136 px column with the two set close (rows without a rank only). */
  compactActions?: boolean;
  /** The notice number links to the notice (default). Pass false where the row's own actions carry "Original notice". */
  refAsLink?: boolean;
  className?: string;
}) {
  const term = termOf(item);
  const place = placeOf(item);
  const chips = reasonChips(item.facts);
  const money = formatMoney(item.valueAmount, item.currency);
  const expected = formatMonth(item.futureNoticeAt);
  const engagement = signal && item.engagementDeadlineAt && Date.parse(item.engagementDeadlineAt) > now.getTime() ? formatDate(item.engagementDeadlineAt) : null;
  const cell = rank !== undefined ? WITH_RANK : compactActions ? WITHOUT_RANK_COMPACT : WITHOUT_RANK;

  return (
    <article
      data-testid="tender-card"
      data-ocid={item.ocid}
      data-tier={item.tier}
      className={cn("grid gap-x-6 px-4 pt-3.5 pb-4 @2xl:gap-y-3 @2xl:px-6 @2xl:py-5", cell.grid, className)}
    >
      {rank !== undefined ? (
        <span aria-hidden className="hidden pt-[3px] font-mono text-13 font-medium text-ink-2 @2xl:col-start-1 @2xl:row-start-1 @2xl:block">
          {rank}
        </span>
      ) : null}

      <div className={cn("flex min-w-0 flex-col @2xl:gap-1", cell.main)}>
        <h3 className="font-sans text-base leading-snug font-semibold text-ink [overflow-wrap:anywhere] @2xl:text-17">
          {rank !== undefined ? (
            <span className="mr-2 font-mono text-13 font-normal text-ink-2 @2xl:sr-only">
              <span className="sr-only">Match </span>
              {rank}
              <span className="sr-only">: </span>
            </span>
          ) : null}
          <Link href={href} className="link-quiet rounded-sm">
            {item.title}
          </Link>
        </h3>
        <p className={cn("mt-1 flex flex-wrap items-center gap-y-0.5 text-sm text-ink @2xl:mt-0", typeAs === "chip" ? "gap-x-2" : "gap-x-1")}>
          <span className="[overflow-wrap:anywhere]">{item.buyerName ?? "Buyer not named in the notice"}</span>
          {/* The kind of notice and its number: beside the buyer from 672 px; in a phone card only for an early signal, where the kind is the news. */}
          <span className={cn("items-center @2xl:inline-flex", signal ? "inline-flex basis-full flex-wrap gap-y-1 pt-0.5 @2xl:basis-auto @2xl:pt-0" : "hidden", typeAs === "chip" ? "gap-x-2" : "gap-x-1.5")}>
            {typeAs === "chip" ? (
              <NoticeTypeChip notice={item} />
            ) : (
              <span className="text-ink-2">
                {/* The dot joins it to the buyer on one line; alone on a line of a phone card it has nothing to join. */}
                <span className="@max-2xl:hidden">· </span>
                {noticeLabel(item)}
              </span>
            )}
            <NoticeRef id={item.releaseId} href={refAsLink ? item.noticeUrl : null} />
          </span>
        </p>
        {engagement ? <p className="hidden text-13 text-ink-2 @2xl:block">Market engagement closes {engagement}</p> : null}

        {/* Phone card: the date and the money as two lines. */}
        <div className="mt-2 flex flex-col gap-1 @2xl:hidden">
          {signal ? (
            <p className="text-sm text-ink">
              <span className="text-ink-2">Expected to be published </span>
              <span className="font-semibold">{expected ?? "date not given"}</span>
            </p>
          ) : (
            <Closes deadline={item.deadlineAt} now={now} form="line" />
          )}
          <p className="text-13 text-ink-2">
            {money ? (
              <>
                Est. <Money amount={item.valueAmount} currency={item.currency} />
              </>
            ) : (
              "Value not published"
            )}
            {term ? ` · ${term}` : null}
          </p>
          {engagement ? <p className="text-13 text-ink-2">Market engagement closes {engagement}</p> : null}
        </div>

        <ReasonChips
          reasons={chips}
          place={place.label}
          placeNote={place.note}
          wider={showWider && item.tier === "wider"}
          scroll={chipsLayout === "scroll"}
          className="mt-2.5 @2xl:mt-0 @2xl:pt-1.5"
        />
      </div>

      {/* From 672 px: value and date as two small blocks — under the title, then as columns. */}
      <div className={cn("hidden gap-x-6 @2xl:flex @5xl:contents", cell.facts)}>
        <div className={cn("flex w-[10.625rem] shrink-0 flex-col gap-0.5 @5xl:w-auto", cell.value)}>
          <span className="text-xs text-ink-2">Estimated value</span>
          <Money amount={item.valueAmount} currency={item.currency} className={cn(money ? "text-17 leading-6 font-semibold text-ink" : "text-sm")} />
          {term ? <span className="text-13 text-ink-2">{term}</span> : null}
        </div>
        {signal ? (
          <div className={cn("flex flex-col gap-0.5", cell.date)}>
            <span className="text-xs text-ink-2">Expected to be published</span>
            <span className={cn(expected ? "text-17 leading-6 font-semibold text-ink tabular-nums" : "text-sm text-ink-2")}>{expected ?? "Date not given"}</span>
          </div>
        ) : (
          <Closes deadline={item.deadlineAt} now={now} form="block" className={cell.date} />
        )}
      </div>

      <div
        className={cn(
          "mt-3 flex items-center gap-2 @2xl:row-span-2 @2xl:row-start-1 @2xl:mt-0 @2xl:flex-col @2xl:items-stretch @5xl:row-span-1",
          compactActions ? "@2xl:gap-0.5" : "@2xl:gap-1.5",
          cell.actions,
        )}
        data-testid="tender-actions"
      >
        {actions}
      </div>
    </article>
  );
}
