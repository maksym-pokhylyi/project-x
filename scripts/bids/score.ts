/**
 * Scores a bid brief against the hand-written ground truth of the bid-pack spike
 * (/home/user/spikes/bid-pack/groundtruth/<slug>.json). TypeScript port of the checks in
 * the spike's scripts/score.py, so numbers are comparable with its REPORT.md.
 *
 * Each ground-truth fact is checked mechanically: correct | missing | wrong | review.
 *   wrong  = found, but a number / date / limit differs, or a value was filled in for
 *            something the pack does not state (hallucination trap)
 *   review = cannot be decided mechanically (counted separately)
 */

export type ScoreFact = {
  id: string;
  cat: string;
  desc: string;
  src?: string;
  check: {
    type: "summary" | "not_stated" | "top_weight" | "no_question_limits" | "empty" | "item";
    field?: string;
    date?: string | null;
    time?: string | null;
    text?: string | null;
    value?: number;
    what?: string;
    sections?: string[];
    all?: string[];
    weight?: number | null;
    pages?: number | null;
    words?: number | null;
    limit_rx?: string | null;
  };
};

type RawFactLike = { value?: string | null; normalized?: string | null; status?: string | null; note?: string | null; quote?: string | null };
type Item = Record<string, unknown>;

/** The brief in the spike's result shape. */
export type ScoreResult = {
  summary: Record<string, RawFactLike>;
  key_dates: Item[];
  requirements: Item[];
  questions: Item[];
  documents_to_return: Item[];
  red_flags: Item[];
  unknowns: Item[];
  evaluation: {
    price_weight_percent: number | null;
    quality_weight_percent: number | null;
    social_value_weight_percent: number | null;
    criteria: Item[];
    scoring_scale: Item[];
    minimum_thresholds: Item[];
    price_scoring_method?: RawFactLike | null;
  };
};

export type FactStatus = "correct" | "missing" | "wrong" | "review";
export type FactOutcome = { id: string; cat: string; desc: string; status: FactStatus; why: string };

const TIME_RX: Record<string, RegExp> = {
  "14:00": /14[:.]00|2 ?p\.?m/,
  "12:00": /12[:.]00|noon|midday|12 ?p\.?m/,
  "10:00": /10[:.]00|10 ?a\.?m/,
  "17:00": /17[:.]00|5 ?p\.?m/,
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

/** Python-style re.search with re.I. */
function rx(pattern: string): RegExp {
  return new RegExp(pattern, "is");
}

function sectionItems(result: ScoreResult, section: string): Array<Item | ScoreResult | RawFactLike> {
  if (section === "ANY") return [result];
  if (section.startsWith("summary:")) {
    const value = result.summary[section.slice("summary:".length)];
    return value ? [value] : [];
  }
  if (section === "criteria" || section === "minimum_thresholds" || section === "scoring_scale") return result.evaluation[section] ?? [];
  const list = (result as unknown as Record<string, unknown>)[section];
  return Array.isArray(list) ? (list as Item[]) : [];
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

export function checkFact(fact: ScoreFact, result: ScoreResult): { status: FactStatus; why: string } {
  const check = fact.check;
  const evaluation = result.evaluation;

  if (check.type === "summary" || check.type === "not_stated") {
    const field = check.field ?? "";
    const value: RawFactLike = (field === "__price_scoring_method__" ? evaluation.price_scoring_method : result.summary[field]) ?? {};
    const stated = ["stated", "conflicting", "ambiguous"].includes(value.status ?? "") && Boolean(value.value || value.normalized);
    const blob = [value.value, value.normalized, value.note, value.quote].map((part) => String(part ?? "")).join(" ").toLowerCase();
    if (check.type === "not_stated") {
      if (!stated) return { status: "correct", why: "" };
      if (value.status === "stated") return { status: "wrong", why: `filled: ${JSON.stringify(value.value)}` };
      return { status: "review", why: `${value.status}: ${JSON.stringify(value.value)} | note=${JSON.stringify(value.note)}` };
    }
    if (!stated) return { status: "missing", why: "" };
    const normalized = String(value.normalized ?? "");
    if (check.date) {
      if (!normalized.startsWith(check.date)) {
        const [year, month, day] = check.date.split("-");
        const monthName = MONTHS[Number(month) - 1]!.slice(0, 3);
        const d = Number(day);
        const alt = new RegExp(
          `\\b0?${d}(st|nd|rd|th)?\\s+${monthName}[a-z]*\\.?,?\\s+${year}|${monthName}[a-z]*\\.?\\s+0?${d}(st|nd|rd|th)?,?\\s+${year}|\\b0?${d}/0?${Number(month)}/${year}`,
        );
        if (!alt.test(blob)) return { status: "wrong", why: `got ${JSON.stringify(value.value)} / ${JSON.stringify(normalized)}` };
      }
      const time = check.time;
      const valueText = String(value.value ?? "").toLowerCase();
      if (time === "NONE") {
        if (normalized.includes("T") || /\b\d{1,2}[:.]\d{2}\b|\bnoon\b|midday|midnight|\d ?(am|pm)\b/.test(valueText)) {
          return { status: "wrong", why: `time invented: ${JSON.stringify(value.value)} / ${JSON.stringify(normalized)}` };
        }
      } else if (time) {
        if (!normalized.includes(`T${time}`) && !(TIME_RX[time]?.test(valueText) ?? false)) {
          if (normalized.includes("T")) return { status: "wrong", why: `time: got ${JSON.stringify(normalized)}` };
          return { status: "missing", why: `date ok, time missing: ${JSON.stringify(value.value)} / ${JSON.stringify(normalized)}` };
        }
      }
    }
    if (check.text && !rx(check.text).test(blob)) return { status: "review", why: `got ${JSON.stringify(value.value)}` };
    return { status: "correct", why: "" };
  }

  if (check.type === "top_weight") {
    const got = num((evaluation as unknown as Record<string, unknown>)[check.field ?? ""]);
    if (got === null) return { status: "missing", why: "" };
    return Math.abs(got - (check.value ?? Number.NaN)) < 0.01 ? { status: "correct", why: "" } : { status: "wrong", why: `got ${got}` };
  }

  if (check.type === "no_question_limits") {
    const bad = result.questions.filter((question) => question.limit_words != null || question.limit_pages != null).map((question) => question.id);
    return bad.length === 0 ? { status: "correct", why: "" } : { status: "wrong", why: `limits invented for ${JSON.stringify(bad.slice(0, 6))}` };
  }

  if (check.type === "empty") {
    if (check.what === "scoring_scale") {
      const scale = evaluation.scoring_scale ?? [];
      return scale.length === 0 ? { status: "correct", why: "" } : { status: "wrong", why: `${scale.length} scale rows` };
    }
    if (check.what === "criteria_weights") {
      const weighted = (evaluation.criteria ?? []).filter((criterion) => criterion.weight_percent != null).map((criterion) => criterion.name);
      const tops = (["price_weight_percent", "quality_weight_percent", "social_value_weight_percent"] as const).filter((key) => evaluation[key] != null);
      return weighted.length === 0 && tops.length === 0 ? { status: "correct", why: "" } : { status: "wrong", why: `weights invented: ${JSON.stringify(weighted.slice(0, 5))} ${JSON.stringify(tops)}` };
    }
  }

  if (check.type === "item") {
    const hits: Item[] = [];
    for (const section of check.sections ?? []) {
      for (const item of sectionItems(result, section)) {
        const blob = JSON.stringify(item).toLowerCase();
        if ((check.all ?? []).every((pattern) => rx(pattern).test(blob))) hits.push(item as Item);
      }
    }
    if (hits.length === 0) return { status: "missing", why: "" };
    if (check.weight !== null && check.weight !== undefined) {
      const weights = hits.map((hit) => num(hit.weight_percent));
      if (weights.some((weight) => weight !== null && Math.abs(weight - check.weight!) < 0.01)) return { status: "correct", why: "" };
      if (weights.every((weight) => weight === null)) return { status: "missing", why: "item found, weight null" };
      return { status: "wrong", why: `weights ${JSON.stringify(weights)}` };
    }
    if ((check.pages !== null && check.pages !== undefined) || (check.words !== null && check.words !== undefined) || check.limit_rx) {
      for (const hit of hits) {
        const limitText = String(hit.limit_text ?? "").toLowerCase();
        if (check.pages !== null && check.pages !== undefined) {
          const word = NUMBER_WORDS[check.pages] ?? String(check.pages);
          if (hit.limit_pages === check.pages || new RegExp(`\\b(${check.pages}|${word})\\s*(sides?|pages?)`).test(limitText)) return { status: "correct", why: "" };
        }
        if (check.words !== null && check.words !== undefined) {
          if (hit.limit_words === check.words || new RegExp(`\\b${check.words}\\]?\\s*words`).test(limitText)) return { status: "correct", why: "" };
        }
        if (check.limit_rx && rx(check.limit_rx).test(`${limitText} ${String(hit.limit_pages ?? "")}`)) return { status: "correct", why: "" };
      }
      if (hits.every((hit) => !hit.limit_text && hit.limit_pages == null && hit.limit_words == null)) return { status: "missing", why: "item found, limit null" };
      return { status: "wrong", why: `limits ${JSON.stringify(hits.slice(0, 3).map((hit) => [hit.limit_text, hit.limit_pages, hit.limit_words]))}` };
    }
    return { status: "correct", why: "" };
  }
  return { status: "review", why: "unknown check" };
}

export function scoreBrief(facts: ScoreFact[], result: ScoreResult): FactOutcome[] {
  return facts.map((fact) => ({ id: fact.id, cat: fact.cat, desc: fact.desc, ...checkFact(fact, result) }));
}

export type CategoryScore = { correct: number; total: number; wrong: number; missing: number; review: number };

export function summarise(outcomes: FactOutcome[]): Record<string, CategoryScore> {
  const table: Record<string, CategoryScore> = {};
  for (const outcome of outcomes) {
    const row = (table[outcome.cat] ??= { correct: 0, total: 0, wrong: 0, missing: 0, review: 0 });
    row.total += 1;
    row[outcome.status] += 1;
  }
  return table;
}
