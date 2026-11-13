import "server-only";
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { getBidCapabilities } from "@/features/bids/access";
import { effectiveWordLimit, GAP_PATTERN } from "@/features/bids/answer-text";
import { countWords, STANDING_NOTICE } from "@/features/bids/constants";
import { describeLoc } from "@/features/bids/locations";
import {
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_CATEGORY_LABELS,
  REQUIREMENT_KIND_LABELS,
  SUMMARY_FIELD_LABELS,
  SUMMARY_FIELDS,
  VERDICT_LABELS,
  type Citation,
  type RequirementCategory,
  type RequirementKind,
} from "@/features/bids/types";
import { track } from "@/lib/analytics";
import { getBid, listQuestions, listRequirements, type BidRow, type QuestionRow, type RequirementRow, type Scope } from "./bids";
import { DraftingLockedError } from "./drafting";

/** Server-side exports: answers (DOCX), the cited bid check (DOCX), the requirements checklist (DOCX, CSV). */

export type ExportFile = { fileName: string; contentType: string; body: Uint8Array };

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const FONT = "Calibri";

function safeName(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9 _-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "bid"
  );
}

const STATUS_LABELS: Record<string, string> = { met: "Met", gap: "Gap", unknown: "Unknown", verify: "Verify in documents" };

function citationLine(citation: Citation | null): string {
  if (!citation) return "No citation (added by hand)";
  const where = `${citation.fileName}${citation.loc ? `, ${describeLoc(citation.loc)}` : ""}`;
  return `${citation.verified ? "Quote found in" : "VERIFY IN DOCUMENTS — quote not found in"} ${where}`;
}

const text = (value: string, options: { bold?: boolean; italics?: boolean; size?: number; color?: string; highlight?: "yellow" } = {}) =>
  new TextRun({ text: value, font: FONT, size: options.size ?? 22, bold: options.bold, italics: options.italics, color: options.color, highlight: options.highlight });

const paragraph = (value: string, options: Parameters<typeof text>[1] & { spacingAfter?: number } = {}) =>
  new Paragraph({ children: [text(value, options)], spacing: { after: options.spacingAfter ?? 120 } });

const heading = (value: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
  new Paragraph({ heading: level, children: [new TextRun({ text: value, font: FONT, bold: true })], spacing: { before: 240, after: 120 } });

function cell(value: string, options: { bold?: boolean; width?: number; shade?: boolean } = {}): TableCell {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shade ? { type: ShadingType.CLEAR, fill: "F3F0E8", color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: value.split("\n").map((line) => new Paragraph({ children: [text(line, { bold: options.bold, size: 19 })] })),
  });
}

function table(headers: Array<{ label: string; width: number }>, rows: string[][]): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "C9C2B2" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((header) => cell(header.label, { bold: true, width: header.width, shade: true })) }),
      ...rows.map((row) => new TableRow({ children: row.map((value, index) => cell(value, { width: headers[index]?.width })) })),
    ],
  });
}

function documentOf(title: string, children: Array<Paragraph | Table>): Document {
  return new Document({
    creator: "Bidfolio",
    title,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
}

async function pack(document: Document): Promise<Uint8Array> {
  return new Uint8Array(await Packer.toBuffer(document));
}

const dateTime = (value: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);

function titleBlock(bid: BidRow, subtitle: string): Paragraph[] {
  return [
    new Paragraph({ alignment: AlignmentType.LEFT, children: [text(bid.title, { bold: true, size: 36 })], spacing: { after: 80 } }),
    paragraph([bid.buyerName, bid.reference ? `Ref ${bid.reference}` : null].filter(Boolean).join(" · ") || " ", { size: 22, color: "434A50", spacingAfter: 60 }),
    paragraph(`${subtitle} · exported ${dateTime(new Date())}`, { size: 18, color: "6B737A", spacingAfter: 60 }),
    ...(bid.submissionDeadline ? [paragraph(`Submission deadline as read from the pack: ${dateTime(bid.submissionDeadline)} (UK time) — confirm against the documents.`, { size: 18, color: "6B737A" })] : []),
  ];
}

/** Paragraphs of an answer; `[EVIDENCE NEEDED: …]` stays visible (highlighted), source markers are removed. */
function answerParagraphs(answer: string): Paragraph[] {
  const clean = answer.replace(/\s?\[E\d{1,3}\]/g, "");
  return clean.split(/\n{2,}/).flatMap((block) => {
    const lines = block.split("\n");
    return lines.map((line, lineIndex) => {
      const runs: TextRun[] = [];
      let cursor = 0;
      const isHeading = lines.length === 1 && line.length < 80 && !/[.!?:;,]$/.test(line.trim()) && !line.trim().startsWith("-") && block !== clean;
      for (const match of line.matchAll(new RegExp(GAP_PATTERN.source, "gi"))) {
        if (match.index > cursor) runs.push(text(line.slice(cursor, match.index), { bold: isHeading }));
        runs.push(text(match[0], { bold: true, highlight: "yellow" }));
        cursor = match.index + match[0].length;
      }
      if (cursor < line.length) runs.push(text(line.slice(cursor), { bold: isHeading }));
      return new Paragraph({ children: runs.length > 0 ? runs : [text("")], spacing: { after: lineIndex === lines.length - 1 ? 160 : 40 } });
    });
  });
}

/** All answers in one Word document: reference, question, word count against the limit, text. */
export async function exportAnswersDocx(ctx: Scope, bidId: string): Promise<ExportFile> {
  const bid = await getBid(ctx, bidId);
  const capabilities = await getBidCapabilities(ctx.organization.id, bid);
  if (!capabilities.exportAnswers) throw new DraftingLockedError(capabilities.lockedReason);
  const questions = await listQuestions(ctx, bid.id);
  const answered = questions.filter((question) => question.draftText?.trim());
  const withGaps = answered.filter((question) => new RegExp(GAP_PATTERN.source, "i").test(question.draftText ?? ""));
  const overLimit = answered.filter((question) => {
    const { limit } = effectiveWordLimit(question);
    return limit !== null && countWords(question.draftText ?? "") > limit;
  });

  const children: Array<Paragraph | Table> = [...titleBlock(bid, "Answers")];
  children.push(paragraph(STANDING_NOTICE, { italics: true, size: 18, color: "6B737A" }));
  children.push(paragraph(`${answered.length} of ${questions.length} questions have an answer.`, { size: 20 }));
  if (withGaps.length > 0) {
    children.push(paragraph(`Evidence still needed in: ${withGaps.map((question) => question.ref || question.title || "question").join(", ")}. The placeholders are highlighted — remove them before you submit.`, { bold: true, size: 20, color: "A3271C" }));
  }
  if (overLimit.length > 0) {
    children.push(paragraph(`Over the word limit: ${overLimit.map((question) => question.ref || question.title || "question").join(", ")}.`, { bold: true, size: 20, color: "A3271C" }));
  }
  for (const question of questions) {
    const { limit, fromPages } = effectiveWordLimit(question);
    const words = countWords(question.draftText ?? "");
    children.push(heading(`${question.ref ? `${question.ref} ` : ""}${question.title ?? ""}`.trim() || "Question", HeadingLevel.HEADING_2));
    children.push(paragraph(question.text, { italics: true, size: 20, color: "434A50" }));
    const limitText = limit ? `${words} words of ${limit} allowed${fromPages ? ` (limit converted from ${question.pageLimit} page${question.pageLimit === 1 ? "" : "s"})` : ""}${words > limit ? " — OVER LIMIT" : ""}` : `${words} words (no limit stated)`;
    children.push(paragraph([limitText, question.weighting !== null ? `weighting ${question.weighting}%` : null, `status: ${question.status.replace("_", " ")}`].filter(Boolean).join(" · "), { size: 18, color: limit && words > limit ? "A3271C" : "6B737A" }));
    if (question.draftText?.trim()) children.push(...answerParagraphs(question.draftText));
    else children.push(paragraph("No answer yet.", { italics: true, color: "6B737A" }));
  }
  await track("export_done", { organizationId: ctx.organization.id, userId: ctx.user.id }, { kind: "answers_docx" });
  return { fileName: `${safeName(bid.title)}-answers.docx`, contentType: DOCX_TYPE, body: await pack(documentOf(`${bid.title} — answers`, children)) };
}

function requirementRows(requirements: RequirementRow[]): string[][] {
  return requirements.map((row) => [
    row.ref,
    `${row.text}${row.threshold ? `\nLevel: ${row.threshold}` : ""}`,
    REQUIREMENT_KIND_LABELS[row.kind as RequirementKind] ?? row.kind,
    `${STATUS_LABELS[row.companyStatus] ?? row.companyStatus}${row.companyNote ? `\n${row.companyNote}` : ""}${row.note ? `\nNote: ${row.note}` : ""}`,
    `${row.citation?.quote ? `“${row.citation.quote}”\n` : ""}${citationLine(row.citation)}`,
    row.checkedAt ? "Yes" : "",
  ]);
}

const REQUIREMENT_HEADERS = [
  { label: "Ref", width: 6 },
  { label: "Requirement", width: 30 },
  { label: "Type", width: 10 },
  { label: "Your position", width: 18 },
  { label: "Source", width: 28 },
  { label: "Checked", width: 8 },
];

function checklistSections(requirements: RequirementRow[]): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [];
  for (const category of REQUIREMENT_CATEGORIES) {
    const rows = requirements.filter((row) => (row.category as RequirementCategory) === category);
    if (rows.length === 0) continue;
    children.push(heading(`${REQUIREMENT_CATEGORY_LABELS[category]} (${rows.length})`, HeadingLevel.HEADING_3));
    children.push(table(REQUIREMENT_HEADERS, requirementRows(rows)));
  }
  if (requirements.length === 0) children.push(paragraph("No requirements were found or added.", { italics: true }));
  return children;
}

/** The requirements checklist on its own. */
export async function exportRequirementsDocx(ctx: Scope, bidId: string): Promise<ExportFile> {
  const bid = await getBid(ctx, bidId);
  const requirements = await listRequirements(ctx, bid.id);
  const children: Array<Paragraph | Table> = [...titleBlock(bid, "Requirements checklist"), paragraph(STANDING_NOTICE, { italics: true, size: 18, color: "6B737A" }), ...checklistSections(requirements)];
  await track("export_done", { organizationId: ctx.organization.id, userId: ctx.user.id }, { kind: "requirements_docx" });
  return { fileName: `${safeName(bid.title)}-requirements.docx`, contentType: DOCX_TYPE, body: await pack(documentOf(`${bid.title} — requirements`, children)) };
}

/** The whole cited bid check: verdict, key facts, key dates, evaluation model, red flags, checklist, questions. */
export async function exportBriefDocx(ctx: Scope, bidId: string): Promise<ExportFile> {
  const bid = await getBid(ctx, bidId);
  const [requirements, questions] = await Promise.all([listRequirements(ctx, bid.id), listQuestions(ctx, bid.id)]);
  const brief = bid.brief;
  const children: Array<Paragraph | Table> = [...titleBlock(bid, "Cited bid check"), paragraph(STANDING_NOTICE, { italics: true, size: 18, color: "6B737A" })];

  if (bid.verdict) {
    children.push(heading(`Our cautious read: ${VERDICT_LABELS[bid.verdict.verdict]}`, HeadingLevel.HEADING_2));
    for (const reason of bid.verdict.reasons) children.push(paragraph(`• ${reason}`, { spacingAfter: 60 }));
    children.push(paragraph(`Not assessed by this check: ${(bid.verdict.notAssessed ?? []).join("; ")}.`, { size: 18, color: "6B737A" }));
  }
  if (brief?.overview) {
    children.push(heading("Summary", HeadingLevel.HEADING_2));
    children.push(paragraph(brief.overview));
  }
  if (brief) {
    children.push(heading("Key facts", HeadingLevel.HEADING_2));
    children.push(
      table(
        [
          { label: "Fact", width: 20 },
          { label: "As read from the pack", width: 40 },
          { label: "Source", width: 40 },
        ],
        SUMMARY_FIELDS.map((field) => {
          const fact = brief.summary[field];
          const value = fact.status === "not_stated" ? "Not stated in the pack" : `${fact.value ?? ""}${fact.status === "conflicting" ? "\nCHECK: readings or documents disagree" : ""}${fact.note ? `\n${fact.note}` : ""}`;
          return [SUMMARY_FIELD_LABELS[field], value, fact.status === "not_stated" ? "" : `${fact.citation?.quote ? `“${fact.citation.quote}”\n` : ""}${citationLine(fact.citation)}`];
        }),
      ),
    );
  }
  if ((bid.keyDates ?? []).length > 0) {
    children.push(heading("Key dates", HeadingLevel.HEADING_2));
    children.push(
      table(
        [
          { label: "Date", width: 22 },
          { label: "Event", width: 38 },
          { label: "Source", width: 40 },
        ],
        (bid.keyDates ?? []).map((item) => [`${item.dateIso ?? "No date"}${item.time ? ` ${item.time}` : ""}`, item.event, citationLine(item.citation)]),
      ),
    );
  }
  const evaluation = bid.evaluationModel;
  if (evaluation && (evaluation.criteria.length > 0 || evaluation.scoringScale.length > 0)) {
    children.push(heading("How tenders are evaluated", HeadingLevel.HEADING_2));
    if (evaluation.criteria.length > 0) {
      children.push(
        table(
          [
            { label: "Criterion", width: 34 },
            { label: "Weighting", width: 12 },
            { label: "What is assessed", width: 54 },
          ],
          evaluation.criteria.map((item) => [`${item.parent ? `${item.parent} › ` : ""}${item.name}`, item.weight !== null ? `${item.weight}%` : "Not stated", item.whatIsAssessed ?? ""]),
        ),
      );
    }
    if (evaluation.scoringScale.length > 0) {
      children.push(paragraph("Scoring scale", { bold: true }));
      children.push(
        table(
          [
            { label: "Score", width: 12 },
            { label: "Label", width: 22 },
            { label: "Descriptor", width: 66 },
          ],
          evaluation.scoringScale.map((item) => [item.score, item.label ?? "", item.descriptor ?? ""]),
        ),
      );
    }
    for (const item of evaluation.minimumThresholds) children.push(paragraph(`Minimum threshold: ${item.description}`));
  }
  if (brief && brief.redFlags.length > 0) {
    children.push(heading("Red flags", HeadingLevel.HEADING_2));
    for (const flag of brief.redFlags) children.push(paragraph(`• [${flag.severity}] ${flag.description}${flag.citation ? ` (${citationLine(flag.citation)})` : ""}`, { spacingAfter: 60 }));
  }
  if (brief && brief.documentsToReturn.length > 0) {
    children.push(heading("Documents to return", HeadingLevel.HEADING_2));
    for (const item of brief.documentsToReturn) children.push(paragraph(`☐ ${item.name}${item.formatNote ? ` — ${item.formatNote}` : ""}`, { spacingAfter: 60 }));
  }
  if (brief && brief.unknowns.length > 0) {
    children.push(heading("Not stated in the pack", HeadingLevel.HEADING_2));
    for (const item of brief.unknowns) children.push(paragraph(`• ${item.item}${item.whyItMatters ? ` — ${item.whyItMatters}` : ""}`, { spacingAfter: 60 }));
  }
  children.push(heading(`Requirements checklist (${requirements.length})`, HeadingLevel.HEADING_2));
  children.push(...checklistSections(requirements));
  children.push(heading(`Questions to answer (${questions.length})`, HeadingLevel.HEADING_2));
  if (questions.length > 0) {
    children.push(
      table(
        [
          { label: "Ref", width: 10 },
          { label: "Question", width: 52 },
          { label: "Weighting", width: 12 },
          { label: "Limit", width: 26 },
        ],
        questions.map((question: QuestionRow) => [
          question.ref,
          `${question.title ? `${question.title}\n` : ""}${question.text.slice(0, 600)}`,
          question.weighting !== null ? `${question.weighting}%` : "Not stated",
          question.limitText ?? (question.wordLimit ? `${question.wordLimit} words` : "Not stated"),
        ]),
      ),
    );
  } else children.push(paragraph("No questions were found or added.", { italics: true }));

  const coverage = bid.packStats?.coverage;
  if (coverage) {
    children.push(heading("What was read", HeadingLevel.HEADING_2));
    children.push(
      table(
        [
          { label: "File", width: 46 },
          { label: "Read", width: 18 },
          { label: "Items found", width: 12 },
          { label: "Note", width: 24 },
        ],
        coverage.files.map((file) => [file.name, `${file.status}${file.pages ? `, ${file.pages} pages/sections` : ""}`, String(file.items), file.note ?? ""]),
      ),
    );
    for (const warning of bid.packStats?.warnings ?? []) children.push(paragraph(`• ${warning}`, { size: 18, spacingAfter: 60 }));
  }
  await track("export_done", { organizationId: ctx.organization.id, userId: ctx.user.id }, { kind: "brief_docx" });
  return { fileName: `${safeName(bid.title)}-cited-bid-check.docx`, contentType: DOCX_TYPE, body: await pack(documentOf(`${bid.title} — cited bid check`, children)) };
}

/** Quotes a CSV field and defuses spreadsheet formulas (a cell starting with = + - @). */
export function csvField(value: string | number | null | undefined): string {
  let field = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(field)) field = `'${field}`;
  return `"${field.replace(/"/g, '""')}"`;
}

/** The requirements checklist as CSV (UTF-8 with BOM so Excel opens £ correctly). */
export async function exportRequirementsCsv(ctx: Scope, bidId: string): Promise<ExportFile> {
  const bid = await getBid(ctx, bidId);
  const requirements = await listRequirements(ctx, bid.id);
  const header = ["Ref", "Category", "Requirement", "Level", "Type", "Your position", "Why", "Your note", "Checked against documents", "Source file", "Location", "Quote", "Quote found in documents"];
  const lines = [header.map(csvField).join(",")];
  for (const row of requirements) {
    lines.push(
      [
        row.ref,
        REQUIREMENT_CATEGORY_LABELS[row.category as RequirementCategory] ?? row.category,
        row.text,
        row.threshold,
        REQUIREMENT_KIND_LABELS[row.kind as RequirementKind] ?? row.kind,
        STATUS_LABELS[row.companyStatus] ?? row.companyStatus,
        row.companyNote,
        row.note,
        row.checkedAt ? "Yes" : "No",
        row.citation?.fileName ?? "",
        row.citation?.loc ? describeLoc(row.citation.loc) : "",
        row.citation?.quote ?? "",
        row.citation ? (row.citation.verified ? "Yes" : "No — verify in documents") : "No citation",
      ]
        .map(csvField)
        .join(","),
    );
  }
  await track("export_done", { organizationId: ctx.organization.id, userId: ctx.user.id }, { kind: "requirements_csv" });
  return { fileName: `${safeName(bid.title)}-requirements.csv`, contentType: "text/csv; charset=utf-8", body: new TextEncoder().encode(`﻿${lines.join("\r\n")}\r\n`) };
}
