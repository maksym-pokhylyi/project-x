import { describe, expect, it } from "vitest";
import {
  answerHash,
  cleanModelAnswer,
  effectiveWordLimit,
  figuresIn,
  findEvidenceGaps,
  findEvidenceMarkers,
  normaliseGapMarkers,
  trimToWordLimit,
  wordLimitState,
  WORDS_PER_PAGE,
} from "@/features/bids/answer-text";
import { countWords, estimateTokens, fileKindFromName, formatBytes, unsupportedFileReason } from "@/features/bids/constants";
import { describeLoc, isPastDate, pageFromLoc } from "@/features/bids/locations";

describe("evidence gaps and markers", () => {
  it("finds every gap marker, whatever spelling the model used", () => {
    const text = "We hold ISO 9001 [E2]. [EVIDENCE NEEDED: ISO 14001 certificate] Our team [EVIDENCE_NEEDED - named contract manager] and [evidence needed: ISO 14001 certificate].";
    expect(findEvidenceGaps(text)).toEqual(["ISO 14001 certificate", "named contract manager"]);
    expect(findEvidenceGaps("Nothing missing here [E1].")).toEqual([]);
    expect(findEvidenceGaps("[EVIDENCE NEEDED]")).toEqual(["supporting evidence"]);
  });

  it("rewrites gap markers to the canonical form", () => {
    expect(normaliseGapMarkers("[Evidence needed - a waste carrier licence]")).toBe("[EVIDENCE NEEDED: a waste carrier licence]");
  });

  it("lists evidence markers in order of first use", () => {
    expect(findEvidenceMarkers("First [E3], then [E1] and [E3] again; [E12].")).toEqual(["E3", "E1", "E12"]);
  });
});

describe("cleanModelAnswer", () => {
  it("removes fences and the model's own word count", () => {
    expect(cleanModelAnswer("```\nOur approach is simple.\n```")).toBe("Our approach is simple.");
    expect(cleanModelAnswer("Our approach is simple.\n\nWord count: 889")).toBe("Our approach is simple.");
    expect(cleanModelAnswer("Our approach.\n\n(Total word count: 1,204 words)")).toBe("Our approach.");
    expect(cleanModelAnswer("Para one.\n\n\n\nPara two. [evidence_needed: a CV]")).toBe("Para one.\n\nPara two. [EVIDENCE NEEDED: a CV]");
  });

  it("splits combined source markers so each source can be checked and shown", () => {
    expect(cleanModelAnswer("Managed under Chapter 8 by accredited operatives [E2,E3]. Also [E1, E4 and E7]; not [E2-E5] or [see E2].")).toBe(
      "Managed under Chapter 8 by accredited operatives [E2][E3]. Also [E1][E4][E7]; not [E2-E5] or [see E2].",
    );
    expect(findEvidenceMarkers(cleanModelAnswer("One [E2,E3] two [E3; E1]."))).toEqual(["E2", "E3", "E1"]);
  });

  it("keeps a sentence that merely mentions a word count", () => {
    expect(cleanModelAnswer("The buyer set a word count of 500 words for this answer.")).toBe("The buyer set a word count of 500 words for this answer.");
  });
});

describe("word limits", () => {
  it("counts words the way buyers do and ignores evidence markers", () => {
    expect(countWords("We will mow weekly [E1] and report monthly [E2].")).toBe(7);
    expect(countWords("   ")).toBe(0);
    expect(countWords("one\ntwo\tthree  four")).toBe(4);
  });

  it("uses the word limit, else converts the page limit", () => {
    expect(effectiveWordLimit({ wordLimit: 500, pageLimit: 2 })).toEqual({ limit: 500, fromPages: false });
    expect(effectiveWordLimit({ wordLimit: null, pageLimit: 2 })).toEqual({ limit: 2 * WORDS_PER_PAGE, fromPages: true });
    expect(effectiveWordLimit({ wordLimit: null, pageLimit: null })).toEqual({ limit: null, fromPages: false });
    expect(effectiveWordLimit({ wordLimit: 0, pageLimit: 0 })).toEqual({ limit: null, fromPages: false });
  });

  it("never returns more words than the limit", () => {
    const sentence = "We will inspect every site each week and record the result. ";
    const text = sentence.repeat(30).trim();
    for (const limit of [5, 11, 37, 100, 250]) {
      const trimmed = trimToWordLimit(text, limit);
      expect(countWords(trimmed)).toBeLessThanOrEqual(limit);
      expect(trimmed.length).toBeGreaterThan(0);
    }
  });

  it("cuts at a sentence boundary when one is close", () => {
    const text = "First sentence has five words. Second sentence also has five words. Third sentence is the one that gets cut off here.";
    const trimmed = trimToWordLimit(text, 13);
    expect(trimmed).toBe("First sentence has five words. Second sentence also has five words.");
  });

  it("leaves a text within the limit untouched and does not count markers", () => {
    const text = "Short answer with evidence [E1] and [E2].";
    expect(trimToWordLimit(text, 50)).toBe(text);
    expect(trimToWordLimit("one two three [E1] four five six", 5)).toBe("one two three [E1] four five");
  });

  it("reports the live state for the editor", () => {
    expect(wordLimitState(10, null)).toBe("none");
    expect(wordLimitState(100, 500)).toBe("ok");
    expect(wordLimitState(450, 500)).toBe("near");
    expect(wordLimitState(500, 500)).toBe("near");
    expect(wordLimitState(501, 500)).toBe("over");
  });
});

describe("answerHash and figures", () => {
  it("changes when the text changes", () => {
    expect(answerHash("abc")).toBe(answerHash("abc"));
    expect(answerHash("abc")).not.toBe(answerHash("abd"));
    expect(answerHash("")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("extracts money, percentages and large numbers", () => {
    expect(figuresIn("We turned over £1,250,000 in 2025, a 12% rise, with 140 staff and 3 depots.").sort()).toEqual(["12%", "140", "2025", "£1250000"].sort());
    expect(figuresIn("£5m cover")).toEqual(["£5m"]);
  });
});

describe("files and locations", () => {
  it("recognises supported files and explains unsupported ones", () => {
    expect(fileKindFromName("ITT.PDF")).toBe("pdf");
    expect(fileKindFromName("Pricing Schedule.xlsx")).toBe("xlsx");
    expect(fileKindFromName("pack.zip")).toBe("zip");
    expect(fileKindFromName("old.doc")).toBeNull();
    expect(unsupportedFileReason("spec.docx")).toBeNull();
    expect(unsupportedFileReason("old.doc")).toMatch(/save it as \.docx or PDF/);
    expect(unsupportedFileReason("scan.jpg")).toMatch(/Images are not supported/);
    expect(unsupportedFileReason("pack.rar")).toMatch(/Only \.zip/);
    expect(unsupportedFileReason("README")).toMatch(/not supported/);
  });

  it("formats sizes and estimates tokens", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(estimateTokens("x".repeat(3600))).toBe(1000);
  });

  it("describes locations", () => {
    expect(pageFromLoc("p12")).toBe(12);
    expect(pageFromLoc("s3")).toBeNull();
    expect(pageFromLoc("sheet:Pricing")).toBeNull();
    expect(describeLoc("p12")).toBe("page 12");
    expect(describeLoc("sheet:Pricing")).toMatch(/Pricing/);
    expect(isPastDate("2020-01-01")).toBe(true);
    expect(isPastDate("2999-01-01")).toBe(false);
    expect(isPastDate(null)).toBe(false);
  });
});
