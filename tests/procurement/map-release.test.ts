import { describe, expect, it } from "vitest";
import { mapRelease, parseDate } from "@/features/procurement/domain/map-release";
import type { OcdsRelease } from "@/features/procurement/domain/ocds";
import { resolveEntities } from "@/features/procurement/ingest/resolve";
import { fixture, mapped } from "./helpers/factory";

/**
 * mapRelease on REAL releases from the Find a Tender feed (tests/fixtures/fts, contact
 * details scrubbed). Each fixture was picked for a different kind of mess.
 */
describe("mapRelease: tender-stage notices", () => {
  it("maps a Procurement Act tender notice (UK4) with lots and weighted criteria", () => {
    const { notice, awards, suppliers, buyer } = mapped(fixture("uk4-tender"));
    expect(notice).toMatchObject({
      id: "ocds-h6vhtk-069f8b:086022-2026",
      releaseId: "086022-2026",
      ocid: "ocds-h6vhtk-069f8b",
      stage: "tender",
      noticeType: "UK4",
      regime: "PA23",
      isUpdate: false,
      title: "Terra Nova Construction Materials",
      status: "active",
      cpvMain: "44111100",
      valueAmount: 15_000_000,
      currency: "GBP",
      valuePlaceholder: false,
      procedure: "Open procedure",
      competition: "open",
      aboveThreshold: true,
      isFramework: true,
      deadlineAt: "2026-10-05T11:00:00.000Z",
      regionCodes: ["UKD", "UKE3"],
      regions: ["UKD", "UKE"],
      regionSource: "delivery",
      lotsCount: 3,
      smeSuitable: true,
      noticeUrl: "https://www.find-tender.service.gov.uk/Notice/086022-2026",
    });
    expect(notice.cpvCodes).toHaveLength(4);
    expect(notice.cpvDivisions).toContain("44");
    expect(notice.cpvText).toBeTruthy();
    expect(notice.awardCriteria?.criteria.slice(0, 2)).toEqual([
      { type: "price", name: "Price", weight: 70 },
      { type: "quality", name: "Quality", weight: 30 },
    ]);
    expect(awards).toEqual([]);
    expect(suppliers).toEqual([]);
    // A buyer identified on a register other than PPON still gets a stable key.
    expect(buyer).toMatchObject({ name: "Great Places Housing Group", keys: ["GB-MPR:30045R", "NAME:great places housing group"], topRegion: "UKD" });
  });

  it("maps an update of the same procurement to a new notice version", () => {
    const original = mapped(fixture("uk4-tender")).notice;
    const update = mapped(fixture("uk4-tender-update")).notice;
    expect(update.ocid).toBe(original.ocid);
    expect(update.id).not.toBe(original.id);
    expect(update.isUpdate).toBe(true);
    expect(update.publishedAt > original.publishedAt).toBe(true);
  });

  it("maps an old-regime tender forwarded from Public Contracts Scotland", () => {
    const { notice, buyer } = mapped(fixture("legacy-tender-scotland"));
    expect(notice).toMatchObject({ stage: "tender", noticeType: null, regime: "legacy", cpvMain: "50720000", valueAmount: 710_000, competition: "open", deadlineAt: "2026-10-12T16:00:00.000Z", regions: ["UKM"], lotsCount: 3 });
    // Legacy criteria carry the weight as a bare number in `description`.
    expect(notice.awardCriteria?.criteria).toEqual([
      { type: "quality", name: "Quality", weight: 60 },
      { type: "price", name: "Price", weight: 40 },
    ]);
    // No notice document in legacy releases: the URL is built from the notice id.
    expect(notice.noticeUrl).toBe("https://www.find-tender.service.gov.uk/Notice/086108-2026");
    // No identifier scheme at all: the buyer is keyed by its normalised name.
    expect(buyer?.keys).toEqual(["NAME:maryhill housing association"]);
  });

  it("marks a procurement termination notice (UK12) as cancelling the whole procurement", () => {
    const { notice, awards } = mapped(fixture("uk12-cancellation"));
    expect(notice).toMatchObject({ stage: "tender", noticeType: "UK12", status: "cancelled", effects: { cancelledLots: "all" } });
    expect(awards).toEqual([]);
    expect(mapped(fixture("uk4-cancelled-tender")).notice.ocid).toBe(notice.ocid);
  });

  it("maps a market engagement notice (UK2) with its expected tender date", () => {
    const { notice } = mapped(fixture("uk2-planning"));
    expect(notice).toMatchObject({ stage: "planning", noticeType: "UK2", status: "planning", deadlineAt: null, futureNoticeAt: "2026-09-15T22:59:59.000Z", engagementDeadlineAt: "2026-09-15T22:59:59.000Z", valueAmount: 250_000 });
  });
});

describe("mapRelease: awards and contracts", () => {
  it("maps a contract award notice (UK6) and the contract details notice (UK7) that follows it", () => {
    const award = mapped(fixture("uk6-award"));
    const contract = mapped(fixture("uk7-contract"));
    expect(award.notice).toMatchObject({ stage: "award", noticeType: "UK6", aboveThreshold: false, competition: "open", valueAmount: 64_998.5, valueGross: 77_998.2 });
    expect(award.awards).toHaveLength(1);
    expect(award.awards[0]).toMatchObject({ awardRef: "1", contractRef: null, lotKey: "1", valueAmount: 64_998.5, valueShared: false, status: "active", signedAt: null, contractEnd: "2027-12-25T23:59:59.000Z", cpvMain: "37400000", regions: ["UKD"], supplierBasis: "coh" });
    // The UK7 carries the signed contract: value, signature date and period come from contracts[].
    expect(contract.awards[0]).toMatchObject({ contractRef: "1", valueAmount: 64_998.5, signedAt: "2026-09-27T23:00:00.000Z", contractStart: "2026-09-27T23:00:00.000Z", contractEnd: "2027-12-28T23:59:59.000Z", noticeType: "UK7" });
    // Same procurement, same lot, same supplier party: the later row supersedes the earlier one.
    expect(contract.awards[0]!.ocid).toBe(award.awards[0]!.ocid);
    expect(contract.awards[0]!.lotKey).toBe(award.awards[0]!.lotKey);
    expect(contract.awards[0]!.id).not.toBe(award.awards[0]!.id);
    expect(contract.suppliers[0]).toMatchObject({
      name: "KEISER UK LIMITED",
      coh: "04264117",
      ppon: "PPBM-3347-QNGJ",
      keys: ["GB-COH:04264117", "GB-PPON:PPBM-3347-QNGJ", "NAME:keiser uk ltd"],
      identityBasis: "coh",
      scale: "sme",
      legalForm: "ltd",
      isIncorporated: true,
      legalEvidence: "company_number_and_suffix",
      country: "GB",
      postcodeArea: "GL",
    });
  });

  it("keeps a transparency notice (UK5) as a pending direct award", () => {
    const { notice, awards } = mapped(fixture("uk5-transparency"));
    expect(notice).toMatchObject({ noticeType: "UK5", competition: "direct", regions: ["UK"] });
    expect(awards[0]).toMatchObject({ status: "pending", valueAmount: 1_504_800, competition: "direct", awardedAt: null, contractEnd: "2029-09-23T22:59:59.000Z", maxExtentEnd: "2032-09-23T22:59:59.000Z" });
  });

  it("treats £0 / £1 values as not published", () => {
    for (const name of ["uk7-placeholder-value", "legacy-award-placeholder-value"]) {
      const { notice, awards } = mapped(fixture(name));
      expect(notice.valueAmount, name).toBeNull();
      expect(notice.valuePlaceholder, name).toBe(true);
      expect(awards[0]!.valueAmount, name).toBeNull();
      expect(awards[0]!.currency, name).toBeNull();
    }
  });

  it("never attributes a framework value shared by several suppliers to one of them", () => {
    const { notice, awards, suppliers } = mapped(fixture("uk7-shared-framework"));
    expect(suppliers).toHaveLength(6);
    expect(awards).toHaveLength(6);
    expect(new Set(awards.map((award) => award.supplierPartyId)).size).toBe(6);
    for (const award of awards) expect(award).toMatchObject({ valueShared: true, suppliersCount: 6, isFramework: true, lotKey: "2PI", valueAmount: 6_666_666 });
    expect(new Set(awards.map((award) => award.id)).size).toBe(6);
    expect(notice.isFramework).toBe(true);
    expect(notice.suppliersCount).toBe(6);
  });

  it("keys a supplier without any identifier by its registered name", () => {
    const { suppliers, awards, notice } = mapped(fixture("legacy-award-no-identifier"));
    expect(notice).toMatchObject({ regime: "legacy", noticeType: null, competition: "direct", valueAmount: 803_497.5 });
    expect(suppliers[0]).toMatchObject({ keys: ["NAME:north staffordshire gp federation ltd"], identityBasis: "name", coh: null, ppon: null, legalForm: "ltd", legalEvidence: "suffix" });
    expect(awards[0]).toMatchObject({ supplierBasis: "name", status: "active", contractEnd: null });
  });

  it("maps a non-UK supplier and a non-GBP value", () => {
    const { suppliers, awards } = mapped(fixture("uk7-non-uk-supplier"));
    expect(suppliers[0]).toMatchObject({ country: "US", coh: null, legalForm: "unknown", isIncorporated: false, topRegion: null, postcodeArea: null, keys: ["GB-PPON:PGGL-9493-PMMR"] });
    expect(awards[0]).toMatchObject({ currency: "USD", valueAmount: 115_500 });
  });

  it("does not count dynamic-market members (UK15) as contract wins", () => {
    const { notice, awards, suppliers, contacts } = mapped(fixture("uk15-dynamic-market"));
    expect(notice).toMatchObject({ stage: "market", noticeType: "UK15" });
    expect(awards).toEqual([]);
    expect(suppliers).toEqual([]);
    expect(contacts).toEqual([]);
  });

  it("records a contract termination notice (UK11) as an effect on the earlier award", () => {
    const { notice, awards, buyer } = mapped(fixture("uk11-termination"));
    expect(notice).toMatchObject({ stage: "contract", noticeType: "UK11", effects: { terminatedRefs: ["1"], terminatedAt: "2026-08-10T23:00:00.000Z" } });
    expect(awards).toEqual([]);
    // UK11 releases omit `buyer`; it is recovered from the party with the buyer role.
    expect(buyer?.name).toBe("London Borough of Islington");
  });
});

describe("mapRelease: contacts (internal only)", () => {
  it("classifies the published address and keeps no personal name", () => {
    const generic = mapped(fixture("uk6-award")).contacts[0];
    expect(generic).toEqual({ supplierPartyId: "GB-COH-04264117", email: "tender@keiseruk.com", domain: "keiseruk.com", kind: "generic", namePresent: false });
    expect(mapped(fixture("uk7-freemail-supplier")).contacts[0]).toMatchObject({ kind: "freemail", domain: "gmail.com" });
    expect(mapped(fixture("uk5-transparency")).contacts[0]).toMatchObject({ kind: "named" });
    // The notice published a contact name next to this role mailbox: only the fact is kept.
    const withName = mapped(fixture("uk7-supplier-ppon-only"));
    expect(withName.contacts[0]).toEqual({ supplierPartyId: "GB-PPON-PRQC-5121-CMBL", email: "bid.management@biffa.co.uk", domain: "biffa.co.uk", kind: "generic", namePresent: true });
    expect(JSON.stringify(withName)).not.toContain("Redacted Name");
  });

  it("never carries a contact name or telephone number in its output", () => {
    for (const name of ["uk4-tender", "uk6-award", "uk7-contract", "uk7-shared-framework", "legacy-award-no-identifier", "legacy-tender-scotland", "uk2-planning"]) {
      const output = JSON.stringify(mapped(fixture(name)));
      expect(output, name).not.toContain("Redacted Name");
      expect(output, name).not.toContain("+44 0000 000000");
      expect(output, name).not.toMatch(/"(telephone|contactName|faxNumber)"/);
    }
  });
});

describe("mapRelease: robustness", () => {
  it("returns null for records that cannot be keyed and survives missing sections", () => {
    expect(mapRelease({})).toBeNull();
    expect(mapRelease({ id: "1-2026", ocid: "ocds-h6vhtk-000001", date: "not a date" })).toBeNull();
    const bare = mapRelease({ id: "1-2026", ocid: "ocds-h6vhtk-000001", date: "2026-11-01T10:00:00Z", tag: ["tender"] });
    expect(bare?.notice).toMatchObject({ title: "Untitled notice", stage: "tender", cpvCodes: [], valueAmount: null, regions: [], noticeUrl: "https://www.find-tender.service.gov.uk/Notice/1-2026" });
    expect(bare?.buyer).toBeNull();
  });

  it("is pure: the same release always maps to the same output", () => {
    const release = fixture("uk7-shared-framework");
    const frozen = JSON.stringify(release);
    const first = mapRelease(release);
    const second = mapRelease(JSON.parse(frozen) as OcdsRelease);
    expect(JSON.stringify(release)).toBe(frozen);
    expect(second).toEqual(first);
  });

  it("parses the feed's mixed date formats", () => {
    expect(parseDate("2026-11-12T19:45:06Z")).toBe("2026-11-12T19:45:06.000Z");
    expect(parseDate("2026-10-22T15:44:31+01:00")).toBe("2026-10-22T14:44:31.000Z");
    expect(parseDate("2026-11-09", true)).toBe("2026-11-09T23:59:59.000Z");
    expect(parseDate("0001-01-01T00:00:00Z")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("drops suppliers whose name is a placeholder and skips unusable identifiers", () => {
    const release = fixture("uk7-contract");
    const supplier = release.parties!.find((party) => party.roles?.includes("supplier"))!;
    supplier.name = "Withheld Section 94 Supplier";
    expect(mapped(release).awards).toEqual([]);
    const second = fixture("uk7-contract");
    const party = second.parties!.find((entry) => entry.roles?.includes("supplier"))!;
    party.identifier = { scheme: "GB-COH", id: "TBC" };
    party.additionalIdentifiers = [];
    // "TBC" is not a company number: the supplier falls back to its registered name.
    expect(mapped(second).suppliers[0]).toMatchObject({ coh: null, identityBasis: "name", keys: ["NAME:keiser uk ltd"] });
  });
});

describe("identity resolution across notices", () => {
  const options = { idPrefix: "sup", exclusiveScheme: "GB-COH" };

  it("lands a PPON-only notice on the supplier first seen with its company number", () => {
    const withBoth = mapped(fixture("uk7-supplier-coh-and-ppon")).suppliers[0]!;
    const pponOnly = mapped(fixture("uk7-supplier-ppon-only")).suppliers[0]!;
    expect(pponOnly.coh).toBeNull();
    const result = resolveEntities(
      [
        { ref: "a", keys: withBoth.keys },
        { ref: "b", keys: pponOnly.keys },
      ],
      new Map(),
      options,
    );
    expect(result.entityOf.get("a")).toBe(result.entityOf.get("b"));
    expect(result.created.size).toBe(1);
    expect(result.merges).toEqual([]);
  });

  it("gives the same grouping whatever the order, and merges rows that turn out to be one company", () => {
    const records = [
      { ref: "coh", keys: ["GB-COH:00946107"] },
      { ref: "ppon", keys: ["GB-PPON:PRQC-5121-CMBL"] },
      { ref: "both", keys: ["GB-COH:00946107", "GB-PPON:PRQC-5121-CMBL"] },
    ];
    const forward = resolveEntities(records, new Map(), options);
    const backward = resolveEntities([...records].reverse(), new Map(), options);
    for (const result of [forward, backward]) {
      expect(new Set(result.entityOf.values()).size).toBe(1);
    }
    expect(forward.entityOf.get("coh")).toBe(backward.entityOf.get("coh"));

    // The two rows already exist separately; a later notice carrying both identifiers folds the PPON row into the company row.
    const existing = new Map([
      ["GB-COH:00946107", "sup_company"],
      ["GB-PPON:PRQC-5121-CMBL", "sup_ppon"],
    ]);
    const merged = resolveEntities([records[2]!], existing, options);
    expect(merged.entityOf.get("both")).toBe("sup_company");
    expect(merged.merges).toEqual([{ from: "sup_ppon", into: "sup_company" }]);
    expect(merged.aliases.get("GB-PPON:PRQC-5121-CMBL")).toBe("sup_company");
  });

  it("never merges two different company numbers, whatever else they share", () => {
    const existing = new Map([
      ["GB-COH:11111111", "sup_one"],
      ["GB-PPON:PAAA-1111-AAAA", "sup_one"],
    ]);
    const result = resolveEntities([{ ref: "x", keys: ["GB-COH:22222222", "GB-PPON:PAAA-1111-AAAA", "NAME:acme ltd"] }], existing, options);
    expect(result.entityOf.get("x")).not.toBe("sup_one");
    expect(result.merges).toEqual([]);
    // The shared platform id stays with the company that had it first.
    expect(result.aliasView.get("GB-PPON:PAAA-1111-AAAA")).toBe("sup_one");
    expect(result.aliasView.get("GB-COH:22222222")).toBe(result.entityOf.get("x"));
  });

  it("matches a name-only notice to the company registered under exactly that name", () => {
    const existing = new Map([
      ["GB-COH:04264117", "sup_keiser"],
      ["NAME:keiser uk ltd", "sup_keiser"],
    ]);
    const result = resolveEntities(
      [
        { ref: "legacy", keys: ["NAME:keiser uk ltd"] },
        { ref: "other", keys: ["NAME:keiser fitness ltd"] },
      ],
      existing,
      options,
    );
    expect(result.entityOf.get("legacy")).toBe("sup_keiser");
    expect(result.entityOf.get("other")).not.toBe("sup_keiser");
  });
});
