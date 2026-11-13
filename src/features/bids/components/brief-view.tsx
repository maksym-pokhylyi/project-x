import { CalendarClock, CircleAlert, FileCheck2, Flag, HelpCircle, ScrollText } from "lucide-react";
import Link from "next/link";
import {
  RED_FLAG_LABELS,
  SUMMARY_FIELD_LABELS,
  VERDICT_LABELS,
  type BidBrief,
  type BidKeyDate,
  type BidReview,
  type BidVerdict,
  type BriefFact,
  type EvaluationModel,
  type PackStats,
  type SummaryField,
  type VerdictKey,
} from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { CitationMark, type SourceLinks } from "./citation";
import { FactConfirm } from "./fact-confirm";
import { RequirementsView, type RequirementItem } from "./requirements-view";
import { Callout, DeadlineChip, Pill, SectionHeading, StandingNotice, type Tone } from "./ui";

/**
 * The Brief tab — the "cited bid check". Order follows what a bidder needs first:
 * the cautious verdict, the deadline and other key facts (each with its quote), the
 * gating requirements, how the tender is scored, risks, and finally an honest account of
 * what was and was not read.
 */

const VERDICT_TONE: Record<VerdictKey, Tone> = {
  looks_biddable: "success",
  biddable_with_gaps: "warning",
  likely_not_eligible: "danger",
  not_enough_information: "neutral",
};

const CONFIRMABLE: SummaryField[] = ["submission_deadline", "clarification_deadline", "submission_method", "estimated_value"];
const PRIMARY_FACTS: SummaryField[] = ["submission_deadline", "clarification_deadline", "submission_method", "estimated_value"];
const SECONDARY_FACTS: SummaryField[] = ["buyer", "reference", "procedure_type", "lots", "contract_start", "contract_duration", "extensions", "tender_validity"];

function formatNormalized(fact: BriefFact): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(fact.normalized ?? "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(date);
  return match[4] ? `${day}, ${match[4]}:${match[5]}` : `${day} (no time stated)`;
}

function FactRow({ bidId, field, fact, links, review, readOnly }: { bidId: string; field: SummaryField; fact: BriefFact; links: SourceLinks; review: BidReview | null; readOnly: boolean }) {
  const notStated = fact.status === "not_stated";
  const isDate = field.endsWith("deadline") || field === "contract_start";
  const pretty = isDate ? formatNormalized(fact) : null;
  const confirmedAt = review?.facts?.[field] ?? null;
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4" data-testid={`fact-${field}`} data-fact-status={fact.status}>
      <dt className="text-sm text-muted-foreground">{SUMMARY_FIELD_LABELS[field]}</dt>
      <dd className="min-w-0 space-y-1.5 text-sm">
        {notStated ? (
          <p className="text-muted-foreground">Not stated in the pack{fact.note ? ` — ${fact.note}` : ""}</p>
        ) : (
          <>
            <p className={cn("break-words", PRIMARY_FACTS.includes(field) ? "font-medium" : "")}>
              {pretty ?? fact.value}
              {pretty && fact.value && fact.value !== pretty ? <span className="ml-2 font-normal text-muted-foreground">as written: “{fact.value}”</span> : null}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <CitationMark citation={fact.citation} links={links} />
              {fact.status === "conflicting" ? (
                <Pill tone="warning" icon={<CircleAlert aria-hidden className="size-3" />}>
                  Check — readings disagree
                </Pill>
              ) : fact.status === "ambiguous" ? (
                <Pill tone="warning">Ambiguous in the pack</Pill>
              ) : null}
              {CONFIRMABLE.includes(field) ? <FactConfirm bidId={bidId} field={field} confirmedAt={confirmedAt} readOnly={readOnly} /> : null}
            </div>
            {fact.alternatives?.map((alternative, index) => (
              <p key={index} className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Other reading:</span>
                <span className="font-medium">{alternative.value ?? alternative.normalized}</span>
                <CitationMark citation={alternative.citation} links={links} />
              </p>
            ))}
            {fact.note ? <p className="text-xs text-muted-foreground">{fact.note}</p> : null}
          </>
        )}
      </dd>
    </div>
  );
}

export type BriefViewProps = {
  bidId: string;
  brief: BidBrief | null;
  verdict: BidVerdict | null;
  evaluationModel: EvaluationModel | null;
  keyDates: BidKeyDate[];
  packStats: PackStats | null;
  review: BidReview | null;
  submissionDeadline: Date | null;
  requirements: RequirementItem[];
  questionCount: number;
  links: SourceLinks;
  readOnly?: boolean;
  /** Still processing: later sections may be missing. */
  partial?: boolean;
  factsConfirmed?: boolean;
  /** Base path of the workspace tabs ("/app/bids/<id>" or "/sample-check"). */
  basePath: string;
};

export function BriefView(props: BriefViewProps) {
  const { bidId, brief, verdict, evaluationModel, keyDates, packStats, links, readOnly = false, partial = false, basePath } = props;
  const gating = props.requirements.filter((item) => item.isPassFail || item.kind === "minimum_score" || (item.kind === "mandatory" && ["insurance", "financial", "accreditation"].includes(item.category)));
  const unverified = packStats ? packStats.citations.total - packStats.citations.verified : 0;
  const warnings = packStats?.warnings ?? [];

  return (
    <div className="space-y-8" data-testid="brief-view">
      <StandingNotice />

      {verdict ? (
        <section aria-label="Verdict" data-testid="verdict" data-verdict={verdict.verdict} className={cn("rounded-lg border-l-4 border bg-card p-4 sm:p-5", { "border-l-success": verdict.verdict === "looks_biddable", "border-l-warning": verdict.verdict === "biddable_with_gaps", "border-l-destructive": verdict.verdict === "likely_not_eligible" })}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Our cautious read</p>
            <Pill tone={VERDICT_TONE[verdict.verdict]}>{VERDICT_LABELS[verdict.verdict]}</Pill>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {verdict.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-foreground/50" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline">What this check cannot assess</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {(verdict.notAssessed ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
          <p className="mt-3 text-xs text-muted-foreground">
            Based on {verdict.counts.requirements} requirements found ({verdict.counts.passFail} pass/fail): {verdict.counts.met} met, {verdict.counts.gap} gap{verdict.counts.gap === 1 ? "" : "s"},{" "}
            {verdict.counts.unknown} unknown, {verdict.counts.verify} to verify. It is a check of stated requirements, not a prediction of the outcome.
          </p>
        </section>
      ) : partial ? null : (
        <Callout>No verdict yet. Use “Re-check against company facts” on the Requirements tab.</Callout>
      )}

      {warnings.length > 0 ? (
        <section aria-label="Warnings" className="space-y-2" data-testid="pack-warnings">
          {warnings.map((warning) => (
            <Callout key={warning} tone="warning">
              {warning}
            </Callout>
          ))}
        </section>
      ) : null}

      {brief ? (
        <>
          {brief.overview ? (
            <section aria-label="Summary">
              <SectionHeading title="Summary" />
              <p className="mt-2 max-w-[68ch] text-[15px] leading-6">{brief.overview}</p>
            </section>
          ) : null}

          <section aria-label="Key facts">
            <SectionHeading title="Deadline and key facts">
              <DeadlineChip deadline={props.submissionDeadline} />
            </SectionHeading>
            <p className="mt-1 text-sm text-muted-foreground">Confirm the deadline and how to submit against the documents yourself — one wrong date is fatal.</p>
            <dl className="mt-2 rounded-lg border bg-card px-4">
              {PRIMARY_FACTS.map((field) => (
                <FactRow key={field} bidId={bidId} field={field} fact={brief.summary[field]} links={links} review={props.review} readOnly={readOnly} />
              ))}
            </dl>
            <dl className="mt-3 rounded-lg border bg-card px-4">
              {SECONDARY_FACTS.map((field) => (
                <FactRow key={field} bidId={bidId} field={field} fact={brief.summary[field]} links={links} review={props.review} readOnly={readOnly} />
              ))}
            </dl>
          </section>

          {keyDates.length > 0 ? (
            <section aria-label="Key dates">
              <SectionHeading title="Key dates" count={keyDates.length} />
              <ol className="mt-2 divide-y rounded-lg border bg-card">
                {keyDates.map((item, index) => (
                  <li key={`${item.event}-${index}`} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                    <span className="flex w-44 shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums">
                      <CalendarClock aria-hidden className="size-3.5 text-muted-foreground" />
                      {item.dateIso ?? "No date"}
                      {item.time ? ` ${item.time}` : ""}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">{item.event}</span>
                    <CitationMark citation={item.citation} links={links} />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : partial ? (
        <p className="text-sm text-muted-foreground">Key facts appear here once the first reading of the pack has finished.</p>
      ) : null}

      <section aria-label="Gating requirements">
        <SectionHeading title="Pass/fail and eligibility requirements" count={gating.length}>
          <Link href={`${basePath}/requirements`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            All {props.requirements.length} requirements →
          </Link>
        </SectionHeading>
        <p className="mt-1 text-sm text-muted-foreground">Anything that can stop a bid on its own: pass/fail items, minimum scores, and mandatory insurance, financial and accreditation levels.</p>
        <div className="mt-2">
          {gating.length > 0 ? (
            <RequirementsView bidId={bidId} requirements={gating} links={links} readOnly={readOnly} compact />
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {partial ? "Requirements appear here as they are found." : "No pass/fail or mandatory eligibility requirements were found. Read the pack to be sure."}
            </p>
          )}
        </div>
      </section>

      {evaluationModel && (evaluationModel.criteria.length > 0 || evaluationModel.scoringScale.length > 0 || evaluationModel.priceWeight !== null || evaluationModel.qualityWeight !== null) ? (
        <section aria-label="Evaluation model">
          <SectionHeading title="How tenders are evaluated" />
          {evaluationModel.priceWeight !== null || evaluationModel.qualityWeight !== null || evaluationModel.socialValueWeight !== null ? (
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {evaluationModel.priceWeight !== null ? <Pill tone="brand">Price {evaluationModel.priceWeight}%</Pill> : null}
              {evaluationModel.qualityWeight !== null ? <Pill tone="brand">Quality {evaluationModel.qualityWeight}%</Pill> : null}
              {evaluationModel.socialValueWeight !== null ? <Pill tone="brand">Social value {evaluationModel.socialValueWeight}%</Pill> : null}
            </div>
          ) : null}
          {evaluationModel.weightsNote ? <p className="mt-1 text-xs text-muted-foreground">{evaluationModel.weightsNote}</p> : null}
          {evaluationModel.criteria.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Criterion
                    </th>
                    <th scope="col" className="w-36 px-3 py-2 text-right font-medium">
                      Weighting
                    </th>
                    <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">
                      What is assessed
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {evaluationModel.criteria.map((criterion, index) => (
                    <tr key={`${criterion.name}-${index}`}>
                      <td className="px-3 py-2 align-top">
                        {criterion.parent ? <span className="text-muted-foreground">{criterion.parent} › </span> : null}
                        {criterion.name}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {criterion.weight !== null ? (
                          <span className="inline-flex items-center justify-end gap-2">
                            <span aria-hidden className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, criterion.weight)}%` }} />
                            </span>
                            <span className="font-medium tabular-nums">{criterion.weight}%</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not stated</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 align-top text-muted-foreground md:table-cell">{criterion.whatIsAssessed}</td>
                      <td className="px-3 py-2 align-top">
                        <CitationMark citation={criterion.citation} links={links} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {evaluationModel.scoringScale.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-sm font-medium">Scoring scale</h3>
              <ol className="mt-1.5 divide-y rounded-lg border bg-card text-sm">
                {evaluationModel.scoringScale.map((row, index) => (
                  <li key={`${row.score}-${index}`} className="flex gap-3 px-3 py-2">
                    <span className="w-10 shrink-0 font-mono font-medium tabular-nums">{row.score}</span>
                    <span className="min-w-0 flex-1">
                      {row.label ? <span className="font-medium">{row.label}. </span> : null}
                      <span className="text-muted-foreground">{row.descriptor}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">The pack does not publish a scoring scale. When you ask for an answer to be marked, a typical public-sector 0–5 scale is used and labelled as such.</p>
          )}
          {evaluationModel.minimumThresholds.map((threshold, index) => (
            <p key={index} className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <Pill tone="warning">Minimum threshold</Pill>
              {threshold.description}
              <CitationMark citation={threshold.citation} links={links} />
            </p>
          ))}
        </section>
      ) : null}

      {brief && brief.redFlags.length > 0 ? (
        <section aria-label="Red flags">
          <SectionHeading title="Red flags" count={brief.redFlags.length} />
          <ul className="mt-2 divide-y rounded-lg border bg-card">
            {brief.redFlags.map((flag, index) => (
              <li key={index} className="flex gap-3 px-4 py-3">
                <Flag aria-hidden className={cn("mt-0.5 size-4 shrink-0", flag.severity === "high" ? "text-destructive" : flag.severity === "medium" ? "text-warning" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{RED_FLAG_LABELS[flag.type] ?? "Other"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{flag.severity} severity</span>
                  </p>
                  <p className="text-sm">{flag.description}</p>
                  <CitationMark citation={flag.citation} links={links} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Questions">
        <SectionHeading title="Questions to answer" count={props.questionCount}>
          <Link href={`${basePath}/questions`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Open questions →
          </Link>
        </SectionHeading>
        {props.questionCount === 0 && !partial ? (
          <Callout className="mt-2" tone="warning" title="No questions were found">
            Some packs keep the questions in a portal or a separate response form. Check where you are asked to answer, and add the questions by hand on the Questions tab.
          </Callout>
        ) : null}
      </section>

      {brief && brief.documentsToReturn.length > 0 ? (
        <section aria-label="Documents to return">
          <SectionHeading title="Documents to return" count={brief.documentsToReturn.length} />
          <ul className="mt-2 divide-y rounded-lg border bg-card">
            {brief.documentsToReturn.map((item, index) => (
              <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <FileCheck2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  {item.name}
                  {item.formatNote ? <span className="ml-2 text-xs text-muted-foreground">{item.formatNote}</span> : null}
                </span>
                {item.mandatory ? <Pill>Mandatory</Pill> : null}
                <CitationMark citation={item.citation} links={links} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief && brief.unknowns.length > 0 ? (
        <section aria-label="Not stated in the pack">
          <SectionHeading title="Not stated in the pack" count={brief.unknowns.length} />
          <ul className="mt-2 divide-y rounded-lg border bg-card">
            {brief.unknowns.map((item, index) => (
              <li key={index} className="flex gap-3 px-4 py-2.5 text-sm">
                <HelpCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {item.item}
                  {item.whyItMatters ? <span className="text-muted-foreground"> — {item.whyItMatters}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">Consider asking the buyer a clarification question before the clarification deadline.</p>
        </section>
      ) : null}

      {packStats ? (
        <section aria-label="Coverage" data-testid="coverage">
          <SectionHeading title="What was read" />
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">
            This is a first-pass check, not a substitute for reading the tender. {packStats.files} file{packStats.files === 1 ? "" : "s"}, {packStats.pages} pages and sections
            {packStats.durationSeconds ? `, read in ${Math.round(packStats.durationSeconds / 6) / 10} minutes` : ""}.{" "}
            {packStats.citations.total > 0 ? (
              <>
                <span className="font-medium text-foreground">
                  {packStats.citations.verified} of {packStats.citations.total}
                </span>{" "}
                quotes were found in the text of your documents
                {unverified > 0 ? (
                  <>
                    ; <span className="font-medium text-warning">{unverified} are marked “Verify in documents”</span>
                  </>
                ) : null}
                .
              </>
            ) : null}
          </p>
          {packStats.coverage ? (
            <>
              <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        File
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Read
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Items found
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {packStats.coverage.files.map((file) => (
                      <tr key={file.name}>
                        <td className="px-3 py-2 align-top">
                          <span className="flex items-start gap-2">
                            <ScrollText aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 break-all">{file.name}</span>
                          </span>
                          {file.note ? <p className="mt-0.5 pl-5 text-xs text-warning">{file.note}</p> : null}
                        </td>
                        <td className="px-3 py-2 align-top whitespace-nowrap">
                          {file.status === "read" ? `${file.pages} page${file.pages === 1 ? "" : "s"}/sections` : <span className="font-medium text-destructive">{file.status}</span>}
                        </td>
                        <td className={cn("px-3 py-2 text-right align-top tabular-nums", file.items === 0 && file.status === "read" ? "text-warning" : "")}>
                          {file.items === 0 && file.status === "read" ? "0 — read it yourself" : file.items}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Readings completed: {packStats.coverage.passes.length > 0 ? packStats.coverage.passes.join("; ") : "none recorded"}.
                {packStats.coverage.failedPasses.length > 0 ? <span className="text-warning"> Not completed: {packStats.coverage.failedPasses.join("; ")}.</span> : null}
              </p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
