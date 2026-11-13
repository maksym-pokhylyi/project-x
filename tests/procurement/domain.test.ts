import { describe, expect, it } from "vitest";
import { PLANS } from "@/config/plans";
import { canAddRadarSource, radarAccess } from "@/features/procurement/access";
import { cpvPrefixes, cpvStem, sharedCpvDepth, shortCpvLabel } from "@/features/procurement/domain/cpv";
import { calendarDaysBetween, describeDeadline, describeTimeUntil, formatDateTime } from "@/features/procurement/domain/format";
import { cleanValue, formatMoneyExact, formatMoneyShort } from "@/features/procurement/domain/money";
import {
  classifyEmail,
  classifyLegalForm,
  isPlaceholderSupplierName,
  legalSuffix,
  normaliseCompanyNumber,
  normaliseName,
  postcodeArea,
  stableId,
} from "@/features/procurement/domain/normalize";
import { competitionOf, legacyStage, noticeBadgeKind } from "@/features/procurement/domain/notice-types";
import { outreachEligibility, type OutreachContact, type OutreachSupplier } from "@/features/procurement/domain/outreach";
import { buildSupplierProfile, scoreCpv, scoreNotice, specFromManualProfile, tradeLevels, type ProfileAward, type RadarSpec } from "@/features/procurement/domain/profile";
import { closestReference, explainMatch, isAcceptableReason, isGroundedReason } from "@/features/procurement/domain/reasons";
import { regionsLabel, topRegion, topRegions } from "@/features/procurement/domain/regions";
import { keywordsToWebQuery, termsOf, topKeywords } from "@/features/procurement/domain/text";

const NOW = new Date("2026-11-13T12:00:00Z");

describe("organisation names and identifiers", () => {
  it("normalises names but keeps the legal suffix", () => {
    expect(normaliseName("ACME  Grounds & Maintenance LIMITED.")).toBe("acme grounds and maintenance ltd");
    expect(normaliseName("The Acme Co. Ltd")).toBe("acme co ltd");
    expect(normaliseName("Acme")).not.toBe(normaliseName("Acme Ltd"));
    expect(normaliseName("Café Société Cyf")).toBe("cafe societe ltd");
    expect(normaliseName("O'Connor Public Limited Company")).toBe("oconnor plc");
  });

  it("restores dropped leading zeros and rejects junk company numbers", () => {
    expect(normaliseCompanyNumber("1243967")).toBe("01243967");
    expect(normaliseCompanyNumber("02773548")).toBe("02773548");
    expect(normaliseCompanyNumber(" sc 123456 ")).toBe("SC123456");
    expect(normaliseCompanyNumber("OC300001")).toBe("OC300001");
    expect(normaliseCompanyNumber("IP29918R")).toBe("IP29918R");
    for (const junk of ["TBC", "experian ltd", "Withheld Section 94 Supplier", "PPON PGXJ-9617-YWTL", "00000000", "12345", ""]) {
      expect(normaliseCompanyNumber(junk), junk).toBeNull();
    }
  });

  it("classifies legal form from the number prefix and the name suffix", () => {
    expect(classifyLegalForm({ coh: "02773548", name: "M.C.M. CONSTRUCTION LIMITED" })).toMatchObject({ legalForm: "ltd", isIncorporated: true, evidence: "company_number_and_suffix" });
    expect(classifyLegalForm({ coh: "00123456", name: "Softcat plc" }).legalForm).toBe("plc");
    expect(classifyLegalForm({ coh: "OC322760", name: "Gibbs Laidler Consulting LLP" }).legalForm).toBe("llp");
    // A company-type number but no suffix to cross-check against.
    expect(classifyLegalForm({ coh: "03056469", name: "Miquill Catering Services" })).toMatchObject({ legalForm: "company", evidence: "company_number" });
    // Limited partnerships hold a number without being a company.
    expect(classifyLegalForm({ coh: "LP012345", name: "Smith Capital LP" })).toMatchObject({ legalForm: "lp", isIncorporated: false });
    expect(classifyLegalForm({ coh: null, name: "A2B Taxis" })).toMatchObject({ legalForm: "unknown", isIncorporated: false, evidence: "none" });
    expect(classifyLegalForm({ coh: null, name: "Acme Ltd" })).toMatchObject({ legalForm: "ltd", evidence: "suffix" });
    expect(classifyLegalForm({ coh: null, name: "Helping Hands", otherSchemes: ["GB-CHC"] })).toMatchObject({ legalForm: "charity", isIncorporated: false });
    expect(legalSuffix("PageOne Communications Ltd T/A Critico")).toBe("ltd");
    expect(legalSuffix("Critico")).toBeNull();
  });

  it("spots names published instead of a supplier", () => {
    expect(isPlaceholderSupplierName("Withheld Section94 Supplier")).toBe(true);
    expect(isPlaceholderSupplierName("N/A")).toBe(true);
    expect(isPlaceholderSupplierName("Keiser UK Limited")).toBe(false);
  });

  it("gives the same id for the same key", () => {
    expect(stableId("sup", "GB-COH:02773548")).toBe(stableId("sup", "GB-COH:02773548"));
    expect(stableId("sup", "GB-COH:02773548")).not.toBe(stableId("sup", "GB-COH:02773549"));
    expect(postcodeArea("PO30 5XJ")).toBe("PO");
    expect(postcodeArea("02559")).toBeNull();
  });
});

describe("contact email classification", () => {
  it("separates role mailboxes, named people and free-mail", () => {
    const kind = (email: string) => classifyEmail(email)?.kind;
    for (const generic of ["info@acme.co.uk", "Tenders@Acme.co.uk", "sales.uk@acme.com", "bidteam@acme.com", "business.development@acme.com", "tenders2@acme.com", "ukbids@acme.com"]) {
      expect(kind(generic), generic).toBe("generic");
    }
    for (const named of ["jane.smith@acme.co.uk", "david@acme.co.uk", "j.smith@acme.com", "david.tenders@acme.com", "surreytransporterslimited@acme.com", "uk@acme.com"]) {
      expect(kind(named), named).toBe("named");
    }
    for (const free of ["info@gmail.com", "acme.ltd@hotmail.co.uk", "sales@btinternet.com", "bob@yahoo.co.uk"]) {
      expect(kind(free), free).toBe("freemail");
    }
    expect(classifyEmail("not an email")).toBeNull();
    expect(classifyEmail("")).toBeNull();
    expect(classifyEmail("Info@Acme.CO.UK")).toEqual({ email: "info@acme.co.uk", domain: "acme.co.uk", kind: "generic" });
  });
});

describe("outreach eligibility gate", () => {
  const supplier: OutreachSupplier = { name: "Acme Grounds Ltd", coh: "02773548", legalForm: "ltd", country: "GB" };
  const generic: OutreachContact = { email: "tenders@acme.co.uk", kind: "generic", namePresent: false, firstIngestedAt: "2026-06-01T00:00:00Z" };

  it("passes an incorporated company with a role mailbox on its own domain", () => {
    expect(outreachEligibility(supplier, generic, NOW)).toEqual({ eligible: true, reasons: [], personalData: false, contactBy: null });
    expect(outreachEligibility({ ...supplier, name: "Softcat plc", legalForm: "plc" }, generic, NOW).eligible).toBe(true);
    expect(outreachEligibility({ ...supplier, name: "Gibbs Laidler LLP", coh: "OC322760", legalForm: "llp" }, generic, NOW).eligible).toBe(true);
  });

  it("rejects anything that is not demonstrably a corporate subscriber", () => {
    const reasons = (s: OutreachSupplier) => outreachEligibility(s, generic, NOW).reasons;
    expect(reasons({ ...supplier, coh: null, legalForm: "ltd" })).toContain("no_company_number");
    expect(reasons({ ...supplier, name: "A2B Taxis", coh: null, legalForm: "unknown" })).toEqual(["no_company_number", "legal_form_unknown"]);
    expect(reasons({ ...supplier, name: "Smith Capital LP", coh: "LP012345", legalForm: "lp" })).toContain("limited_partnership");
    expect(reasons({ ...supplier, name: "Miquill Catering Services", legalForm: "company" })).toEqual(["name_suffix_missing"]);
    expect(reasons({ ...supplier, name: "Helping Hands", coh: null, legalForm: "charity" })).toEqual(["no_company_number", "legal_form_not_allowed"]);
    expect(reasons({ ...supplier, name: "Acme CIC", legalForm: "cic" })).toEqual(["legal_form_not_allowed"]);
    expect(reasons({ ...supplier, country: "US" })).toEqual(["non_uk_supplier"]);
    expect(reasons({ ...supplier, removedAt: "2026-10-01T00:00:00Z" })).toEqual(["supplier_removed"]);
    expect(reasons({ ...supplier, coh: "2773548" })).toEqual(["invalid_company_number"]);
  });

  it("never allows free-mail or suppressed addresses", () => {
    expect(outreachEligibility(supplier, { ...generic, email: "acme@gmail.com", kind: "freemail" }, NOW).reasons).toContain("freemail_domain");
    // Even if the stored kind is stale, the domain check still applies.
    expect(outreachEligibility(supplier, { ...generic, email: "info@hotmail.co.uk" }, NOW).eligible).toBe(false);
    expect(outreachEligibility(supplier, { ...generic, suppressedAt: "2026-10-01T00:00:00Z" }, NOW).reasons).toEqual(["suppressed"]);
    expect(outreachEligibility(supplier, { ...generic, email: "nonsense" }, NOW).reasons).toContain("invalid_email");
  });

  it("allows a named address only within one month of first storing it", () => {
    const fresh = outreachEligibility(supplier, { email: "jane.smith@acme.co.uk", kind: "named", namePresent: false, firstIngestedAt: "2026-11-01T00:00:00Z" }, NOW);
    expect(fresh).toMatchObject({ eligible: true, personalData: true });
    expect(fresh.contactBy?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    const stale = outreachEligibility(supplier, { email: "jane.smith@acme.co.uk", kind: "named", namePresent: false, firstIngestedAt: "2026-09-01T00:00:00Z" }, NOW);
    expect(stale).toMatchObject({ eligible: false, reasons: ["named_address_past_one_month"] });
    // A role mailbox published with a person's name is treated as personal data too.
    expect(outreachEligibility(supplier, { ...generic, namePresent: true, firstIngestedAt: "2026-09-01T00:00:00Z" }, NOW).reasons).toEqual(["named_address_past_one_month"]);
  });
});

describe("values, dates and labels", () => {
  it("treats zero and £1 values as not published", () => {
    expect(cleanValue({ amount: 49620, currency: "GBP" })).toMatchObject({ amount: 49620, basis: "net", placeholder: false });
    expect(cleanValue({ amountGross: 48000, currency: "GBP" })).toMatchObject({ amount: 48000, gross: 48000, basis: "gross" });
    expect(cleanValue({ amount: 1, amountGross: 1, currency: "GBP" })).toMatchObject({ amount: null, placeholder: true });
    expect(cleanValue({ amount: 0 })).toMatchObject({ amount: null, placeholder: true });
    expect(cleanValue(null)).toMatchObject({ amount: null, placeholder: false });
    expect(cleanValue({ amount: Number.POSITIVE_INFINITY })).toMatchObject({ amount: null, placeholder: false });
  });

  it("formats money the way the design system asks", () => {
    expect(formatMoneyShort(102_340)).toBe("£102k");
    expect(formatMoneyShort(1_200_000)).toBe("£1.2m");
    expect(formatMoneyShort(303_000_000)).toBe("£303m");
    expect(formatMoneyShort(2_500_000_000)).toBe("£2.5bn");
    expect(formatMoneyShort(1500)).toBe("£1.5k");
    expect(formatMoneyShort(115_500, "USD")).toBe("$116k");
    expect(formatMoneyShort(0)).toBeNull();
    expect(formatMoneyShort(null)).toBeNull();
    expect(formatMoneyExact(102_340)).toBe("£102,340");
  });

  it("describes deadlines with urgency and the absolute date", () => {
    expect(describeDeadline("2026-11-22T12:00:00Z", NOW)).toEqual({ label: "Closes in 9 days", absolute: "22 Nov 2026, 12:00", urgency: "soon", days: 9 });
    expect(describeDeadline("2026-12-20T12:00:00Z", NOW)?.urgency).toBe("neutral");
    expect(describeDeadline("2026-11-16T09:00:00Z", NOW)).toMatchObject({ label: "Closes in 3 days", urgency: "urgent" });
    expect(describeDeadline("2026-11-14T09:00:00Z", NOW)?.label).toBe("Closes tomorrow");
    expect(describeDeadline("2026-11-13T17:00:00Z", NOW)).toMatchObject({ label: "Closes today", urgency: "urgent" });
    expect(describeDeadline("2026-11-13T11:00:00Z", NOW)).toMatchObject({ label: "Closed", urgency: "closed" });
    expect(describeDeadline(null, NOW)).toBeNull();
    // UK local time, including summer time.
    expect(formatDateTime("2026-07-01T11:00:00Z")).toBe("1 Jul 2026, 12:00");
    expect(calendarDaysBetween(new Date("2026-11-13T23:30:00Z"), new Date("2026-11-14T00:30:00Z"))).toBe(1);
    expect(describeTimeUntil("2027-04-13T12:00:00Z", NOW)).toBe("in 5 months");
    expect(describeTimeUntil("2026-11-20T12:00:00Z", NOW)).toBe("in 7 days");
  });

  it("maps procedures to how the contract was competed", () => {
    expect(competitionOf("Below threshold - without competition", "direct")).toBe("direct");
    expect(competitionOf("Direct award", "direct")).toBe("direct");
    expect(competitionOf("Award procedure without prior publication of a call for competition", "limited")).toBe("direct");
    expect(competitionOf("Below threshold - limited competition", "limited")).toBe("limited");
    expect(competitionOf("Below threshold - open competition", "open")).toBe("open");
    expect(competitionOf("Competitive flexible procedure", "selective")).toBe("open");
    expect(competitionOf("Award under framework", "selective")).toBe("framework");
    expect(competitionOf("Restricted procedure", "selective")).toBe("limited");
    expect(competitionOf("Below threshold - unknown", null)).toBe("unknown");
    expect(competitionOf(null, "open")).toBe("open");
    expect(legacyStage(["award", "contract"])).toBe("award");
    expect(legacyStage(["planning", "tender"])).toBe("tender");
    expect(noticeBadgeKind({ stage: "tender", noticeType: "UK4", aboveThreshold: false, isFramework: false })).toBe("below_threshold");
    expect(noticeBadgeKind({ stage: "tender", noticeType: "UK4", aboveThreshold: true, isFramework: true })).toBe("framework");
    expect(noticeBadgeKind({ stage: "planning", noticeType: "UK2", aboveThreshold: null, isFramework: false })).toBe("early");
    expect(noticeBadgeKind({ stage: "tender", noticeType: "UK12", aboveThreshold: null, isFramework: false })).toBe("closed");
  });

  it("reads region codes at mixed depth", () => {
    expect(topRegion("UKK14")).toBe("UKK");
    expect(topRegion("UK")).toBe("UK");
    expect(topRegion("FR")).toBeNull();
    expect(topRegions(["UKK14", "UKK", "UKI32"])).toEqual(["UKI", "UKK"]);
    expect(topRegions(["AO"])).toEqual(["ZZ"]);
    expect(topRegions(["UKC", "UKD", "UKE", "UKF", "UKG", "UKH", "UKI", "UKJ", "UKK", "UKL", "UKM", "UKN"])).toEqual(["UK"]);
    expect(regionsLabel(["UKI", "UKJ"])).toBe("London and South East");
    expect(regionsLabel(["UK"])).toBe("UK-wide");
    expect(regionsLabel(["ZZ"])).toBe("Outside the UK");
  });
});

describe("CPV and keywords", () => {
  it("works on the significant prefix of a code", () => {
    expect(cpvStem("45000000")).toBe("45");
    expect(cpvStem("77314000")).toBe("77314");
    expect(cpvPrefixes("77314000")).toEqual(["77", "773", "7731", "77314"]);
    expect(cpvPrefixes("45000000")).toEqual(["45"]);
    expect(sharedCpvDepth("77314000", "77310000")).toBe(4);
    expect(sharedCpvDepth("77314000", "45000000")).toBe(0);
    expect(shortCpvLabel("Grounds maintenance services")).toBe("grounds maintenance");
  });

  it("extracts trade keywords and ignores procurement boilerplate", () => {
    expect(termsOf("Provision of Grounds Maintenance Services - Lot 2")).toEqual(expect.arrayContaining(["grounds", "grounds maintenance"]));
    expect(termsOf("Provision of Grounds Maintenance Services - Lot 2")).not.toContain("maintenance");
    expect(termsOf("Supply of services for the council 2026")).toEqual([]);
    const keywords = topKeywords(
      [
        { text: "Grounds Maintenance and Grass Cutting", weight: 1 },
        { text: "Grounds Maintenance for Housing Estates", weight: 1 },
        { text: "Winter Gritting", weight: 0.5 },
      ],
      12,
    );
    expect(keywords[0]).toBe("grounds maintenance");
    expect(keywords).toEqual(expect.arrayContaining(["grass cutting", "winter gritting"]));
    // "grounds" only ever appears inside the pair, so it is not repeated on its own.
    expect(keywords).not.toContain("grounds");
    expect(keywordsToWebQuery(["grounds maintenance", "gritting"])).toBe('"grounds maintenance" or gritting');
    expect(keywordsToWebQuery([])).toBeNull();
  });
});

describe("supplier profile and match scoring", () => {
  const award = (overrides: Partial<ProfileAward>): ProfileAward => ({
    title: "Grounds Maintenance Services",
    cpvCodes: ["77314000"],
    regions: ["UKE"],
    valueAmount: 120_000,
    currency: "GBP",
    valueShared: false,
    isFramework: false,
    competition: "open",
    date: "2026-09-01T00:00:00Z",
    buyerId: "buy_1",
    buyerName: "Leeds City Council",
    ...overrides,
  });
  const profile = buildSupplierProfile(
    { name: "Acme Grounds Ltd", region: "UKE" },
    [award({}), award({ title: "Grounds Maintenance for Parks", valueAmount: 80_000, buyerId: "buy_2", buyerName: "City of York Council" }), award({ title: "Tree Surgery", cpvCodes: ["77341000"], valueAmount: null, valueShared: true })],
    new Map([["77314000", "Grounds maintenance services"]]),
    NOW,
  );
  const spec: RadarSpec = { key: "s:1", supplierId: "sup_1", label: "Acme Grounds Ltd", cpvWeights: profile.cpvWeights, cpvDivisions: profile.cpvDivisions, cpvGroups: profile.cpvGroups, keywords: profile.keywords, regions: profile.regions, valueLow: 40_000, valueHigh: 400_000 };

  it("builds weights, regions, a value band and a factual summary", () => {
    expect(profile.cpvWeights["77"]).toBe(1);
    expect(profile.cpvWeights["77314"]).toBeCloseTo(0.667, 2);
    expect(profile.cpvDivisions).toEqual(["77"]);
    expect(profile.regions).toEqual(["UKE"]);
    expect(profile.topCpv[0]).toMatchObject({ code: "77314000", label: "Grounds maintenance services" });
    expect(profile.keywords).toContain("grounds maintenance");
    // Shared values never enter the band or the total.
    expect(profile.totalValue).toBe(200_000);
    expect(profile.valueLow).toBe(84_000);
    expect(profile.valueHigh).toBe(116_000);
    expect(profile.summary).toBe("Acme Grounds Ltd is named in 3 published public contract awards worth £200k from 2 buyers, mostly in grounds, forestry and horticultural services (Yorkshire and the Humber).");
    expect(tradeLevels(profile.cpvWeights)).toEqual({ classes: ["7731", "7734"], groups: [], divisions: [] });
  });

  it("scores the same line of work above neighbouring codes and unrelated ones at zero", () => {
    const same = scoreCpv(spec.cpvWeights, ["77314000"]);
    const broader = scoreCpv(spec.cpvWeights, ["77300000"]);
    const sibling = scoreCpv(spec.cpvWeights, ["77320000"]);
    const division = scoreCpv(spec.cpvWeights, ["77000000"]);
    expect(same).toMatchObject({ prefix: "77314", relation: "line" });
    expect(sibling).toMatchObject({ prefix: "773", relation: "sibling" });
    expect(same.score).toBeGreaterThan(broader.score);
    expect(broader.score).toBeGreaterThan(sibling.score);
    expect(broader.score).toBeGreaterThan(division.score);
    expect(scoreCpv(spec.cpvWeights, ["45000000"])).toEqual({ score: 0, prefix: null, relation: null });
  });

  it("ranks trade, then region and size, and needs a trade signal", () => {
    const local = scoreNotice(spec, { title: "Grounds Maintenance Contract", cpvCodes: ["77314000"], regions: ["UKE"], valueAmount: 150_000, textRank: 0.2 });
    const elsewhere = scoreNotice(spec, { title: "Grounds Maintenance Contract", cpvCodes: ["77314000"], regions: ["UKM"], valueAmount: 150_000, textRank: 0.2 });
    const huge = scoreNotice(spec, { title: "Grounds Maintenance Contract", cpvCodes: ["77314000"], regions: ["UKE"], valueAmount: 90_000_000, textRank: 0.2 });
    const unrelated = scoreNotice(spec, { title: "Payroll software", cpvCodes: ["48450000"], regions: ["UKE"], valueAmount: 150_000, textRank: 0 });
    const abroad = scoreNotice(spec, { title: "Grounds Maintenance Contract", cpvCodes: ["77314000"], regions: ["ZZ"], valueAmount: 150_000, textRank: 0.2 });
    expect(local.total).toBeGreaterThan(0.8);
    expect(local).toMatchObject({ regionMatch: "local", cpvPrefix: "77314", oversized: false });
    expect(local.keywordHits).toEqual(["grounds maintenance"]);
    expect(elsewhere.regionMatch).toBe("elsewhere");
    expect(local.total).toBeGreaterThan(elsewhere.total);
    expect(huge.oversized).toBe(true);
    expect(local.total).toBeGreaterThan(huge.total);
    expect(unrelated.total).toBe(0);
    expect(abroad.regionMatch).toBe("elsewhere");
    // A notice that lists most of the country is nationwide, not local.
    expect(scoreNotice(spec, { title: "x", cpvCodes: ["77314000"], regions: ["UKC", "UKD", "UKE", "UKF", "UKG", "UKH"], valueAmount: null, textRank: 0 }).regionMatch).toBe("nationwide");
  });

  it("explains a match with a published fact", () => {
    const references = [{ ocid: "o1", title: "Grounds Maintenance Services", cpvCodes: ["77314000"], valueAmount: 120_000, buyerId: "buy_1", buyerName: "Leeds City Council", date: "2026-09-01T00:00:00Z" }];
    const labels = new Map([["77314000", "Grounds maintenance services"]]);
    const breakdown = scoreNotice(spec, { title: "Grounds Maintenance", cpvCodes: ["77314000"], regions: ["UKE"], valueAmount: 100_000, textRank: 0 });
    expect(explainMatch(spec, { title: "Grounds Maintenance", cpvCodes: ["77314000"], buyerId: "buy_9", buyerName: "Kirklees Council" }, breakdown, references, labels)).toBe(
      "Same category as your £120k award from Leeds City Council",
    );
    expect(explainMatch(spec, { title: "Grounds Maintenance", cpvCodes: ["77314000"], buyerId: "buy_1", buyerName: "Leeds City Council" }, breakdown, references, labels)).toBe(
      "From Leeds City Council, which awarded you a £120k contract in 2026",
    );
    const manual = specFromManualProfile({ id: "p1", name: "Start-up", cpvCodes: ["77314000"], keywords: ["hedge cutting"], regions: [], valueMin: null, valueMax: null });
    expect(manual.cpvWeights).toEqual({ "77": 1, "773": 1, "7731": 1, "77314": 1 });
    const manualBreakdown = scoreNotice(manual, { title: "Hedge cutting on highways", cpvCodes: ["77314000"], regions: ["UKE"], valueAmount: null, textRank: 0 });
    expect(explainMatch(manual, { title: "Hedge cutting on highways", cpvCodes: ["77314000"], buyerId: null, buyerName: null }, manualBreakdown, [], labels)).toBe(
      'Matches your trade (grounds maintenance) and mentions "hedge cutting"',
    );
  });

  it("rejects model-written reasons that promise or leak", () => {
    expect(isAcceptableReason("Same grounds maintenance work as your £120k Leeds City Council contract.")).toBe(true);
    expect(isAcceptableReason("A perfect fit — you will win this one, guaranteed.")).toBe(false);
    expect(isAcceptableReason("Email jane@buyer.gov.uk to discuss this tender today.")).toBe(false);
    expect(isAcceptableReason("Too short")).toBe(false);
    expect(isAcceptableReason(42)).toBe(false);
  });

  it("rejects model-written reasons that state figures we did not supply", () => {
    const facts = { amounts: ["£392k"], years: ["2026"] };
    expect(isGroundedReason("Pest control for council housing, like your £392k contract with West Kent Housing Association.", facts)).toBe(true);
    expect(isGroundedReason("Verge mowing, the same service as your 2026 award from Fusion 21.", facts)).toBe(true);
    // A year turned into a price, an invented value, an invented year.
    expect(isGroundedReason("Grass cutting, relevant to your £2026 grounds maintenance award.", facts)).toBe(false);
    expect(isGroundedReason("Grass cutting, close to your £1.2m contract.", facts)).toBe(false);
    expect(isGroundedReason("Grass cutting, like your 2019 contract.", facts)).toBe(false);
    expect(isGroundedReason("Grass cutting, the same trade as your recent award.", { amounts: [null], years: [null] })).toBe(true);
  });

  it("picks the closest past award for a notice", () => {
    const references = [
      { ocid: "a", title: "Tree works", cpvCodes: ["77341000"], valueAmount: 656_000, buyerId: "b1", buyerName: "Hillingdon", date: "2026-10-01T00:00:00Z" },
      { ocid: "b", title: "Pest control", cpvCodes: ["90922000"], valueAmount: 392_000, buyerId: "b2", buyerName: "West Kent", date: "2026-09-22T00:00:00Z" },
    ];
    expect(closestReference({ cpvCodes: ["90922000"], buyerId: "b9" }, references)?.ocid).toBe("b");
    expect(closestReference({ cpvCodes: ["77340000"], buyerId: "b9" }, references)?.ocid).toBe("a");
    // The same buyer outranks a closer code.
    expect(closestReference({ cpvCodes: ["90920000", "77000000"], buyerId: "b1" }, references)?.ocid).toBe("a");
    expect(closestReference({ cpvCodes: ["48000000"], buyerId: "b9" }, references)).toBeNull();
  });
});

describe("plan gating adapter", () => {
  it("falls back to Free behaviour when the radar keys are absent", () => {
    const access = radarAccess({ features: PLANS.free.features, limits: PLANS.free.limits, plan: PLANS.free });
    expect(access).toMatchObject({ full: false, matchLimit: 10, maxProfiles: 1 });
    // A paid plan without the keys is still treated as Free for the radar. (The catalogue
    // defines the keys now, so "absent" is simulated by stripping them.)
    const withoutRadarKeys = <T extends object>(record: T) => Object.fromEntries(Object.entries(record).filter(([key]) => !key.startsWith("radar."))) as unknown as T;
    expect(radarAccess({ features: withoutRadarKeys(PLANS.pro.features), limits: withoutRadarKeys(PLANS.pro.limits), plan: PLANS.pro })).toMatchObject({
      full: false,
      matchLimit: 10,
      maxProfiles: 1,
    });
    expect(canAddRadarSource(access, 0)).toBe(true);
    expect(canAddRadarSource(access, 1)).toBe(false);
  });

  it("gives every paid plan of the real catalogue the full radar, and Free the capped one", () => {
    for (const key of ["starter", "pro", "business"] as const) {
      const plan = PLANS[key];
      expect(radarAccess({ features: plan.features, limits: plan.limits, plan }), key).toMatchObject({ full: true, matchLimit: null, maxProfiles: plan.limits["radar.profiles"] });
    }
    // "Top 10 matches" on the pricing page is the cap the radar applies.
    const free = radarAccess({ features: PLANS.free.features, limits: PLANS.free.limits, plan: PLANS.free });
    expect(free.matchLimit).toBe(PLANS.free.limits["radar.matches"]);
    expect(free.maxProfiles).toBe(PLANS.free.limits["radar.profiles"]);
  });

  it("honours radar.full and radar.profiles when the catalogue defines them", () => {
    const features = { ...PLANS.pro.features, "radar.full": true } as unknown as typeof PLANS.pro.features;
    const limits = { ...PLANS.pro.limits, "radar.profiles": 5 } as unknown as typeof PLANS.pro.limits;
    const access = radarAccess({ features, limits, plan: PLANS.pro });
    expect(access).toMatchObject({ full: true, matchLimit: null, maxProfiles: 5 });
    expect(canAddRadarSource(access, 4)).toBe(true);
    expect(canAddRadarSource(access, 5)).toBe(false);
    const unlimited = radarAccess({ features, limits: { ...limits, "radar.profiles": null } as unknown as typeof PLANS.pro.limits, plan: PLANS.pro });
    expect(unlimited.maxProfiles).toBeNull();
    expect(canAddRadarSource(unlimited, 500)).toBe(true);
  });
});
