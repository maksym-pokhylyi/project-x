import "./bid-theme.css";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { isPastDate } from "@/features/bids/locations";
import {
  QUESTION_STATUS_LABELS,
  RED_FLAG_LABELS,
  type BidBrief,
  type BidKeyDate,
  type BidVerdict,
  type BriefFact,
  type Citation,
  type EvaluationModel,
  type PackStats,
  type SummaryField,
} from "@/features/bids/types";
import { displayRef, gateGroup, isGatingRequirement, isScoredQuestion, type CoverageSummary, type PackFileItem } from "@/features/bids/view";
import { cn } from "@/lib/utils";
import { CitationMark, SourceLegend, type SourceLinks } from "./citation";
import { GateList } from "./gate-list";
import type { QuestionItem } from "./questions-view";
import type { RequirementItem } from "./requirements-view";
import { Callout, daysLeftLabel, formatDeadline } from "./ui";

/**
 * The cited bid check on one page, following the design handoff (Brief-1440 / Brief-390):
 * a cautious verdict next to the key facts, the pass-or-fail requirements quoted from the
 * pack with their status against the company, the scored questions, and the terms to read
 * yourself. Server component; used by the workspace and, read-only, by /sample-check.
 */

export type BriefViewProps = {
  bidId: string;
  brief: BidBrief | null;
  verdict: BidVerdict | null;
  evaluationModel: EvaluationModel | null;
  keyDates: BidKeyDate[];
  packStats: PackStats | null;
  submissionDeadline: Date | null;
  requirements: RequirementItem[];
  questions: QuestionItem[];
  files: PackFileItem[];
  coverage: CoverageSummary;
  links: SourceLinks;
  readOnly?: boolean;
  /** A cited check without a full bid: the scored questions are listed by title only. */
  locked?: boolean;
  /** Still processing: later sections may be missing. */
  partial?: boolean;
  factsConfirmed?: boolean;
  /** Base path of the workspace ("/app/bids/<id>"); null where the tabs do not exist (public sample). */
  basePath: string | null;
  /** Where "Upload evidence" and "confirm your facts" lead; null hides them. */
  libraryHref?: string | null;
  /** Link to a question's answer, or null when it cannot be opened from here. */
  questionHref?: (question: QuestionItem) => string | null;
  /** Link to a pack file, or null. */
  fileHref?: (file: PackFileItem) => string | null;
  now?: Date;
};

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const count = (n: number, capital = true) => {
  const word = n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n]! : String(n);
  return capital ? word : word.toLowerCase();
};
const plural = (n: number, word: string, pluralWord = `${word}s`) => (n === 1 ? word : pluralWord);

/** The cautious headline. It never says a bid will win, and never "eligible" as a fact. */
function headline(verdict: BidVerdict, gates: { gap: number; confirm: number; met: number; total: number }): string {
  switch (verdict.verdict) {
    case "looks_biddable":
      return "Looks biddable on what the pack states.";
    case "likely_not_eligible":
      return `${count(gates.gap)} ${plural(gates.gap, "gap")} to close before you can bid.`;
    case "biddable_with_gaps":
      return gates.confirm > 0
        ? `No gaps found in what we could check. ${count(gates.confirm)} ${plural(gates.confirm, "point")} for you to confirm.`
        : "No pass-or-fail gaps found, but there are gaps in other requirements.";
    default:
      return verdict.factsConfirmed ? "Not enough to go on for a verdict yet." : "Confirm your company facts to see where you stand.";
  }
}

function RefLinks({ items }: { items: RequirementItem[] }) {
  const shown = items.slice(0, 6);
  return (
    <>
      {shown.map((item, index) => (
        <span key={item.id}>
          {index > 0 ? ", " : ""}
          <a href={`#req-${item.ref}`} className="bid-mono bid-link-quiet text-[13px]">
            {displayRef(item.ref)}
          </a>
        </span>
      ))}
      {items.length > shown.length ? ` and ${items.length - shown.length} more` : ""}
    </>
  );
}

function Line({ tone, lead, children }: { tone: "met" | "gap" | "info"; lead: string; children: ReactNode }) {
  const Icon = tone === "met" ? CircleCheck : tone === "gap" ? CircleAlert : Info;
  return (
    <li className="flex gap-2.5">
      <Icon aria-hidden className={cn("mt-px size-5 shrink-0", tone === "met" ? "text-(--bid-brand)" : tone === "gap" ? "text-(--bid-danger)" : "text-(--bid-info)")} strokeWidth={1.8} />
      <span>
        <span className="font-semibold">{lead}</span> {children}
      </span>
    </li>
  );
}

const CROSS_CHECKED: Array<[SummaryField, string]> = [
  ["submission_deadline", "tender deadline"],
  ["clarification_deadline", "clarification deadline"],
  ["submission_method", "way to submit"],
  ["estimated_value", "value"],
  ["contract_start", "start date"],
  ["contract_duration", "contract length"],
];

function dateOf(fact: BriefFact | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(fact?.normalized ?? "");
  if (!match) return null;
  // Europe/London wall time; close enough for a "days left" label (the stored deadline is exact).
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${(match[4] ?? "23").padStart(2, "0")}:${match[5] ?? "59"}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function FactRow({ label, testId, status, children }: { label: string; testId?: string; status?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-(--bid-line) py-3 first:border-t-0" data-testid={testId} data-fact-status={status}>
      <dt className="text-xs text-(--bid-muted)">{label}</dt>
      <dd className="text-[15px]">{children}</dd>
    </div>
  );
}

function NotStated() {
  return <span className="text-(--bid-muted)">Not stated in the pack.</span>;
}

/** A dated fact: dot, date, days left, source. Two readings that disagree are both shown. */
function DateFact({ fact, exact, links, now }: { fact: BriefFact | undefined; exact?: Date | null; links: SourceLinks; now: Date }) {
  if (!fact || fact.status === "not_stated" || !fact.value) return <NotStated />;
  if (fact.status === "conflicting") {
    return (
      <span className="flex flex-col gap-1.5">
        <span className="bid-pill bid-pill-danger">
          <CircleAlert aria-hidden className="size-3.5" />
          Two readings differ — check the documents
        </span>
        {[{ value: fact.value, citation: fact.citation }, ...(fact.alternatives ?? [])].map((reading, index) => (
          <span key={index} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
            {reading.value}
            <CitationMark citation={reading.citation} links={links} variant="ref" className="ml-auto" />
          </span>
        ))}
      </span>
    );
  }
  const date = exact ?? dateOf(fact);
  const left = date ? daysLeftLabel(date, now) : null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold tabular-nums">
      {left ? <span aria-hidden className={cn("size-[9px] rounded-full", left.past ? "bg-(--bid-line-strong)" : left.urgent ? "bg-(--bid-danger)" : "bg-(--bid-amber)")} /> : null}
      <span className={left?.past ? "line-through" : undefined}>{exact ? formatDeadline(exact) : fact.value}</span>
      {left ? <span className={cn("rounded px-1.5 py-px text-xs", left.urgent && !left.past ? "bg-(--bid-danger-tint) text-(--bid-danger)" : left.past ? "bg-(--bid-paper-deep)" : "bg-(--bid-amber-tint)")}>{left.label}</span> : null}
      {fact.status === "ambiguous" ? <span className="bid-pill bid-pill-amber text-xs">Ambiguous — check</span> : null}
      <CitationMark citation={fact.citation} links={links} variant="ref" className="ml-auto" />
    </span>
  );
}

function TextFact({ fact, links, strong = false }: { fact: BriefFact | undefined; links: SourceLinks; strong?: boolean }) {
  if (!fact || fact.status === "not_stated" || !fact.value) return null;
  return (
    <span>
      <span className={strong ? "font-semibold" : undefined}>{fact.value}</span>
      {fact.status === "conflicting" && fact.alternatives?.length ? <span className="text-(--bid-danger)"> (another reading: {fact.alternatives.map((item) => item.value).join("; ")} — check)</span> : null}{" "}
      <CitationMark citation={fact.citation} links={links} variant="ref" />
    </span>
  );
}

function firstCitation(...candidates: Array<Citation | null | undefined>): Citation | null {
  return candidates.find((item): item is Citation => Boolean(item)) ?? null;
}

export function BriefView(props: BriefViewProps) {
  const { bidId, brief, verdict, evaluationModel, packStats, links, coverage, files, readOnly = false, partial = false, basePath, factsConfirmed = false } = props;
  const now = props.now ?? new Date();
  const libraryHref = props.libraryHref === undefined ? "/app/library" : props.libraryHref;
  const gating = props.requirements.filter(isGatingRequirement);
  const others = props.requirements.length - gating.length;
  const byGroup = { gap: gating.filter((item) => gateGroup(item.companyStatus) === "gap"), confirm: gating.filter((item) => gateGroup(item.companyStatus) === "confirm"), met: gating.filter((item) => gateGroup(item.companyStatus) === "met") };
  const gates = { gap: byGroup.gap.length, confirm: byGroup.confirm.length, met: byGroup.met.length, total: gating.length };
  const summary = brief?.summary;
  const conflicts = summary ? CROSS_CHECKED.filter(([field]) => summary[field]?.status === "conflicting").map(([, label]) => label) : [];
  const warnings = packStats?.warnings ?? [];
  const scored = props.questions.filter(isScoredQuestion);
  const forms = props.questions.length - scored.length;
  const scale = evaluationModel?.scoringScale ?? [];
  const weights = evaluationModel
    ? ([
        ["Quality", evaluationModel.qualityWeight],
        ["price", evaluationModel.priceWeight],
        ["social value", evaluationModel.socialValueWeight],
      ] as Array<[string, number | null]>).filter(([, weight]) => weight !== null)
    : [];
  const flags = [...(brief?.redFlags ?? [])].sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity));
  const wordsInAll = scored.every((question) => question.wordLimit) ? scored.reduce((sum, question) => sum + (question.wordLimit ?? 0), 0) : null;

  return (
    <div className="flex flex-col gap-10" data-testid="brief-view">
      {warnings.length > 0 ? (
        <Callout tone="warning" title="Read this before relying on the check" className="-mb-4" action={basePath ? <Link href={`${basePath}/files`} className="bid-link text-sm font-medium">See what was read</Link> : undefined}>
          <ul data-testid="pack-warnings" className="flex list-disc flex-col gap-1 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {brief?.overview ? (
        <p className="-mb-4 max-w-[820px] text-[15px]" data-testid="brief-overview">
          {brief.overview}
        </p>
      ) : null}

      {/* --- Verdict + key facts ------------------------------------------------------------ */}
      <section aria-labelledby="verdict-h" className="flex flex-wrap items-stretch gap-x-10 gap-y-7 rounded-xl bg-(--bid-brand-tint) px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex min-w-0 flex-[1.5_1_520px] flex-col" data-testid={verdict ? "verdict" : undefined} data-verdict={verdict?.verdict}>
          <p className="flex flex-wrap items-center gap-2.5 text-[13px]">
            <span className="rounded bg-(--bid-brand) px-2 py-0.5 font-semibold text-white">Verdict</span>
            <span>
              Based on the {coverage.read} {plural(coverage.read, "file")} of the pack that we read
              {verdict?.factsConfirmed ? " and your confirmed company facts" : ""}
            </span>
          </p>
          {verdict ? (
            <>
              <h2 id="verdict-h" className="bid-serif mt-3 text-[26px] leading-[1.15] font-semibold tracking-[-0.015em] text-balance sm:text-[32px]">
                {headline(verdict, gates)}
              </h2>
              <ul className="mt-4 flex max-w-[660px] flex-col gap-2.5 text-[15px] leading-[1.5]">
                {verdict.factsConfirmed && gates.total > 0 && gates.met > 0 ? (
                  <Line tone="met" lead={`${gates.met} of the ${gates.total} pass-or-fail ${plural(gates.total, "requirement")} look met.`}>
                    Checked against your confirmed company facts, not against the buyer&rsquo;s judgement.
                  </Line>
                ) : null}
                {gates.gap > 0 ? (
                  <Line tone="gap" lead={`${count(gates.gap)} ${plural(gates.gap, "gap")}.`}>
                    <RefLinks items={byGroup.gap} />. Check each against the documents: some can be closed before the deadline, or before award where the pack allows it.
                  </Line>
                ) : null}
                {!verdict.factsConfirmed ? (
                  <Line tone="info" lead="Your company facts are not confirmed.">
                    The requirements were found in the pack but not compared with your company.{" "}
                    {libraryHref && !readOnly ? (
                      <>
                        <Link href={libraryHref} className="bid-link font-medium">
                          Confirm your company facts
                        </Link>
                        , then use “Re-check against company facts” on the Requirements tab.
                      </>
                    ) : null}
                  </Line>
                ) : gates.confirm > 0 ? (
                  <Line tone="info" lead={`${count(gates.confirm)} for you to confirm.`}>
                    Your company facts do not settle <RefLinks items={byGroup.confirm} />.
                  </Line>
                ) : null}
                {conflicts.length > 0 ? (
                  <Line tone="gap" lead="Two readings of the pack disagree.">
                    They differ on the {conflicts.join(", ")}. Both are shown — settle it from the documents.
                  </Line>
                ) : null}
                {gates.total === 0 ? (
                  <Line tone="info" lead="No pass-or-fail requirements were found.">
                    That is unusual. Read the instructions to tenderers yourself before relying on this.
                  </Line>
                ) : null}
              </ul>
              <div className="mt-auto flex max-w-[660px] flex-col gap-2 pt-5">
                {gates.total > 0 ? (
                  <>
                    <div role="img" aria-label={`${gates.met} met, ${gates.confirm} to confirm, ${gates.gap} gaps`} className="flex h-2 gap-[3px] overflow-hidden rounded">
                      {gates.met > 0 ? <span style={{ flex: `${gates.met} 1 0` }} className="bg-(--bid-brand)" /> : null}
                      {gates.confirm > 0 ? <span style={{ flex: `${gates.confirm} 1 0` }} className="bg-(--bid-info)" /> : null}
                      {gates.gap > 0 ? <span style={{ flex: `${gates.gap} 1 0` }} className="bg-(--bid-danger)" /> : null}
                    </div>
                    <p className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]" data-testid="gate-counts">
                      <span>
                        <span className="font-semibold">{gates.met}</span> met
                      </span>
                      <span>
                        <span className="font-semibold">{gates.confirm}</span> for you to confirm
                      </span>
                      <span>
                        <span className="font-semibold">{gates.gap}</span> {plural(gates.gap, "gap")}
                      </span>
                      <span className="text-(--bid-muted)">
                        of {gates.total} pass-or-fail {plural(gates.total, "requirement")}
                      </span>
                    </p>
                  </>
                ) : null}
                <details className="text-[13px]">
                  <summary className="bid-link inline-flex min-h-9 cursor-pointer items-center font-medium">What this check cannot tell you</summary>
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-5" data-testid="not-assessed">
                    {verdict.notAssessed.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                    <li>Your chances of winning: this reads stated requirements only.</li>
                  </ul>
                </details>
              </div>
            </>
          ) : (
            <>
              <h2 id="verdict-h" className="bid-serif mt-3 text-[26px] leading-[1.15] font-semibold tracking-[-0.015em] sm:text-[32px]">
                {partial ? "Still reading the pack." : "No verdict yet."}
              </h2>
              <p className="mt-3 max-w-[620px] text-[15px]">{partial ? "What has been found so far is shown below. The verdict appears when every file has been read and checked against your company." : "The check did not finish."}</p>
            </>
          )}
        </div>

        <dl className="box-border flex min-w-0 flex-[1_1_360px] flex-col rounded-lg bg-(--bid-surface) px-5 py-1.5" data-testid="key-facts">
          <FactRow label="Tender deadline" testId="fact-submission_deadline" status={summary?.submission_deadline?.status ?? "not_stated"}>
            <DateFact fact={summary?.submission_deadline} exact={props.submissionDeadline} links={links} now={now} />
          </FactRow>
          <FactRow label="Clarification questions by" testId="fact-clarification_deadline" status={summary?.clarification_deadline?.status ?? "not_stated"}>
            <DateFact fact={summary?.clarification_deadline} links={links} now={now} />
          </FactRow>
          <FactRow label="Value and term" testId="fact-estimated_value" status={summary?.estimated_value?.status ?? "not_stated"}>
            {summary && [summary.estimated_value, summary.contract_duration, summary.contract_start, summary.extensions].some((fact) => fact?.value) ? (
              <span className="flex flex-col gap-0.5">
                <TextFact fact={summary.estimated_value} links={links} strong />
                <TextFact fact={summary.contract_duration} links={links} />
                <TextFact fact={summary.contract_start} links={links} />
                <TextFact fact={summary.extensions} links={links} />
              </span>
            ) : (
              <NotStated />
            )}
          </FactRow>
          <FactRow label="How it is marked" testId="fact-marking">
            {weights.length > 0 || scale.length > 0 ? (
              <span>
                {weights.length > 0 ? <span className="font-semibold">{weights.map(([name, weight]) => `${name} ${weight}%`).join(", ")}. </span> : null}
                {scale.length >= 2 ? `Answers scored ${scale[0]!.score} to ${scale[scale.length - 1]!.score}. ` : ""}
                {evaluationModel?.weightsNote ? `${evaluationModel.weightsNote} ` : ""}
                <CitationMark citation={firstCitation(evaluationModel?.criteria.find((item) => item.citation?.verified)?.citation, scale[0]?.citation, evaluationModel?.criteria[0]?.citation)} links={links} variant="ref" />
              </span>
            ) : (
              <NotStated />
            )}
          </FactRow>
          <FactRow label="How to submit" testId="fact-submission_method" status={summary?.submission_method?.status ?? "not_stated"}>
            {summary?.submission_method?.value ? <TextFact fact={summary.submission_method} links={links} /> : <NotStated />}
          </FactRow>
        </dl>
      </section>

      <p className="bid-mono -mt-6 text-xs text-(--bid-muted)" data-testid="coverage">
        Coverage: {coverage.headline}
        {coverage.citations ? ` · ${coverage.citations.verified} of ${coverage.citations.total} quotes found word for word in the pack` : ""}
        {coverage.transcribedPages > 0 ? ` · ${coverage.transcribedPages} scanned ${plural(coverage.transcribedPages, "page")} transcribed by AI` : ""}
        {coverage.failedPasses.length > 0 ? ` · ${coverage.failedPasses.length} ${plural(coverage.failedPasses.length, "reading")} did not complete` : ""}
        {basePath ? (
          <>
            {" · "}
            <Link href={`${basePath}/files`} className="bid-link-quiet">
              what was read
            </Link>
          </>
        ) : null}
      </p>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-10">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-12">
          {/* --- Pass-or-fail requirements -------------------------------------------------- */}
          <section aria-labelledby="req-h" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="req-h" className="bid-h2">
                Pass-or-fail requirements
              </h2>
              <p className="text-sm text-(--bid-muted)">Each line is quoted word for word from the pack. Open a reference to read it on the page. Gaps come first.</p>
              <SourceLegend className="mt-1" />
            </div>
            <GateList bidId={bidId} items={gating} links={links} readOnly={readOnly} libraryHref={libraryHref} factsConfirmed={factsConfirmed} />
            {others > 0 ? (
              <p className="text-sm">
                {basePath ? (
                  <Link href={`${basePath}/requirements`} className="bid-link font-medium" data-testid="all-requirements-link">
                    All {props.requirements.length} requirements
                  </Link>
                ) : (
                  <span className="font-medium">{props.requirements.length} requirements in all.</span>
                )}{" "}
                <span className="text-(--bid-muted)">
                  {others} more {plural(others, "is", "are")} not pass-or-fail: forms to sign, submission rules and other things the pack asks for.
                </span>
              </p>
            ) : null}
          </section>

          {/* --- Scored questions ----------------------------------------------------------- */}
          <section aria-labelledby="q-h" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="q-h" className="bid-h2">
                Scored questions
              </h2>
              <p className="text-sm text-(--bid-muted)">
                {props.locked && scored.length > 0
                  ? `${count(scored.length)} scored ${plural(scored.length, "question")} found${evaluationModel?.qualityWeight != null ? `, carrying ${evaluationModel.qualityWeight}% of the marks` : ""}. Titles are shown; the matrix, drafts and marking are part of a full bid.`
                  : scored.length === 0
                  ? partial
                    ? "Questions appear here as they are found."
                    : "No scored written questions were found in the pack."
                  : `${count(scored.length)} written ${plural(scored.length, "answer")}${evaluationModel?.qualityWeight != null ? ` ${plural(scored.length, "carries", "carry")} ${evaluationModel.qualityWeight}% of the marks` : ""}${wordsInAll ? `: ${wordsInAll.toLocaleString("en-GB")} words in all` : ""}.`}
              </p>
            </div>
            {scored.length > 0 && props.locked ? (
              <ol className="bid-card" data-testid="scored-questions-locked">
                {scored.map((question, index) => (
                  <li key={question.id} className={cn("flex items-baseline gap-4 px-5 py-3 text-[15px] sm:px-6", index > 0 ? "bid-rule" : "")}>
                    <span className="bid-mono w-14 shrink-0 text-xs text-(--bid-muted)">{question.ref}</span>
                    <span className="min-w-0">{question.title ?? question.text}</span>
                  </li>
                ))}
              </ol>
            ) : scored.length > 0 ? (
              <div className="bid-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm" data-testid="scored-questions">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-(--bid-muted)">
                        <th scope="col" className="border-b border-(--bid-line) py-3 pr-3 pl-6 font-semibold">Question</th>
                        <th scope="col" className="border-b border-(--bid-line) p-3 text-right font-semibold">Weight</th>
                        <th scope="col" className="border-b border-(--bid-line) p-3 text-right font-semibold">Word limit</th>
                        <th scope="col" className="border-b border-(--bid-line) py-3 pr-3 pl-6 font-semibold">Draft</th>
                        <th scope="col" className="border-b border-(--bid-line) py-3 pr-6 pl-3 font-semibold">Marked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scored.map((question, index) => {
                        const href = props.questionHref ? props.questionHref(question) : basePath ? `${basePath}/questions/${question.id}` : null;
                        const cell = cn("py-3.5", index < scored.length - 1 ? "border-b border-(--bid-line)" : "");
                        const title = question.title ?? question.text.slice(0, 90);
                        const over = question.wordLimit !== null && question.wordCount > question.wordLimit;
                        return (
                          <tr key={question.id}>
                            <td className={cn(cell, "pr-3 pl-6")}>
                              {question.ref ? <span className="bid-mono mr-2.5 text-[13px] text-(--bid-muted)">{question.ref}</span> : null}
                              {href ? (
                                <Link href={href} className="bid-link font-semibold">
                                  {title}
                                </Link>
                              ) : (
                                <span className="font-semibold">{title}</span>
                              )}
                            </td>
                            <td className={cn(cell, "px-3 text-right tabular-nums")}>{question.weighting !== null ? `${question.weighting}%` : "—"}</td>
                            <td className={cn(cell, "px-3 text-right tabular-nums")}>{question.wordLimit ? question.wordLimit.toLocaleString("en-GB") : question.pageLimit ? `${question.pageLimit} pp` : "—"}</td>
                            <td className={cn(cell, "pr-3 pl-6 whitespace-nowrap tabular-nums")}>
                              {question.status === "not_started" ? (
                                <span className="text-(--bid-muted)">Not started</span>
                              ) : question.gaps > 0 ? (
                                <span className="font-semibold text-(--bid-danger)">
                                  {question.gaps} {plural(question.gaps, "gap")} to fill
                                </span>
                              ) : over ? (
                                <span className="font-semibold text-(--bid-danger)">Over the limit · {question.wordCount} words</span>
                              ) : (
                                `${QUESTION_STATUS_LABELS[question.status]} · ${question.wordCount} words`
                              )}
                            </td>
                            <td className={cn(cell, "pr-6 pl-3 whitespace-nowrap", question.score ? "font-semibold" : "text-(--bid-muted)")}>
                              {question.score ? `${question.score} of ${question.maxEvaluated}` : "Not marked"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {evaluationModel?.priceWeight != null ? (
              <p className="text-[13px] text-(--bid-muted)">Price carries {evaluationModel.priceWeight}% of the marks. Complete the pricing documents yourself: Bidfolio does not price bids.</p>
            ) : null}
            {forms > 0 ? (
              <p className="text-sm">
                {basePath ? (
                  <Link href={`${basePath}/questions`} className="bid-link font-medium">
                    {forms} {plural(forms, "form or declaration", "forms and declarations")} to complete
                  </Link>
                ) : (
                  <span className="font-medium">
                    {forms} {plural(forms, "form or declaration", "forms and declarations")} to complete
                  </span>
                )}{" "}
                <span className="text-(--bid-muted)">— confirmations and details the pack asks you to supply, listed so nothing is missed.</span>
              </p>
            ) : null}
            {scale.length > 0 || (evaluationModel?.criteria.length ?? 0) > 0 || (evaluationModel?.minimumThresholds.length ?? 0) > 0 ? (
              <details className="bid-card px-5 py-3 text-sm" data-testid="marking-detail">
                <summary className="bid-link inline-flex min-h-9 cursor-pointer items-center font-medium">How answers are marked: criteria and scoring scale</summary>
                <div className="mt-2 flex flex-col gap-4 pb-2">
                  {evaluationModel && evaluationModel.criteria.length > 0 ? (
                    <ul className="flex flex-col">
                      {evaluationModel.criteria.map((item, index) => (
                        <li key={`${item.name}-${index}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-(--bid-line) py-2 first:border-t-0">
                          <span className={cn("font-medium", item.parent ? "pl-4 font-normal" : "")}>{item.name}</span>
                          {item.weight !== null ? <span className="tabular-nums">{item.weight}%</span> : null}
                          <CitationMark citation={item.citation} links={links} variant="ref" className="ml-auto" />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {scale.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {scale.map((row) => (
                        <li key={row.score} className="flex gap-3">
                          <span className="bid-mono w-8 shrink-0 font-medium">{row.score}</span>
                          <span>
                            {row.label ? <span className="font-semibold">{row.label}. </span> : null}
                            {row.descriptor}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-(--bid-muted)">The pack does not publish a scoring scale. Marking in Bidfolio then uses a typical public-sector 0 to 5 scale and says so.</p>
                  )}
                  {evaluationModel?.minimumThresholds.map((item, index) => (
                    <p key={index} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">Minimum score:</span> {item.description} <CitationMark citation={item.citation} links={links} variant="ref" />
                    </p>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        {/* --- Side column ---------------------------------------------------------------------- */}
        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <section aria-labelledby="files-h" className="bid-card px-5 pt-[18px] pb-2" data-testid="pack-files-card">
            <h2 id="files-h" className="bid-h3">
              Coverage{" "}
              <span className="font-normal text-(--bid-muted)">
                · {coverage.read} {plural(coverage.read, "file")} read{files.length - coverage.read > 0 ? `, ${files.length - coverage.read} not read` : ""}
              </span>
            </h2>
            <ul className="mt-2 flex flex-col text-xs">
              {files.map((file) => {
                const href = props.fileHref ? props.fileHref(file) : links.kind === "app" && file.read ? `/api/bids/${links.bidId}/files/${file.id}` : links.kind === "public" ? (links.urls[file.id] ?? null) : null;
                return (
                  <li key={file.id} className="flex min-h-10 items-center justify-between gap-3 border-t border-(--bid-line)">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="bid-mono bid-link-quiet min-w-0 truncate" title={file.name}>
                        {file.name}
                      </a>
                    ) : (
                      <span className="bid-mono min-w-0 truncate" title={file.name}>
                        {file.name}
                      </span>
                    )}
                    <span className={cn("shrink-0", file.read && file.analysed ? "text-(--bid-muted)" : "font-semibold text-(--bid-danger)")}>{file.read && !file.analysed ? "not analysed" : file.size}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="read-h" className="bid-card px-5 pt-[18px] pb-1.5" data-testid="read-yourself">
            <h2 id="read-h" className="bid-h3">
              Read these yourself
            </h2>
            <p className="mt-0.5 text-[13px] text-(--bid-muted)">Terms that change your price or your risk.</p>
            {flags.length > 0 ? (
              <ul className="mt-2.5 flex flex-col">
                {flags.map((flag, index) => (
                  <li key={index} className="flex flex-col items-start gap-1.5 border-t border-(--bid-line) py-3">
                    <p className="text-sm leading-[1.5]">
                      <span className="font-semibold">{RED_FLAG_LABELS[flag.type] ?? "Other"}.</span> {flag.description}
                    </p>
                    <CitationMark citation={flag.citation} links={links} variant="ref" short={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 border-t border-(--bid-line) py-3 text-sm">{partial ? "Still reading." : "Nothing was flagged. Read the contract terms all the same: this list is not a legal review."}</p>
            )}
          </section>

          {brief && brief.documentsToReturn.length > 0 ? (
            <section aria-labelledby="return-h" className="bid-card px-5 pt-[18px] pb-1.5" data-testid="documents-to-return">
              <h2 id="return-h" className="bid-h3">
                Return with your tender
              </h2>
              <ul className="mt-2.5 flex flex-col">
                {brief.documentsToReturn.map((item, index) => (
                  <li key={index} className="flex flex-col items-start gap-1 border-t border-(--bid-line) py-2.5">
                    <p className="text-sm">
                      <span className="font-medium">{item.name}</span>
                      {item.mandatory ? <span className="bid-tag ml-2 text-[11px]">Required</span> : null}
                      {item.formatNote ? <span className="text-(--bid-muted)"> · {item.formatNote}</span> : null}
                    </p>
                    <CitationMark citation={item.citation} links={links} variant="ref" short={false} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {props.keyDates.length > 0 ? (
            <section aria-labelledby="dates-h" className="bid-card px-5 pt-[18px] pb-1.5" data-testid="key-dates">
              <h2 id="dates-h" className="bid-h3">
                Dates in the pack
              </h2>
              <ul className="mt-2.5 flex flex-col">
                {props.keyDates.map((item, index) => (
                  <li key={index} className="flex flex-col items-start gap-0.5 border-t border-(--bid-line) py-2.5 text-sm">
                    <span className={cn("font-semibold tabular-nums", isPastDate(item.dateIso, now.getTime()) ? "text-(--bid-muted) line-through" : "")}>
                      {item.dateIso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.dateIso}T12:00:00Z`)) : "Date not stated"}
                      {item.time ? `, ${item.time}` : ""}
                    </span>
                    <span>{item.event}</span>
                    <CitationMark citation={item.citation} links={links} variant="ref" short={false} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {brief && brief.unknowns.length > 0 ? (
            <section aria-labelledby="unknown-h" className="bid-card px-5 pt-[18px] pb-1.5" data-testid="unknowns">
              <h2 id="unknown-h" className="bid-h3">
                Not stated in the pack
              </h2>
              <p className="mt-0.5 text-[13px] text-(--bid-muted)">Worth a clarification question.</p>
              <ul className="mt-2.5 flex flex-col">
                {brief.unknowns.map((item, index) => (
                  <li key={index} className="border-t border-(--bid-line) py-2.5 text-sm">
                    <span className="font-medium">{item.item}</span>
                    {item.whyItMatters ? <span className="text-(--bid-muted)"> — {item.whyItMatters}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

    </div>
  );
}
