import { describe, expect, it } from "vitest";
import { ModelJsonError, parseModelJson, salvageTruncatedJson, sanitizeModelString, sanitizeModelValue } from "@/features/bids/server/ai/json";
import { isModelUnavailable } from "@/features/bids/server/ai/models";
import {
  companyCheckOutputSchema,
  documentOutputSchema,
  keyFactsOutputSchema,
  overviewOutputSchema,
  patchOutputSchema,
  questionsOutputSchema,
  requirementsOutputSchema,
} from "@/features/bids/server/pipeline/schema";

describe("parseModelJson", () => {
  it("parses plain JSON, fenced JSON and JSON with a sentence around it", () => {
    expect(parseModelJson('{"a": 1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Here is the JSON you asked for:\n{"a": {"b": "x } y"}}\nLet me know if you need more.')).toEqual({ a: { b: "x } y" } });
  });

  it("throws a ModelJsonError for empty, non-JSON and cut-off output", () => {
    expect(() => parseModelJson("")).toThrow(ModelJsonError);
    expect(() => parseModelJson("I could not find any requirements.")).toThrow(/no JSON object/);
    expect(() => parseModelJson('{"requirements": [{"id": "R1"')).toThrow(/cut off/);
    expect(() => parseModelJson('{"a": 1,}')).toThrow(/not valid JSON/);
  });
});

describe("salvageTruncatedJson", () => {
  it("keeps the complete items of an array that was cut off", () => {
    const cut = '{"requirements": [{"id": "R1", "requirement": "Hold PL insurance"}, {"id": "R2", "requirement": "Provide two refer';
    expect(salvageTruncatedJson(cut)).toEqual({ requirements: [{ id: "R1", requirement: "Hold PL insurance" }] });
  });

  it("closes nested structures in the right order", () => {
    const cut = '```json\n{"overview": "x", "evaluation": {"criteria": [{"name": "Quality", "weight_percent": 60}, {"name": "Pri';
    expect(salvageTruncatedJson(cut)).toEqual({ overview: "x", evaluation: { criteria: [{ name: "Quality", weight_percent: 60 }] } });
  });

  it("is not fooled by brackets inside strings", () => {
    const cut = '{"questions": [{"id": "Q1", "text": "Describe [your] {approach}"}, {"id": "Q2", "text": "Cut [off';
    expect(salvageTruncatedJson(cut)).toEqual({ questions: [{ id: "Q1", text: "Describe [your] {approach}" }] });
  });

  it("returns null when there is nothing complete to keep, or the text is not truncated", () => {
    expect(salvageTruncatedJson('{"requirements": [{"id": "R1", "requ')).toBeNull();
    expect(salvageTruncatedJson("no json here")).toBeNull();
    expect(salvageTruncatedJson('{"a": [1, 2]}')).toBeNull();
  });
});

describe("sanitizeModelString", () => {
  it("repairs the NUL + hex corruption seen from one provider", () => {
    expect(sanitizeModelString("Minimum cover of \u0000A314,000 per claim")).toBe("Minimum cover of £14,000 per claim");
    expect(sanitizeModelString("the Council\u0002s decision")).toBe("the Council's decision");
    expect(sanitizeModelString("plain text – unchanged £5m")).toBe("plain text – unchanged £5m");
    expect(sanitizeModelString("tab\tand\nnewline stay")).toBe("tab\tand\nnewline stay");
  });

  it("walks nested values", () => {
    expect(sanitizeModelValue({ a: ["x\u0000\u0000y", 3, null], b: { c: "\u0000A35m" } })).toEqual({ a: ["xy", 3, null], b: { c: "£5m" } });
  });
});

describe("isModelUnavailable", () => {
  it("recognises the gateway's 'no access to this model' answers, also when wrapped", () => {
    expect(isModelUnavailable(Object.assign(new Error("Free tier users do not have access to this model."), { statusCode: 403 }))).toBe(true);
    expect(isModelUnavailable({ name: "GatewayModelNotFoundError", message: "x" })).toBe(true);
    expect(isModelUnavailable({ message: "wrapped", cause: { type: "model_not_found", message: "y" } })).toBe(true);
    expect(isModelUnavailable(new Error("Model anthropic/claude-x does not exist"))).toBe(true);
  });

  it("does not treat rate limits, timeouts or server errors as a reason to switch model", () => {
    expect(isModelUnavailable(Object.assign(new Error("Rate limit exceeded"), { statusCode: 429 }))).toBe(false);
    expect(isModelUnavailable(new Error("The operation was aborted due to timeout"))).toBe(false);
    expect(isModelUnavailable(new Error("Internal server error"))).toBe(false);
    expect(isModelUnavailable(null)).toBe(false);
    expect(isModelUnavailable("model not found")).toBe(false);
  });
});

describe("extraction schemas", () => {
  it("accepts a well-formed requirements list and normalises loose values", () => {
    const parsed = requirementsOutputSchema.parse({
      requirements: [
        {
          id: 1,
          category: "insurance",
          requirement: "Public liability insurance",
          threshold: "  £5,000,000 ",
          kind: "pass_fail",
          evidence_to_provide: "",
          file: "ITT.pdf",
          loc: "p4",
          quote: "not less than £5,000,000",
        },
        { requirement: "Attend the site visit", category: "made_up_category", kind: "compulsory", threshold: "N/A", file: null, loc: null, quote: "null" },
      ],
    });
    expect(parsed.requirements[0]).toMatchObject({ id: "1", threshold: "£5,000,000", evidence_to_provide: null, kind: "pass_fail" });
    // Unknown enum values fall back to the SAFE default: "other" and mandatory (never silently dropped).
    expect(parsed.requirements[1]).toMatchObject({ id: "", category: "other", kind: "mandatory_unscored", threshold: null, quote: null });
  });

  it("rejects output that is not a list of requirement objects", () => {
    expect(requirementsOutputSchema.safeParse({ requirements: "none" }).success).toBe(false);
    expect(requirementsOutputSchema.safeParse({ requirements: [{ category: "insurance" }] }).success).toBe(false);
    expect(requirementsOutputSchema.safeParse({ requirements: ["Hold insurance"] }).success).toBe(false);
    // A missing list is an empty list, not an error.
    expect(requirementsOutputSchema.parse({}).requirements).toEqual([]);
  });

  it("reads numbers written as text in questions", () => {
    const parsed = questionsOutputSchema.parse({
      questions: [{ id: "Q1", title: "Method", text: "Describe your method.", weight_percent: "20%", max_score_points: "10", limit_words: "1,000 words", limit_pages: null, limit_text: "1000 words", scored: "scored_weighted", sub_parts: null }],
    });
    expect(parsed.questions[0]).toMatchObject({ weight_percent: 20, max_score_points: 10, limit_words: 1000, limit_pages: null, sub_parts: [], scored: "scored_weighted" });
    const loose = questionsOutputSchema.parse({ questions: [{ text: "Tell us about your team", scored: "maybe" }] });
    expect(loose.questions[0]).toMatchObject({ id: "", title: "", scored: "unclear", weight_percent: null });
    expect(questionsOutputSchema.safeParse({ questions: [{ title: "No text" }] }).success).toBe(false);
  });

  it("fills an overview with not_stated facts instead of failing on gaps", () => {
    const parsed = overviewOutputSchema.parse({
      overview: "Grounds maintenance for a town council.",
      summary: { title: { value: "Grounds Maintenance", normalized: null, status: "stated", note: null, file: "ITT.pdf", loc: "p1", quote: "Grounds Maintenance" }, estimated_value: null },
      evaluation: null,
      key_dates: [{ event: "Deadline", date_iso: "2027-05-14", time_24h: "12:00", file: "ITT.pdf", loc: "p1", quote: "12:00 noon on Friday 14 May 2027" }, "garbage"],
    });
    expect(parsed.summary.title.value).toBe("Grounds Maintenance");
    expect(parsed.summary.estimated_value).toMatchObject({ status: "not_stated", value: null });
    expect(parsed.summary.submission_deadline.status).toBe("not_stated");
    expect(parsed.evaluation).toMatchObject({ price_weight_percent: null, criteria: [], scoring_scale: [] });
    // One bad row empties that list rather than failing the whole brief.
    expect(parsed.key_dates).toEqual([]);
    expect(parsed.red_flags).toEqual([]);
  });

  it("validates the key-facts, per-document and company-check shapes", () => {
    expect(keyFactsOutputSchema.parse({ summary: {}, key_dates: null })).toMatchObject({ key_dates: [] });
    expect(documentOutputSchema.parse({ requirements: null })).toEqual({ requirements: [], questions: [] });
    const check = companyCheckOutputSchema.parse({ results: [{ id: "a", status: "probably", reason: 5 }, { id: "b", status: "met", reason: "Holds ISO 9001", fact_used: "accreditations" }] });
    expect(check.results[0]).toMatchObject({ status: "unknown", reason: "5" });
    expect(check.results[1]).toMatchObject({ status: "met" });
    expect(companyCheckOutputSchema.safeParse({ results: [{ status: "met" }] }).success).toBe(false);
  });

  it("accepts a partial second-pass patch and drops malformed sections", () => {
    const patch = patchOutputSchema.parse({
      add_requirements: [{ category: "insurance", requirement: "Professional indemnity £1m", threshold: "£1m", kind: "pass_fail", file: "ITT.pdf", loc: "p9", quote: "Professional Indemnity of £1,000,000" }],
      removals: [{ section: "not_a_section", id_or_name: "R1" }],
      requirement_corrections: [{ requirement_id: "R2", problem: "wrong level", kind: "nonsense", threshold: "£10m", file: null, loc: null, quote: null }],
    });
    expect(patch.add_requirements).toHaveLength(1);
    expect(patch.removals).toEqual([]);
    expect(patch.requirement_corrections[0]).toMatchObject({ requirement_id: "R2", kind: null, threshold: "£10m" });
    expect(patch.add_questions).toEqual([]);
    expect(patchOutputSchema.parse({})).toMatchObject({ add_requirements: [], summary_corrections: [], question_corrections: [] });
  });
});
