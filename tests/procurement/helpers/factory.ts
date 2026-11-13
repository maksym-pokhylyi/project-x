import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "@/db";
import { mapRelease, type MappedRelease } from "@/features/procurement/domain/map-release";
import type { OcdsParty, OcdsRelease } from "@/features/procurement/domain/ocds";
import { upsertBatch, type UpsertSummary } from "@/features/procurement/ingest/upsert";
import { rebuildSupplierProfiles } from "@/features/procurement/profiles/build";

/** Fixed "today" for query tests, so nothing depends on the wall clock. */
export const NOW = new Date("2026-11-13T12:00:00Z");

export function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

/** A real release from tests/fixtures/fts (contact details scrubbed). */
export function fixture(name: string): OcdsRelease {
  const file = fileURLToPath(new URL(`../../fixtures/fts/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(file, "utf8")) as OcdsRelease;
}

export function mapped(release: OcdsRelease): MappedRelease {
  const result = mapRelease(release);
  if (!result) throw new Error("fixture did not map");
  return result;
}

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

export type BuyerSpec = { name: string; ppon: string; region?: string };
export type SupplierSpec = { name: string; coh?: string; ppon?: string; region?: string; email?: string; scale?: "sme" | "large" };

export function buyerParty(buyer: BuyerSpec): OcdsParty {
  return {
    id: `GB-PPON-${buyer.ppon}`,
    name: buyer.name,
    identifier: { scheme: "GB-PPON", id: buyer.ppon },
    address: { locality: "Testtown", postalCode: "LS1 1AA", country: "GB", countryName: "United Kingdom", region: buyer.region ?? "UKE42" },
    roles: ["buyer"],
    details: { classifications: [{ scheme: "UK_CA_TYPE", id: "publicAuthoritySubCentralGovernment" }] },
  };
}

export function supplierParty(supplier: SupplierSpec): OcdsParty {
  const id = supplier.coh ? `GB-COH-${supplier.coh}` : supplier.ppon ? `GB-PPON-${supplier.ppon}` : `GB-FTS-${next()}`;
  return {
    id,
    name: supplier.name,
    identifier: supplier.coh ? { scheme: "GB-COH", id: supplier.coh } : supplier.ppon ? { scheme: "GB-PPON", id: supplier.ppon } : { legalName: supplier.name },
    additionalIdentifiers: supplier.coh && supplier.ppon ? [{ scheme: "GB-PPON", id: supplier.ppon }] : undefined,
    address: { locality: "Supplierville", postalCode: "LS2 2BB", country: "GB", countryName: "United Kingdom", region: supplier.region ?? "UKE42" },
    contactPoint: supplier.email ? { email: supplier.email } : undefined,
    roles: ["supplier"],
    details: { scale: supplier.scale ?? "sme", vcse: false },
  };
}

const item = (cpv: string[], regions: string[]) => ({
  id: "1",
  additionalClassifications: cpv.map((code) => ({ scheme: "CPV", id: code, description: `Label of ${code}` })),
  deliveryAddresses: regions.map((region) => ({ region, country: "GB" })),
  relatedLot: "1",
});

export type TenderSpec = {
  ocid?: string;
  id?: string;
  title: string;
  description?: string;
  buyer: BuyerSpec;
  cpv: string[];
  regions?: string[];
  value?: number | null;
  /** Days from NOW to the deadline (negative = closed). */
  deadlineInDays?: number;
  publishedDaysAgo?: number;
  aboveThreshold?: boolean;
  tag?: string[];
  noticeType?: string;
  status?: string;
};

/** A Procurement Act tender notice (UK4) as the feed would publish it. */
export function tenderRelease(spec: TenderSpec): OcdsRelease {
  const n = next();
  const id = spec.id ?? `${String(900000 + n)}-2026`;
  const ocid = spec.ocid ?? `ocds-h6vhtk-t${String(n).padStart(5, "0")}`;
  const buyer = buyerParty(spec.buyer);
  const noticeType = spec.noticeType ?? "UK4";
  return {
    id,
    ocid,
    date: daysFromNow(-(spec.publishedDaysAgo ?? 5)),
    tag: spec.tag ?? ["tender"],
    parties: [buyer],
    buyer: { id: buyer.id, name: buyer.name },
    tender: {
      id: `REF-${n}`,
      legalBasis: { id: "2023/54", scheme: "UKPGA" },
      title: spec.title,
      description: spec.description ?? spec.title,
      status: spec.status ?? "active",
      items: [item(spec.cpv, spec.regions ?? ["UKE"])],
      value: spec.value === null ? undefined : { amount: spec.value ?? 200_000, amountGross: (spec.value ?? 200_000) * 1.2, currency: "GBP" },
      procurementMethod: "open",
      procurementMethodDetails: spec.aboveThreshold === false ? "Below threshold - open competition" : "Open procedure",
      mainProcurementCategory: "services",
      aboveThreshold: spec.aboveThreshold ?? true,
      tenderPeriod: { endDate: daysFromNow(spec.deadlineInDays ?? 21) },
      lots: [{ id: "1", status: "active", contractPeriod: { startDate: daysFromNow(60), endDate: daysFromNow(60 + 365) } }],
      documents: [{ id, documentType: noticeType === "UK12" ? "tenderCancellationNotice" : "tenderNotice", noticeType, url: `https://www.find-tender.service.gov.uk/Notice/${id}` }],
    },
  };
}

export type PlanningSpec = Omit<TenderSpec, "deadlineInDays" | "aboveThreshold"> & { futureNoticeInDays?: number };

/** A preliminary market engagement notice (UK2). */
export function planningRelease(spec: PlanningSpec): OcdsRelease {
  const base = tenderRelease({ ...spec, tag: ["planning"], noticeType: "UK2", status: "planning" });
  const id = base.id!;
  return {
    ...base,
    tender: { ...base.tender!, tenderPeriod: undefined, documents: undefined, procurementMethodDetails: undefined, communication: { futureNoticeDate: daysFromNow(spec.futureNoticeInDays ?? 45) } },
    planning: {
      documents: [{ id, documentType: "marketEngagementNotice", noticeType: "UK2", url: `https://www.find-tender.service.gov.uk/Notice/${id}` }],
      milestones: [{ type: "engagement", dueDate: daysFromNow(10), status: "scheduled" }],
    },
  };
}

export type ContractSpec = {
  ocid?: string;
  id?: string;
  title: string;
  buyer: BuyerSpec;
  suppliers: SupplierSpec[];
  cpv: string[];
  regions?: string[];
  value?: number | null;
  signedDaysAgo?: number;
  /** Days from NOW to the contract end (negative = already ended). */
  endsInDays?: number;
  publishedDaysAgo?: number;
  procedure?: string;
  method?: string;
  aboveThreshold?: boolean;
  lot?: string;
};

/** A contract details notice (UK7): one award, one contract. */
export function contractRelease(spec: ContractSpec): OcdsRelease {
  const n = next();
  const id = spec.id ?? `${String(800000 + n)}-2026`;
  const ocid = spec.ocid ?? `ocds-h6vhtk-c${String(n).padStart(5, "0")}`;
  const buyer = buyerParty(spec.buyer);
  const suppliers = spec.suppliers.map(supplierParty);
  const signed = daysFromNow(-(spec.signedDaysAgo ?? 30));
  const lot = spec.lot ?? "1";
  return {
    id,
    ocid,
    date: daysFromNow(-(spec.publishedDaysAgo ?? spec.signedDaysAgo ?? 30)),
    tag: ["award", "contract"],
    parties: [buyer, ...suppliers],
    buyer: { id: buyer.id, name: buyer.name },
    tender: {
      id: `REF-${n}`,
      legalBasis: { id: "2023/54", scheme: "UKPGA" },
      title: spec.title,
      description: spec.title,
      status: "complete",
      procurementMethod: spec.method ?? "open",
      procurementMethodDetails: spec.procedure ?? "Open procedure",
      lots: [{ id: lot, status: "complete" }],
    },
    awards: [
      {
        id: "1",
        title: spec.title,
        status: "active",
        suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name })),
        items: [{ ...item(spec.cpv, spec.regions ?? ["UKE"]), relatedLot: lot }],
        relatedLots: [lot],
        mainProcurementCategory: "services",
      },
    ],
    contracts: [
      {
        id: "1",
        awardID: "1",
        status: "active",
        value: spec.value === null ? undefined : { amount: spec.value ?? 120_000, amountGross: (spec.value ?? 120_000) * 1.2, currency: "GBP" },
        dateSigned: signed,
        period: { startDate: signed, endDate: daysFromNow(spec.endsInDays ?? 400) },
        aboveThreshold: spec.aboveThreshold ?? false,
        documents: [{ id, documentType: "contractNotice", noticeType: "UK7", url: `https://www.find-tender.service.gov.uk/Notice/${id}` }],
      },
    ],
  };
}

/** Maps and stores releases through the real pipeline, then rebuilds the touched profiles. */
export async function ingest(releases: OcdsRelease[], options: { profiles?: boolean } = {}): Promise<UpsertSummary> {
  const summary = await upsertBatch(db, releases.map(mapped));
  if (options.profiles !== false) await rebuildSupplierProfiles(db, summary.touchedSupplierIds, NOW);
  return summary;
}
