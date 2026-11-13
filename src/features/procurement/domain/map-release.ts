import { cpvClass, cpvDivision, cpvGroup, distinctCpv, isCpvCode } from "./cpv";
import { tidyPlace } from "./format";
import { cleanValue, type CleanValue } from "./money";
import {
  classifyEmail,
  classifyLegalForm,
  cleanName,
  hostOf,
  isPlaceholderSupplierName,
  legalSuffix,
  normaliseCompanyNumber,
  normaliseName,
  postcodeArea,
  stableId,
  type EmailKind,
  type LegalForm,
  type LegalFormEvidence,
} from "./normalize";
import { competitionOf, legacyStage, NOTICE_TYPES, type Competition, type NoticeStage, type Regime } from "./notice-types";
import type { OcdsAward, OcdsContract, OcdsItem, OcdsLot, OcdsParty, OcdsPeriod, OcdsRelease } from "./ocds";
import { topRegion, topRegions } from "./regions";

/**
 * mapRelease: one OCDS release (one notice version) -> the rows we store.
 *
 * PURE: no I/O, no clock, no randomness. The same release always maps to the same output,
 * which is what makes ingestion idempotent and re-runnable. Identity resolution across
 * releases (which supplier row a party belongs to) happens later, in upsertBatch, from the
 * `keys` each organisation carries here.
 */

export type MappedBuyer = {
  /** Id of the party inside this release (stable for the release, not across releases). */
  partyId: string;
  /** Identity keys, strongest first, e.g. ["GB-PPON:PXLY-5862-RMML", "NAME:historic england"]. */
  keys: string[];
  name: string;
  nameNorm: string;
  ppon: string | null;
  /** UK_CA_TYPE / TED_CA_TYPE id, e.g. "publicAuthoritySubCentralGovernment". */
  buyerType: string | null;
  /** GB-WLS | GB-NIR | GB-SCT when the buyer follows devolved regulations. */
  devolved: string | null;
  regionCode: string | null;
  topRegion: string | null;
  locality: string | null;
  postcodeArea: string | null;
  website: string | null;
};

export type MappedSupplier = {
  partyId: string;
  /**
   * Strong identifiers first ("GB-COH:…", "GB-PPON:…", other registers), then "NAME:…" when
   * the name can stand in for an identifier: always for registered company names (Ltd, PLC,
   * LLP, CIC — unique at Companies House), otherwise only when nothing else is published.
   */
  keys: string[];
  /** What the identity rests on in THIS release. */
  identityBasis: "coh" | "ppon" | "register" | "name";
  name: string;
  nameNorm: string;
  /** Companies House number, canonical 8 characters. */
  coh: string | null;
  ppon: string | null;
  scale: "sme" | "large" | null;
  vcse: boolean | null;
  legalForm: LegalForm;
  isIncorporated: boolean;
  legalEvidence: LegalFormEvidence["evidence"];
  /** ISO country code when published; "GB" assumed only when the address says United Kingdom. */
  country: string | null;
  regionCode: string | null;
  topRegion: string | null;
  locality: string | null;
  postcodeArea: string | null;
  website: string | null;
};

/** INTERNAL ONLY. Never rendered publicly. The contact person's name is deliberately not kept. */
export type MappedContact = {
  supplierPartyId: string;
  email: string;
  domain: string;
  kind: EmailKind;
  /** A personal name accompanied the address in the notice (the name itself is discarded). */
  namePresent: boolean;
};

export type AwardCriterionSummary = { type: string | null; name: string | null; weight: number | null };
export type LotSummary = { id: string; title: string | null; value: number | null };

export type MappedNotice = {
  /** `${ocid}:${releaseId}` — one notice can cover several procurements (ocids). */
  id: string;
  releaseId: string;
  ocid: string;
  stage: NoticeStage;
  noticeType: string | null;
  regime: Regime;
  tags: string[];
  isUpdate: boolean;
  title: string;
  description: string | null;
  status: string | null;
  cpvMain: string | null;
  cpvCodes: string[];
  cpvDivisions: string[];
  cpvGroups: string[];
  cpvClasses: string[];
  /** Official labels of the codes, joined, for full-text search. */
  cpvText: string | null;
  category: string | null;
  valueAmount: number | null;
  valueGross: number | null;
  currency: string | null;
  valuePlaceholder: boolean;
  procedure: string | null;
  procurementMethod: string | null;
  competition: Competition;
  aboveThreshold: boolean | null;
  isFramework: boolean;
  specialRegimes: string[];
  publishedAt: string;
  deadlineAt: string | null;
  enquiryDeadlineAt: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  /** Planning stage: when the buyer expects to publish the tender notice. */
  futureNoticeAt: string | null;
  /** Planning stage: last date of market engagement. */
  engagementDeadlineAt: string | null;
  /** Delivery regions exactly as published ("UKK14", "UK", "FR"). */
  regionCodes: string[];
  /** Top-level UK regions for matching; falls back to the buyer's region. */
  regions: string[];
  regionSource: "delivery" | "buyer" | null;
  noticeUrl: string;
  awardCriteria: { criteria: AwardCriterionSummary[]; description: string | null } | null;
  lots: LotSummary[];
  lotsCount: number;
  smeSuitable: boolean | null;
  vcseSuitable: boolean | null;
  bidsCount: number | null;
  suppliersCount: number;
  /** Side effects on earlier awards of the same procurement (terminations, cancellations). */
  effects: NoticeEffects | null;
};

export type NoticeEffects = {
  /** UK11: award/contract ids whose contract ended early. */
  terminatedRefs?: string[];
  terminatedAt?: string | null;
  /** UK12: lots whose procurement was cancelled; "all" when the whole procurement ended. */
  cancelledLots?: string[] | "all";
};

export type MappedAward = {
  /** Stable for (ocid, release, award, supplier party). */
  id: string;
  noticeId: string;
  releaseId: string;
  ocid: string;
  awardRef: string;
  contractRef: string | null;
  /** Sorted related lot ids joined by "," ("" when the award names none). */
  lotKey: string;
  lots: string[];
  supplierPartyId: string;
  /** What identified the supplier in THIS notice: coh | ppon | register | name. */
  supplierBasis: string;
  title: string;
  cpvMain: string | null;
  cpvCodes: string[];
  cpvDivisions: string[];
  cpvGroups: string[];
  cpvClasses: string[];
  category: string | null;
  valueAmount: number | null;
  valueGross: number | null;
  currency: string | null;
  /** The figure covers several suppliers (framework, joint award): never attribute it to one. */
  valueShared: boolean;
  suppliersCount: number;
  /** pending | active | cancelled | unsuccessful | terminated */
  status: string;
  awardedAt: string | null;
  signedAt: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  maxExtentEnd: string | null;
  hasRenewal: boolean | null;
  procedure: string | null;
  competition: Competition;
  aboveThreshold: boolean | null;
  isFramework: boolean;
  noticeType: string | null;
  publishedAt: string;
  regionCodes: string[];
  regions: string[];
};

export type MappedRelease = {
  releaseId: string;
  ocid: string;
  publishedAt: string;
  buyer: MappedBuyer | null;
  suppliers: MappedSupplier[];
  contacts: MappedContact[];
  notice: MappedNotice;
  awards: MappedAward[];
  /** code -> official label, as published. Feeds the CPV picker. */
  cpvLabels: Record<string, string>;
};

const FTS_NOTICE_URL = "https://www.find-tender.service.gov.uk/Notice/";
const PPON_PATTERN = /^P[A-Z]{3}-\d{4}-[A-Z]{4}$/;
const REGISTER_SCHEMES = new Set(["GB-CHC", "GB-NHS", "GB-UKPRN", "GB-MPR", "GB-SC", "GB-NIC", "GB-GOR", "GB-LAE", "IM-CR", "JE-FSC", "GG-RCE"]);

// --- small pure helpers ------------------------------------------------------------------

function text(value: unknown, max = 20_000): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

/** ISO timestamp, or null. Date-only strings are read as the end of that day (deadlines). */
export function parseDate(value: unknown, endOfDay = false): string | null {
  if (typeof value !== "string" || !value) return null;
  const input = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z` : value;
  const time = Date.parse(input);
  if (Number.isNaN(time)) return null;
  const year = new Date(time).getUTCFullYear();
  if (year < 1990 || year > 2100) return null;
  return new Date(time).toISOString();
}

function minDate(values: Array<string | null>): string | null {
  const list = values.filter((value): value is string => Boolean(value)).sort();
  return list[0] ?? null;
}

function maxDate(values: Array<string | null>): string | null {
  const list = values.filter((value): value is string => Boolean(value)).sort();
  return list[list.length - 1] ?? null;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

function periodEnd(period: OcdsPeriod | null | undefined, fallbackStart: string | null): string | null {
  const end = parseDate(period?.endDate, true);
  if (end) return end;
  const start = parseDate(period?.startDate) ?? fallbackStart;
  const days = period?.durationInDays;
  if (start && typeof days === "number" && days > 0 && days < 36_500) return addDays(start, days);
  return null;
}

type CpvCollector = { codes: string[]; labels: Record<string, string> };

function collectItemCpv(items: OcdsItem[] | null | undefined, into: CpvCollector): void {
  for (const item of items ?? []) {
    for (const classification of [item.classification, ...(item.additionalClassifications ?? [])]) {
      if (!classification || (classification.scheme && classification.scheme !== "CPV")) continue;
      if (!isCpvCode(classification.id)) continue;
      if (!into.codes.includes(classification.id)) into.codes.push(classification.id);
      const label = text(classification.description, 200);
      if (label && !into.labels[classification.id]) into.labels[classification.id] = label;
    }
  }
}

function collectRegions(items: OcdsItem[] | null | undefined): string[] {
  const out: string[] = [];
  for (const item of items ?? []) {
    for (const address of item.deliveryAddresses ?? []) {
      const region = text(address?.region, 12)?.toUpperCase();
      if (region && !out.includes(region)) out.push(region);
    }
  }
  return out;
}

function cpvFacets(codes: string[]) {
  return {
    cpvDivisions: distinctCpv(codes, cpvDivision),
    cpvGroups: distinctCpv(codes, cpvGroup),
    cpvClasses: distinctCpv(codes, cpvClass),
  };
}

function ownNoticeType(release: OcdsRelease): { noticeType: string | null; url: string | null } {
  const groups = [
    release.tender?.documents,
    ...(release.awards ?? []).map((award) => award.documents),
    ...(release.contracts ?? []).map((contract) => contract.documents),
    release.planning?.documents,
  ];
  for (const documents of groups) {
    for (const document of documents ?? []) {
      if (document?.id === release.id && document.noticeType) {
        return { noticeType: document.noticeType, url: text(document.url, 500) };
      }
    }
  }
  return { noticeType: null, url: null };
}

function identifiersOf(party: OcdsParty): Array<{ scheme: string; id: string }> {
  const out: Array<{ scheme: string; id: string }> = [];
  for (const identifier of [party.identifier, ...(party.additionalIdentifiers ?? [])]) {
    const scheme = text(identifier?.scheme, 30)?.toUpperCase();
    const id = text(identifier?.id, 80);
    if (scheme && id) out.push({ scheme, id });
  }
  return out;
}

function pponOf(identifiers: Array<{ scheme: string; id: string }>): string | null {
  for (const identifier of identifiers) {
    if (identifier.scheme !== "GB-PPON") continue;
    const value = identifier.id.toUpperCase().replace(/\s+/g, "");
    if (PPON_PATTERN.test(value)) return value;
  }
  return null;
}

function registerKeys(identifiers: Array<{ scheme: string; id: string }>): string[] {
  const out: string[] = [];
  for (const identifier of identifiers) {
    if (!REGISTER_SCHEMES.has(identifier.scheme)) continue;
    const value = identifier.id.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length >= 3 && value.length <= 20) out.push(`${identifier.scheme}:${value}`);
  }
  return out;
}

function addressFacts(party: OcdsParty) {
  const address = party.address ?? {};
  const regionCode = text(address.region, 12)?.toUpperCase() ?? null;
  const countryName = text(address.countryName, 80);
  const country = text(address.country, 2)?.toUpperCase() ?? (countryName && /^united kingdom$/i.test(countryName) ? "GB" : null);
  return {
    country,
    regionCode,
    topRegion: topRegion(regionCode),
    locality: tidyPlace(text(address.locality, 120)),
    postcodeArea: country === null || country === "GB" ? postcodeArea(address.postalCode) : null,
  };
}

// --- organisations -------------------------------------------------------------------------

export function mapBuyerParty(party: OcdsParty): MappedBuyer | null {
  const name = cleanName(party.name ?? party.identifier?.legalName);
  const nameNorm = normaliseName(name);
  if (!party.id || !nameNorm) return null;
  const identifiers = identifiersOf(party);
  const ppon = pponOf(identifiers);
  const keys: string[] = [];
  if (ppon) keys.push(`GB-PPON:${ppon}`);
  keys.push(...registerKeys(identifiers));
  const coh = normaliseCompanyNumber(identifiers.find((identifier) => identifier.scheme === "GB-COH")?.id);
  if (coh) keys.push(`GB-COH:${coh}`);
  keys.push(`NAME:${nameNorm}`);
  const classifications = party.details?.classifications ?? [];
  const pick = (scheme: string) => text(classifications.find((entry) => entry?.scheme === scheme)?.id, 80);
  const facts = addressFacts(party);
  return {
    partyId: party.id,
    keys,
    name,
    nameNorm,
    ppon,
    buyerType: pick("UK_CA_TYPE") ?? pick("TED_CA_TYPE"),
    devolved: pick("UK_CA_DEVOLVED_REGULATIONS"),
    regionCode: facts.regionCode,
    topRegion: facts.topRegion,
    locality: facts.locality,
    postcodeArea: facts.postcodeArea,
    website: hostOf(party.details?.url),
  };
}

export function mapSupplierParty(party: OcdsParty): MappedSupplier | null {
  const name = cleanName(party.name ?? party.identifier?.legalName);
  const nameNorm = normaliseName(name);
  if (!party.id || !nameNorm || isPlaceholderSupplierName(name)) return null;
  const identifiers = identifiersOf(party);
  const coh = identifiers.filter((identifier) => identifier.scheme === "GB-COH").map((identifier) => normaliseCompanyNumber(identifier.id)).find(Boolean) ?? null;
  const ppon = pponOf(identifiers);
  const registers = registerKeys(identifiers);
  const keys: string[] = [];
  if (coh) keys.push(`GB-COH:${coh}`);
  if (ppon) keys.push(`GB-PPON:${ppon}`);
  keys.push(...registers);
  const identityBasis: MappedSupplier["identityBasis"] = coh ? "coh" : ppon ? "ppon" : registers.length > 0 ? "register" : "name";
  const suffix = legalSuffix(name);
  const registeredName = suffix === "ltd" || suffix === "plc" || suffix === "llp" || suffix === "cic";
  if (keys.length === 0 || registeredName) keys.push(`NAME:${nameNorm}`);
  const legal = classifyLegalForm({ coh, name, otherSchemes: registers.map((key) => key.split(":")[0]!) });
  const scale = party.details?.scale === "sme" ? "sme" : party.details?.scale === "large" ? "large" : null;
  const facts = addressFacts(party);
  return {
    partyId: party.id,
    keys,
    identityBasis,
    name,
    nameNorm,
    coh,
    ppon,
    scale,
    vcse: typeof party.details?.vcse === "boolean" ? party.details.vcse : null,
    legalForm: legal.legalForm,
    isIncorporated: legal.isIncorporated,
    legalEvidence: legal.evidence,
    country: facts.country,
    regionCode: facts.regionCode,
    topRegion: facts.topRegion,
    locality: facts.locality,
    postcodeArea: facts.postcodeArea,
    website: hostOf(party.details?.url),
  };
}

// --- notice ----------------------------------------------------------------------------------

function summariseCriteria(lots: OcdsLot[]): MappedNotice["awardCriteria"] {
  for (const lot of lots) {
    const block = lot.awardCriteria;
    if (!block) continue;
    const criteria: AwardCriterionSummary[] = (block.criteria ?? []).slice(0, 12).map((criterion) => {
      const exact = criterion.numbers?.find((entry) => typeof entry?.number === "number" && (entry.weight ?? "").startsWith("percentage"));
      // Legacy notices put the weight in `description` as a bare number ("40").
      const legacy = exact ? null : /^\s*(\d{1,3}(?:\.\d+)?)\s*%?\s*$/.exec(criterion.description ?? "");
      const weight = exact ? exact.number! : legacy ? Number(legacy[1]) : null;
      return {
        type: text(criterion.type, 30),
        name: text(criterion.name, 160) ?? (criterion.type === "price" || criterion.type === "cost" ? "Price" : null),
        weight: weight !== null && weight >= 0 && weight <= 100 ? weight : null,
      };
    });
    const description = text(block.description ?? block.weightingDescription, 600);
    if (criteria.length > 0 || description) return { criteria, description };
  }
  return null;
}

function combineValues(values: CleanValue[]): CleanValue | null {
  const known = values.filter((value) => value.amount !== null);
  if (known.length === 0) {
    const placeholder = values.some((value) => value.placeholder);
    return placeholder ? { amount: null, gross: null, currency: null, basis: null, placeholder: true } : null;
  }
  const currency = known[0]!.currency;
  const sameCurrency = known.filter((value) => value.currency === currency);
  const distinctAmounts = new Set(sameCurrency.map((value) => value.amount));
  // Frameworks repeat one ceiling on every award: count it once.
  if (distinctAmounts.size === 1) return sameCurrency[0]!;
  const sum = (pick: (value: CleanValue) => number | null) => sameCurrency.reduce((total, value) => total + (pick(value) ?? 0), 0);
  const grossComplete = sameCurrency.every((value) => value.gross !== null);
  return {
    amount: Math.round(sum((value) => value.amount) * 100) / 100,
    gross: grossComplete ? Math.round(sum((value) => value.gross) * 100) / 100 : null,
    currency,
    basis: sameCurrency.every((value) => value.basis === "net") ? "net" : "gross",
    placeholder: false,
  };
}

function contractFor(award: OcdsAward, contracts: OcdsContract[]): OcdsContract | null {
  const matches = contracts.filter((contract) => contract.awardID !== undefined && contract.awardID !== null && contract.awardID === award.id);
  if (matches.length === 0) return null;
  return matches.find((contract) => contract.value) ?? matches[0]!;
}

/**
 * Maps one release. Returns null only for records that cannot be keyed
 * (no ocid, id or parseable date).
 */
export function mapRelease(release: OcdsRelease): MappedRelease | null {
  const releaseId = text(release.id, 60);
  const ocid = text(release.ocid, 60);
  const publishedAt = parseDate(release.date);
  if (!releaseId || !ocid || !publishedAt) return null;

  const tender = release.tender ?? {};
  const tags = (release.tag ?? []).filter((tag): tag is string => typeof tag === "string");
  const parties = (release.parties ?? []).filter((party): party is OcdsParty => Boolean(party && party.id));
  const partyById = new Map(parties.map((party) => [party.id!, party]));
  const awardsRaw = (release.awards ?? []).filter(Boolean);
  const contractsRaw = (release.contracts ?? []).filter(Boolean);
  const lotsRaw = (tender.lots ?? []).filter(Boolean);

  const own = ownNoticeType(release);
  const noticeType = own.noticeType;
  const info = noticeType ? NOTICE_TYPES[noticeType] : undefined;
  const regime: Regime = tender.legalBasis?.scheme === "UKPGA" ? "PA23" : "legacy";
  const stage: NoticeStage = info?.stage ?? legacyStage(tags);
  const awardsAreWins = info ? info.awardsAreWins : stage === "award";

  // Buyer: the `buyer` reference, else the first party with the buyer role (UK9/UK11/UK12 omit `buyer`).
  const buyerParty =
    (release.buyer?.id ? partyById.get(release.buyer.id) : undefined) ?? parties.find((party) => (party.roles ?? []).includes("buyer"));
  const buyer = buyerParty ? mapBuyerParty(buyerParty) : null;

  // CPV: tender-stage notices carry it on tender.items, award-stage notices on awards[].items.
  const cpv: CpvCollector = { codes: [], labels: {} };
  if (isCpvCode(tender.classification?.id)) {
    cpv.codes.push(tender.classification.id);
    const label = text(tender.classification.description, 200);
    if (label) cpv.labels[tender.classification.id] = label;
  }
  collectItemCpv(tender.items, cpv);
  for (const award of awardsRaw) collectItemCpv(award.items, cpv);
  for (const contract of contractsRaw) collectItemCpv(contract.items, cpv);

  const regionCodes = collectRegions(tender.items);
  for (const award of awardsRaw) for (const code of collectRegions(award.items)) if (!regionCodes.includes(code)) regionCodes.push(code);
  for (const contract of contractsRaw) for (const code of collectRegions(contract.items)) if (!regionCodes.includes(code)) regionCodes.push(code);
  let regions = topRegions(regionCodes);
  let regionSource: MappedNotice["regionSource"] = regions.length > 0 ? "delivery" : null;
  if (regions.length === 0 && buyer?.topRegion) {
    regions = [buyer.topRegion];
    regionSource = "buyer";
  }

  const procedure = text(tender.procurementMethodDetails, 160);
  const procurementMethod = text(tender.procurementMethod, 40);
  const competition = competitionOf(procedure, procurementMethod);
  const thresholdFlags = [tender.aboveThreshold, ...awardsRaw.map((award) => award.aboveThreshold), ...contractsRaw.map((contract) => contract.aboveThreshold)].filter(
    (flag): flag is boolean => typeof flag === "boolean",
  );
  const noticeAboveThreshold = thresholdFlags.length > 0 ? thresholdFlags.some(Boolean) : procedure && /below threshold/i.test(procedure) ? false : null;
  const isFramework = tender.techniques?.hasFrameworkAgreement === true;

  // --- awards (contract wins) -------------------------------------------------------------
  const suppliers = new Map<string, MappedSupplier>();
  const contacts: MappedContact[] = [];
  const awards: MappedAward[] = [];
  const noticeId = `${ocid}:${releaseId}`;

  if (awardsAreWins) {
    for (const award of awardsRaw) {
      const awardRef = text(award.id, 80);
      if (!awardRef) continue;
      const contract = contractFor(award, contractsRaw);
      const supplierRefs = (award.suppliers ?? []).filter((ref) => ref && ref.id);
      const mappedSuppliers: MappedSupplier[] = [];
      for (const ref of supplierRefs) {
        const party = partyById.get(ref.id!);
        if (!party) continue;
        const mapped = suppliers.get(party.id!) ?? mapSupplierParty(party);
        if (!mapped) continue;
        if (!suppliers.has(mapped.partyId)) {
          suppliers.set(mapped.partyId, mapped);
          const contact = classifyEmail(party.contactPoint?.email);
          if (contact) {
            contacts.push({
              supplierPartyId: mapped.partyId,
              email: contact.email,
              domain: contact.domain,
              kind: contact.kind,
              namePresent: Boolean(text(party.contactPoint?.name)),
            });
          }
        }
        if (!mappedSuppliers.includes(mapped)) mappedSuppliers.push(mapped);
      }
      if (mappedSuppliers.length === 0) continue;

      const awardCpv: CpvCollector = { codes: [], labels: {} };
      collectItemCpv(award.items, awardCpv);
      if (contract) collectItemCpv(contract.items, awardCpv);
      const codes = awardCpv.codes.length > 0 ? awardCpv.codes : cpv.codes;
      let awardRegionCodes = collectRegions(award.items);
      if (awardRegionCodes.length === 0 && contract) awardRegionCodes = collectRegions(contract.items);
      if (awardRegionCodes.length === 0) awardRegionCodes = regionCodes;
      const awardRegions = topRegions(awardRegionCodes);

      const lots = [...new Set((award.relatedLots ?? []).filter((lot): lot is string => typeof lot === "string" && lot.length > 0))].sort();
      const relatedLot = lotsRaw.find((lot) => lot.id !== undefined && lots.includes(lot.id));
      const value = cleanValue(contract?.value ?? award.value);
      const signedAt = parseDate(contract?.dateSigned);
      const awardedAt = parseDate(award.date) ?? signedAt;
      const contractStart = parseDate(contract?.period?.startDate) ?? parseDate(award.contractPeriod?.startDate) ?? parseDate(relatedLot?.contractPeriod?.startDate);
      const contractEnd =
        periodEnd(contract?.period, signedAt) ?? periodEnd(award.contractPeriod, awardedAt) ?? periodEnd(relatedLot?.contractPeriod, contractStart ?? signedAt ?? awardedAt);
      const maxExtentEnd =
        parseDate(contract?.period?.maxExtentDate, true) ?? parseDate(award.contractPeriod?.maxExtentDate, true) ?? parseDate(relatedLot?.contractPeriod?.maxExtentDate, true);
      const contractStatus = text(contract?.status, 30);
      const awardStatus = text(award.status, 30);
      const status =
        contractStatus === "terminated" || contractStatus === "cancelled"
          ? contractStatus
          : awardStatus === "pending" || awardStatus === "active" || awardStatus === "cancelled" || awardStatus === "unsuccessful"
            ? awardStatus
            : "active";
      const threshold = typeof contract?.aboveThreshold === "boolean" ? contract.aboveThreshold : typeof award.aboveThreshold === "boolean" ? award.aboveThreshold : noticeAboveThreshold;
      const title =
        text(award.title, 400) ?? text(contract?.title, 400) ?? (lotsRaw.length > 1 ? text(relatedLot?.title, 400) : null) ?? text(tender.title, 400) ?? "Untitled contract";

      for (const supplier of mappedSuppliers) {
        awards.push({
          id: stableId("aw", `${ocid}|${releaseId}|${awardRef}|${supplier.partyId}`),
          noticeId,
          releaseId,
          ocid,
          awardRef,
          contractRef: text(contract?.id, 80),
          lotKey: lots.join(","),
          lots,
          supplierPartyId: supplier.partyId,
          supplierBasis: supplier.identityBasis,
          title,
          cpvMain: codes[0] ?? null,
          cpvCodes: codes,
          ...cpvFacets(codes),
          category: text(award.mainProcurementCategory, 20) ?? text(tender.mainProcurementCategory, 20),
          valueAmount: value.amount,
          valueGross: value.gross,
          currency: value.amount !== null ? value.currency : null,
          valueShared: mappedSuppliers.length > 1,
          suppliersCount: mappedSuppliers.length,
          status,
          awardedAt,
          signedAt,
          contractStart,
          contractEnd,
          maxExtentEnd,
          hasRenewal: typeof contract?.hasRenewal === "boolean" ? contract.hasRenewal : typeof award.hasRenewal === "boolean" ? award.hasRenewal : null,
          procedure,
          competition,
          aboveThreshold: threshold,
          isFramework,
          noticeType,
          publishedAt,
          regionCodes: awardRegionCodes,
          regions: awardRegions.length > 0 ? awardRegions : regions,
        });
      }
    }
  }

  // --- notice -----------------------------------------------------------------------------
  let noticeValue: CleanValue | null;
  if (stage === "award" || stage === "contract") {
    const contractValues = contractsRaw.filter((contract) => contract.value).map((contract) => cleanValue(contract.value));
    const awardValues = awardsRaw.filter((award) => award.value).map((award) => cleanValue(award.value));
    noticeValue = combineValues(contractValues.length > 0 ? contractValues : awardValues) ?? (tender.value ? cleanValue(tender.value) : null);
  } else {
    noticeValue = tender.value ? cleanValue(tender.value) : combineValues(lotsRaw.filter((lot) => lot.value).map((lot) => cleanValue(lot.value)));
  }

  const lotStarts = lotsRaw.map((lot) => parseDate(lot.contractPeriod?.startDate));
  const lotEnds = lotsRaw.map((lot) => periodEnd(lot.contractPeriod, parseDate(lot.contractPeriod?.startDate)));
  const awardStarts = awards.map((award) => award.contractStart);
  const awardEnds = awards.map((award) => award.contractEnd);

  const isTenderStage = stage === "tender" || stage === "market";
  const deadlineAt = isTenderStage || noticeType === "UK3" ? (parseDate(tender.tenderPeriod?.endDate, true) ?? parseDate(tender.expressionOfInterestDeadline, true)) : null;
  const engagement = (release.planning?.milestones ?? []).filter((milestone) => milestone?.type === "engagement").map((milestone) => parseDate(milestone.dueDate, true));

  let effects: NoticeEffects | null = null;
  if (noticeType === "UK11") {
    const refs = new Set<string>();
    for (const contract of contractsRaw) {
      if (contract.status !== "terminated") continue;
      for (const ref of [contract.id, contract.awardID]) if (typeof ref === "string" && ref) refs.add(ref);
    }
    effects = { terminatedRefs: [...refs], terminatedAt: maxDate(contractsRaw.map((contract) => parseDate(contract.implementation?.endDate, true))) ?? publishedAt };
  } else if (noticeType === "UK12") {
    const wholeProcurement = ["cancelled", "withdrawn", "unsuccessful"].includes(tender.status ?? "");
    const cancelledLots = lotsRaw.filter((lot) => lot.id && ["cancelled", "withdrawn", "unsuccessful"].includes(lot.status ?? "")).map((lot) => lot.id!);
    const fromAwards = awardsRaw.filter((award) => award.status === "cancelled").flatMap((award) => award.relatedLots ?? []);
    const lots = [...new Set([...cancelledLots, ...fromAwards])];
    effects = { cancelledLots: wholeProcurement || lots.length === 0 ? "all" : lots };
  }

  const bids = (release as { bids?: { statistics?: Array<{ measure?: string; value?: number }> } }).bids?.statistics ?? [];
  const bidValues = bids.filter((entry) => entry?.measure === "bids" && typeof entry.value === "number").map((entry) => entry.value!);

  const smeFlags = lotsRaw.map((lot) => lot.suitability?.sme).filter((flag): flag is boolean => typeof flag === "boolean");
  const vcseFlags = lotsRaw.map((lot) => lot.suitability?.vcse).filter((flag): flag is boolean => typeof flag === "boolean");
  const cpvText = cpv.codes.map((code) => cpv.labels[code]).filter(Boolean).join("; ");

  const notice: MappedNotice = {
    id: noticeId,
    releaseId,
    ocid,
    stage,
    noticeType,
    regime,
    tags,
    isUpdate: tags.some((tag) => /Update$|Amendment$/.test(tag)),
    title: text(tender.title, 600) ?? "Untitled notice",
    description: text(tender.description, 20_000),
    status: noticeType === "UK12" ? "cancelled" : text(tender.status, 30),
    cpvMain: cpv.codes[0] ?? null,
    cpvCodes: cpv.codes,
    ...cpvFacets(cpv.codes),
    cpvText: cpvText || null,
    category: text(tender.mainProcurementCategory, 20) ?? text(awardsRaw[0]?.mainProcurementCategory, 20),
    valueAmount: noticeValue?.amount ?? null,
    valueGross: noticeValue?.gross ?? null,
    currency: noticeValue?.amount != null ? noticeValue.currency : null,
    valuePlaceholder: noticeValue?.placeholder ?? false,
    procedure,
    procurementMethod,
    competition,
    aboveThreshold: noticeAboveThreshold,
    isFramework,
    specialRegimes: (tender.specialRegime ?? []).filter((entry): entry is string => typeof entry === "string").slice(0, 6),
    publishedAt,
    deadlineAt,
    enquiryDeadlineAt: isTenderStage ? parseDate(tender.enquiryPeriod?.endDate, true) : null,
    contractStart: minDate(awardStarts.length > 0 ? awardStarts : lotStarts),
    contractEnd: maxDate(awardEnds.length > 0 ? awardEnds : lotEnds),
    futureNoticeAt: stage === "planning" ? parseDate(tender.communication?.futureNoticeDate, true) : null,
    engagementDeadlineAt: stage === "planning" ? maxDate(engagement) : null,
    regionCodes,
    regions,
    regionSource,
    noticeUrl: own.url ?? `${FTS_NOTICE_URL}${encodeURIComponent(releaseId)}`,
    awardCriteria: summariseCriteria(lotsRaw),
    lots: lotsRaw.slice(0, 20).map((lot) => ({ id: String(lot.id ?? ""), title: text(lot.title, 200), value: lot.value ? cleanValue(lot.value).amount : null })),
    lotsCount: lotsRaw.length,
    smeSuitable: smeFlags.length > 0 ? smeFlags.some(Boolean) : null,
    vcseSuitable: vcseFlags.length > 0 ? vcseFlags.some(Boolean) : null,
    bidsCount: bidValues.length > 0 ? Math.max(...bidValues) : null,
    suppliersCount: suppliers.size,
    effects,
  };

  return {
    releaseId,
    ocid,
    publishedAt,
    buyer,
    suppliers: [...suppliers.values()],
    contacts,
    notice,
    awards,
    cpvLabels: cpv.labels,
  };
}
