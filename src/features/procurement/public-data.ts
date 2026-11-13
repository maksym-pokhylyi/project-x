import "server-only";
import { unstable_cache } from "next/cache";
import { procurementConfig } from "./config";
import { getBuyerBySlug, getBuyerCompetitionMix, getBuyersForSupplier, type BuyerCompetitionMix, type BuyerInsight, type BuyerRecord } from "./queries/buyers";
import { getBuyerContracts, getEndingSoon, getOwnRenewals, getSupplierContracts, type ContractRow, type EndingSoonItem } from "./queries/contracts";
import { getBuyerNotices, getSupplierMatches, type MatchItem } from "./queries/matches";
import { getTender, type TenderDetail } from "./queries/notices";
import type { NoticeCard } from "./queries/shared";
import { getSupplierBySlug, type SupplierRecord } from "./queries/suppliers";

/**
 * Data for the public pages, cached for an hour (`unstable_cache`, tag "procurement").
 *
 * The pages themselves render per request (they log the visit on the server and adapt
 * the call to action to a signed-in viewer); what is expensive — the queries — is shared
 * across requests here. Results are plain JSON: dates are ISO strings.
 *
 * Only what an unclaimed page may show is loaded: three items per block and the totals.
 * The hidden items never reach the HTML.
 */
const options = { revalidate: procurementConfig.revalidateSeconds, tags: ["procurement"] };
const BLOCK = procurementConfig.publicBlockItems;

export type Block<T> = { items: T[]; total: number };

export type SupplierPageData = {
  supplier: SupplierRecord;
  contracts: Block<ContractRow>;
  matches: Block<MatchItem>;
  endingSoon: Block<EndingSoonItem>;
  buyers: Block<BuyerInsight>;
  renewals: ContractRow[];
};

export const loadSupplierPage = unstable_cache(
  async (slug: string): Promise<SupplierPageData | null> => {
    const supplier = await getSupplierBySlug(slug);
    if (!supplier) return null;
    const empty = { items: [], total: 0 };
    if (!supplier.isPublic || supplier.mergedIntoSlug) {
      return { supplier, contracts: empty, matches: empty, endingSoon: empty, buyers: empty, renewals: [] };
    }
    const [contracts, matches, endingSoon, buyers, renewals] = await Promise.all([
      getSupplierContracts(supplier.id, { limit: 25 }),
      getSupplierMatches(supplier.id, { limit: BLOCK }),
      getEndingSoon(supplier.id, 9, { limit: BLOCK }),
      getBuyersForSupplier(supplier.id, { limit: BLOCK }),
      getOwnRenewals(supplier.id, 12),
    ]);
    return { supplier, contracts, matches, endingSoon, buyers, renewals: renewals.slice(0, BLOCK) };
  },
  ["procurement:supplier-page:v1"],
  options,
);

export type BuyerPageData = {
  buyer: BuyerRecord;
  live: NoticeCard[];
  planning: NoticeCard[];
  contracts: Block<ContractRow>;
  mix: BuyerCompetitionMix;
};

export const loadBuyerPage = unstable_cache(
  async (slug: string): Promise<BuyerPageData | null> => {
    const buyer = await getBuyerBySlug(slug);
    if (!buyer) return null;
    if (buyer.mergedIntoSlug) return { buyer, live: [], planning: [], contracts: { items: [], total: 0 }, mix: { awards: 0, direct: 0, limited: 0, framework: 0, open: 0, unknown: 0, belowThreshold: 0 } };
    const [notices, contracts, mix] = await Promise.all([getBuyerNotices(buyer.id), getBuyerContracts(buyer.id, { limit: 25 }), getBuyerCompetitionMix(buyer.id)]);
    return { buyer, live: notices.live, planning: notices.planning, contracts, mix };
  },
  ["procurement:buyer-page:v1"],
  options,
);

export const loadTenderPage = unstable_cache(async (id: string): Promise<TenderDetail | null> => getTender(id), ["procurement:tender-page:v1"], options);
