import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { NavLink } from "@/components/ui/nav-link";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { tabListClasses } from "@/components/ui/tab-classes";
import { TabsCount } from "@/components/ui/tabs";
import { formatPrice, PLANS } from "@/config/plans";
import { cn } from "@/lib/utils";
import { cpvDivisionLabel } from "../domain/cpv";
import { describeClosing, formatDate, formatMonth, pluralise } from "../domain/format";
import { bidCheckHref } from "../domain/links";
import { UK_REGIONS } from "../domain/regions";
import {
  BUYER_SORTS,
  BUYERS_MONTHS,
  CLOSING_WINDOWS,
  ENDING_SOON_MONTHS,
  ENDING_WINDOWS,
  TAB_FILTERS,
  VALUE_BANDS,
  type LockedMatch,
  type MatchList,
  type RadarFilters,
  type RadarList as RadarListData,
  type RadarTab,
  type RadarView,
} from "../radar/view";
import { CompanySearchForm } from "./company-search";
import { MatchRow, plainRow, tenderListClasses, tenderListFrameClasses, tenderListItemClasses } from "./match-row";
import { Closes } from "./notice-bits";
import { AppSourceNote } from "./public-chrome";
import { RadarEditTrigger } from "./radar-edit";
import { RadarFirstRunGuide } from "./radar-first-run";
import { RadarList } from "./radar-list";
import { SaveButton } from "./save-button";
import { BuyersInTrade, EndingContracts } from "./supplier-lists";
import { ActionBand } from "./ui/action-band";
import { AppliedFilters, type AppliedFilter } from "./ui/applied-filters";
import { CategoryChip, CategoryChipList } from "./ui/category-chip";
import { EmptyState } from "./ui/empty-state";
import { KeepCurrentInView } from "./ui/keep-current-in-view";
import { ListCard } from "./ui/list-card";
import { LockedRow } from "./ui/locked-row";
import { MenuFilter, type MenuFilterOption } from "./ui/menu-filter";
import { MetaLine } from "./ui/meta-line";
import { ScrollRow } from "./ui/scroll-row";

/**
 * The Radar, as the Radar artboards draw it: what the workspace's company should look at
 * today. A Server Component: everything on it comes from `loadRadar` (tenant-scoped), the
 * filters are links, and only the row actions and the edit panel run in the browser.
 *
 *   header      meta line · "Radar" · what it matches on (with Edit) · the radars, if several
 *   deadlines   saved tenders with a deadline ahead
 *   tabs        Matches · Ending soon · Buyers · Early signals (· Saved), each a URL
 *   Matches     STRONG matches, soonest deadline first; the Free plan shows its ten best and
 *               counts the rest; wider matches are counted and, on a paid plan, one click away
 */
const RADAR_PRO = PLANS.starter;

type Patch = Partial<Record<"tab" | "profile" | "category" | "region" | "value" | "closing" | "ending" | "sort" | "wider" | "page", string | null>>;

/** Address of the radar with the current tab, radar and filters, changed by `patch` (null removes). Changing anything goes back to page one. */
function radarHref(view: RadarView, patch: Patch = {}): string {
  const tab = (patch.tab ?? view.tab) as RadarTab;
  const offered = TAB_FILTERS[tab];
  const current: Record<string, string | null> = {
    tab,
    profile: view.active && view.sources.length > 1 ? view.active.key : null,
    category: offered.includes("category") ? view.filters.category : null,
    region: offered.includes("region") ? view.filters.region : null,
    value: offered.includes("value") ? view.filters.value : null,
    closing: offered.includes("closing") && view.filters.closing ? String(view.filters.closing) : null,
    ending: offered.includes("ending") && view.filters.ending ? String(view.filters.ending) : null,
    sort: offered.includes("sort") && view.filters.sort !== "awards" ? view.filters.sort : null,
    wider: view.list && "showingWider" in view.list && view.list.showingWider && tab === view.tab ? "1" : null,
    page: null,
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) if (value) params.set(key, value);
  return `/app?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function MatchingOn({ view }: { view: RadarView }) {
  const matching = view.matching;
  if (!matching || !view.edit) return null;
  const trades = matching.trades.length > 0 ? matching.trades.map((trade) => trade.label) : matching.keywords.map((keyword) => `“${keyword}”`);
  const edit = (
    <RadarEditTrigger data={view.edit} className="shrink-0">
      Edit<span className="sr-only"> trades and regions</span>
    </RadarEditTrigger>
  );
  return (
    <div data-testid="matching-on">
      {/* Phones: the sentence and Edit on one line, the chips under it. */}
      <div className="flex min-h-11 items-center justify-between gap-3 md:hidden">
        <p className="text-13 text-ink-2">Matching on your trades and regions</p>
        {edit}
      </div>
      <div className="flex flex-col gap-1.5 pt-0.5 md:hidden">
        {trades.length > 0 ? (
          <ul aria-label="Trades" className="flex flex-wrap gap-1.5">
            {trades.map((label) => (
              <li key={label} className="flex max-w-full">
                <Badge variant="secondary" className="max-w-full shrink">
                  <span className="truncate">{label}</span>
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-13 text-ink">No trades yet: tick yours to sharpen the radar.</p>
        )}
        <ul aria-label="Regions" className="flex flex-wrap gap-1.5">
          {matching.regions.map((label) => (
            <li key={label} className="flex">
              <Badge variant="secondary">{label}</Badge>
            </li>
          ))}
        </ul>
      </div>
      {/* From 768 px: one line of words and chips. */}
      <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-sm md:flex">
        <span className="text-ink-2">Matching on</span>
        {trades.length > 0 ? (
          <CategoryChipList label="Trades">
            {trades.map((label) => (
              <li key={label}>
                <CategoryChip>{label}</CategoryChip>
              </li>
            ))}
          </CategoryChipList>
        ) : (
          <span className="text-ink">no trades yet</span>
        )}
        <span className="text-ink-2">in</span>
        <CategoryChipList label="Regions">
          {matching.regions.map((label) => (
            <li key={label}>
              <CategoryChip>{label}</CategoryChip>
            </li>
          ))}
        </CategoryChipList>
        {edit}
      </div>
    </div>
  );
}

function SourceSwitcher({ view }: { view: RadarView }) {
  if (view.sources.length < 2) return null;
  return (
    <nav aria-label="Your radars" className={cn(tabListClasses, "-mx-5 px-5 md:mx-0 md:px-0")} data-testid="radar-sources">
      <KeepCurrentInView watch={view.active?.key} />
      {view.sources.map((source) => (
        <NavLink key={source.key} variant="tab" href={radarHref(view, { profile: source.key, tab: view.tab })} current={source.key === view.active?.key} className="max-md:text-sm">
          <span className="max-w-[16rem] truncate">{source.name}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function RadarHead({ view }: { view: RadarView }) {
  const updated = formatDate(view.updatedAt);
  return (
    <header className="flex flex-col gap-1.5 md:gap-2">
      <MetaLine parts={["Radar", updated ? `updated ${updated}` : null, <span key="source"><span className="max-md:hidden">notices from </span>Find a Tender</span>]} />
      <h1 className="type-title text-ink">Radar</h1>
      <SourceSwitcher view={view} />
      <MatchingOn view={view} />
    </header>
  );
}

// ---------------------------------------------------------------------------
// Upcoming deadlines
// ---------------------------------------------------------------------------

function DeadlineStrip({ view, now }: { view: RadarView; now: Date }) {
  const items = view.deadlines.slice(0, 3);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="deadlines-h" className="rounded-card border border-line bg-surface" data-testid="deadline-strip">
      <h2 id="deadlines-h" className="px-4 pt-3.5 font-sans text-15 font-semibold text-ink md:px-6 md:pt-4">
        Upcoming deadlines{" "}
        <span className="font-normal text-ink-2">
          ·{" "}
          <Link href={radarHref(view, { tab: "saved" })} className="link-quiet underline decoration-line-strong underline-offset-[3px]">
            {pluralise(view.saved.length, "saved tender")}
          </Link>
        </span>
      </h2>
      <ul className="mt-2.5 flex flex-col divide-y divide-line border-t border-line px-4 md:mt-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(min(18.75rem,100%),1fr))] md:divide-x md:divide-y-0 md:border-t-0 md:px-0">
        {items.map((card) => {
          const closing = describeClosing(card.deadlineAt, now);
          return (
            <li key={card.ocid} className="flex min-w-0 flex-col gap-1 py-2.5 md:px-6 md:pt-2.5 md:pb-4">
              <DeadlineMarker size="lg" left={closing.left ?? undefined} className="max-md:text-sm">
                <time dateTime={closing.iso ?? undefined}>{closing.dateTime}</time>
              </DeadlineMarker>
              <Link href={`/app/tenders/${card.ocid}`} className="link text-sm leading-[1.4] font-medium [overflow-wrap:anywhere] md:font-semibold">
                {card.title}
              </Link>
              {card.buyerName ? <span className="text-13 text-ink-2 max-md:hidden">{card.buyerName}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function RadarTabs({ view }: { view: RadarView }) {
  const counts = view.counts;
  const tabs: Array<{ key: RadarTab; label: string; count: number | null }> = [
    { key: "matches", label: "Matches", count: counts?.matches ?? null },
    { key: "ending", label: "Ending soon", count: counts?.ending ?? null },
    { key: "buyers", label: "Buyers", count: counts?.buyers ?? null },
    { key: "signals", label: "Early signals", count: counts?.signals ?? null },
  ];
  if (view.saved.length > 0 || view.tab === "saved") tabs.push({ key: "saved", label: "Saved", count: view.saved.length });
  return (
    <div className="relative">
      <nav aria-label="Radar sections" className={cn(tabListClasses, "-mx-5 gap-x-6 px-5 md:mx-0 md:px-0")} data-testid="radar-tabs">
        <KeepCurrentInView watch={view.tab} />
        {tabs.map((tab) => (
          <NavLink key={tab.key} variant="tab" href={radarHref(view, { tab: tab.key, wider: null })} current={view.tab === tab.key} scroll={false} className="max-md:gap-1.5 max-md:text-sm" data-testid={`tab-${tab.key}`}>
            {tab.label}
            {tab.count !== null ? <TabsCount>{tab.count}</TabsCount> : null}
          </NavLink>
        ))}
      </nav>
      <span aria-hidden className="pointer-events-none absolute top-0 -right-5 bottom-px w-8 bg-gradient-to-l from-paper to-transparent md:hidden" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function filterMenus(view: RadarView): Array<{ key: keyof RadarFilters; label: string; value?: string; options: MenuFilterOption[] }> {
  const { filters } = view;
  const offered = TAB_FILTERS[view.tab];
  const menus: Array<{ key: keyof RadarFilters; label: string; value?: string; options: MenuFilterOption[] }> = [];
  if (offered.includes("category") && view.categories.length > 1) {
    menus.push({
      key: "category",
      label: "Category",
      options: [
        { label: "Any category", href: radarHref(view, { category: null }), selected: filters.category === null },
        ...view.categories.map((category) => ({ label: category.label, href: radarHref(view, { category: category.code }), selected: filters.category === category.code })),
      ],
    });
  }
  if (offered.includes("region")) {
    menus.push({
      key: "region",
      label: "Region",
      options: [
        { label: "Any region", href: radarHref(view, { region: null }), selected: filters.region === null },
        ...Object.entries(UK_REGIONS).map(([code, label]) => ({ label, href: radarHref(view, { region: code }), selected: filters.region === code })),
      ],
    });
  }
  if (offered.includes("value")) {
    menus.push({
      key: "value",
      label: "Value",
      options: [
        { label: "Any value", href: radarHref(view, { value: null }), selected: filters.value === null },
        ...Object.entries(VALUE_BANDS).map(([key, band]) => ({ label: band.label, href: radarHref(view, { value: key }), selected: filters.value === key })),
      ],
    });
  }
  if (offered.includes("closing")) {
    menus.push({
      key: "closing",
      label: "Closing within",
      options: [
        { label: "Any time", href: radarHref(view, { closing: null }), selected: filters.closing === null },
        ...CLOSING_WINDOWS.map((days) => ({ label: `${days} days`, href: radarHref(view, { closing: String(days) }), selected: filters.closing === days })),
      ],
    });
  }
  if (offered.includes("ending")) {
    menus.push({
      key: "ending",
      label: "Ending within",
      options: [
        { label: `${ENDING_SOON_MONTHS} months`, href: radarHref(view, { ending: null }), selected: filters.ending === null },
        ...ENDING_WINDOWS.filter((months) => months < ENDING_SOON_MONTHS).map((months) => ({ label: `${months} months`, href: radarHref(view, { ending: String(months) }), selected: filters.ending === months })),
      ],
    });
  }
  if (offered.includes("sort")) {
    menus.push({
      key: "sort",
      label: "Sort",
      value: `Sorted by ${BUYER_SORTS[filters.sort]}`,
      options: Object.entries(BUYER_SORTS).map(([key, label]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), href: radarHref(view, { sort: key === "awards" ? null : key }), selected: filters.sort === key })),
    });
  }
  return menus;
}

function appliedFilters(view: RadarView): AppliedFilter[] {
  const { filters } = view;
  const items: AppliedFilter[] = [];
  if (filters.category) items.push({ label: "Category", value: cpvDivisionLabel(filters.category), href: radarHref(view, { category: null }) });
  if (filters.region) items.push({ label: "Region", value: UK_REGIONS[filters.region] ?? filters.region, href: radarHref(view, { region: null }) });
  if (filters.value) items.push({ label: "Value", value: VALUE_BANDS[filters.value]?.label ?? filters.value, href: radarHref(view, { value: null }) });
  if (filters.closing) items.push({ label: "Closing within", value: `${filters.closing} days`, href: radarHref(view, { closing: null }) });
  if (filters.ending) items.push({ label: "Ending within", value: `${filters.ending} months`, href: radarHref(view, { ending: null }) });
  return items;
}

/** The toolbar of a list: menu buttons, the filters in force, and how the list is sorted. The first row of the list's card from 768 px. */
function FilterBar({
  view,
  groupLabel,
  sorted,
  phone = "scroll",
}: {
  view: RadarView;
  groupLabel: string;
  sorted?: string;
  /** On a phone the buttons sit on one scrolling line (several short filters) or fill the width and wrap (a filter and a long sort). */
  phone?: "scroll" | "fill";
}) {
  const menus = filterMenus(view);
  const applied = appliedFilters(view);
  if (menus.length === 0 && !sorted) return null;
  return (
    <div className="flex flex-col gap-x-3 gap-y-1 md:flex-row md:flex-wrap md:items-center md:gap-y-2 md:border-b md:border-line md:px-6 md:py-3" data-testid="filter-bar">
      {menus.length > 0 && phone === "scroll" ? (
        <ScrollRow role="group" aria-label={groupLabel} bleed="5" wrapFrom="md" fadeClassName="from-paper" className="gap-2">
          {menus.map((menu) => (
            <MenuFilter key={menu.key} label={menu.label} value={menu.value} options={menu.options} />
          ))}
        </ScrollRow>
      ) : null}
      {menus.length > 0 && phone === "fill" ? (
        <div role="group" aria-label={groupLabel} className="flex flex-wrap gap-2">
          {menus.map((menu) => (
            <MenuFilter key={menu.key} label={menu.label} value={menu.value} options={menu.options} className="max-md:flex-auto max-md:justify-between" />
          ))}
        </div>
      ) : null}
      <AppliedFilters items={applied} clearHref={radarHref(view, { category: null, region: null, value: null, closing: null, ending: null })} />
      {sorted ? <p className="text-13 text-ink-2 md:ml-auto md:text-sm">{sorted}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matches and early signals
// ---------------------------------------------------------------------------

function waitingToo(locked: LockedMatch[], lockedTotal: number): string | null {
  const rest = lockedTotal - locked.length;
  const last = locked[locked.length - 1];
  if (rest <= 0 || !last) return null;
  const from = last.rank + 1;
  if (rest === 1) return `Match ${from} is waiting too.`;
  if (rest === 2) return `Matches ${from} and ${from + 1} are waiting too.`;
  return `Matches ${from} to ${from + rest - 1} are waiting too.`;
}

function CapBand({ list, cap }: { list: MatchList; cap: number }) {
  const noun = list.tab === "signals" ? "early signal" : "match";
  const price = RADAR_PRO.prices ? formatPrice(RADAR_PRO.prices.month) : null;
  const wider = list.wider > 0 ? `, with ${pluralise(list.wider, "wider match", "wider matches")} from neighbouring categories and other regions,` : "";
  return (
    <ActionBand
      headingLevel="h2"
      title={`${list.lockedTotal.toLocaleString("en-GB")} more ${list.lockedTotal === 1 ? `${noun} is` : `${noun === "match" ? "matches" : `${noun}s`} are`} waiting`}
      aside={
        price ? (
          <p className="flex items-baseline gap-1.5">
            <span className="type-figure text-3xl leading-none text-ink">{price}</span>
            <span className="text-sm text-ink">a month</span>
          </p>
        ) : undefined
      }
      actions={
        <ButtonLink href="/pricing" className="max-md:w-full" data-testid="upgrade-cta">
          See {RADAR_PRO.name}
        </ButtonLink>
      }
      data-testid="free-cap"
    >
      The free radar shows your top {cap} {list.tab === "signals" ? "early signals" : "matches"}. {RADAR_PRO.name} shows every match{wider} and sends daily alerts.
    </ActionBand>
  );
}

/** The columns of a tender row (match-row.tsx), so a locked row reads as the next row of the list above it. */
const LOCKED_COLUMNS = "@5xl:grid-cols-[1.5rem_minmax(0,1fr)_10.625rem_11.25rem_10rem]";

function LockedList({ list, now }: { list: MatchList; now: Date }) {
  if (list.locked.length === 0) return null;
  const more = waitingToo(list.locked, list.lockedTotal);
  return (
    <ListCard aria-label={`Matches shown with ${RADAR_PRO.name}`} data-testid="locked-matches">
      {list.locked.map((match) => (
        <LockedRow
          key={match.rank}
          as="li"
          label={`Match ${match.rank}`}
          plan={RADAR_PRO.name}
          columnsClassName={LOCKED_COLUMNS}
          chip={
            match.place ? (
              <Badge variant="secondary" className="max-w-full shrink" title={match.place}>
                <span className="truncate">{match.place}</span>
              </Badge>
            ) : undefined
          }
          detail={
            list.tab === "signals" ? (
              match.futureNoticeAt ? (
                <span className="text-sm text-ink-2">Expected {formatMonth(match.futureNoticeAt)}</span>
              ) : undefined
            ) : (
              <Closes deadline={match.deadlineAt} now={now} form="line" withTime={false} withLeft={false} />
            )
          }
        />
      ))}
      {more ? (
        <li className="@container">
          <p className="px-4 py-3 text-13 text-ink-2 @2xl:px-6 @5xl:pl-[4.5rem]">{more}</p>
        </li>
      ) : null}
    </ListCard>
  );
}

function PageLinks({ view, list }: { view: RadarView; list: { page: number; pages: number } }) {
  if (list.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-2 md:px-6" data-testid="radar-pagination">
      <p className="text-sm text-ink-2 tabular-nums">
        Page {list.page} of {list.pages}
      </p>
      <Pagination className="w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href={radarHref(view, { page: list.page > 2 ? String(list.page - 1) : null })} disabled={list.page <= 1} />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href={radarHref(view, { page: String(list.page + 1) })} disabled={list.page >= list.pages} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function MatchesPanel({ view, list, now }: { view: RadarView; list: MatchList; now: Date }) {
  const signals = list.tab === "signals";
  const cap = view.access.matchLimit;
  const nowIso = now.toISOString();
  const saved = [...view.states].filter(([, state]) => state === "saved").map(([ocid]) => ocid);
  const nothingAtAll = list.total === 0 && !view.hasFilters;
  const widerHref = radarHref(view, { wider: list.showingWider ? null : "1" });

  const widerControl =
    list.wider > 0 && cap === null ? (
      <ButtonLink variant="outline" href={widerHref} data-testid="wider-toggle">
        {list.showingWider ? "Hide wider matches" : `Show wider matches (${list.wider.toLocaleString("en-GB")})`}
      </ButtonLink>
    ) : null;
  const widerOnFree =
    list.wider > 0 && cap !== null && list.lockedTotal === 0 ? (
      <p className="text-sm text-ink-2" data-testid="wider-upsell">
        {RADAR_PRO.name} also shows {pluralise(list.wider, "wider match", "wider matches")}: tenders in neighbouring categories or outside your regions.{" "}
        <Link href="/pricing" className="link font-medium">
          See {RADAR_PRO.name}
        </Link>
      </p>
    ) : null;

  if (nothingAtAll && !list.showingWider) {
    const matching = view.matching;
    const tradeCount = matching?.trades.length ?? 0;
    return (
      <section aria-label={signals ? "Early signals" : "Matches"} className="flex flex-col gap-4">
        {signals ? <p className="text-15 text-ink-2">Procurements that buyers have announced but not yet opened. Dates are the buyer’s own estimates and can move.</p> : null}
        <EmptyState
          title={signals ? "No early signals right now" : "No open tenders match right now"}
          note={
            matching
              ? tradeCount > 0
                ? `Matching on ${pluralise(tradeCount, "trade")} and ${matching.regions.length === 1 ? matching.regions[0]!.toLowerCase() === "anywhere in the uk" ? "the whole of the UK" : "1 region" : pluralise(matching.regions.length, "region")}.`
                : "No trades are ticked yet, so only a buyer you have already won from can be a match."
              : undefined
          }
          actions={
            <>
              {view.edit ? (
                <RadarEditTrigger data={view.edit} variant="default" className="max-md:w-full">
                  Edit trades and regions
                </RadarEditTrigger>
              ) : null}
              {widerControl}
              <Link href={radarHref(view, { tab: "ending" })} className="link inline-flex min-h-11 items-center rounded-sm text-15 font-medium">
                See contracts ending soon
              </Link>
            </>
          }
        >
          {signals
            ? "No buyer has announced a procurement in your trades and regions that is still ahead. New notices are checked every day."
            : "Nothing on Find a Tender matches your trades and regions today. New notices are checked every day, and your weekly digest will tell you when one appears."}
        </EmptyState>
        {widerOnFree}
      </section>
    );
  }

  return (
    <section aria-label={signals ? "Early signals" : "Matches"} className="flex flex-col gap-4">
      {signals ? <p className="text-15 text-ink-2">Procurements that buyers have announced but not yet opened. Dates are the buyer’s own estimates and can move.</p> : null}
      <div className={tenderListFrameClasses}>
        <FilterBar view={view} groupLabel="Filter matches" sorted={signals ? undefined : "Sorted by soonest deadline"} />
        {list.items.length > 0 ? (
          <div className="max-md:mt-3">
            <RadarList items={list.items} saved={saved} now={nowIso} firstRank={signals ? undefined : list.firstRank} signal={signals} showWider={list.showingWider} label={signals ? "Early signals" : "Matches"} />
          </div>
        ) : (
          <EmptyState
            plain
            headingLevel="h2"
            title="Nothing in your matches fits these filters"
            actions={
              <Link href={radarHref(view, { category: null, region: null, value: null, closing: null })} className="link inline-flex min-h-11 items-center rounded-sm text-15 font-medium">
                Clear the filters
              </Link>
            }
            data-testid="filtered-empty"
          >
            {cap !== null && list.lockedTotal > 0
              ? `${pluralise(list.lockedTotal, "match", "matches")} beyond your top ${cap} ${list.lockedTotal === 1 ? "fits" : "fit"} them.`
              : "Loosen one of them, or clear them all."}
          </EmptyState>
        )}
        <PageLinks view={view} list={list} />
        {widerControl ? <div className="flex px-4 py-3 max-md:px-0 md:border-t md:border-line md:px-6">{widerControl}</div> : null}
      </div>
      {cap !== null && list.lockedTotal > 0 ? <CapBand list={list} cap={cap} /> : null}
      {cap !== null ? <LockedList list={list} now={now} /> : null}
      {widerOnFree}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ending soon, buyers, saved
// ---------------------------------------------------------------------------

function HiddenOnFree({ hidden, noun }: { hidden: number; noun: string }) {
  if (hidden <= 0) return null;
  return (
    <p className="text-sm text-ink-2" data-testid="free-cap-line">
      {pluralise(hidden, `more ${noun}`)} on {RADAR_PRO.name}.{" "}
      <Link href="/pricing" className="link font-medium">
        See {RADAR_PRO.name}
      </Link>
    </p>
  );
}

function EndingPanel({ view, list, now }: { view: RadarView; list: Extract<RadarListData, { tab: "ending" }>; now: Date }) {
  const months = view.filters.ending ?? ENDING_SOON_MONTHS;
  return (
    <section aria-label="Ending soon" className="flex flex-col gap-4">
      <p className="text-15 text-ink-2">Contracts for work like yours, held by someone else, with a stated end date within {months} months. Expect a new tender before each one.</p>
      <div className={tenderListFrameClasses}>
        <FilterBar view={view} groupLabel="Filter contracts" sorted="Sorted by soonest end date" />
        {list.items.length > 0 ? (
          <div className="max-md:mt-3">
            <EndingContracts
              items={list.items}
              now={now}
              framed={false}
              action={(item) => <SaveButton ocid={item.ocid} saved={view.states.get(item.ocid) === "saved"} itemLabel={item.title} />}
            />
          </div>
        ) : (
          <EmptyState plain headingLevel="h2" title={view.hasFilters ? "No contract fits these filters" : `No rival contract in your trade has a stated end date in the next ${months} months`}>
            {view.hasFilters ? (
              <Link href={radarHref(view, { region: null, value: null, ending: null })} className="link font-medium">
                Clear the filters
              </Link>
            ) : (
              "End dates come from contract award notices; many notices state none."
            )}
          </EmptyState>
        )}
        <PageLinks view={view} list={list} />
      </div>
      <HiddenOnFree hidden={list.hidden} noun="contract" />
    </section>
  );
}

function BuyersPanel({ view, list }: { view: RadarView; list: Extract<RadarListData, { tab: "buyers" }> }) {
  const years = BUYERS_MONTHS / 12;
  const span = years === 1 ? "year" : `${["", "", "two", "three", "four", "five"][years] ?? years} years`;
  return (
    <section aria-label="Buyers" className="flex flex-col gap-4">
      <p className="text-15 text-ink-2">Public bodies that awarded work like yours in the last {span}, your regions first.</p>
      <div className={tenderListFrameClasses}>
        <FilterBar view={view} groupLabel="Filter and sort buyers" phone="fill" />
        {list.items.length > 0 ? (
          <div className="max-md:mt-3">
            <BuyersInTrade items={list.items} framed={false} personal />
          </div>
        ) : (
          <EmptyState plain headingLevel="h2" title={view.filters.region ? "No buyer in this region awarded work like yours" : "No awards in your trade have been published yet"}>
            {view.filters.region ? (
              <Link href={radarHref(view, { region: null })} className="link font-medium">
                Show every region
              </Link>
            ) : (
              "Counts come from contract award notices on Find a Tender."
            )}
          </EmptyState>
        )}
        <PageLinks view={view} list={list} />
      </div>
      <HiddenOnFree hidden={list.hidden} noun="buyer" />
    </section>
  );
}

function SavedPanel({ view, list, now }: { view: RadarView; list: Extract<RadarListData, { tab: "saved" }>; now: Date }) {
  if (list.items.length === 0) {
    return (
      <EmptyState title="Nothing saved yet" actions={<ButtonLink href={radarHref(view, { tab: "matches" })}>See your matches</ButtonLink>}>
        Save a tender to keep it here, with its deadline at the top of your radar.
      </EmptyState>
    );
  }
  return (
    <section aria-label="Saved" className="flex flex-col gap-4">
      <p className="text-15 text-ink-2">Tenders and contracts your workspace has saved, soonest deadline first.</p>
      <div className={tenderListFrameClasses}>
        <ul aria-label="Saved" className={tenderListClasses} data-testid="saved-list">
          {list.items.map((card) => {
            const live = card.stage === "tender" && card.deadlineAt !== null && Date.parse(card.deadlineAt) > now.getTime();
            return (
              <li key={card.ocid} className={tenderListItemClasses}>
                <MatchRow
                  item={plainRow(card)}
                  now={now}
                  href={`/app/tenders/${card.ocid}`}
                  signal={card.stage === "planning"}
                  actions={
                    <>
                      {live ? (
                        <ButtonLink variant="outline" href={bidCheckHref(card.ocid)} className="flex-1 text-15 @2xl:flex-none @2xl:text-sm">
                          Start a bid check
                        </ButtonLink>
                      ) : null}
                      <SaveButton ocid={card.ocid} saved itemLabel={card.title} className={live ? undefined : "@max-2xl:ml-auto"} />
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col" data-testid="radar">
      {children}
      <AppSourceNote />
    </div>
  );
}

/** No radar yet: the two ways to get one. */
function RadarStart() {
  return (
    <Frame>
      <header className="flex flex-col gap-1.5">
        <MetaLine parts={["Radar", "notices from Find a Tender"]} />
        <h1 className="type-title text-ink">Radar</h1>
      </header>
      <div className="mt-6 flex flex-col gap-5 rounded-card border border-line bg-surface p-5 md:p-8" data-testid="radar-onboarding">
        <div className="flex flex-col gap-2">
          <h2 className="type-h3 text-ink">Start with your company</h2>
          <p className="max-w-[42.5rem] text-15 text-ink md:text-base">Your radar is built from the public contracts your company has won: the open tenders like them, the rival contracts ending soon and the buyers behind them.</p>
        </div>
        <CompanySearchForm action="/app/radar/find" id="radar-company-q" />
        <p className="text-sm text-ink-2">
          No public contracts yet?{" "}
          <Link href="/app/radar/setup" className="link font-medium">
            Set up a radar by trade and region
          </Link>
          .
        </p>
      </div>
    </Frame>
  );
}

export function RadarScreen({ view, now, userEmail }: { view: RadarView; now: Date; /** The signed-in user's own address: where their digest goes. */ userEmail: string }) {
  if (!view.active) return <RadarStart />;

  if (!view.spec) {
    return (
      <Frame>
        <RadarHead view={view} />
        <div className="mt-6">
          <EmptyState
            title="This company has no contract awards to match on yet"
            actions={
              <ButtonLink href="/app/radar/setup" className="max-md:w-full">
                Set up a radar by trade and region
              </ButtonLink>
            }
          >
            {view.active.name} is on your radar, but no award notice names it at the moment. Describe your trades and regions and the radar works the same way.
          </EmptyState>
        </div>
      </Frame>
    );
  }

  if (view.firstRun) {
    return (
      <Frame>
        <RadarFirstRunGuide view={view} firstRun={view.firstRun} now={now} userEmail={userEmail} allHref={radarHref(view, { tab: "matches" })} />
      </Frame>
    );
  }

  const list = view.list;
  return (
    <Frame>
      <RadarHead view={view} />
      {/* The strip belongs to the Matches tab (Radar-1440); the other tabs open straight on their list. */}
      {view.tab === "matches" && view.deadlines.length > 0 ? (
        <div className="mt-5">
          <DeadlineStrip view={view} now={now} />
        </div>
      ) : null}
      <div className="mt-5 md:mt-6">
        <RadarTabs view={view} />
      </div>
      <div className="mt-4 md:mt-6">
        {list === null ? null : list.tab === "saved" ? (
          <SavedPanel view={view} list={list} now={now} />
        ) : list.tab === "ending" ? (
          <EndingPanel view={view} list={list} now={now} />
        ) : list.tab === "buyers" ? (
          <BuyersPanel view={view} list={list} />
        ) : (
          <MatchesPanel view={view} list={list} now={now} />
        )}
      </div>
    </Frame>
  );
}

/** Shown when the radar could not be loaded: what happened and what to do. */
export function RadarError() {
  return (
    <Frame>
      <h1 className="type-title text-ink">Radar</h1>
      <div className="mt-6">
        <EmptyState
          title="We could not load your radar"
          actions={
            <ButtonLink href="/app" className="max-md:w-full">
              Try again
            </ButtonLink>
          }
          data-testid="radar-error"
        >
          Nothing has been lost: your saved tenders and settings are safe. If it keeps happening, tell us and we will look at it.
        </EmptyState>
      </div>
    </Frame>
  );
}

/** The radar while it loads: the same blocks at the same sizes, so nothing jumps when the rows arrive. */
export function RadarSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading your radar" data-testid="radar-skeleton">
      <Skeleton className="h-[1.125rem] w-64 max-w-full" />
      <Skeleton className="mt-2 h-[1.875rem] w-28 md:h-[2.625rem] md:w-36" />
      <Skeleton className="mt-3 h-7 w-full max-w-xl" />
      <div className="mt-6 flex gap-6 border-b border-line pb-3">
        {["w-[4.5rem]", "w-24", "w-16", "w-[6.5rem]"].map((width) => (
          <Skeleton key={width} className={cn("h-5", width)} />
        ))}
      </div>
      <div className={cn("mt-6", tenderListClasses, tenderListFrameClasses)}>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={cn(tenderListItemClasses, "flex flex-col gap-3 p-4 md:flex-row md:items-start md:gap-6 md:px-6 md:py-5")}>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-full max-w-[32rem]" />
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="h-[1.375rem] w-80 max-w-full" />
            </div>
            <Skeleton className="h-[4.25rem] w-full md:w-40" />
            <Skeleton className="hidden h-[4.25rem] w-44 lg:block" />
            <Skeleton className="h-11 w-full md:h-[6.25rem] md:w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
