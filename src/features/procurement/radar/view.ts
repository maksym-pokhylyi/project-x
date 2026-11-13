import "server-only";
import type { OrgContext } from "@/server/session";
import { radarAccess, type RadarAccess } from "../access";
import { calendarDaysBetween } from "../domain/format";
import type { RadarSpec } from "../domain/profile";
import { UK_REGIONS } from "../domain/regions";
import { getBuyersForSpec, type BuyerInsight } from "../queries/buyers";
import { getEndingSoonForSpec, type EndingSoonItem } from "../queries/contracts";
import { getEarlySignalsForSpec, getMatchesForSpec, type MatchFilters, type MatchItem } from "../queries/matches";
import type { NoticeCard } from "../queries/shared";
import { getRadarItemStates, getSavedTenders, listRadarSources, pickSource, specForSource, type RadarItemState, type RadarSource } from "./data";

/**
 * Everything the Radar screen needs for one request, tenant-scoped through `ctx`.
 * The free plan sees the first `matchLimit` rows of a list in full; the rest are returned
 * as `locked` (title, buyer and the Find a Tender link only — the source is never gated).
 */
export const RADAR_TABS = ["matches", "ending", "buyers", "signals", "saved"] as const;
export type RadarTab = (typeof RADAR_TABS)[number];

export const VALUE_BANDS: Record<string, { label: string; min: number | null; max: number | null }> = {
  small: { label: "Under £100k", min: null, max: 100_000 },
  medium: { label: "£100k to £1m", min: 100_000, max: 1_000_000 },
  large: { label: "Over £1m", min: 1_000_000, max: null },
};

export type RadarQuery = { tab?: string; profile?: string; division?: string; region?: string; value?: string; kind?: string };

export type RadarFilters = { division: string | null; region: string | null; value: string | null; kind: string | null };

export type RadarList =
  | { tab: "matches" | "signals"; items: MatchItem[]; locked: MatchItem[]; total: number }
  | { tab: "ending"; items: EndingSoonItem[]; total: number; hidden: number }
  | { tab: "buyers"; items: BuyerInsight[]; total: number; hidden: number }
  | { tab: "saved"; items: NoticeCard[]; total: number };

export type RadarView = {
  sources: RadarSource[];
  active: RadarSource | null;
  spec: RadarSpec | null;
  access: RadarAccess;
  tab: RadarTab;
  filters: RadarFilters;
  hasFilters: boolean;
  states: Map<string, RadarItemState>;
  saved: NoticeCard[];
  /** Saved tenders closing within 14 days, soonest first. */
  deadlines: NoticeCard[];
  list: RadarList | null;
};

const PAGE = 30;
const LOCKED_PREVIEW = 10;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRadarQuery(params: Record<string, string | string[] | undefined>): RadarQuery {
  return { tab: first(params.tab), profile: first(params.profile), division: first(params.division), region: first(params.region), value: first(params.value), kind: first(params.kind) };
}

export async function loadRadar(ctx: OrgContext, query: RadarQuery, now: Date = new Date()): Promise<RadarView> {
  const access = radarAccess(ctx.entitlements);
  const [sources, states, saved] = await Promise.all([listRadarSources(ctx), getRadarItemStates(ctx), getSavedTenders(ctx)]);
  const active = pickSource(sources, query.profile);
  const tab: RadarTab = (RADAR_TABS as readonly string[]).includes(query.tab ?? "") ? (query.tab as RadarTab) : "matches";
  const filters: RadarFilters = {
    division: query.division && /^\d{2}$/.test(query.division) ? query.division : null,
    region: query.region && query.region in UK_REGIONS ? query.region : null,
    value: query.value && query.value in VALUE_BANDS ? query.value : null,
    kind: query.kind && ["tender", "below_threshold", "framework"].includes(query.kind) ? query.kind : null,
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const deadlines = saved.filter((card) => {
    if (!card.deadlineAt) return false;
    const end = new Date(card.deadlineAt);
    return end.getTime() > now.getTime() && calendarDaysBetween(now, end) <= 14;
  });
  const base: Omit<RadarView, "list" | "spec"> = { sources, active, access, tab, filters, hasFilters, states, saved, deadlines };

  if (tab === "saved") return { ...base, spec: null, list: { tab: "saved", items: saved, total: saved.length } };
  if (!active) return { ...base, spec: null, list: null };
  const spec = await specForSource(active);
  if (!spec) return { ...base, spec: null, list: null };

  const band = filters.value ? VALUE_BANDS[filters.value]! : null;
  const matchFilters: MatchFilters = { division: filters.division, region: filters.region, valueMin: band?.min ?? null, valueMax: band?.max ?? null, kind: filters.kind };
  const dismissed = [...states].filter(([, state]) => state === "dismissed").map(([ocid]) => ocid);
  const cap = access.matchLimit;

  if (tab === "matches" || tab === "signals") {
    const load = tab === "matches" ? getMatchesForSpec : getEarlySignalsForSpec;
    const result = await load(spec, { limit: cap === null ? PAGE : cap + LOCKED_PREVIEW, filters: matchFilters, excludeOcids: dismissed, now });
    const visible = cap === null ? result.items : result.items.slice(0, cap);
    const locked = cap === null ? [] : result.items.slice(cap);
    return { ...base, spec, list: { tab, items: visible, locked, total: result.total } };
  }
  if (tab === "ending") {
    const result = await getEndingSoonForSpec(spec, 9, { limit: cap ?? PAGE, region: filters.region, now });
    return { ...base, spec, list: { tab, items: result.items, total: result.total, hidden: Math.max(0, result.total - result.items.length) } };
  }
  const result = await getBuyersForSpec(spec, { limit: cap ?? PAGE, region: filters.region, now });
  return { ...base, spec, list: { tab: "buyers", items: result.items, total: result.total, hidden: Math.max(0, result.total - result.items.length) } };
}
