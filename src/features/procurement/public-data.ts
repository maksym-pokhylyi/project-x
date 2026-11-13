import "server-only";
import { unstable_cache } from "next/cache";
import { procurementConfig } from "./config";
import { getBuyerBySlug, getBuyerCompetitionMix, getBuyersForSupplier, type BuyerCompetitionMix, type BuyerInsight, type BuyerRecord } from "./queries/buyers";
import { getBuyerContracts, getEndingSoon, getSupplierContracts, type ContractRow, type EndingSoonItem } from "./queries/contracts";
import { getBuyerNotices, getSupplierMatches, type MatchItem } from "./queries/matches";
import { getTender, type TenderDetail } from "./queries/notices";
import { getDataUpdatedAt, type NoticeCard } from "./queries/shared";
import { getSupplierBySlug, type SupplierRecord } from "./queries/suppliers";

/**
 * Data for the public pages, cached for an hour (`unstable_cache`, tag "procurement").
 *
 * The pages themselves render per request (they log the visit on the server and adapt
 * the call to action to a signed-in viewer); what is expensive — the queries — is shared
 * across requests here. Results are plain JSON: dates are ISO strings.
 *
 * Only what an unclaimed page may show is loaded: three items per block and the totals.
 * The hidden items never reach the HTML. "Open tenders" are the supplier's STRONG matches
 * (queries/matches.ts), the three best shown soonest deadline first.
 */
const options = { revalidate: procurementConfig.revalidateSeconds, tags: ["procurement"] };
const BLOCK = procurementConfig.publicBlockItems;

/** Rival contracts are listed when their stated end date falls within this many months. */
export const PUBLIC_ENDING_MONTHS = 12;
/** Buyers are those that awarded in the trade within this many months. */
export const PUBLIC_BUYERS_MONTHS = 24;

export type Block<T> = { items: T[]; total: number };

export type SupplierPageData = {
  supplier: SupplierRecord;
  /** The most recent contract wins (the preview under "Your contract wins"). */
  contracts: Block<ContractRow>;
  matches: Block<MatchItem>;
  endingSoon: Block<EndingSoonItem>;
  buyers: Block<BuyerInsight>;
  /** When the Find a Tender data was last brought up to date. */
  updatedAt: string | null;
};

function byDeadline(a: MatchItem, b: MatchItem): number {
  return (a.deadlineAt ?? "9999").localeCompare(b.deadlineAt ?? "9999") || a.ocid.localeCompare(b.ocid);
}

export const loadSupplierPage = unstable_cache(
  async (slug: string): Promise<SupplierPageData | null> => {
    const supplier = await getSupplierBySlug(slug);
    if (!supplier) return null;
    const empty = { items: [], total: 0 };
    if (!supplier.isPublic || supplier.mergedIntoSlug) {
      return { supplier, contracts: empty, matches: empty, endingSoon: empty, buyers: empty, updatedAt: null };
    }
    const [contracts, matches, endingSoon, buyers, updatedAt] = await Promise.all([
      getSupplierContracts(supplier.id, { limit: procurementConfig.publicWinsPreview }),
      getSupplierMatches(supplier.id, { limit: BLOCK }),
      getEndingSoon(supplier.id, PUBLIC_ENDING_MONTHS, { limit: BLOCK }),
      getBuyersForSupplier(supplier.id, { limit: BLOCK, months: PUBLIC_BUYERS_MONTHS }),
      getDataUpdatedAt(),
    ]);
    return { supplier, contracts, matches: { items: [...matches.items].sort(byDeadline), total: matches.total }, endingSoon, buyers, updatedAt };
  },
  ["procurement:supplier-page:v2"],
  options,
);

/** One page of a supplier's contract wins, for "Show all N contracts" (50 a page). */
export const loadSupplierWins = unstable_cache(
  async (supplierId: string, page: number): Promise<Block<ContractRow>> => {
    const size = procurementConfig.publicWinsPageSize;
    return getSupplierContracts(supplierId, { limit: size, offset: (Math.max(1, page) - 1) * size });
  },
  ["procurement:supplier-wins:v1"],
  options,
);

export type BuyerPageData = {
  buyer: BuyerRecord;
  live: NoticeCard[];
  planning: NoticeCard[];
  contracts: Block<ContractRow>;
  mix: BuyerCompetitionMix;
  updatedAt: string | null;
};

export const loadBuyerPage = unstable_cache(
  async (slug: string): Promise<BuyerPageData | null> => {
    const buyer = await getBuyerBySlug(slug);
    if (!buyer) return null;
    if (buyer.mergedIntoSlug) {
      return { buyer, live: [], planning: [], contracts: { items: [], total: 0 }, mix: { awards: 0, direct: 0, limited: 0, framework: 0, open: 0, unknown: 0, belowThreshold: 0 }, updatedAt: null };
    }
    const [notices, contracts, mix, updatedAt] = await Promise.all([getBuyerNotices(buyer.id), getBuyerContracts(buyer.id, { limit: 25 }), getBuyerCompetitionMix(buyer.id), getDataUpdatedAt()]);
    return { buyer, live: notices.live, planning: notices.planning, contracts, mix, updatedAt };
  },
  ["procurement:buyer-page:v2"],
  options,
);

export const loadTenderPage = unstable_cache(async (id: string): Promise<TenderDetail | null> => getTender(id), ["procurement:tender-page:v2"], options);
