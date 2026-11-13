import type { LanguageModel } from "ai";

/**
 * A deterministic, offline stand-in for the language model — for end-to-end tests and for
 * clicking through the product without network access or spend. It is NOT a product
 * feature: it reads the prompt, finds the marked-up pack text in it and answers each task
 * with simple pattern matching, always quoting real lines of the pack, so everything
 * downstream (citation verification, union, company check, exports, UI) runs for real.
 *
 * Enabled only with BIDS_OFFLINE_AI=1 and never on a Vercel production deployment
 * (see ./models.ts).
 */

type Unit = { file: string; loc: string; text: string };

function promptText(options: unknown): string {
  const prompt = (options as { prompt?: Array<{ role: string; content: unknown }> }).prompt ?? [];
  return prompt
    .map((message) => {
      if (typeof message.content === "string") return message.content;
      if (Array.isArray(message.content)) return message.content.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : "")).join("\n");
      return "";
    })
    .join("\n\n");
}

function packUnits(text: string): Unit[] {
  const units: Unit[] = [];
  const pattern = /<<<FILE: (.+?) \| LOC: (.+?)>>>\n([\s\S]*?)(?=\n\n<<<FILE: |\n\n=== END OF TENDER PACK ===)/g;
  for (const match of text.matchAll(pattern)) units.push({ file: match[1]!, loc: match[2]!, text: match[3]! });
  return units;
}

/** A verbatim quote from a line: its first ~28 words. */
function quoteOf(line: string): string {
  return line.trim().split(/\s+/).slice(0, 28).join(" ");
}

function lines(units: Unit[]): Array<Unit & { line: string }> {
  return units.flatMap((unit) =>
    unit.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length >= 25 && line.length <= 600)
      .map((line) => ({ ...unit, line })),
  );
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseDate(text: string): { iso: string; time: string | null; raw: string } | null {
  const pattern = /(?:(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)|(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?),?\s+(\d{4})/i;
  const match = pattern.exec(text);
  if (!match) return null;
  const day = Number(match[1] ?? match[4]);
  const monthName = (match[2] ?? match[3] ?? "").toLowerCase();
  const month = MONTHS.findIndex((name) => name.startsWith(monthName.slice(0, 3))) + 1;
  if (!month || !day) return null;
  const iso = `${match[5]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time = /\b(noon|midday|12\s?noon)\b/i.test(text) ? "12:00" : (/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/i.exec(text)?.slice(1, 3).join(":") ?? null);
  return { iso, time: time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : null, raw: match[0] };
}

function requirements(units: Unit[]) {
  const picked: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const entry of lines(units)) {
    const line = entry.line;
    const lower = line.toLowerCase();
    let category: string | null = null;
    if (/insurance|indemnity/.test(lower) && /£\s?\d/.test(line)) category = "insurance";
    else if (/\bico\b|iso \d|accredit|certificat|registered with/.test(lower) && /must|shall|required|hold|registration/.test(lower)) category = "accreditation_certification";
    else if (/references?/.test(lower) && /two|three|2|3/.test(lower) && /must|provide|required/.test(lower)) category = "experience_references";
    else if (/experience/.test(lower) && /must|demonstrable|required/.test(lower)) category = "experience_references";
    else if (/turnover|accounts/.test(lower) && /must|provide|required/.test(lower)) category = "financial_standing";
    else if (/conflict of interest|declare/.test(lower)) category = "legal_declaration";
    else if (/polic(y|ies)/.test(lower) && /must|provide|required|have/.test(lower)) category = "mandatory_policy";
    if (!category) continue;
    const key = `${category}:${lower.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const amounts = [...line.matchAll(/£\s?[\d,]+(?:\.\d+)?\s*(?:million|m\b)?/gi)].map((match) => match[0].trim());
    const types = [...lower.matchAll(/(public liability|professional indemnity|employers'? liability|product liability)/g)].map((match) => match[1]!);
    const quote = quoteOf(line);
    if (category === "insurance" && types.length > 1) {
      // One sentence, several covers: one requirement each, as a careful reader would list them.
      types.forEach((type, index) => {
        picked.push({ id: `R${picked.length + 1}`, category, requirement: `Suppliers must hold ${type} insurance.`, threshold: amounts[index] ?? amounts[0] ?? null, kind: "mandatory_unscored", evidence_to_provide: "Insurance certificate", file: entry.file, loc: entry.loc, quote });
      });
    } else {
      picked.push({
        id: `R${picked.length + 1}`,
        category,
        requirement: line.length > 220 ? `${line.slice(0, 217)}…` : line,
        threshold: amounts[0] ?? null,
        kind: /pass\/?fail|rejected|excluded|will not be considered|disqualif/.test(lower) ? "pass_fail" : "mandatory_unscored",
        evidence_to_provide: null,
        file: entry.file,
        loc: entry.loc,
        quote,
      });
    }
    if (picked.length >= 14) break;
  }
  return picked;
}

function questions(units: Unit[]) {
  const picked: Array<Record<string, unknown>> = [];
  for (const entry of lines(units)) {
    const line = entry.line;
    const asks = /^(describe|explain|provide details|please (describe|explain|provide)|how (will|do|would) you|what (is|are) your|set out|outline)\b/i.test(line) || (/\?$/.test(line) && /\b(you|your)\b/i.test(line));
    if (!asks) continue;
    const id = /^(\d+(?:\.\d+)*)[.)]?\s/.exec(line)?.[1] ?? `Q${picked.length + 1}`;
    picked.push({
      id,
      title: line.replace(/^(\d+(?:\.\d+)*)[.)]?\s/, "").split(/\s+/).slice(0, 7).join(" "),
      text: line,
      sub_parts: [],
      section: null,
      guidance: null,
      weight_percent: /(\d{1,2})\s?%/.test(line) ? Number(/(\d{1,2})\s?%/.exec(line)![1]) : null,
      max_score_points: null,
      limit_text: /(\d{2,4})\s+words/i.test(line) ? `${/(\d{2,4})\s+words/i.exec(line)![1]} words` : null,
      limit_words: /(\d{2,4})\s+words/i.test(line) ? Number(/(\d{2,4})\s+words/i.exec(line)![1]) : null,
      limit_pages: null,
      attachments_allowed: null,
      scored: "unclear",
      file: entry.file,
      loc: entry.loc,
      quote: quoteOf(line),
    });
    if (picked.length >= 8) break;
  }
  return picked;
}

function fact(entry: (Unit & { line: string }) | undefined, value: string | null, normalized: string | null = null) {
  if (!entry || !value) return { value: null, normalized: null, status: "not_stated", note: null, file: null, loc: null, quote: null };
  return { value, normalized, status: "stated", note: null, file: entry.file, loc: entry.loc, quote: quoteOf(entry.line) };
}

function keyFacts(units: Unit[]) {
  const all = lines(units);
  const deadlineLine = all.find((entry) => /(received by|deadline|closing date|return|submit|quotations? (must|should)|no later than)/i.test(entry.line) && parseDate(entry.line) && !/clarification|question/i.test(entry.line));
  const clarificationLine = all.find((entry) => /clarification|questions/i.test(entry.line) && parseDate(entry.line));
  const methodLine = all.find((entry) => /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(entry.line) && /(submit|send|return|e-?mail)/i.test(entry.line));
  const validityLine = all.find((entry) => /valid/i.test(entry.line) && /\d+\s+(days|months)/i.test(entry.line));
  const deadline = deadlineLine ? parseDate(deadlineLine.line) : null;
  const clarification = clarificationLine ? parseDate(clarificationLine.line) : null;
  const summary = {
    submission_deadline: fact(deadlineLine, deadline ? `${deadline.raw}${deadline.time ? ` ${deadline.time}` : ""}` : null, deadline ? `${deadline.iso}${deadline.time ? `T${deadline.time}` : ""}` : null),
    clarification_deadline: fact(clarificationLine, clarification?.raw ?? null, clarification?.iso ?? null),
    submission_method: fact(methodLine, methodLine ? (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(methodLine.line)?.[0] ?? null) : null),
    tender_validity: fact(validityLine, validityLine ? (/\d+\s+(days|months)/i.exec(validityLine.line)?.[0] ?? null) : null),
  };
  const key_dates = [deadlineLine && deadline ? { event: "Submission deadline", date_iso: deadline.iso, time_24h: deadline.time, file: deadlineLine.file, loc: deadlineLine.loc, quote: quoteOf(deadlineLine.line) } : null, clarificationLine && clarification ? { event: "Clarification questions", date_iso: clarification.iso, time_24h: null, file: clarificationLine.file, loc: clarificationLine.loc, quote: quoteOf(clarificationLine.line) } : null].filter(Boolean);
  return { summary, key_dates };
}

function overview(units: Unit[]) {
  const all = lines(units);
  const { summary, key_dates } = keyFacts(units);
  const buyerLine = all.find((entry) => /\b(council|trust|authority|university|nhs|agency|college)\b/i.test(entry.line));
  const buyer = buyerLine ? (/([A-Z][A-Za-z&' ]+ (?:Town |City |County |Parish |Borough )?(?:Council|Trust|Authority|University|Agency|College))/.exec(buyerLine.line)?.[1]?.trim() ?? null) : null;
  const titleLine = lines(units.slice(0, 1))[0];
  const paymentLine = all.find((entry) => /payment|invoice/i.test(entry.line) && /\d+\s?%|days/i.test(entry.line));
  return {
    overview: `${buyer ?? "The buyer"} is inviting bids for the work described in the uploaded pack (${units.length} pages and sections read).`,
    summary: {
      buyer: fact(buyerLine, buyer),
      title: fact(titleLine, titleLine ? titleLine.line.slice(0, 120) : null),
      ...summary,
    },
    key_dates,
    evaluation: { price_weight_percent: null, quality_weight_percent: null, social_value_weight_percent: null, weights_note: null, criteria: [], scoring_scale: [], minimum_thresholds: [], price_scoring_method: null },
    documents_to_return: all
      .filter((entry) => /^(appendix|schedule|form)\b/i.test(entry.line) && entry.line.length < 120)
      .slice(0, 4)
      .map((entry) => ({ name: entry.line.slice(0, 100), mandatory: null, format_note: null, file: entry.file, loc: entry.loc, quote: quoteOf(entry.line) })),
    red_flags: paymentLine ? [{ type: "payment_terms", description: "Staged or conditional payment terms — check cash flow.", severity: "low", file: paymentLine.file, loc: paymentLine.loc, quote: quoteOf(paymentLine.line) }] : [],
    unknowns: summary.submission_deadline.status === "not_stated" ? [{ item: "Submission deadline", why_it_matters: "The pack does not state when bids are due." }] : [],
  };
}

function draftAnswer(text: string): string {
  const limit = Number(/Word limit to respect: (\d+) words/.exec(text)?.[1] ?? 220);
  const hasFacts = /<<<SOURCE E1: Company facts/.test(text);
  const secondSource = /<<<SOURCE (E[2-9]): ([^>]+)>>>/.exec(text);
  const paragraphs = [
    "Our approach",
    `We will deliver this work with a named lead and a small, experienced team, following the method set out below.${hasFacts ? " Our company details, insurance cover and accreditations are as recorded in our company facts [E1]." : ""}`,
    "Relevant experience",
    secondSource ? `We have delivered comparable work, as set out in “${secondSource[2]!.trim()}” [${secondSource[1]}].` : "[EVIDENCE NEEDED: a case study of comparable work for a similar buyer, with dates, value and results]",
    "Quality and reporting",
    "We will agree a plan with the buyer before work starts, report progress at each milestone and keep a record of every finding. [EVIDENCE NEEDED: named team members and their qualifications]",
  ];
  const answer = paragraphs.join("\n\n");
  const words = answer.split(/\s+/);
  return words.length > limit ? `${words.slice(0, limit).join(" ")}.` : answer;
}

function respond(text: string): string {
  const units = packUnits(text);
  if (text.includes("Transcribe ONLY these pages")) {
    const pages = /pages \(1-based page numbers of the PDF\): ([\d, ]+)/.exec(text)?.[1]?.split(",").map((value) => value.trim()) ?? [];
    return pages.map((page) => `<<<PAGE ${page}>>>\n[illegible]`).join("\n");
  }
  if (text.includes("TASK: second-pass check")) return JSON.stringify({ add_requirements: [], add_questions: [], add_criteria: [], add_minimum_thresholds: [], add_key_dates: [], add_documents_to_return: [], add_red_flags: [], summary_corrections: [], requirement_corrections: [], question_corrections: [], removals: [] });
  if (text.includes("TASK: read the tender pack above and report ONLY these key facts")) return JSON.stringify(keyFacts(units));
  if (text.includes("NOTE: the text above is ONE document")) return JSON.stringify({ requirements: requirements(units), questions: questions(units) });
  if (text.includes("TASK: produce the compliance matrix")) return JSON.stringify({ requirements: requirements(units) });
  if (text.includes("TASK: list EVERY question")) return JSON.stringify({ questions: questions(units) });
  if (text.includes("TASK: produce the bid brief")) return JSON.stringify(overview(units));
  if (text.includes("For EACH requirement below decide its status")) {
    const ids = [...text.matchAll(/"id": "([0-9a-f-]{36})"/g)].map((match) => match[1]!);
    return JSON.stringify({ results: ids.map((id) => ({ id, status: "unknown", reason: "The company facts do not cover this.", fact_used: null })) });
  }
  if (text.includes("Catalogue the document above")) {
    const body = /DOCUMENT: [^\n]*\n\n([\s\S]*?)\n\n=== END OF DOCUMENT ===/.exec(text)?.[1] ?? "";
    const firstLines = body.split("\n").map((line) => line.trim()).filter((line) => line.length > 20);
    return JSON.stringify({ summary: (firstLines[0] ?? "A document from the evidence library.").slice(0, 300), kind: "other", facts: firstLines.slice(1, 5).map((line) => line.slice(0, 200)), parties: [], dates: [], expires_at: null });
  }
  if (text.includes("Fill in the company facts from the website text above")) {
    const number = /\b(?:company (?:number|no\.?)|registered (?:in england )?(?:number|no\.?))[:\s]*([A-Z0-9]{8})\b/i.exec(text)?.[1] ?? null;
    return JSON.stringify({ legalName: null, tradingName: null, companyNumber: number, turnoverBand: null, employees: null, yearsTrading: null, insurance: {}, accreditations: /ISO 9001/i.test(text) ? [{ name: "ISO 9001", reference: null, expiresAt: null }] : [], sectors: [], regions: [], policies: [], notes: null, evidence: [] });
  }
  if (text.includes("List every statement in the DRAFT")) return JSON.stringify({ unsupported: [], unanswered_parts: [] });
  if (text.includes("Mark the ANSWER.")) {
    const top = /SCORING SCALE[^\n]*\n(\d+)/.exec(text)?.[1];
    const scores = [...(/SCORING SCALE[^\n]*\n([\s\S]*?)\n\nANSWER/.exec(text)?.[1] ?? "").matchAll(/^(\d+)/gm)].map((match) => Number(match[1]));
    const max = scores.length > 0 ? Math.max(...scores) : Number(top ?? 5);
    const score = scores.includes(3) ? 3 : (scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] ?? max);
    return JSON.stringify({
      score: String(score),
      band: null,
      rationale: "The answer addresses the question and is clearly structured, but two statements are placeholders rather than evidence, which limits the score under the descriptors.",
      strengths: ["Clear structure that follows the question."],
      improvements: [
        { suggestion: "Replace the case-study placeholder with one comparable project: client, dates, value and a measured result.", rationale: "The higher descriptors ask for relevant, specific evidence.", impact: "high", needs_evidence: true },
        { suggestion: "Name the lead and state their qualification for this work.", rationale: "Named, qualified people give evaluators confidence in delivery.", impact: "medium", needs_evidence: true },
      ],
      missing_parts: [],
    });
  }
  if (text.includes("Write the answer now.") || text.includes("Revise the current answer") || text.includes("Rewrite it in at most")) return draftAnswer(text);
  return "{}";
}

/** The offline model as an AI SDK language model (specification v4). */
export const offlineModel = {
  specificationVersion: "v4",
  provider: "offline",
  modelId: "pattern-matcher",
  supportedUrls: {},
  async doGenerate(options: unknown) {
    const output = respond(promptText(options));
    return {
      content: [{ type: "text", text: output }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 50, noCache: 50, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
      warnings: [],
    };
  },
  async doStream() {
    throw new Error("The offline model does not stream.");
  },
} as unknown as Exclude<LanguageModel, string>;
