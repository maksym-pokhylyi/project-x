import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { estimateTokens } from "@/features/bids/constants";
import { expandZip, ExtractionError, extractDocument, unitMarker } from "@/features/bids/server/extract";
import { htmlToText } from "@/features/bids/server/extract/docx";
import { parseCsv, rowsToText } from "@/features/bids/server/extract/sheet";
import { decodeText, splitIntoSections } from "@/features/bids/server/extract/text";
import { normaliseZipPath } from "@/features/bids/server/extract/zip";
import { buildPack, filePriority } from "@/features/bids/server/pipeline/pack";
import { classifyDocument } from "@/features/bids/server/pipeline/step-analyse";
import { buildPdf, buildZip } from "./helpers";

/** Text extraction on real fixtures (a council's published pack) and on generated edge cases. */

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", name)));

describe("PDF", () => {
  it("reads a real text PDF page by page", async () => {
    const doc = await extractDocument("pdf", fixture("check-sheet.pdf"));
    expect(doc.kind).toBe("pdf");
    expect(doc.pages).toBe(3);
    expect(doc.units.map((unit) => unit.loc)).toEqual(["p1", "p2", "p3"]);
    expect(doc.lowTextPages).toEqual([]);
    expect(doc.units[0]!.text).toContain("Ryde Town Council - Contractor Due Diligence Questionnaire");
    expect(doc.units[2]!.text).toContain("Section 3 - Health & Safety");
    // Table cells on one line stay apart.
    expect(doc.units[0]!.text).toMatch(/1\.6 VAT number/);
  });

  it("flags pages without a text layer (scanned-like PDF) and still returns one unit per page", async () => {
    const doc = await extractDocument("pdf", buildPdf([null, "The Contractor shall hold Public Liability insurance of not less than five million pounds.", null]));
    expect(doc.pages).toBe(3);
    expect(doc.lowTextPages).toEqual([1, 3]);
    expect(doc.units).toHaveLength(3);
    expect(doc.units[0]!.text).toBe("");
    expect(doc.units[1]!.text).toContain("Public Liability insurance");
  });

  it("keeps the lines of a generated page in order", async () => {
    const doc = await extractDocument("pdf", buildPdf(["4.1 Insurance\nPublic liability: 5,000,000 pounds\nEmployers liability: 10,000,000 pounds"]));
    expect(doc.units[0]!.text.split("\n")).toEqual(["4.1 Insurance", "Public liability: 5,000,000 pounds", "Employers liability: 10,000,000 pounds"]);
  });

  it("refuses files that are not PDFs with a message a person can act on", async () => {
    await expect(extractDocument("pdf", new TextEncoder().encode("PK not a pdf at all"))).rejects.toThrow(ExtractionError);
    await expect(extractDocument("pdf", new TextEncoder().encode("%PDF-1.7\nthis is damaged"))).rejects.toThrow(/could not be opened/);
    await expect(extractDocument("pdf", new Uint8Array())).rejects.toThrow("This file is empty.");
  });
});

describe("Word", () => {
  it("reads a real .docx: headings and table rows", async () => {
    const doc = await extractDocument("docx", fixture("references.docx"));
    expect(doc.kind).toBe("docx");
    expect(doc.units[0]!.loc).toBe("s1");
    const text = doc.units.map((unit) => unit.text).join("\n");
    expect(text).toContain("Appendix 4");
    expect(text).toContain("Information | Reference 1 | Reference 2 | Reference 3");
    expect(text).toMatch(/Customer organisation \(name\) \|/);
  });

  it("converts mammoth's HTML to citable text", () => {
    const text = htmlToText(
      "<h1>4. Insurance</h1><p>The Contractor shall hold:</p><ol><li>Public liability &pound;5m</li><li>Employers&#39; liability &amp; indemnity</li></ol>" +
        "<table><tr><th>Cover</th><th>Level</th></tr><tr><td><p>Public liability</p></td><td><p>£5,000,000</p><p>any one claim</p></td></tr></table><p>End.</p>",
    );
    expect(text).toContain("4. Insurance");
    expect(text).toMatch(/1\. Public liability/);
    expect(text).toMatch(/2\. Employers' liability & indemnity/);
    expect(text).toContain("Cover | Level");
    expect(text).toMatch(/Public liability \| £5,000,000 \/ any one claim/);
  });

  it("refuses a file that is not a .docx", async () => {
    await expect(extractDocument("docx", new TextEncoder().encode("plain text pretending"))).rejects.toThrow(ExtractionError);
  });
});

describe("spreadsheets, CSV and text", () => {
  it("reads a real .xlsx: one unit per sheet, cells with their references", async () => {
    const doc = await extractDocument("xlsx", fixture("query-responses.xlsx"));
    expect(doc.units).toHaveLength(1);
    expect(doc.units[0]!.loc).toBe("sheet:Sheet1");
    expect(doc.units[0]!.text.split("\n")[0]).toBe("A1: Query Number | B1: Query | C1: Response");
    expect(doc.units[0]!.text).toContain("Bi-weekly progress updates to the Project Manager.");
    await expect(extractDocument("xlsx", new TextEncoder().encode("not a zip"))).rejects.toThrow(/Old \.xls files/);
  });

  it("renders rows with cell references, skips empty cells and caps long sheets", () => {
    expect(rowsToText([["Item", null, "Rate"], [], ["Mowing", "", 12.5], [new Date("2027-05-14T00:00:00Z"), "multi\nline"]]).text).toBe("A1: Item | C1: Rate\nA3: Mowing | C3: 12.5\nA4: 2027-05-14 | B4: multi / line");
    const long = rowsToText(Array.from({ length: 450 }, (_, index) => [`row ${index}`]));
    expect(long.truncatedRows).toBe(50);
    expect(long.text).toContain("[SHEET TRUNCATED: 50 further non-empty rows not shown]");
  });

  it("parses CSV with quotes, embedded newlines and other delimiters", async () => {
    expect(parseCsv('ref,question,answer\n1,"Is a site visit ""mandatory""?","Yes,\nby appointment"\n')).toEqual([
      ["ref", "question", "answer"],
      ["1", 'Is a site visit "mandatory"?', "Yes,\nby appointment"],
    ]);
    expect(parseCsv("a;b;c\n1;2;3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
    const doc = await extractDocument("csv", new TextEncoder().encode("﻿ref,question\n7,Is TUPE expected to apply?\n"));
    expect(doc.units).toEqual([{ loc: "sheet:CSV", text: "A1: ref | B1: question\nA2: 7 | B2: Is TUPE expected to apply?" }]);
  });

  it("splits text into page-sized sections and decodes legacy encodings", async () => {
    const paragraphs = Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}. ${"The supplier must comply with the specification. ".repeat(8)}`).join("\n\n");
    const doc = await extractDocument("txt", new TextEncoder().encode(paragraphs));
    expect(doc.units.length).toBeGreaterThan(2);
    expect(doc.units.map((unit) => unit.loc)).toEqual(doc.units.map((_, index) => `s${index + 1}`));
    expect(doc.units.every((unit) => unit.text.length <= 4800)).toBe(true);
    expect(doc.units.map((unit) => unit.text).join("\n\n")).toContain("Paragraph 30.");
    expect(splitIntoSections("x".repeat(12_000)).length).toBeGreaterThan(2);
    // "£5m" in Windows-1252 (0xA3) is not valid UTF-8.
    expect(decodeText(new Uint8Array([0xa3, 0x35, 0x6d]))).toBe("£5m");
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x41, 0x00]))).toBe("A");
  });
});

describe("ZIP", () => {
  it("expands supported files and reports everything it skipped, with reasons", () => {
    const zip = buildZip({
      "Pack/01 ITT.pdf": buildPdf(["Invitation to tender"]),
      "Pack/Appendices/Pricing.csv": "item,rate\nMowing,12",
      "Pack/old-spec.doc": "legacy",
      "Pack/site-photo.jpg": new Uint8Array([1, 2, 3]),
      "Pack/more.zip": buildZip({ "inner.txt": "nested" }),
      "Pack/empty.txt": "",
      "__MACOSX/Pack/._01 ITT.pdf": "junk",
      "Pack/.DS_Store": "junk",
      "Pack/~$lock.docx": "junk",
    });
    const { members, skipped } = expandZip(zip);
    expect(members.map((member) => [member.path, member.kind])).toEqual([
      ["Pack/01 ITT.pdf", "pdf"],
      ["Pack/Appendices/Pricing.csv", "csv"],
    ]);
    const reasons = Object.fromEntries(skipped.map((skip) => [skip.path, skip.reason]));
    expect(reasons["Pack/old-spec.doc"]).toMatch(/Old Word format/);
    expect(reasons["Pack/site-photo.jpg"]).toMatch(/Images are not supported/);
    expect(reasons["Pack/more.zip"]).toMatch(/not expanded/);
    expect(reasons["Pack/empty.txt"]).toBe("Empty file.");
    // Junk entries are ignored silently.
    expect(Object.keys(reasons)).toHaveLength(4);
  });

  it("respects what is left of the bid's file and size limits", () => {
    const zip = buildZip({ "a.txt": "a".repeat(200), "b.txt": "b".repeat(200), "c.txt": "c".repeat(200) });
    const byCount = expandZip(zip, { remainingFiles: 2 });
    expect(byCount.members).toHaveLength(2);
    expect(byCount.skipped).toEqual([{ path: "c.txt", reason: "Too many files in this bid." }]);
    const bySize = expandZip(zip, { remainingBytes: 450 });
    expect(bySize.members).toHaveLength(2);
    expect(bySize.skipped[0]!.reason).toBe("The bid would exceed 200 MB.");
  });

  it("refuses non-archives and unsafe paths", () => {
    expect(() => expandZip(new TextEncoder().encode("%PDF-1.4"))).toThrow(/not a valid ZIP/);
    expect(() => expandZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9, 9, 9]))).toThrow(/could not be opened/);
    expect(normaliseZipPath("../../etc/passwd")).toBeNull();
    expect(normaliseZipPath("folder\\sub\\file.pdf")).toBe("folder/sub/file.pdf");
    expect(normaliseZipPath("folder/")).toBeNull();
  });
});

describe("pack building", () => {
  const unit = (chars: number) => [{ loc: "p1", text: "x".repeat(chars) }];

  it("marks every unit with its file and location", () => {
    const pack = buildPack([{ id: "a", name: "ITT.pdf", units: [{ loc: "p1", text: "Page one" }, { loc: "p2", text: "  " }, { loc: "p3", text: "Page three" }] }]);
    expect(pack.text).toBe(`${unitMarker("ITT.pdf", "p1")}\nPage one\n\n${unitMarker("ITT.pdf", "p3")}\nPage three`);
    expect(unitMarker("ITT.pdf", "p1")).toBe("<<<FILE: ITT.pdf | LOC: p1>>>");
    expect(pack.excludedFileIds).toEqual([]);
    expect(pack.tokens).toBe(estimateTokens(pack.text));
  });

  it("over the cap: drops boilerplate and drawings before core documents, and says which", () => {
    const pack = buildPack(
      [
        { id: "itt", name: "Invitation to Tender.pdf", units: unit(3000) },
        { id: "terms", name: "Standard Terms and Conditions.pdf", units: unit(6000) },
        { id: "drawing", name: "Site layout drawing.pdf", units: unit(2000) },
        { id: "spec", name: "Specification.docx", units: unit(3000) },
      ],
      2000,
    );
    expect(pack.excludedFileIds.sort()).toEqual(["drawing", "terms"]);
    expect(pack.files.map((file) => file.id)).toEqual(["itt", "spec"]);
    expect(pack.truncatedFileId).toBeNull();
  });

  it("cuts the tail of a single enormous file rather than dropping it", () => {
    const pack = buildPack([{ id: "big", name: "Specification.pdf", units: Array.from({ length: 50 }, (_, index) => ({ loc: `p${index + 1}`, text: "y".repeat(1000) })) }], 3000);
    expect(pack.excludedFileIds).toEqual([]);
    expect(pack.truncatedFileId).toBe("big");
    expect(pack.files[0]!.units.length).toBeLessThan(50);
    expect(pack.files[0]!.units.length).toBeGreaterThan(5);
    expect(pack.tokens).toBeLessThanOrEqual(3300);
  });

  it("ranks and classifies files by name", () => {
    expect(filePriority("pack.zip/01 Invitation to Tender.pdf")).toBe(2);
    expect(filePriority("Standard Terms and Conditions.pdf")).toBe(0);
    expect(filePriority("Appendix B.pdf")).toBe(1);
    expect(classifyDocument("Clarification Log Q&A.xlsx", "")).toBe("clarifications");
    expect(classifyDocument("04_Due-Dilligence-Check-Sheet.pdf", "")).toBe("questionnaire"); // real file name, misspelt by the buyer
    expect(classifyDocument("Selection Questionnaire (PSQ).docx", "")).toBe("questionnaire");
    expect(classifyDocument("Appendix C Quality Methodology.docx", "")).toBe("response_template");
    expect(classifyDocument("Appendix E Pricing Schedule.docx", "")).toBe("pricing");
    expect(classifyDocument("Appendix B.pdf", "Plain text with no questions.")).toBeNull();
    expect(classifyDocument("Appendix B.pdf", Array.from({ length: 9 }, (_, index) => `${index + 1}. Do you hold the policy?`).join("\n"))).toBe("questionnaire");
  });
});
