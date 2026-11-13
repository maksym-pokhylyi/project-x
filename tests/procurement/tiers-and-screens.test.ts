import { describe, expect, it } from "vitest";
import { cleanPagePath, composeDataRequest, DATA_ISSUES, dataIssue } from "@/features/procurement/domain/data-requests";
import { describeClosing, formatDate, formatDateTime, formatMonth, formatTerm, formatTime, tidyPlace } from "@/features/procurement/domain/format";
import { bidCheckHref, bidCheckHrefFor, flagMistakeHref } from "@/features/procurement/domain/links";
import { formatMoney } from "@/features/procurement/domain/money";
import { awardCodeShares, buildSupplierProfile, matchTier, MIN_MATCH_SCORE, scoreCpv, scoreNotice, specFromManualProfile, tradeLevels, type ProfileAward, type RadarSpec } from "@/features/procurement/domain/profile";
import { matchFacts, reasonChips, type ReferenceAward } from "@/features/procurement/domain/reasons";
import { placeLabel } from "@/features/procurement/domain/regions";
import { BROAD_TRADES, broadTrade, cpvCodesForTrades, splitTrades } from "@/features/procurement/domain/trades";
import { cleanSelection, hasSelection, parseSelection, setupHref } from "@/features/procurement/radar/selection";

/**
 * The pure rules behind the rebuilt screens: which matches are STRONG, how a broad award is
 * weighed, what the chips may say, and how dates, places and money are written.
 */
const NOW = new Date("2026-11-13T12:00:00Z");

describe("match tiers", () => {
  // A roofer: its awards concentrate in the class "roof works" (4526), with one stated only at group level (453).
  const roofer: Pick<RadarSpec, "cpvWeights" | "trades" | "chosen"> = {
    cpvWeights: { "45": 1, "452": 1, "4526": 1, "45261": 0.8, "453": 0.3 },
    trades: { classes: ["4526"], groups: ["453"], divisions: [] },
    chosen: [],
  };
  const tier = (prefix: string | null, relation: "line" | "sibling" | null, regionMatch: "local" | "nationwide" | "unknown" | "elsewhere" = "local", buyerWins = 0) =>
    matchTier(roofer, { cpvPrefix: prefix, cpvRelation: relation, regionMatch }, buyerWins);

  it("calls the profile's own line of work, where it works, strong", () => {
    expect(tier("45261", "line")).toBe("strong");
    // A class-level notice in its class is the same line of work.
    expect(tier("4526", "line")).toBe("strong");
    // Open to the whole UK, or with no place stated, still counts; another region never does.
    expect(tier("45261", "line", "nationwide")).toBe("strong");
    expect(tier("45261", "line", "unknown")).toBe("strong");
    expect(tier("45261", "line", "elsewhere")).toBe("wider");
    expect(tier("45261", "line", "elsewhere", 3)).toBe("wider");
  });

  it("leaves neighbouring categories and group- or division-level overlaps to the wider list", () => {
    // A sibling under the same class (roofing next to scaffolding under 4526) is not the same line.
    expect(tier("4526", "sibling")).toBe("wider");
    // Only the group or the division in common: "Building installation work" is too wide to be a trade.
    expect(tier("453", "line")).toBe("wider");
    expect(tier("452", "line")).toBe("wider");
    expect(tier("45", "line")).toBe("wider");
    // A class its awards do not concentrate in.
    expect(tier("4521", "line")).toBe("wider");
    // No category in common at all (a keyword or the buyer alone carried the score).
    expect(tier(null, null)).toBe("wider");
    expect(tier(null, null, "local", 2)).toBe("wider");
  });

  it("lets a buyer that has already awarded the supplier a contract pull in work next to its trade", () => {
    expect(tier("4526", "sibling", "local", 1)).toBe("strong");
    // A trade its awards state only at group level.
    expect(tier("453", "line", "local", 1)).toBe("strong");
    expect(tier("4531", "line", "local", 1)).toBe("strong");
    // Still not the bare division, a class it has never touched, or another region.
    expect(tier("45", "line", "local", 1)).toBe("wider");
    expect(tier("4521", "line", "local", 1)).toBe("wider");
    expect(tier("453", "line", "elsewhere", 1)).toBe("wider");
  });

  it("treats a hand-picked trade as the radar's own line of work at the depth it was picked", () => {
    const manual = specFromManualProfile({ id: "p1", name: "IT firm", cpvCodes: ["72000000", "45261000"], keywords: [], regions: ["UKE"], valueMin: null, valueMax: null });
    expect(manual.chosen).toEqual(["72", "45261"]);
    const pick = (prefix: string, relation: "line" | "sibling" = "line", buyerWins = 0) => matchTier(manual, { cpvPrefix: prefix, cpvRelation: relation, regionMatch: "local" }, buyerWins);
    // Anything at or below a picked code.
    expect(pick("72")).toBe("strong");
    expect(pick("7221")).toBe("strong");
    expect(pick("452611")).toBe("strong");
    // A class-level notice that is the broader form of a picked code; its group and division are not.
    expect(pick("4526")).toBe("strong");
    expect(pick("452")).toBe("wider");
    expect(pick("45")).toBe("wider");
    // A broad division named as the trade scores like one: without the pick it would not reach the threshold.
    const notice = { title: "Software support", cpvCodes: ["72000000"], regions: ["UKE"], valueAmount: null, textRank: 0 };
    expect(scoreCpv(manual.cpvWeights, notice.cpvCodes, manual.chosen).score).toBeGreaterThan(scoreCpv(manual.cpvWeights, notice.cpvCodes).score);
    expect(scoreNotice(manual, notice).total).toBeGreaterThanOrEqual(MIN_MATCH_SCORE);
    expect(scoreNotice({ ...manual, chosen: [] }, notice).total).toBeLessThan(MIN_MATCH_SCORE);
  });

  it("falls back to the levels read from the weights when a spec carries none", () => {
    const bare = { cpvWeights: { "77": 1, "773": 1, "7731": 1, "77314": 1 } };
    expect(tradeLevels(bare.cpvWeights)).toEqual({ classes: ["7731"], groups: [], divisions: [] });
    expect(matchTier(bare, { cpvPrefix: "77314", cpvRelation: "line", regionMatch: "local" })).toBe("strong");
    expect(matchTier(bare, { cpvPrefix: "773", cpvRelation: "line", regionMatch: "local" })).toBe("wider");
  });
});

describe("how much an award says about each of its codes", () => {
  it("counts a focused award in full: the main code, then the additional ones at their usual weight", () => {
    expect(awardCodeShares(["45261000"])).toEqual([1]);
    expect(awardCodeShares(["45261000", "45261900", "45260000"])).toEqual([1, 0.35, 0.35]);
    // Four classes is still one job.
    expect(awardCodeShares(["45261000", "45262000", "45310000", "45330000"])).toEqual([1, 0.35, 0.35, 0.35]);
  });

  it("thins out a multi-trade framework lot, so that one such award cannot define a trade", () => {
    const eight = awardCodeShares(["45210000", "45220000", "45230000", "45240000", "45250000", "45260000", "45310000", "45320000"]);
    // Eight classes: half the focus. The main code keeps a quarter, each other code under a tenth.
    expect(eight[0]).toBeCloseTo(0.25, 5);
    expect(eight[1]).toBeCloseTo(0.0875, 5);
    const lot = awardCodeShares(Array.from({ length: 28 }, (_, index) => `${String(4511 + index)}0000`));
    expect(lot[0]).toBeCloseTo(0.05, 5);
    expect(lot[1]!).toBeLessThan(0.01);
    // Never more than a focused award, and the main code never below the others.
    for (const share of [...eight, ...lot]) expect(share).toBeLessThanOrEqual(1);
    expect(lot[0]!).toBeGreaterThan(lot[1]!);
  });

  it("keeps a roofer's profile on roofing when one of its awards is a broad framework", () => {
    const award = (overrides: Partial<ProfileAward>): ProfileAward => ({
      title: "Flat roof replacement",
      cpvCodes: ["45261000"],
      regions: ["UKJ"],
      valueAmount: 120_000,
      currency: "GBP",
      valueShared: false,
      isFramework: false,
      competition: "open",
      date: "2026-09-01T00:00:00Z",
      buyerId: "buy_1",
      buyerName: "Kent County Council",
      ...overrides,
    });
    const framework = award({
      title: "Repairs, maintenance and planned works framework",
      cpvCodes: ["45000000", ...Array.from({ length: 24 }, (_, index) => `${String(4521 + index * 4)}0000`), "50700000", "71000000", "90910000"],
      valueShared: true,
      isFramework: true,
      valueAmount: null,
    });
    const profile = buildSupplierProfile({ name: "Roofer Ltd", region: "UKJ" }, [award({}), award({ title: "School roof repairs" }), framework], new Map(), NOW);
    expect(tradeLevels(profile.cpvWeights)).toEqual({ classes: ["4526"], groups: [], divisions: [] });
    // Cleaning, which only the framework names, is no part of its trade.
    expect(profile.cpvWeights["9091"] ?? 0).toBeLessThan(0.05);
  });
});

describe("the counted facts on a match", () => {
  const references: ReferenceAward[] = [
    { ocid: "a1", title: "Flat roof replacement", cpvCodes: ["45261000"], valueAmount: 120_000, buyerId: "buy_1", buyerName: "Kent County Council", date: "2026-07-01T00:00:00Z" },
    { ocid: "a2", title: "School roof repairs", cpvCodes: ["45261900"], valueAmount: 45_000, buyerId: "buy_1", buyerName: "Kent County Council", date: "2025-05-01T00:00:00Z" },
    { ocid: "a3", title: "Boiler replacement", cpvCodes: ["45331000"], valueAmount: null, buyerId: "buy_2", buyerName: "Medway Council", date: "2024-02-01T00:00:00Z" },
  ];
  const labels = new Map([
    ["45261000", "Erection and related works of roof frames and coverings"],
    ["45330000", "Plumbing and sanitary works"],
  ]);
  const spec = { keywords: ["roof"], supplierId: "sup_1" };

  it("counts wins from the buyer and wins that are the same work, and says so in chips", () => {
    const facts = matchFacts(spec, { title: "Roof replacement programme", cpvCodes: ["45261000"], buyerId: "buy_1", buyerName: "Kent County Council" }, { cpvPrefix: "45261", cpv: 0.9 }, references, labels);
    expect(facts).toMatchObject({ wins: 3, buyerWins: 2, newBuyer: false, sameWorkWins: 2, relatedWorkWins: 0, trade: null });
    // The supplier's contracts with this buyer, as the tender page lists them.
    expect(facts.buyerContracts).toEqual([
      { title: "Flat roof replacement", valueAmount: 120_000, year: "2026" },
      { title: "School roof repairs", valueAmount: 45_000, year: "2025" },
    ]);
    expect(facts.sameWorkLabels).toHaveLength(1);
    expect(reasonChips(facts)).toEqual([
      { kind: "buyer", strong: true, label: "You have won 2 contracts from this buyer" },
      { kind: "work", strong: false, label: "Same work as 2 of your wins" },
    ]);
  });

  it("says a buyer is new, and never calls a neighbouring category the same work", () => {
    const facts = matchFacts(spec, { title: "Heating upgrade", cpvCodes: ["45330000"], buyerId: "buy_9", buyerName: "Dover District Council" }, { cpvPrefix: "4533", cpv: 0.6 }, references, labels);
    // Plumbing (4533) is the same class as the boiler job, stated one level up: the same line of work.
    expect(facts).toMatchObject({ buyerWins: 0, newBuyer: true, sameWorkWins: 1 });
    const neighbour = matchFacts(spec, { title: "Electrical rewiring", cpvCodes: ["45311000"], buyerId: "buy_9", buyerName: "Dover District Council" }, { cpvPrefix: "453", cpv: 0.3 }, references, labels);
    expect(neighbour).toMatchObject({ sameWorkWins: 0, relatedWorkWins: 1 });
    expect(reasonChips(neighbour)).toEqual([{ kind: "new_buyer", strong: false, label: "New buyer for you" }]);
    // One contract to its name: "your contract win", not "1 of your wins".
    const single = matchFacts(spec, { title: "Roof repairs", cpvCodes: ["45261000"], buyerId: "buy_9", buyerName: null }, { cpvPrefix: "45261", cpv: 0.9 }, references.slice(0, 1), labels);
    expect(reasonChips(single).map((chip) => chip.label)).toEqual(["Same work as your contract win", "New buyer for you"]);
  });

  it("names the trade or the keyword for a radar that has no wins to count", () => {
    const manual = { keywords: ["sports pitch"], supplierId: null };
    const byTrade = matchFacts(manual, { title: "Roof repairs", cpvCodes: ["45261000"], buyerId: "buy_1", buyerName: null }, { cpvPrefix: "45261", cpv: 0.9 }, [], labels);
    expect(byTrade).toMatchObject({ wins: 0, newBuyer: false, sameWorkWins: 0, trade: expect.any(String) });
    expect(reasonChips(byTrade)).toEqual([{ kind: "trade", strong: false, label: `Your trade: ${byTrade.trade}` }]);
    const byKeyword = matchFacts(manual, { title: "Sports pitch drainage", cpvCodes: ["90000000"], buyerId: null, buyerName: null }, { cpvPrefix: null, cpv: 0, keywordHits: ["sports pitch"] }, [], labels);
    expect(reasonChips(byKeyword)).toEqual([{ kind: "keyword", strong: false, label: "Mentions “sports pitch”" }]);
  });
});

describe("dates, places and money as the screens write them", () => {
  it("writes dates with three-letter months and midday in words", () => {
    expect(formatDate("2026-11-27T12:00:00Z")).toBe("27 Nov 2026");
    expect(formatDate("2026-09-01T09:00:00Z")).toBe("1 Sep 2026");
    expect(formatDateTime("2026-09-01T16:00:00Z")).toBe("1 Sep 2026, 17:00");
    expect(formatMonth("2026-09-15T00:00:00Z")).toBe("Sep 2026");
    expect(formatTime("2026-11-27T12:00:00Z")).toBe("12:00 noon");
    expect(formatTime("2026-11-27T17:00:00Z")).toBe("17:00");
    expect(formatDate(null)).toBeNull();
    expect(formatDate("not a date")).toBeNull();
  });

  it("describes a closing date: today, tomorrow, days left, closed, unknown", () => {
    expect(describeClosing("2026-11-27T12:00:00Z", NOW)).toEqual({ state: "open", iso: "2026-11-27T12:00:00.000Z", date: "27 Nov 2026", time: "12:00 noon", dateTime: "27 Nov 2026, 12:00", left: "14 days left", days: 14 });
    expect(describeClosing("2026-11-13T23:59:00Z", NOW)).toMatchObject({ state: "open", left: "Today", days: 0 });
    expect(describeClosing("2026-11-14T00:30:00Z", NOW)).toMatchObject({ state: "open", left: "Tomorrow", days: 1 });
    // Passed earlier today: closed, with no time left to show.
    expect(describeClosing("2026-11-13T09:00:00Z", NOW)).toMatchObject({ state: "closed", left: null, days: 0, date: "13 Nov 2026" });
    expect(describeClosing("2026-09-03T11:00:00Z", NOW)).toMatchObject({ state: "closed", dateTime: "3 Sep 2026, 12:00", left: null });
    expect(describeClosing(null, NOW)).toEqual({ state: "unknown", iso: null, date: null, time: null, dateTime: null, left: null, days: null });
  });

  it("writes the length of a contract as a buyer would", () => {
    expect(formatTerm("2027-04-01", "2031-03-31")).toBe("4 years");
    expect(formatTerm("2027-01-01", "2027-09-30")).toBe("9 months");
    expect(formatTerm("2027-01-01", "2029-06-30")).toBe("2 years 6 months");
    expect(formatTerm("2027-01-01", "2027-02-18")).toBe("7 weeks");
    expect(formatTerm("2027-01-01", "2027-01-05")).toBe("5 days");
    expect(formatTerm("2027-01-01", "2026-12-01")).toBeNull();
    expect(formatTerm(null, "2027-01-01")).toBeNull();
  });

  it("writes money to one decimal above a million and in full below it", () => {
    expect(formatMoney(4_200_000)).toBe("£4.2m");
    expect(formatMoney(780_000)).toBe("£780,000");
    expect(formatMoney(124_550.4)).toBe("£124,550");
    expect(formatMoney(1_200_000_000)).toBe("£1.2bn");
    // Nothing honest to show: the screen says "Value not published".
    expect(formatMoney(0)).toBeNull();
    expect(formatMoney(null)).toBeNull();
  });

  it("names a place as specifically as it was published", () => {
    expect(placeLabel(["UKE42"], ["UKE"])).toBe("West Yorkshire");
    expect(placeLabel(["UKE42", "UKE32"], ["UKE"])).toMatch(/ and /);
    // A bare region next to an area is two regions, not one area.
    expect(placeLabel(["UKE4", "UKJ"], ["UKE", "UKJ"])).toBe("Yorkshire and the Humber and South East");
    expect(placeLabel([], ["UKI", "UKJ", "UKK", "UKL"])).toBe("London, South East and 2 more");
    expect(placeLabel(["UK"], ["UK"])).toBe("UK-wide");
    expect(placeLabel([], [])).toBeNull();
    expect(placeLabel(null, null)).toBeNull();
  });

  it("tidies a town typed with a stray comma", () => {
    expect(tidyPlace("Cambridge,")).toBe("Cambridge");
    expect(tidyPlace("  Stoke-on-Trent. ")).toBe("Stoke-on-Trent");
    expect(tidyPlace("St. Albans")).toBe("St. Albans");
    expect(tidyPlace(" , ")).toBeNull();
    expect(tidyPlace(null)).toBeNull();
  });
});

describe("the short list of trades", () => {
  it("is twelve to fourteen broad trades, each with its codes", () => {
    expect(BROAD_TRADES.length).toBeGreaterThanOrEqual(12);
    expect(BROAD_TRADES.length).toBeLessThanOrEqual(14);
    expect(new Set(BROAD_TRADES.map((trade) => trade.key)).size).toBe(BROAD_TRADES.length);
    for (const trade of BROAD_TRADES) for (const code of trade.cpv) expect(code).toMatch(/^\d{8}$/);
    expect(broadTrade("roofing")).toMatchObject({ label: "Roofing", cpv: ["45261000"] });
    expect(broadTrade("made-up")).toBeNull();
  });

  it("turns ticks into codes and codes back into ticks", () => {
    expect(cpvCodesForTrades(["roofing", "cleaning", "made-up", "roofing"])).toEqual(["45261000", "90910000"]);
    const stored = [...cpvCodesForTrades(["grounds"]), "45262100", "not-a-code"];
    // A trade is ticked when ALL of its codes are stored; anything else is one of the "more trades".
    expect(splitTrades(stored)).toEqual({ keys: ["grounds"], otherCodes: ["45262100"] });
    expect(splitTrades(["77310000"])).toEqual({ keys: [], otherCodes: ["77310000"] });
    expect(splitTrades([])).toEqual({ keys: [], otherCodes: [] });
  });
});

describe("a radar described before signing up", () => {
  it("travels in the address of the set-up page and keeps only what the form could have produced", () => {
    const selection = cleanSelection({ name: "  Tidewell\u0000 Roofing Ltd  ", trades: ["roofing", "roofing", "made-up"], cpv: ["45262100", "nope"], regions: ["UKE", "XX", "UKE"] });
    expect(selection).toEqual({ name: "Tidewell  Roofing Ltd", trades: ["roofing"], cpv: ["45262100"], regions: ["UKE"] });
    const href = setupHref(selection);
    expect(href).toBe("/app/radar/setup?name=Tidewell++Roofing+Ltd&trade=roofing&cpv=45262100&region=UKE");
    // Reading the address back gives the same selection.
    const params = Object.fromEntries([...new URLSearchParams(href.split("?")[1]).entries()].map(([key, value]) => [key, value]));
    expect(parseSelection(params)).toEqual(selection);
    expect(parseSelection({ trade: ["roofing", "cleaning"], region: "UKK", name: ["A", "B"] })).toEqual({ name: "A", trades: ["roofing", "cleaning"], cpv: [], regions: ["UKK"] });
    expect(hasSelection(selection)).toBe(true);
    expect(hasSelection(parseSelection({}))).toBe(false);
    expect(setupHref(parseSelection({}))).toBe("/app/radar/setup");
    expect(cleanSelection({ name: "x".repeat(200), trades: [], cpv: [], regions: [] }).name).toHaveLength(80);
  });
});

describe("flag a mistake", () => {
  it("reads the page a request is about from a path or a pasted address, and nothing else", () => {
    expect(cleanPagePath("/suppliers/acme-grounds-ltd-01111111")).toBe("/suppliers/acme-grounds-ltd-01111111");
    expect(cleanPagePath(" https://bidfolio.co.uk/suppliers/acme-grounds-ltd-01111111?r=abc#wins ")).toBe("/suppliers/acme-grounds-ltd-01111111");
    expect(cleanPagePath("bidfolio.co.uk/tenders/ocds-h6vhtk-06eb2e")).toBe("/tenders/ocds-h6vhtk-06eb2e");
    expect(cleanPagePath("/buyers/kent-county-council-7990a3de/")).toBe("/buyers/kent-county-council-7990a3de");
    expect(cleanPagePath("/app/settings")).toBeNull();
    expect(cleanPagePath("javascript:alert(1)")).toBeNull();
    expect(cleanPagePath("")).toBeNull();
    expect(cleanPagePath(null)).toBeNull();
  });

  it("offers five things to flag: three corrections and two removals", () => {
    expect(DATA_ISSUES.map((issue) => issue.kind)).toEqual(["correction", "correction", "correction", "removal", "removal"]);
    expect(dataIssue("hide_page")).toMatchObject({ kind: "removal", label: "Hide the whole page" });
    expect(dataIssue("anything")).toBeNull();
  });

  it("stores the answers as labelled lines a person can read, leaving empty ones out", () => {
    expect(composeDataRequest({ issue: "not_ours", page: "/suppliers/acme", detail: "Cemetery Grounds Maintenance ", correction: "Awarded to another company.", evidence: "", name: "Dana Director", actsForCompany: true })).toBe(
      ["What is wrong: A contract here is not ours", "Which contract or detail: Cemetery Grounds Maintenance", "What it should say: Awarded to another company.", "Asked by: Dana Director", "Works for or acts for the company: Yes (ticked)"].join("\n"),
    );
    expect(composeDataRequest({ issue: "hide_page", page: null, detail: "", correction: "", evidence: "https://example.org/proof", name: "Dana", actsForCompany: false })).toBe(
      ["What is wrong: Hide the whole page", "Link that shows it: https://example.org/proof", "Asked by: Dana", "Works for or acts for the company: No"].join("\n"),
    );
  });
});

describe("links to other parts of the product", () => {
  it("starts a bid check with the tender filled in, by way of sign-up for a visitor", () => {
    expect(bidCheckHref("ocds-h6vhtk-06eb2e")).toBe("/app/bids/new?tender=ocds-h6vhtk-06eb2e");
    expect(bidCheckHrefFor("ocds-h6vhtk-06eb2e", true)).toBe("/app/bids/new?tender=ocds-h6vhtk-06eb2e");
    expect(bidCheckHrefFor("ocds-h6vhtk-06eb2e", false)).toBe(`/sign-up?next=${encodeURIComponent("/app/bids/new?tender=ocds-h6vhtk-06eb2e")}`);
    expect(flagMistakeHref("/suppliers/acme-ltd-01234567")).toBe("/flag-a-mistake?page=%2Fsuppliers%2Facme-ltd-01234567");
    expect(flagMistakeHref()).toBe("/flag-a-mistake");
  });
});
