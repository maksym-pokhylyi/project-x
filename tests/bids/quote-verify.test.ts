import { describe, expect, it } from "vitest";
import {
  buildPackIndex,
  citationStats,
  normaliseText,
  numberTokens,
  resolveFile,
  thresholdGrounded,
  thresholdMagnitudes,
  tightText,
  verifyCitation,
} from "@/features/bids/server/pipeline/quote-verify";
import { toFact, toRequirement } from "@/features/bids/server/pipeline/transform";

/**
 * The citation check is the product's main defence against a confident wrong answer:
 * nothing is shown as "verified" unless THIS code found the quote in the text we extracted.
 */

const ITT = "f-itt";
const QA = "f-qa";

const index = buildPackIndex([
  {
    id: ITT,
    name: "01 Invitation to Tender.pdf",
    units: [
      { loc: "p1", text: "Invitation to Tender\nGrounds Maintenance 2027–2030\nTenders must be received by 12:00 noon on Friday 14 May 2027." },
      {
        loc: "p2",
        text:
          "4.1 Insurance\nThe Contractor shall hold Public Liability insurance of not less than £5,000,000 for\nany one claim and Employers’ Liability insurance of £10 million.\n" +
          "4.2 Bidders must provide two references for contracts of a similar nature com-\npleted within the last three years.",
      },
      { loc: "p3", text: "A bidder scoring less than 3 on any quality question will be excluded from the competition.\nThe successful supplier must hold" },
      { loc: "p4", text: "Cyber Essentials certification at contract award.\n• Tenders are to be submitted through the e-tendering portal only." },
    ],
  },
  {
    id: QA,
    name: "Clarification Log (Q&A).xlsx",
    units: [{ loc: "sheet:Log", text: "A2: 7 | B2: Is a site visit mandatory? | C2: Yes. Bidders who do not attend the site visit on 21 April 2027 will be rejected." }],
  },
]);

describe("text normalisation", () => {
  it("ignores case, typography and whitespace", () => {
    expect(normaliseText("  The  Contractor’s “duty”\n – always ")).toBe(`the contractor's "duty" - always`);
    expect(tightText("Employers’ Liability:\n £10 million")).toBe("employersliability£10million");
  });

  it("reads quantities in every common spelling", () => {
    expect([...numberTokens("£5m")]).toContain("5000000");
    expect([...numberTokens("£5 million")]).toContain("5000000");
    expect([...numberTokens("£5,000,000")]).toContain("5000000");
    expect([...numberTokens("two references in three years")].sort()).toEqual(["2", "3"]);
    expect([...numberTokens("250k turnover")]).toContain("250000");
    // "m" as a unit only when it is not the start of a word.
    expect([...numberTokens("5 metres")]).not.toContain("5000000");
  });

  it("takes the largest reading of each figure in a threshold", () => {
    expect(thresholdMagnitudes("£5m any one claim")).toEqual(["5000000"]);
    expect(thresholdMagnitudes("2 references in 3 years")).toEqual(["2", "3"]);
    expect(thresholdMagnitudes("no figure")).toEqual([]);
  });
});

describe("resolveFile", () => {
  it("finds a file by exact, case-insensitive and partial name", () => {
    expect(resolveFile(index, "01 Invitation to Tender.pdf")?.id).toBe(ITT);
    expect(resolveFile(index, "01 invitation to tender.PDF")?.id).toBe(ITT);
    expect(resolveFile(index, "Invitation to Tender")?.id).toBe(ITT);
    expect(resolveFile(index, "Clarification Log")?.id).toBe(QA);
  });

  it("returns null for an unknown or ambiguous name", () => {
    expect(resolveFile(index, "Specification.docx")).toBeNull();
    expect(resolveFile(index, "")).toBeNull();
    expect(resolveFile(index, "pdf")).toBeNull();
  });
});

describe("verifyCitation", () => {
  it("verifies a verbatim quote at the cited location", () => {
    const citation = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: "The Contractor shall hold Public Liability insurance of not less than £5,000,000" });
    expect(citation).toMatchObject({ verified: true, match: "exact", fileId: ITT, loc: "p2", page: 2 });
  });

  it("is insensitive to line breaks, curly quotes, bullets and hyphenation", () => {
    const hyphenated = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: "contracts of a similar nature completed within the last three years" });
    expect(hyphenated.match).toBe("exact");
    const typography = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: "Employers' Liability insurance of £10 million" });
    expect(typography.match).toBe("exact");
    const bullet = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p4", quote: "Tenders are to be submitted through the e-tendering portal only." });
    expect(bullet.match).toBe("exact");
  });

  it("accepts a quote that runs across a page break", () => {
    const citation = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p3", quote: "The successful supplier must hold Cyber Essentials certification at contract award." });
    expect(citation).toMatchObject({ verified: true, match: "exact", loc: "p3" });
    const fromSecondPage = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p4", quote: "The successful supplier must hold Cyber Essentials certification at contract award." });
    expect(fromSecondPage).toMatchObject({ verified: true, match: "exact", loc: "p4" });
  });

  it("accepts a quote with an ellipsis when every part is at the location", () => {
    const citation = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: "The Contractor shall hold Public Liability insurance […] for any one claim" });
    expect(citation.match).toBe("exact");
  });

  it("corrects a wrong page (relocated) and a wrong file (relocated_file)", () => {
    const wrongPage = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p1", quote: "A bidder scoring less than 3 on any quality question will be excluded" });
    expect(wrongPage).toMatchObject({ verified: true, match: "relocated", loc: "p3", page: 3, fileId: ITT });
    const wrongFile = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p1", quote: "Bidders who do not attend the site visit on 21 April 2027 will be rejected." });
    expect(wrongFile).toMatchObject({ verified: true, match: "relocated_file", fileId: QA, fileName: "Clarification Log (Q&A).xlsx", loc: "sheet:Log", page: null });
    const unknownFile = verifyCitation(index, { file: "Some other document.pdf", loc: "p9", quote: "Tenders must be received by 12:00 noon on Friday 14 May 2027." });
    expect(unknownFile).toMatchObject({ verified: true, match: "relocated_file", fileId: ITT, loc: "p1" });
  });

  it("never relocates a very short quote: it is too easy to find somewhere", () => {
    const citation = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p1", quote: "will be excluded" });
    expect(citation).toMatchObject({ verified: false, match: "not_found" });
  });

  it("accepts a lightly paraphrased quote only when its numbers are at the location (fuzzy)", () => {
    const light = verifyCitation(index, {
      file: "01 Invitation to Tender.pdf",
      loc: "p2",
      quote: "The Contractor shall hold Public Liability insurance of not less than £5,000,000 for each claim and Employers' Liability insurance of £10 million.",
    });
    expect(light).toMatchObject({ verified: true, match: "fuzzy", loc: "p2" });
    // Same wording, but the figure was changed: must NOT verify.
    const changedFigure = verifyCitation(index, {
      file: "01 Invitation to Tender.pdf",
      loc: "p2",
      quote: "The Contractor shall hold Public Liability insurance of not less than £10,000,000 for each claim and Employers' Liability insurance of £10 million.",
    });
    expect(changedFigure).toMatchObject({ verified: false, match: "not_found" });
  });

  it("rejects an invented quote and keeps what the model claimed for the reviewer", () => {
    const citation = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: "Bidders must hold ISO 14001 certification and a minimum turnover of £2 million." });
    expect(citation).toMatchObject({ verified: false, match: "not_found", fileId: ITT, loc: "p2", quote: "Bidders must hold ISO 14001 certification and a minimum turnover of £2 million." });
  });

  it("marks a missing or trivial quote as none, never as verified", () => {
    expect(verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: null })).toMatchObject({ verified: false, match: "none" });
    expect(verifyCitation(index, { file: null, loc: null, quote: "  " })).toMatchObject({ verified: false, match: "none", fileId: null });
    expect(verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: "4.1" })).toMatchObject({ verified: false, match: "none" });
  });

  it("never throws on odd input", () => {
    expect(() => verifyCitation(index, { file: undefined, loc: undefined, quote: undefined })).not.toThrow();
    expect(() => verifyCitation(buildPackIndex([]), { file: "x.pdf", loc: "p1", quote: "A long enough quote that exists nowhere at all" })).not.toThrow();
  });
});

describe("thresholdGrounded", () => {
  const citation = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p2", quote: "The Contractor shall hold Public Liability insurance of not less than £5,000,000" });

  it("accepts a figure found in the quote or next to it", () => {
    expect(thresholdGrounded(index, citation, "£5m")).toBe(true);
    expect(thresholdGrounded(index, citation, "£5,000,000 any one claim")).toBe(true);
    // £10 million is on the same page, just outside the quote.
    expect(thresholdGrounded(index, citation, "£10m")).toBe(true);
    expect(thresholdGrounded(index, citation, null)).toBe(true);
    expect(thresholdGrounded(index, citation, "valid certificate")).toBe(true);
  });

  it("rejects a figure that is not in the source", () => {
    expect(thresholdGrounded(index, citation, "£2,000,000")).toBe(false);
  });

  it("downgrades a requirement whose stated level is not in its source", () => {
    const draft = toRequirement(index, {
      id: "R1",
      category: "insurance",
      requirement: "Public liability insurance",
      threshold: "£20,000,000",
      kind: "pass_fail",
      evidence_to_provide: null,
      file: "01 Invitation to Tender.pdf",
      loc: "p2",
      quote: "The Contractor shall hold Public Liability insurance of not less than £5,000,000",
    });
    expect(draft.citation).toMatchObject({ verified: false, match: "exact", issue: "figure_not_in_source" });
    const good = toRequirement(index, {
      id: "R1",
      category: "insurance",
      requirement: "Public liability insurance",
      threshold: "£5m",
      kind: "pass_fail",
      evidence_to_provide: null,
      file: "01 Invitation to Tender.pdf",
      loc: "p2",
      quote: "The Contractor shall hold Public Liability insurance of not less than £5,000,000",
    });
    expect(good.citation).toMatchObject({ verified: true, match: "exact" });
    expect(good).toMatchObject({ category: "insurance", kind: "pass_fail", isPassFail: true });
  });
});

describe("facts and statistics", () => {
  it("a fact without a value is not_stated and carries no citation", () => {
    expect(toFact(index, { value: null, normalized: null, status: "stated", note: null, file: "01 Invitation to Tender.pdf", loc: "p1", quote: "Tenders must be received" })).toMatchObject({
      status: "not_stated",
      value: null,
      citation: null,
    });
    const stated = toFact(index, { value: "12:00 noon on 14 May 2027", normalized: "2027-05-14T12:00", status: "stated", note: null, file: "01 Invitation to Tender.pdf", loc: "p1", quote: "Tenders must be received by 12:00 noon on Friday 14 May 2027." });
    expect(stated.citation).toMatchObject({ verified: true, page: 1 });
  });

  it("counts verified citations", () => {
    const good = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p1", quote: "Tenders must be received by 12:00 noon on Friday 14 May 2027." });
    const bad = verifyCitation(index, { file: "01 Invitation to Tender.pdf", loc: "p1", quote: "Tenders must be received by 5pm on Monday 17 May 2027 at the latest." });
    expect(citationStats([good, bad, null, undefined])).toEqual({ total: 2, verified: 1 });
  });
});
