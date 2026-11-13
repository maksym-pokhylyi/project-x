import { isCpvCode } from "./cpv";

/**
 * The short list of trades offered when a radar is described by hand (the "Set up a radar
 * manually" form): the kinds of work UK small suppliers most often bid for, in the words
 * they use, each mapped to the CPV groups and classes buyers file that work under.
 *
 * PURE and client-safe. A radar profile stores CPV codes, not these keys: ticking a trade
 * adds its codes, and the "More trades" search adds any other code by its official name.
 * Every code below is a real CPV code that occurs in Find a Tender notices; the choice
 * follows the volume of open tenders (construction, care, cleaning, catering, grounds,
 * IT, training, engineering lead the feed).
 */
export type BroadTrade = {
  /** Stable key used in URLs (`?trade=roofing`). */
  key: string;
  label: string;
  /** 8-digit CPV codes; a code ending in zeros covers everything beneath it. */
  cpv: readonly string[];
};

export const BROAD_TRADES: readonly BroadTrade[] = [
  // 45453 overhaul and refurbishment · 454 building completion · 507 repair and maintenance of building installations
  { key: "building-repairs", label: "Building repairs and refurbishment", cpv: ["45453000", "45400000", "50700000"] },
  // 45261 roof frames and coverings, including roof repair
  { key: "roofing", label: "Roofing", cpv: ["45261000"] },
  // 45343 fire-prevention installation · 517 fire protection equipment installation · 504132 firefighting equipment maintenance · fire doors
  { key: "fire-safety", label: "Fire safety works", cpv: ["45343000", "51700000", "50413200", "44221220"] },
  // 4531 electrical installation · 4533 plumbing, heating and ventilation · 4535 mechanical installations · 5071/5072 their maintenance
  { key: "electrical-mechanical", label: "Electrical and mechanical", cpv: ["45310000", "45330000", "45350000", "50710000", "50720000"] },
  // 4521 building construction work
  { key: "construction", label: "Construction works", cpv: ["45210000"] },
  // 9091 cleaning services (buildings, windows, offices)
  { key: "cleaning", label: "Cleaning", cpv: ["90910000"] },
  // 79993 building and facilities management · 7033 property management
  { key: "facilities-management", label: "Facilities management", cpv: ["79993000", "70330000"] },
  // 7731 planting and maintenance of green areas · 7734 tree pruning and hedge trimming
  { key: "grounds", label: "Grounds maintenance", cpv: ["77310000", "77340000"] },
  // 905 refuse and waste services
  { key: "waste", label: "Waste and recycling", cpv: ["90500000"] },
  // 555 canteen and catering · 553 restaurant and food-serving
  { key: "catering", label: "Catering", cpv: ["55500000", "55300000"] },
  // 853 social work and related services
  { key: "social-care", label: "Social care", cpv: ["85300000"] },
  // 72 IT services · 48 software packages
  { key: "it", label: "IT services", cpv: ["72000000", "48000000"] },
  // 805 training services
  { key: "training", label: "Training", cpv: ["80500000"] },
  // 71 architectural, construction, engineering and inspection services
  { key: "architecture-engineering", label: "Architecture and engineering", cpv: ["71000000"] },
];

const BY_KEY = new Map(BROAD_TRADES.map((trade) => [trade.key, trade]));

export function broadTrade(key: string): BroadTrade | null {
  return BY_KEY.get(key) ?? null;
}

/** CPV codes of the ticked trades, in list order, without duplicates. Unknown keys are ignored. */
export function cpvCodesForTrades(keys: readonly string[]): string[] {
  const wanted = new Set(keys);
  return [...new Set(BROAD_TRADES.filter((trade) => wanted.has(trade.key)).flatMap((trade) => trade.cpv))];
}

/**
 * Reads a stored profile back into the form: the trades whose codes are ALL present are
 * ticked; every code that no ticked trade accounts for is one of the "more trades".
 */
export function splitTrades(cpvCodes: readonly string[]): { keys: string[]; otherCodes: string[] } {
  const stored = new Set(cpvCodes.filter(isCpvCode));
  const ticked = BROAD_TRADES.filter((trade) => trade.cpv.every((code) => stored.has(code)));
  const covered = new Set(ticked.flatMap((trade) => trade.cpv));
  return { keys: ticked.map((trade) => trade.key), otherCodes: [...stored].filter((code) => !covered.has(code)) };
}
