import "server-only";
import type { OrgContext } from "@/server/session";
import { radarAccess, type RadarAccess } from "../access";
import { CPV_DIVISIONS, cpvDivisionLabel, shortCpvLabel } from "../domain/cpv";
import type { RadarSpec, TradeLevels } from "../domain/profile";
import { NATIONWIDE, placeLabel, UK_REGIONS } from "../domain/regions";
import { BROAD_TRADES, splitTrades } from "../domain/trades";
import { getBuyersForSpec, type BuyerInsight, type BuyerSort } from "../queries/buyers";
import { getEndingSoonForSpec, type EndingSoonItem } from "../queries/contracts";
import { labelTrades } from "../queries/cpv";
import { getEarlySignalsForSpec, getMatchesForSpec, passesFilters, type MatchFilters, type MatchItem, type MatchResult } from "../queries/matches";
import { getCpvLabels, getDataUpdatedAt, getSupplierSpec, type NoticeCard } from "../queries/shared";
import { getSupplierById } from "../queries/suppliers";
import { getFirstRunSteps, getRadarItemStates, getSavedTenders, listRadarSources, pickSource, specForSource, type FirstRunSteps, type RadarItemState, type RadarSource } from "./data";

/**
 * Everything the Radar screen needs for one request, tenant-scoped through `ctx`.
 *
 * MATCHES are the STRONG matches of the active radar (see matchTier in domain/profile.ts):
 * the tab, its count, the Free cap and the first-run guide all work on them. The wider
 * matches — everything else above the score threshold — are only counted, and listed after
 * the strong ones when a paid workspace asks for them (`?wider=1`).
 *
 * FILTERS are real: they live in the URL (`?category=45&region=UKE&value=medium&closing=30`),
 * are validated here and applied to the data, not to the page.
 *
 * FREE PLAN: a workspace sees its top `matchLimit` matches — the ten that match best, shown
 * soonest deadline first. The cap is applied BEFORE the filters, so changing a filter can
 * never reveal an eleventh match; what lies beyond it is returned as `locked`, reduced to
 * what the screen may show (a place and a closing date — no title, no buyer, no link).
 */
export const RADAR_TABS = ["matches", "ending", "buyers", "signals", "saved"] as const;
export type RadarTab = (typeof RADAR_TABS)[number];

export const VALUE_BANDS: Record<string, { label: string; min: number | null; max: number | null }> = {
  small: { label: "Under £100,000", min: null, max: 100_000 },
  medium: { label: "£100,000 to £1m", min: 100_000, max: 1_000_000 },
  large: { label: "Over £1m", min: 1_000_000, max: null },
};

/** "Closing within" choices, in days. */
export const CLOSING_WINDOWS = [7, 14, 30, 90] as const;

/** Rival contracts are listed when their stated end date falls within this many months; "Ending within" narrows it. */
export const ENDING_SOON_MONTHS = 12;
export const ENDING_WINDOWS = [3, 6, 12] as const;

/** Buyers are those that awarded in the trade within this many months. */
export const BUYERS_MONTHS = 24;

export const BUYER_SORTS: Record<BuyerSort, string> = {
  awards: "awards in your trade",
  own: "contracts you have won",
  median: "median value",
  open: "open tenders",
};

export type RadarQuery = {
  tab?: string;
  profile?: string;
  category?: string;
  region?: string;
  value?: string;
  closing?: string;
  ending?: string;
  sort?: string;
  wider?: string;
  page?: string;
};

export type RadarFilters = {
  /** CPV division, e.g. "45". */
  category: string | null;
  /** Top-level region, e.g. "UKE". */
  region: string | null;
  /** Key of VALUE_BANDS. */
  value: string | null;
  /** Days, one of CLOSING_WINDOWS (Matches). */
  closing: number | null;
  /** Months, one of ENDING_WINDOWS below the default (Ending soon). */
  ending: number | null;
  /** Order of the Buyers tab. */
  sort: BuyerSort;
};

/** A match beyond the Free plan's cap: only what the locked row shows. */
export type LockedMatch = { rank: number; place: string | null; deadlineAt: string | null; futureNoticeAt: string | null };

export type MatchList = {
  tab: "matches" | "signals";
  items: MatchItem[];
  firstRank: number;
  locked: LockedMatch[];
  /** Strong matches beyond the cap, within the filters. */
  lockedTotal: number;
  /** Strong matches within the filters, shown or locked. */
  total: number;
  /** Wider matches within the filters: counted, and listed after the strong ones when `showingWider`. */
  wider: number;
  showingWider: boolean;
  page: number;
  pages: number;
};

export type RadarList =
  | MatchList
  | { tab: "ending"; items: EndingSoonItem[]; total: number; hidden: number; page: number; pages: number }
  | { tab: "buyers"; items: BuyerInsight[]; total: number; hidden: number; page: number; pages: number }
  | { tab: "saved"; items: NoticeCard[]; total: number };

/** Unfiltered totals behind the counts on the tabs. */
export type RadarCounts = { matches: number; ending: number; buyers: number; signals: number };

/** One of the trades a radar matches on. */
export type RadarTrade = {
  /** 8-digit CPV code of the trade (a class, group or division code ends in zeros). */
  code: string;
  label: string;
  /** "wins": read from the company's contract awards. "chosen": picked by the workspace. */
  source: "wins" | "chosen";
};

export type RadarMatching = {
  /** What the radar matches on, in plain words, most important first. */
  trades: RadarTrade[];
  regions: string[];
  /** A radar described by keywords alone has no trade to name: these are what it listens for. */
  keywords: string[];
};

/** What the "Trades and regions" form shows and posts back. */
export type RadarEditData = {
  /** "s:<supplier id>" or "r:<profile id>". */
  source: string;
  kind: "supplier" | "manual";
  name: string;
  /** Trades read from the company's awards, each ticked unless the workspace switched it off. */
  own: Array<{ code: string; label: string; checked: boolean }>;
  /** The short list, each ticked when all of its codes are on the radar. */
  trades: Array<{ key: string; label: string; checked: boolean }>;
  /** Other trades on the radar ("More trades"), by their official names. */
  other: Array<{ code: string; label: string }>;
  regions: Array<{ code: string; label: string; checked: boolean }>;
  /** Strong matches with the choices as they stand. */
  count: number;
};

export type RadarFirstRun = {
  steps: FirstRunSteps;
  /** The three best matches, soonest deadline first. */
  matches: MatchItem[];
  total: number;
};

export type RadarView = {
  sources: RadarSource[];
  active: RadarSource | null;
  spec: RadarSpec | null;
  access: RadarAccess;
  tab: RadarTab;
  filters: RadarFilters;
  hasFilters: boolean;
  /** Divisions the Category filter offers: the active radar's own. */
  categories: Array<{ code: string; label: string }>;
  states: Map<string, RadarItemState>;
  saved: NoticeCard[];
  /** Saved tenders whose deadline is still ahead, soonest first. */
  deadlines: NoticeCard[];
  counts: RadarCounts | null;
  list: RadarList | null;
  matching: RadarMatching | null;
  edit: RadarEditData | null;
  /** Set while the first-run guide is due for the active radar: the page shows it instead of the lists. */
  firstRun: RadarFirstRun | null;
  /** When the Find a Tender data was last brought up to date. */
  updatedAt: string | null;
};

export const RADAR_PAGE_SIZE = 30;
const LOCKED_PREVIEW = 2;
/** Strong matches read in one go: a radar has tens of them, a very broad one a few hundred. */
const STRONG_LIMIT = 1000;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRadarQuery(params: Record<string, string | string[] | undefined>): RadarQuery {
  return {
    tab: first(params.tab),
    profile: first(params.profile),
    category: first(params.category),
    region: first(params.region),
    value: first(params.value),
    closing: first(params.closing),
    ending: first(params.ending),
    sort: first(params.sort),
    wider: first(params.wider),
    page: first(params.page),
  };
}

/** Validated filters: anything that is not one of the offered choices is dropped. */
export function parseRadarFilters(query: RadarQuery): RadarFilters {
  const closing = Number(query.closing);
  const ending = Number(query.ending);
  return {
    category: query.category && /^\d{2}$/.test(query.category) ? query.category : null,
    region: query.region && query.region in UK_REGIONS ? query.region : null,
    value: query.value && query.value in VALUE_BANDS ? query.value : null,
    closing: (CLOSING_WINDOWS as readonly number[]).includes(closing) ? closing : null,
    ending: (ENDING_WINDOWS as readonly number[]).includes(ending) && ending < ENDING_SOON_MONTHS ? ending : null,
    sort: query.sort && query.sort in BUYER_SORTS ? (query.sort as BuyerSort) : "awards",
  };
}

/** Which filters each tab offers; a filter of another tab is ignored there (and dropped from its links). */
export const TAB_FILTERS: Record<RadarTab, ReadonlyArray<keyof RadarFilters>> = {
  matches: ["category", "region", "value", "closing"],
  signals: [],
  ending: ["region", "value", "ending"],
  buyers: ["region", "sort"],
  saved: [],
};

/** Soonest deadline first; notices without one last. */
function byDeadline(a: NoticeCard, b: NoticeCard): number {
  if (a.deadlineAt && b.deadlineAt) return a.deadlineAt.localeCompare(b.deadlineAt) || a.ocid.localeCompare(b.ocid);
  if (a.deadlineAt || b.deadlineAt) return a.deadlineAt ? -1 : 1;
  return a.ocid.localeCompare(b.ocid);
}

/** Regions of a spec as words: the chosen regions, "UK-wide" for a supplier that works nationwide, or "Anywhere in the UK". */
export function regionWords(regions: readonly string[]): string[] {
  const specific = regions.filter((region) => region !== NATIONWIDE).map((region) => UK_REGIONS[region]).filter((label): label is string => Boolean(label));
  if (specific.length > 0) return regions.includes(NATIONWIDE) ? [...specific, "UK-wide"] : specific;
  return [regions.includes(NATIONWIDE) ? "UK-wide" : "Anywhere in the UK"];
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The trades a company's awards define (tradeLevels), named for people: a class by the
 * company's own heaviest code in it ("Roof repair"), otherwise by the official name of the
 * class, group or division. Codes are the 8-digit form of each level.
 */
export async function nameTradeLevels(levels: TradeLevels, topCpv: ReadonlyArray<{ code: string; label: string | null; weight: number }>): Promise<Array<{ code: string; label: string }>> {
  const stems = [...levels.classes, ...levels.groups, ...levels.divisions];
  const codes = stems.map((stem) => stem.padEnd(8, "0"));
  const official = await getCpvLabels(codes);
  return stems.map((stem, index) => {
    const code = codes[index]!;
    const own = topCpv.filter((entry) => entry.code.startsWith(stem) && entry.label).sort((a, b) => b.weight - a.weight)[0];
    const label = stem.length === 2 ? (CPV_DIVISIONS[stem] ?? official.get(code)) : (own?.label ?? official.get(code));
    return { code, label: capitalise(shortCpvLabel(label ?? cpvDivisionLabel(stem)) ?? cpvDivisionLabel(stem)) };
  });
}

/** Everything the screen says about what a radar matches on, and what its edit form offers. */
async function describeSource(source: RadarSource, spec: RadarSpec, count: number): Promise<{ matching: RadarMatching; edit: RadarEditData }> {
  const allRegions = Object.entries(UK_REGIONS).map(([code, label]) => ({ code, label, checked: spec.regions.includes(code) }));
  const chosenCodes = source.kind === "supplier" ? source.extraCpvCodes : source.cpvCodes;
  const { keys, otherCodes } = splitTrades(chosenCodes);
  const other = await labelTrades(otherCodes);
  const short = BROAD_TRADES.map((trade) => ({ key: trade.key, label: trade.label, checked: keys.includes(trade.key) }));
  const chosen: RadarTrade[] = [
    ...BROAD_TRADES.filter((trade) => keys.includes(trade.key)).map((trade) => ({ code: trade.cpv[0]!, label: trade.label, source: "chosen" as const })),
    ...other.map((option) => ({ code: option.code, label: option.label, source: "chosen" as const })),
  ];

  if (source.kind === "supplier") {
    const [supplier, base] = await Promise.all([getSupplierById(source.supplierId), getSupplierSpec(source.supplierId)]);
    const levels = base?.trades ?? { classes: [], groups: [], divisions: [] };
    const named = await nameTradeLevels(levels, supplier?.profile?.topCpv ?? []);
    const muted = new Set(source.excludedCpvCodes);
    const own = named.map((trade) => ({ ...trade, checked: !muted.has(trade.code) }));
    return {
      matching: { trades: [...own.filter((trade) => trade.checked).map((trade) => ({ code: trade.code, label: trade.label, source: "wins" as const })), ...chosen], regions: regionWords(spec.regions), keywords: [] },
      edit: { source: source.key, kind: "supplier", name: source.name, own, trades: short, other, regions: allRegions, count },
    };
  }
  return {
    matching: { trades: chosen, regions: regionWords(spec.regions), keywords: chosen.length === 0 ? source.keywords.slice(0, 3) : [] },
    edit: { source: source.key, kind: "manual", name: source.name, own: [], trades: short, other, regions: allRegions, count },
  };
}

function locked(item: MatchItem, rank: number): LockedMatch {
  return { rank, place: placeLabel(item.regionCodes, item.regions), deadlineAt: item.deadlineAt, futureNoticeAt: item.futureNoticeAt };
}

export async function loadRadar(ctx: OrgContext, query: RadarQuery, now: Date = new Date()): Promise<RadarView> {
  const access = radarAccess(ctx.entitlements);
  const [sources, states, saved, updatedAt] = await Promise.all([listRadarSources(ctx), getRadarItemStates(ctx), getSavedTenders(ctx), getDataUpdatedAt()]);
  const active = pickSource(sources, query.profile);
  const tab: RadarTab = (RADAR_TABS as readonly string[]).includes(query.tab ?? "") ? (query.tab as RadarTab) : "matches";
  const parsed = parseRadarFilters(query);
  // Only the filters this tab offers are in force.
  const offered = TAB_FILTERS[tab];
  const filters: RadarFilters = {
    category: offered.includes("category") ? parsed.category : null,
    region: offered.includes("region") ? parsed.region : null,
    value: offered.includes("value") ? parsed.value : null,
    closing: offered.includes("closing") ? parsed.closing : null,
    ending: offered.includes("ending") ? parsed.ending : null,
    sort: offered.includes("sort") ? parsed.sort : "awards",
  };
  const hasFilters = filters.category !== null || filters.region !== null || filters.value !== null || filters.closing !== null || filters.ending !== null;
  const deadlines = saved.filter((card) => card.deadlineAt !== null && Date.parse(card.deadlineAt) > now.getTime());
  const base = { sources, active, access, tab, filters, hasFilters, states, saved, deadlines, updatedAt, categories: [], counts: null, matching: null, edit: null, firstRun: null } satisfies Partial<RadarView>;

  const savedList: RadarList = { tab: "saved", items: saved, total: saved.length };
  if (!active) return { ...base, spec: null, list: tab === "saved" ? savedList : null };
  const spec = await specForSource(active);
  if (!spec) return { ...base, spec: null, list: tab === "saved" ? savedList : null };

  const dismissed = [...states].filter(([, state]) => state === "dismissed").map(([ocid]) => ocid);
  const cap = access.matchLimit;
  const categories = spec.cpvDivisions.map((code) => ({ code, label: cpvDivisionLabel(code) })).sort((a, b) => a.label.localeCompare(b.label));

  // Every strong match of the radar, best first: the tab count, the Free cap and the first-run guide all read from it.
  const strong = await getMatchesForSpec(spec, { limit: STRONG_LIMIT, excludeOcids: dismissed, now });
  const describing = describeSource(active, spec, strong.total);

  // The first-run guide replaces the lists until it is dismissed or done; any explicit tab, filter or page asks for the lists.
  const explicit = Boolean(query.tab) || hasFilters || Boolean(query.page) || Boolean(query.wider);
  if (active.firstRunPending && !explicit) {
    const [steps, described] = await Promise.all([getFirstRunSteps(ctx), describing]);
    if (!(steps.profile && steps.documents && steps.check)) {
      return { ...base, spec, categories, ...described, list: null, firstRun: { steps, matches: strong.items.slice(0, 3).sort(byDeadline), total: strong.total } };
    }
  }

  const band = filters.value ? VALUE_BANDS[filters.value]! : null;
  const countsPromise = Promise.all([
    getEndingSoonForSpec(spec, ENDING_SOON_MONTHS, { limit: 0, now }),
    getBuyersForSpec(spec, { limit: 0, months: BUYERS_MONTHS, now }),
    getEarlySignalsForSpec(spec, { limit: 0, excludeOcids: dismissed, now }),
  ]).then(([ending, buyers, signals]): RadarCounts => ({ matches: strong.total, ending: ending.total, buyers: buyers.total, signals: signals.total }));

  const requested = Math.floor(Number(query.page));
  // Pages exist only where nothing is capped: on the Free plan a list is its first rows and a count of the rest.
  const page = cap === null && Number.isFinite(requested) && requested >= 1 && requested <= 500 ? requested : 1;
  const offset = (page - 1) * RADAR_PAGE_SIZE;
  const pagesOf = (total: number) => (cap === null ? Math.max(1, Math.ceil(total / RADAR_PAGE_SIZE)) : 1);

  let listPromise: Promise<RadarList>;
  if (tab === "saved") {
    listPromise = Promise.resolve(savedList);
  } else if (tab === "matches" || tab === "signals") {
    const load = tab === "matches" ? getMatchesForSpec : getEarlySignalsForSpec;
    const matchFilters: MatchFilters = { division: filters.category, region: filters.region, valueMin: band?.min ?? null, valueMax: band?.max ?? null, closingWithinDays: filters.closing };
    const order = tab === "matches" ? ("deadline" as const) : ("relevance" as const);
    listPromise = (async (): Promise<RadarList> => {
      // Best first, every strong one: for Matches that is the list already in hand.
      const all: MatchResult = tab === "matches" ? strong : await load(spec, { limit: STRONG_LIMIT, excludeOcids: dismissed, now });
      // Wider matches within the same filters: a count, unless a paid workspace asked to see them.
      const widerCount = hasFilters ? (await load(spec, { limit: 0, tier: "all", filters: matchFilters, excludeOcids: dismissed, now })).wider : all.wider;
      const within = (item: MatchItem) => passesFilters(item, matchFilters, now);

      if (cap !== null) {
        // The best `cap` of the whole radar, whatever the filters say; the rest stays locked.
        const visible = all.items.slice(0, cap).filter(within);
        const beyond = all.items.slice(cap).filter(within);
        const items = tab === "matches" ? [...visible].sort(byDeadline) : visible;
        return {
          tab,
          items,
          firstRank: 1,
          locked: beyond.slice(0, LOCKED_PREVIEW).map((item, index) => locked(item, items.length + index + 1)),
          lockedTotal: beyond.length,
          total: visible.length + beyond.length,
          wider: widerCount,
          showingWider: false,
          page: 1,
          pages: 1,
        };
      }

      if (query.wider === "1" && widerCount > 0) {
        // Strong first, then the wider ones, each in the list's own order.
        const result = await load(spec, { limit: RADAR_PAGE_SIZE, offset, tier: "all", order, filters: matchFilters, excludeOcids: dismissed, now });
        return { tab, items: result.items, firstRank: offset + 1, locked: [], lockedTotal: 0, total: result.strong, wider: result.wider, showingWider: true, page, pages: pagesOf(result.total) };
      }
      const filtered = all.items.filter(within);
      const ordered = tab === "matches" ? [...filtered].sort(byDeadline) : filtered;
      return {
        tab,
        items: ordered.slice(offset, offset + RADAR_PAGE_SIZE),
        firstRank: offset + 1,
        locked: [],
        lockedTotal: 0,
        total: ordered.length,
        wider: widerCount,
        showingWider: false,
        page,
        pages: pagesOf(ordered.length),
      };
    })();
  } else if (tab === "ending") {
    listPromise = getEndingSoonForSpec(spec, filters.ending ?? ENDING_SOON_MONTHS, {
      limit: cap ?? RADAR_PAGE_SIZE,
      offset,
      region: filters.region,
      valueMin: band?.min ?? null,
      valueMax: band?.max ?? null,
      order: "end",
      now,
    }).then((result) => ({ tab, items: result.items, total: result.total, hidden: cap === null ? 0 : Math.max(0, result.total - result.items.length), page, pages: pagesOf(result.total) }));
  } else {
    listPromise = getBuyersForSpec(spec, { limit: cap ?? RADAR_PAGE_SIZE, offset, region: filters.region, sort: filters.sort, months: BUYERS_MONTHS, now }).then((result) => ({
      tab: "buyers" as const,
      items: result.items,
      total: result.total,
      hidden: cap === null ? 0 : Math.max(0, result.total - result.items.length),
      page,
      pages: pagesOf(result.total),
    }));
  }

  const [list, counts, described] = await Promise.all([listPromise, countsPromise, describing]);
  return { ...base, spec, categories, list, counts, ...described };
}
