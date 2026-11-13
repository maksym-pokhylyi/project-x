import { describe, expect, it } from "vitest";
import type { Citation, CompanyFacts } from "@/features/bids/types";
import { accreditationKey, requiredAmounts, resolveCompanyStatuses, type CheckRequirement, type ModelProposal } from "@/features/bids/server/pipeline/company-check";
import { computeVerdict, isGating, NOT_ASSESSED, type VerdictRequirement } from "@/features/bids/server/pipeline/verdict";

/**
 * Requirement vs company facts. The model only proposes; these rules decide — and they
 * must never say "met" on the strength of an unverified quote or unconfirmed facts.
 */

const verified: Citation = { fileId: "f1", fileName: "ITT.pdf", loc: "p4", page: 4, quote: "quote", verified: true, match: "exact" };
const TODAY = new Date("2027-01-15T10:00:00Z");
const DEADLINE = new Date("2027-03-01T12:00:00Z");

const facts: CompanyFacts = {
  legalName: "Example Facilities Ltd",
  turnoverBand: "1m_2m",
  insurance: {
    publicLiability: { amountGbp: 5_000_000, expiresAt: "2027-09-30" },
    employersLiability: { amountGbp: 10_000_000, expiresAt: "2026-12-31" },
    professionalIndemnity: { amountGbp: null, expiresAt: null },
  },
  accreditations: [
    { name: "ISO 9001:2015", reference: "FS 1234", expiresAt: "2028-05-01" },
    { name: "CHAS", reference: null, expiresAt: "2027-02-14" },
    { name: "Cyber Essentials", reference: null, expiresAt: "2026-06-01" },
  ],
} as CompanyFacts;

const requirement = (id: string, extra: Partial<CheckRequirement>): CheckRequirement => ({
  id,
  category: "other",
  text: "A requirement",
  threshold: null,
  kind: "pass_fail",
  isPassFail: true,
  evidenceToProvide: null,
  citation: verified,
  ...extra,
});

const resolve = (requirements: CheckRequirement[], proposals: Record<string, ModelProposal> = {}, options: { factsConfirmed?: boolean; facts?: CompanyFacts } = {}) =>
  Object.fromEntries(
    resolveCompanyStatuses({
      requirements,
      facts: options.facts ?? facts,
      factsConfirmed: options.factsConfirmed ?? true,
      proposals: new Map(Object.entries(proposals)),
      submissionDeadline: DEADLINE,
      today: TODAY,
    }).map((result) => [result.id, result]),
  );

describe("resolveCompanyStatuses", () => {
  it("asserts nothing from unconfirmed facts, whatever the model proposed", () => {
    const out = resolve([requirement("a", { category: "insurance", text: "Public liability insurance", threshold: "£5m" })], { a: { status: "met", reason: "Holds £5m" } }, { factsConfirmed: false });
    expect(out.a).toMatchObject({ status: "unknown", note: expect.stringContaining("Confirm your company facts") });
  });

  it("marks a requirement with an unverified quote as verify, even if the facts would meet it", () => {
    const unverified = { ...verified, verified: false, match: "not_found" as const };
    const figure = { ...verified, verified: false, issue: "figure_not_in_source" as const };
    const out = resolve(
      [
        requirement("a", { category: "insurance", text: "Public liability insurance", threshold: "£5m", citation: unverified }),
        requirement("b", { category: "insurance", text: "Public liability insurance", threshold: "£5m", citation: figure }),
        requirement("c", { citation: null }),
      ],
      { a: { status: "met", reason: "Holds £5m" } },
    );
    expect(out.a).toMatchObject({ status: "verify", note: expect.stringContaining("could not find") });
    expect(out.b).toMatchObject({ status: "verify", note: expect.stringContaining("figure") });
    expect(out.c!.status).toBe("verify");
  });

  it("decides insurance levels by arithmetic, not by the model", () => {
    const out = resolve(
      [
        requirement("met", { category: "insurance", text: "Public liability insurance of not less than £5,000,000", threshold: "£5m" }),
        requirement("gap", { category: "insurance", text: "Public liability insurance", threshold: "£10,000,000" }),
        requirement("commit", { category: "insurance", text: "Public liability insurance of £10m, or a commitment to obtain it prior to contract award", threshold: "£10m" }),
        requirement("expired", { category: "insurance", text: "Employers' liability insurance", threshold: "£5m" }),
        requirement("missing", { category: "insurance", text: "Professional indemnity insurance", threshold: "£1m" }),
        requirement("two", { category: "insurance", text: "Public liability and employers' liability insurance", threshold: "£5m each" }),
      ],
      // The model is wrong in both directions; arithmetic wins.
      { met: { status: "gap", reason: "No cover" }, gap: { status: "met", reason: "Has cover" }, two: { status: "met", reason: "Both held" } },
    );
    expect(out.met).toMatchObject({ status: "met", note: "You hold £5m public liability cover; the tender asks for £5m." });
    expect(out.gap).toMatchObject({ status: "gap", note: "You hold £5m public liability cover; the tender asks for £10m." });
    expect(out.commit).toMatchObject({ status: "gap", note: expect.stringContaining("commitment to obtain") });
    expect(out.expired).toMatchObject({ status: "verify", note: expect.stringContaining("renewal date on file (2026-12-31) has passed") });
    expect(out.missing).toMatchObject({ status: "unknown", note: expect.stringContaining("do not give your professional indemnity cover") });
    // Two covers in one requirement cannot be settled automatically: a "met" proposal becomes "verify".
    expect(out.two).toMatchObject({ status: "verify", note: expect.stringContaining("could not confirm the figures") });
  });

  it("when no level is asked for, checks that current cover of each named type is held", () => {
    const out = resolve([
      requirement("pl", { category: "insurance", kind: "mandatory", isPassFail: false, text: "Provide details and certificates of your public liability insurance" }),
      requirement("both", { category: "insurance", text: "Provide details of employer's liability and public liability insurance" }),
      requirement("pi", { category: "insurance", text: "Provide details of your professional indemnity insurance" }),
    ]);
    expect(out.pl).toMatchObject({ status: "met", note: expect.stringContaining("You hold £5m public liability cover. The tender asks for details, not a set level") });
    // Employers' liability on file expired on 2026-12-31.
    expect(out.both).toMatchObject({ status: "verify", note: expect.stringContaining("employers' liability cover has passed") });
    expect(out.pi).toMatchObject({ status: "unknown", note: "Your company facts do not give your professional indemnity cover." });
  });

  it("decides turnover tests from the band, and admits when the band straddles the threshold", () => {
    const out = resolve([
      requirement("above", { category: "financial", text: "Minimum annual turnover", threshold: "£500,000" }),
      requirement("below", { category: "financial", text: "Minimum annual turnover of £5 million", threshold: "£5m" }),
      requirement("inside", { category: "financial", text: "Minimum annual turnover", threshold: "£1,500,000" }),
      requirement("relative", { category: "financial", text: "Turnover of at least twice the annual contract value", threshold: null }),
    ]);
    expect(out.above!.status).toBe("met");
    expect(out.below).toMatchObject({ status: "gap", note: expect.stringContaining("below the £5m") });
    expect(out.inside).toMatchObject({ status: "unknown", note: expect.stringContaining("check your latest accounts") });
    expect(out.relative).toMatchObject({ status: "unknown" });
    expect(resolve([requirement("none", { category: "financial", text: "Minimum annual turnover", threshold: "£500,000" })], {}, { facts: {} as CompanyFacts }).none!.status).toBe("unknown");
  });

  it("accepts 'met' for an accreditation only when it is named, valid and lasts to the deadline", () => {
    const met: ModelProposal = { status: "met", reason: "Held." };
    const out = resolve(
      [
        requirement("iso", { category: "accreditation", text: "Hold ISO 9001 certification" }),
        requirement("chas", { category: "accreditation", text: "Hold CHAS or equivalent SSIP accreditation" }),
        requirement("cyber", { category: "accreditation", text: "Hold Cyber Essentials certification" }),
        requirement("plus", { category: "accreditation", text: "Hold Cyber Essentials Plus certification" }),
        requirement("iso14", { category: "accreditation", text: "Hold ISO 14001 certification" }),
        requirement("gapSaid", { category: "accreditation", text: "Hold Constructionline Gold membership" }),
      ],
      { iso: met, chas: met, cyber: met, plus: met, iso14: met, gapSaid: { status: "gap", reason: "No Constructionline membership in the company facts." } },
    );
    expect(out.iso).toMatchObject({ status: "met", note: "You hold ISO 9001:2015 (valid to 2028-05-01)." });
    // Valid today, but expires before the submission deadline.
    expect(out.chas).toMatchObject({ status: "verify", note: expect.stringContaining("before the submission deadline") });
    expect(out.cyber).toMatchObject({ status: "gap", note: expect.stringContaining("expired on 2026-06-01") });
    // "Cyber Essentials" on file does not satisfy "Cyber Essentials Plus"; ISO 9001 does not satisfy ISO 14001.
    expect(out.plus!.status).toBe("verify");
    expect(out.iso14!.status).toBe("verify");
    expect(out.gapSaid).toMatchObject({ status: "gap" });
  });

  it("takes other proposals as they come, defaults to unknown, and never touches a status a person set", () => {
    const out = resolve(
      [
        requirement("policy", { category: "policy", text: "Have a health and safety policy" }),
        requirement("silent", { category: "experience", text: "Two references" }),
        requirement("mine", { category: "insurance", text: "Public liability insurance", threshold: "£10m", statusSetByUser: true, currentStatus: "met", currentNote: null }),
      ],
      { policy: { status: "met", reason: "Health and Safety Policy is listed." }, mine: { status: "gap", reason: "Only £5m" } },
    );
    expect(out.policy).toEqual({ id: "policy", status: "met", note: "Health and Safety Policy is listed." });
    expect(out.silent).toEqual({ id: "silent", status: "unknown", note: "Your company facts do not cover this." });
    expect(out.mine).toEqual({ id: "mine", status: "met", note: null });
  });

  it("reads required amounts and accreditation names", () => {
    expect(requiredAmounts("£5m any one claim", "")).toEqual([5_000_000]);
    expect(requiredAmounts(null, "cover of £250,000 and £1 million")).toEqual([250_000, 1_000_000]);
    expect(requiredAmounts("2 references", "")).toEqual([]);
    expect(accreditationKey("ISO 9001:2015")).toBe("iso9001");
    expect(accreditationKey("Constructionline (Gold)")).toBe("constructionline");
  });
});

describe("computeVerdict", () => {
  const item = (status: VerdictRequirement["status"], extra: Partial<VerdictRequirement> = {}): VerdictRequirement => ({ text: "Hold public liability insurance of £5m", isPassFail: true, kind: "pass_fail", category: "insurance", status, ...extra });
  const soft = (status: VerdictRequirement["status"]) => item(status, { isPassFail: false, kind: "mandatory", category: "submission", text: "Sign the form of tender" });

  it("treats pass/fail, minimum scores and mandatory insurance/financial/accreditation as gates", () => {
    expect(isGating({ isPassFail: true, kind: "pass_fail", category: "other" })).toBe(true);
    expect(isGating({ isPassFail: false, kind: "minimum_score", category: "other" })).toBe(true);
    expect(isGating({ isPassFail: false, kind: "mandatory", category: "accreditation" })).toBe(true);
    expect(isGating({ isPassFail: false, kind: "mandatory", category: "submission" })).toBe(false);
    expect(isGating({ isPassFail: false, kind: "desirable", category: "insurance" })).toBe(false);
  });

  it("says 'looks biddable' only when every gate is positively met", () => {
    const verdict = computeVerdict([item("met"), item("met"), soft("unknown")], true);
    expect(verdict.verdict).toBe("looks_biddable");
    expect(verdict.reasons.join(" ")).toMatch(/says nothing about your chances of winning/);
    expect(verdict.counts).toMatchObject({ requirements: 3, passFail: 2, gating: 2, met: 2, unknown: 1 });
    expect(verdict.notAssessed).toEqual([...NOT_ASSESSED]);
    expect(verdict.notAssessed.join(" ")).toMatch(/Conflicts of interest/);
  });

  it("one gap on a gate is enough for 'likely not eligible', and it names the gap", () => {
    const verdict = computeVerdict([item("met"), item("met"), item("met"), item("gap", { text: "Hold Cyber Essentials at the deadline" })], true);
    expect(verdict.verdict).toBe("likely_not_eligible");
    expect(verdict.reasons[0]).toBe("Pass/fail gap: Hold Cyber Essentials at the deadline");
  });

  it("is 'biddable with gaps' when gates are fine but something is open, and 'not enough information' when most gates are undecided", () => {
    expect(computeVerdict([item("met"), item("met"), item("unknown")], true).verdict).toBe("biddable_with_gaps");
    expect(computeVerdict([item("met"), item("met"), soft("gap")], true).verdict).toBe("biddable_with_gaps");
    // Declarations and submission rules are for the bidder to settle: open points alone do not block a verdict…
    expect(computeVerdict([item("met"), item("verify"), item("unknown")], true).verdict).toBe("biddable_with_gaps");
    // …but when nothing at all could be checked there is no basis for one.
    const none = computeVerdict([item("verify"), item("unknown")], true);
    expect(none.verdict).toBe("not_enough_information");
    expect(none.reasons[0]).toMatch(/^None of the 2 pass\/fail/);
    expect(computeVerdict([soft("unknown"), soft("unknown")], true).verdict).toBe("not_enough_information");
  });

  it("never gives a positive verdict without confirmed facts or without requirements", () => {
    const unconfirmed = computeVerdict([item("unknown"), item("unknown")], false);
    expect(unconfirmed).toMatchObject({ verdict: "not_enough_information", factsConfirmed: false });
    expect(unconfirmed.reasons[0]).toMatch(/have not been confirmed/);
    expect(computeVerdict([], true).verdict).toBe("not_enough_information");
  });
});
