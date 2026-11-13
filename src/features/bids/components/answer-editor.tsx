"use client";

import "./bid-theme.css";
import { NavLink } from "@/components/ui/nav-link";
import { Check, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  applySuggestionsAction,
  draftAnswerAction,
  evaluateAnswerAction,
  restoreVersionAction,
  saveAnswerAction,
  setQuestionStatusAction,
} from "@/features/bids/actions";
import { answerHash, findEvidenceGaps, findEvidenceMarkers, wordLimitState } from "@/features/bids/answer-text";
import { countWords } from "@/features/bids/constants";
import type { AnswerEvaluation, AnswerVersion, Citation, DraftMeta, QuestionStatus, ScoringDescriptor } from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { CitationMark, type SourceLinks } from "./ui/citation-mark";
import { Callout, DeadlineChip, StandingNotice, UpgradeNotice } from "./ui";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScoreBars } from "@/components/ui/score-bars";
import { ToggleButton } from "@/components/ui/toggle-button";
import { ReferenceChip } from "@/components/ui/reference-chip";

/**
 * Answer editor, following the design handoff (Editor-1440 / Editor-390).
 *
 *   left    the questions of this bid, and the sources used in this answer
 *   centre  the question as the buyer wrote it, then the draft: numbered source markers,
 *           dashed "Gap to fill" blocks where evidence is missing, unsupported sentences
 *           underlined with a "no source" tag, and a live word count against the limit
 *   right   the evaluator's view: marked against the buyer's own scoring scheme
 *
 * AI output is always editable and replaceable; any AI write keeps the previous text in
 * History. The marking is a reading of the scoring scheme — never shown as a prediction.
 */

export type EditorQuestion = {
  id: string;
  ref: string;
  title: string | null;
  text: string;
  guidance: string | null;
  weighting: number | null;
  limitText: string | null;
  limit: number | null;
  limitFromPages: boolean;
  citation: Citation | null;
  status: QuestionStatus;
  draftText: string;
  draftMeta: DraftMeta | null;
  evaluation: AnswerEvaluation | null;
  versions: AnswerVersion[];
};

export type EditorNavItem = {
  id: string;
  ref: string;
  title: string;
  weighting: number | null;
  wordCount: number;
  limit: number | null;
  status: QuestionStatus;
  gaps: number;
  score: string | null;
  /** Top of the scale the answer was marked on. */
  maxScore?: string | null;
  href: string | null;
};

export type EditorSource = {
  marker: string;
  title: string;
  /** File name, or what kind of source this is. */
  detail: string | null;
  /** What the source says (summary and key facts), shown when the marker is selected. */
  passage: string | null;
};

export type EditorProps = {
  bidId: string;
  question: EditorQuestion;
  scale: ScoringDescriptor[];
  scaleKind: "pack" | "default";
  links: SourceLinks;
  /** Why the answer cannot be changed here, if it cannot. */
  locked: null | "check_only" | "plan_lapsed" | "archived" | "not_ready" | "sample";
  canUnlock?: boolean;
  library: { factsConfirmed: boolean; documents: number };
  bid: { title: string; deadline: string | null; briefHref: string; briefLabel?: string; exportHref: string | null; buyerName: string | null };
  nav: { items: EditorNavItem[]; qualityWeight: number | null; previousHref: string | null; nextHref: string | null };
  sources: EditorSource[];
  /** Shown inside another page (the public sample): no sub-header, no question navigation. */
  embedded?: boolean;
};

const numeric = (score: string): number | null => {
  const match = /-?\d+(?:\.\d+)?/.exec(score);
  return match ? Number(match[0]) : null;
};

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n: number) => (n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n]! : String(n));

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dateTimeOf = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " at");

/** The draft as a reader sees it: numbered source markers, gap blocks, unsupported sentences. */
export function DraftText({
  text,
  meta,
  numbers,
  selected,
  onSelect,
}: {
  text: string;
  meta: DraftMeta | null;
  numbers: Map<string, number>;
  selected?: string | null;
  onSelect?: (marker: string) => void;
}) {
  const known = new Set((meta?.evidenceRefs ?? []).map((ref) => ref.marker));
  const flagged = (meta?.flaggedClaims ?? []).map((flag) => flag.claim).filter((claim) => claim.length > 12 && text.includes(claim));
  const pattern = new RegExp(`(\\[\\s*EVIDENCE[\\s_-]*NEEDED[^\\]]*\\]|\\[E\\d{1,3}\\]${flagged.length ? `|${flagged.map((claim) => claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}` : ""})`, "gi");
  const isGap = (part: string | undefined) => Boolean(part) && /^\[\s*EVIDENCE/i.test(part!);
  const gapsIn = (value: string) => value.split(pattern).filter(isGap).length;
  // `gapsBefore` numbers the gaps through the whole text, so "Go to the gap" links can target them.
  const render = (line: string, lineKey: string, gapsBefore = 0): ReactNode => {
    const parts = line.split(pattern);
    return parts.map((part, index) => {
      if (!part) return null;
      const key = `${lineKey}-${index}`;
      if (isGap(part)) {
        const gapIndex = gapsBefore + parts.slice(0, index).filter(isGap).length + 1;
        return (
          <span key={key} id={`gap-${gapIndex}`} data-testid="evidence-gap" className="bid-gap scroll-mt-24">
            <span className="bid-gap-label">Gap to fill.</span> {part.replace(/^\[\s*EVIDENCE[\s_-]*NEEDED\s*[:\-–—]?\s*/i, "").replace(/\]$/, "") || "Supporting evidence"}. Your documents do not cover this: add the evidence, or write it yourself.
          </span>
        );
      }
      const marker = /^\[(E\d{1,3})\]$/.exec(part);
      if (marker) {
        const id = marker[1]!;
        const unknown = meta !== null && !known.has(id);
        return (
          <ToggleButton
            key={key}
            variant="marker"
            data-testid="evidence-marker"
            data-unknown={unknown ? "true" : undefined}
            pressed={selected === id}
            tone={unknown ? "danger" : "brand"}
            aria-label={unknown ? "Source marker that matches nothing in your documents" : `Source ${numbers.get(id) ?? id}`}
            className="ml-1"
            onClick={() => onSelect?.(id)}
          >
            {unknown ? "?" : (numbers.get(id) ?? id)}
          </ToggleButton>
        );
      }
      if (flagged.includes(part)) {
        return (
          <Fragment key={key}>
            <span className="bid-unsupported">{part}</span>
            <span className="bid-nosource">no source</span>
          </Fragment>
        );
      }
      return <Fragment key={key}>{part}</Fragment>;
    });
  };
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="bid-draft flex flex-col gap-3.5" data-testid="answer-read">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n");
        const before = blocks.slice(0, blockIndex).reduce((sum, earlier) => sum + gapsIn(earlier), 0);
        const heading = lines.length === 1 && block.length < 90 && !/[.!?:;,\]]$/.test(block.trim()) && !block.trim().startsWith("-");
        if (heading) {
          return (
            <h3 key={blockIndex} className={cn("text-base font-bold", blockIndex > 0 ? "mt-1.5" : "")}>
              {render(block.replace(/^#+\s*/, "").replace(/\*\*/g, ""), `h${blockIndex}`, before)}
            </h3>
          );
        }
        return (
          <p key={blockIndex} className="whitespace-pre-line">
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? "\n" : null}
                {render(line.replace(/\*\*/g, ""), `b${blockIndex}l${lineIndex}`, before + lines.slice(0, lineIndex).reduce((sum, earlier) => sum + gapsIn(earlier), 0))}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function navLine(item: EditorNavItem): { text: string; tone: "muted" | "danger" | "info" } {
  if (item.status === "not_started" || item.wordCount === 0) return { text: "Not started", tone: "info" };
  if (item.gaps > 0) return { text: `${item.gaps} gap${item.gaps === 1 ? "" : "s"} to fill`, tone: "danger" };
  const words = item.limit ? `${item.wordCount.toLocaleString("en-GB")} of ${item.limit.toLocaleString("en-GB")} words` : `${item.wordCount.toLocaleString("en-GB")} words`;
  return { text: `${words}${item.score ? ` · marked ${item.score}${item.maxScore ? ` of ${item.maxScore}` : ""}` : ""}${item.status === "final" ? " · final" : ""}`, tone: item.limit && item.wordCount > item.limit ? "danger" : "muted" };
}

const PART_ICON = {
  covered: <CircleCheck aria-hidden className="size-5 shrink-0 text-brand" strokeWidth={1.8} />,
  partly: (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className="shrink-0">
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--info)" strokeWidth="1.8" />
      <path d="M10 2a8 8 0 0 0 0 16z" fill="var(--info)" />
    </svg>
  ),
  missing: <CircleAlert aria-hidden className="size-5 shrink-0 text-danger" strokeWidth={1.8} />,
} as const;
const PART_WORD = { covered: "Covered.", partly: "Partly covered.", missing: "Not answered." } as const;

export function AnswerEditor({ bidId, question, scale, scaleKind, links, locked, canUnlock = false, library, bid, nav, sources, embedded = false }: EditorProps) {
  const router = useRouter();
  const [text, setText] = useState(question.draftText);
  const [mode, setMode] = useState<"read" | "edit">(question.draftText || locked !== null ? "read" : "edit");
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedFixes, setSelectedFixes] = useState<number[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "draft" | "evaluate" | "apply" | "save" | "restore" | "status">(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluatorError, setEvaluatorError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // What the server holds. When a new AI text or a restored version arrives the page
  // remounts this component (see `editorKey`), so local state never needs syncing.
  const [savedText, setSavedText] = useState(question.draftText);

  const readOnly = locked !== null;
  const words = useMemo(() => countWords(text), [text]);
  const limitState = wordLimitState(words, question.limit);
  const gaps = useMemo(() => findEvidenceGaps(text), [text]);
  const markers = useMemo(() => findEvidenceMarkers(text), [text]);
  const numbers = useMemo(() => new Map(markers.map((marker, index) => [marker, index + 1])), [markers]);
  const dirty = text !== savedText;
  const evaluation = question.evaluation;
  const evaluationStale = Boolean(evaluation && evaluation.answerHash !== answerHash(text));
  const libraryEmpty = !library.factsConfirmed && library.documents === 0;
  const draftNumber = question.versions.length + (question.draftText ? 1 : 0);
  const usedSources = markers.map((marker) => sources.find((source) => source.marker === marker)).filter((source): source is EditorSource => Boolean(source));
  const uses = (marker: string) => text.split(`[${marker}]`).length - 1;
  const flagged = (question.draftMeta?.flaggedClaims ?? []).filter((flag) => !dirty || flag.claim === "Claims check" || text.includes(flag.claim));
  const current = nav.items.findIndex((item) => item.id === question.id);

  const sortedScale = useMemo(() => {
    const rows = scale.map((row) => ({ row, value: numeric(row.score) }));
    return rows.every((entry) => entry.value !== null) ? rows.sort((a, b) => a.value! - b.value!).map((entry) => entry.row) : null;
  }, [scale]);
  const scoreRow = evaluation ? (scale.find((row) => row.score === evaluation.score) ?? null) : null;
  const scoreIndex = evaluation && sortedScale ? sortedScale.findIndex((row) => row.score === evaluation.score) : -1;
  const nextRow = sortedScale && scoreIndex >= 0 ? (sortedScale[scoreIndex + 1] ?? null) : null;
  const scaleRange = sortedScale && sortedScale.length >= 2 ? `Scored ${sortedScale[0]!.score} to ${sortedScale[sortedScale.length - 1]!.score}` : scale.length > 0 ? `${scale.length} scoring bands` : null;

  const save = async (): Promise<boolean> => {
    if (readOnly || text === savedText) return true;
    setBusy("save");
    const result = await saveAnswerAction(bidId, question.id, text);
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      return false;
    }
    setSavedText(text);
    setSavedAt(result.data.savedAt);
    return true;
  };

  const run = async (kind: "draft" | "evaluate" | "apply" | "restore" | "status", work: () => Promise<{ ok: true } | { ok: false; error: { message: string } }>) => {
    setError(null);
    if (kind === "evaluate") setEvaluatorError(null);
    if (!(await save())) return;
    setBusy(kind);
    const result = await work();
    setBusy(null);
    if (!result.ok) {
      if (kind === "evaluate") setEvaluatorError(result.error.message);
      else setError(result.error.message);
      return;
    }
    startTransition(() => router.refresh());
  };

  const draft = () => {
    if (question.draftMeta?.editedAt && !window.confirm("Replace the current answer with a new AI draft? Your edited text is kept in History.")) return;
    void run("draft", () => draftAnswerAction(bidId, question.id, { instructions: instructions.trim() || undefined }));
  };
  const selectMarker = (marker: string) => {
    setSelectedMarker((value) => (value === marker ? null : marker));
    document.getElementById(`src-${marker}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const mark = () => void run("evaluate", () => evaluateAnswerAction(bidId, question.id));
  const setStatus = (status: QuestionStatus) => void run("status", () => setQuestionStatusAction(bidId, question.id, status));

  const counter = (
    <div
      data-testid="word-count"
      data-limit-state={limitState}
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums"
      role="group"
      aria-label={question.limit ? `${words} of ${question.limit} words used` : `${words} words`}
    >
      <span>
        <span className="font-semibold">{words.toLocaleString("en-GB")}</span>
        {question.limit ? ` of ${question.limit.toLocaleString("en-GB")} words` : " words"}
      </span>
      {question.limit ? (
        <>
          <Progress aria-hidden value={Math.min(100, (words / question.limit) * 100)} tone={limitState === "over" ? "danger" : "brand"} className="w-36 max-w-[30vw]" />
          <span className={limitState === "over" ? "font-semibold text-danger" : "text-ink-2"}>
            {limitState === "over" ? `${(words - question.limit).toLocaleString("en-GB")} over` : `${(question.limit - words).toLocaleString("en-GB")} left`}
          </span>
        </>
      ) : null}
    </div>
  );

  const finalControl = (where: "header" | "bar") =>
    readOnly || !question.draftText ? null : question.status === "final" ? (
      <Button variant="outline" type="button"  disabled={busy !== null} onClick={() => setStatus("draft")} data-testid={where === "header" ? "reopen-answer" : "reopen-answer-bar"}>
        <Check aria-hidden className="size-4 text-brand" strokeWidth={2.6} />
        Final · reopen
      </Button>
    ) : (
      <Button type="button"  disabled={busy !== null || !text.trim()} onClick={() => setStatus("final")} data-testid={where === "header" ? "mark-final" : "mark-final-bar"}>
        Mark as final
      </Button>
    );
  const markControl = (where: "panel" | "bar") => readOnly ? null : (
    <Button type="button" className="w-full" variant={(!evaluation || evaluationStale) && where === "panel" ? "default" : "outline"} onClick={mark} disabled={busy !== null || !text.trim()} data-testid={where === "panel" ? "evaluate-button" : "evaluate-button-bar"}>
      {busy === "evaluate" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {busy === "evaluate" ? "Marking…" : evaluation ? "Mark again" : "Mark this answer"}
    </Button>
  );
  const buyer = bid.buyerName ?? "the buyer";

  return (
    <div className="text-15 text-ink @container flex flex-col" data-testid="answer-editor">
      {/* --- Sub-header ------------------------------------------------------------------------ */}
      <div className={cn("flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-line pb-3", embedded ? "hidden" : "")}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
          <Link href={bid.briefHref} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink no-underline hover:text-brand">
            <ChevronLeft aria-hidden className="size-4" />
            {bid.briefLabel ?? "Bid brief"}
          </Link>
          <span className="max-w-[470px] min-w-0 truncate text-15 font-semibold" title={bid.title}>
            {bid.title}
          </span>
          {bid.deadline ? <DeadlineChip deadline={new Date(bid.deadline)} /> : null}
        </div>
        <div className="print:hidden flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="mr-1 text-13 text-ink-2" aria-live="polite" data-testid="save-state">
            {readOnly ? "" : busy === "save" ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved at ${timeOf(savedAt)}` : question.draftText ? "Saved" : ""}
          </span>
          {bid.exportHref ? (
            <ButtonLink variant="outline" href={bid.exportHref}  download data-testid="export-answers">
              <Download aria-hidden className="size-4" />
              Export to Word
            </ButtonLink>
          ) : null}
          <span className="hidden @[900px]:inline-flex">{finalControl("header")}</span>
        </div>
      </div>

      <div className={cn("flex flex-col gap-3", embedded ? "" : "mt-4")}>
        <StandingNotice />
        {locked === "check_only" || locked === "plan_lapsed" ? (
          <UpgradeNotice
            title={locked === "plan_lapsed" ? "Drafting is paused on this bid" : "Drafting and marking are part of Bid Desk"}
            actionLabel="See plans"
            secondary={
              canUnlock ? (
                <ButtonLink variant="outline" href={`/app/bids/${bidId}/questions`}>
                  Use a Bid Pass
                </ButtonLink>
              ) : undefined
            }
          >
            {locked === "plan_lapsed"
              ? "Your plan no longer includes drafting. Your answers are safe and readable; upgrade to edit, draft and mark again."
              : "This bid includes the cited bid check only. Bid Desk (£149/month) adds grounded first drafts, evaluator-style marking and Word export; a Bid Pass (£99) unlocks them for this one bid."}
          </UpgradeNotice>
        ) : null}
        {locked === "archived" ? <Callout>This bid is archived, so its answers are read-only. Restore the bid to make changes.</Callout> : null}
        {locked === "not_ready" ? <Callout>The tender pack is still being read. You can draft this answer as soon as the check is ready.</Callout> : null}
        {!readOnly && libraryEmpty ? (
          <Callout tone="warning" title="Your evidence library is empty">
            Drafts only use facts you have confirmed and documents you have uploaded. Without them a draft will be mostly gaps to fill.{" "}
            <Link href="/app/library" className="link font-medium">
              Add company facts and documents
            </Link>{" "}
            first.
          </Callout>
        ) : null}
      </div>

      {/* Small screens: one question at a time. */}
      <div className={cn("mt-4 flex items-center justify-between gap-3 @[1180px]:hidden", embedded ? "hidden" : "")}>
        {nav.previousHref ? (
          <ButtonLink variant="outline" href={nav.previousHref} aria-label="Previous question" className="px-3">
            <ChevronLeft aria-hidden className="size-5" />
          </ButtonLink>
        ) : (
          <span className="w-11" />
        )}
        <div className="min-w-0 text-center">
          <p className="text-15 font-semibold">
            Question {current + 1} of {nav.items.length}
          </p>
          <p className="text-xs text-ink-2">{question.draftText ? `Draft ${draftNumber}` : "Not started"}</p>
        </div>
        {nav.nextHref ? (
          <ButtonLink variant="outline" href={nav.nextHref} aria-label="Next question" className="px-3">
            <ChevronRight aria-hidden className="size-5" />
          </ButtonLink>
        ) : (
          <span className="w-11" />
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-7 @[900px]:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] @[1180px]:mt-7 @[1180px]:grid-cols-[minmax(220px,300px)_minmax(0,1fr)_minmax(340px,440px)]">
        {/* --- Left: questions and sources --------------------------------------------------- */}
        <div className="order-3 flex min-w-0 flex-col gap-7 @[900px]:col-start-2 @[900px]:row-start-2 @[1180px]:col-start-1 @[1180px]:row-start-1">
          <nav aria-label="Questions" className={cn("hidden flex-col gap-2.5", embedded ? "" : "@[1180px]:flex")}>
            <h2 className="text-15 font-semibold">
              Questions{nav.qualityWeight !== null ? <span className="font-normal text-ink-2"> · {nav.qualityWeight}% of marks</span> : null}
            </h2>
            <ul className="flex flex-col gap-1">
              {nav.items.map((item) => {
                const line = navLine(item);
                const body = (
                  <>
                    <span className="font-mono text-xs text-ink-2">
                      {item.ref || "Question"}
                      {item.weighting !== null ? ` · ${item.weighting}%` : ""}
                    </span>
                    <span className="text-sm leading-[1.35] font-semibold">{item.title}</span>
                    <span className={cn("text-xs tabular-nums", line.tone === "danger" ? "font-semibold text-danger" : line.tone === "info" ? "font-semibold text-info" : "text-ink-2")}>{line.text}</span>
                  </>
                );
                const className = cn("flex flex-col gap-0.5 rounded-card border px-3.5 py-3 text-ink no-underline", item.id === question.id ? "border-ink bg-surface" : "border-transparent hover:border-line");
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <NavLink href={item.href} variant="plain" current={item.id === question.id} className={className}>
                        {body}
                      </NavLink>
                    ) : (
                      <span className={className}>{body}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <section aria-labelledby="src-h" className="rounded-card border border-line bg-surface px-4 pt-4 pb-1.5" data-testid="sources">
            <h2 id="src-h" className="text-15 font-semibold">
              Sources in this answer
            </h2>
            <p className="mt-0.5 text-xs text-ink-2">Your documents only. Select a marker to see what the source says.</p>
            {usedSources.length > 0 ? (
              <ol className="mt-2.5 flex flex-col">
                {usedSources.map((source) => {
                  const open = selectedMarker === source.marker;
                  const times = uses(source.marker);
                  return (
                    <li key={source.marker} id={`src-${source.marker}`} className="flex scroll-mt-24 gap-2.5 border-t border-line py-2.5">
                      <ToggleButton variant="marker" pressed={open} aria-label={`Source ${numbers.get(source.marker)}`} onClick={() => setSelectedMarker(open ? null : source.marker)}>
                        {numbers.get(source.marker)}
                      </ToggleButton>
                      <span className="flex min-w-0 flex-col text-xs">
                        <span className="font-mono [overflow-wrap:anywhere]">{source.title}</span>
                        <span className="text-ink-2">
                          {source.detail}
                          {times > 1 ? `${source.detail ? " · " : ""}used ${times === 2 ? "twice" : `${times} times`}` : ""}
                        </span>
                        {open && source.passage ? <blockquote className="font-serif mt-2 rounded-control bg-paper px-3 py-2.5 text-sm leading-[1.45] whitespace-pre-line">{source.passage}</blockquote> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-2.5 border-t border-line py-3 text-13">{text.trim() ? "No source from your documents is cited in this text." : "Sources appear here once there is a draft."}</p>
            )}
          </section>
        </div>

        {/* --- Centre: question and draft ---------------------------------------------------- */}
        <div className="order-1 flex min-w-0 flex-col gap-5 @[900px]:col-start-1 @[900px]:row-span-2 @[900px]:row-start-1 @[1180px]:col-start-2 @[1180px]:row-span-1">
          <section aria-labelledby="question-h" className="rounded-card border border-line bg-surface flex flex-col items-start gap-3 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="question-h" className="font-mono mr-1.5 text-sm font-medium">
                {question.ref || "Question"}
              </h1>
              {question.weighting !== null ? <span className="rounded-chip border border-line-strong px-2 py-0.5 text-xs font-semibold whitespace-nowrap rounded-chip border border-ink px-2 py-0.5 text-xs font-semibold whitespace-nowrap">{question.weighting}% of marks</span> : null}
              <span className="rounded-chip border border-line-strong px-2 py-0.5 text-xs font-semibold whitespace-nowrap">{question.limit ? `Limit ${question.limit.toLocaleString("en-GB")} words` : "No limit stated"}</span>
              {scaleRange ? <span className="rounded-chip border border-line-strong px-2 py-0.5 text-xs font-semibold whitespace-nowrap">{scaleKind === "pack" ? scaleRange : `${scaleRange} (typical scale)`}</span> : null}
            </div>
            {question.title ? <p className="text-15 font-semibold">{question.title}</p> : null}
            <p className="font-serif text-lg leading-[1.4] whitespace-pre-line text-pretty sm:text-xl">“{question.text}”</p>
            {question.citation ? <CitationMark citation={question.citation} links={links} /> : <ReferenceChip file="Added by hand · no source in the pack" />}
            {question.limitFromPages && question.limit ? (
              <p className="text-xs text-ink-2">
                {question.limitText ? `The buyer's limit is “${question.limitText}”. ` : ""}Converted at 450 words per A4 side (our assumption — check the buyer&rsquo;s font and margin rules).
              </p>
            ) : null}
            {question.guidance || scale.length > 0 ? (
              <details className="w-full text-sm">
                <summary className="link inline-flex min-h-9 cursor-pointer items-center font-medium">What the buyer says, and how it is scored</summary>
                {question.guidance ? <p className="mt-2 whitespace-pre-line">{question.guidance}</p> : null}
                <p className="mt-3 text-13 text-ink-2">
                  {scaleKind === "pack" ? "Scoring scale from the tender documents:" : "The pack publishes no scoring scale, so a typical public-sector 0 to 5 scale is used. Check the buyer's wording if they publish one later."}
                </p>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {scale.map((row, index) => (
                    <li key={`${row.score}-${index}`} className="flex gap-3">
                      <span className="font-mono w-8 shrink-0 font-medium tabular-nums">{row.score}</span>
                      <span className="min-w-0">
                        {row.label ? <span className="font-semibold">{row.label}. </span> : null}
                        {row.descriptor}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </section>

          {evaluation ? (
            <section aria-label="Evaluator's view, in short" className="rounded-card border border-line bg-surface flex flex-col gap-3 px-5 py-4 @[900px]:hidden" data-testid="evaluation-summary">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-15 font-semibold">Evaluator&rsquo;s view</h2>
                <a href="#eval-h" className="link text-13 font-medium">
                  Full marking
                </a>
              </div>
              <p className="flex items-baseline gap-2.5">
                <span className="font-serif text-5xl leading-none font-semibold">{evaluation.score}</span>
                <span className="text-15">
                  <span className="font-semibold">of {evaluation.maxScore}</span>
                  {evaluation.band ? ` · ${evaluation.band}` : ""}
                  {evaluationStale ? " · before your last changes" : ""}
                </span>
              </p>
              {evaluation.improvements.length > 0 ? (
                <ol className="flex flex-col border-t border-line pt-2 text-sm">
                  {evaluation.improvements.slice(0, 3).map((improvement, index) => (
                    <li key={index} className="flex gap-2.5 py-1.5">
                      <span className="font-mono w-4 shrink-0 text-13 text-ink-2">{index + 1}</span>
                      <span className="font-medium">{improvement.suggestion}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="draft-h" className={cn("rounded-card border border-line bg-surface", limitState === "over" ? "border-danger" : "")}>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-5 py-3 sm:px-7">
              <h2 id="draft-h" className="text-15 font-semibold">
                Draft answer
                {question.draftText ? <span className="font-normal text-ink-2"> · draft {draftNumber}</span> : null}
                {question.draftMeta && !question.draftMeta.editedAt && text ? <span className="font-normal text-ink-2"> · written by AI, check every claim</span> : null}
              </h2>
              {counter}
            </div>

            {!readOnly ? (
              <div className="print:hidden flex min-h-11 flex-wrap items-center gap-x-1 gap-y-2 border-b border-line px-5 py-2.5 sm:px-7">
                <Button size="sm" type="button" variant={question.draftText ? "outline" : "default"} onClick={draft} disabled={busy !== null} data-testid="draft-button">
                  {busy === "draft" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  {busy === "draft" ? "Drafting from your documents…" : question.draftText ? "Regenerate" : "Draft from my documents"}
                </Button>
                <Button size="sm" variant="ghost" type="button"  onClick={() => setShowInstructions((value) => !value)} aria-expanded={showInstructions}>
                  {question.draftText ? "Regenerate with instructions" : "Add instructions"}
                </Button>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {question.versions.length > 0 ? (
                    <Button size="sm" variant="ghost" type="button"  onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory}>
                      History ({question.versions.length})
                    </Button>
                  ) : null}
                  {mode === "edit" ? (
                    <Button size="sm" variant="outline" type="button"  onClick={() => void save().then((ok) => (ok ? setMode("read") : undefined))} disabled={busy !== null} data-testid="edit-done">
                      {busy === "save" ? "Saving…" : "Done"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" type="button"  onClick={() => setMode("edit")} disabled={busy !== null} data-testid="edit-answer">
                      Edit
                    </Button>
                  )}
                </span>
              </div>
            ) : null}
            {showInstructions && !readOnly ? (
              <div className="flex flex-col gap-1.5 border-b border-line bg-paper px-5 py-3 sm:px-7">
                <label htmlFor="draft-instructions" className="text-sm font-semibold">
                  Instructions for the next draft
                </label>
                <Textarea
                  id="draft-instructions"
                  
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder="e.g. Lead with the Leeds case study. Shorter sentences. Say more about mobilisation in the first four weeks."
/>
                <p className="text-xs text-ink-2">Instructions shape the writing; they cannot add facts. Anything not in your documents still becomes a gap to fill.</p>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="border-b border-line bg-danger-tint px-5 py-2.5 text-sm text-danger sm:px-7">
                {error}
              </p>
            ) : null}

            {busy === "draft" || busy === "apply" ? (
              <p className="flex items-center gap-2 px-5 py-12 text-sm text-ink-2 sm:px-9" role="status">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {busy === "apply" ? "Revising the answer — the current text is kept in History…" : "Writing a first draft from your documents, then checking its claims. This takes about a minute."}
              </p>
            ) : mode === "edit" && !readOnly ? (
              <div className="px-3 py-3 sm:px-5">
                <Textarea
                  aria-label="Answer text"
                  data-testid="answer-textarea"
                  className="bid-draft resize-y"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onBlur={() => void save()}
                  rows={20}
                  placeholder="Write your answer here, or use “Draft from my documents” to start from your evidence."
/>
                <p className="mt-1.5 text-xs text-ink-2">Source markers look like [E2] here; a gap looks like [EVIDENCE NEEDED: what is missing]. Saved when you leave the box.</p>
              </div>
            ) : text ? (
              <article aria-label="Draft answer" className="px-5 pt-6 pb-7 sm:px-9">
                <DraftText text={text} meta={question.draftMeta} numbers={numbers} selected={selectedMarker} onSelect={selectMarker} />
              </article>
            ) : (
              <p className="px-5 py-12 text-center text-sm text-ink-2">{readOnly ? "No answer has been written for this question." : "No answer yet. Draft one from your documents, or choose Edit and write it yourself."}</p>
            )}

            {showHistory && question.versions.length > 0 ? (
              <div className="border-t border-line" data-testid="answer-history">
                <h3 className="px-5 pt-3 text-sm font-semibold sm:px-7">Earlier drafts</h3>
                <ul className="flex flex-col">
                  {question.versions.map((version) => (
                    <li key={version.id} className="flex flex-wrap items-start gap-3 border-t border-line px-5 py-2.5 first:border-t-0 sm:px-7">
                      <div className="min-w-0 flex-[1_1_16rem]">
                        <p className="text-xs text-ink-2">
                          {version.source === "user" ? "Your text" : version.source === "ai_revision" ? "AI revision" : "AI draft"} · {version.wordCount} words · {dateTimeOf(version.createdAt)}
                          {version.note ? ` · ${version.note}` : ""}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm">{version.text}</p>
                      </div>
                      <Button variant="outline"
                        type="button"
                        
                        disabled={busy !== null || readOnly}
                        onClick={() => {
                          if (window.confirm("Restore this draft? The current answer is kept in History.")) void run("restore", () => restoreVersionAction(bidId, question.id, version.id));
                        }}
>
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-line px-5 py-3 text-13 text-ink-2 sm:px-7">
              <span>Written only from your documents. A numbered marker shows where each claim comes from.</span>
              <span>{limitState === "over" ? <span className="font-semibold text-danger">Over the limit: buyers commonly stop reading at it, or reject the answer.</span> : "Source markers are not counted as words."}</span>
            </div>
          </section>
          {question.draftMeta?.trimmedToLimit && !question.draftMeta.editedAt ? <p className="text-13 text-accent-ink">The AI draft ran over the limit twice and was cut at the limit. Read the ending.</p> : null}
        </div>

        {/* --- Right: the evaluator's view --------------------------------------------------- */}
        <aside aria-labelledby="eval-h" className="rounded-card border border-line bg-surface order-2 flex min-w-0 scroll-mt-24 flex-col px-5 pt-5 pb-5 @[900px]:col-start-2 @[900px]:row-start-1 @[1180px]:col-start-3" data-testid="evaluator-panel">
          <h2 id="eval-h" className="font-serif text-2xl leading-[1.25] font-semibold">
            Evaluator&rsquo;s view
          </h2>
          <p className="mt-1 text-13 text-ink-2">
            {scaleKind === "pack" ? `Marked against ${buyer}'s own scoring scheme.` : "The pack publishes no scoring scale: marked against a typical public-sector 0 to 5 scale."}
            {evaluation ? ` Marked ${dateTimeOf(evaluation.evaluatedAt)}.` : ""}
          </p>

          {busy === "evaluate" ? (
            <p role="status" className="mt-4 flex items-center gap-2 rounded-card bg-paper px-4 py-6 text-sm text-ink-2">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Reading the answer as an evaluator would…
            </p>
          ) : evaluatorError ? (
            <div role="alert" className="mt-4 rounded-card bg-danger-tint px-4 py-4 text-sm">
              <p className="font-semibold text-danger">The evaluator is unavailable</p>
              <p className="mt-1">{evaluatorError} Your answer is saved; try marking it again in a moment.</p>
            </div>
          ) : evaluation ? (
            <div data-testid="evaluation-result" className={cn("flex flex-col", evaluationStale ? "opacity-80" : "")}>
              {evaluationStale ? (
                <Callout tone="warning" className="mt-4">
                  The answer has changed since it was marked. Mark it again before relying on this.
                </Callout>
              ) : null}
              <div className="mt-4 flex flex-col rounded-card bg-paper p-4">
                <span className="text-xs text-ink-2">Marked{scaleKind === "pack" ? "" : " · on a typical 0 to 5 scale"}</span>
                <p className="flex items-baseline gap-2.5" data-testid="evaluation-score" aria-label={`Marked ${evaluation.score} of ${evaluation.maxScore}`}>
                  <span className="font-serif text-6xl leading-[1.1] font-semibold tracking-[-0.02em]">{evaluation.score}</span>
                  <span className="text-15">
                    <span className="font-semibold">of {evaluation.maxScore}</span>
                    {evaluation.band ? ` · ${evaluation.band}` : ""}
                  </span>
                </p>
                {sortedScale && scoreIndex >= 0 && sortedScale.length <= 12 ? (
                  <div role="img" aria-label={`${evaluation.score} of ${evaluation.maxScore}`} className="mt-2">
                    <ScoreBars filled={scoreIndex} total={sortedScale.length - 1} />
                  </div>
                ) : null}
                {scoreRow?.descriptor ? (
                  <>
                    <blockquote className="font-serif mt-3.5 text-15 leading-[1.45]">
                      “{scoreRow.label ? `${scoreRow.label}: ` : ""}
                      {scoreRow.descriptor}”
                    </blockquote>
                    {scaleKind === "pack" && scoreRow.citation ? <CitationMark citation={scoreRow.citation} links={links} variant="ref" short={false} className="mt-1.5 self-start" /> : null}
                  </>
                ) : null}
                <p className="mt-3 border-t border-line pt-3 text-13">{evaluation.rationale}</p>
                {evaluation.overWordLimit ? <p className="mt-2 text-13 font-semibold text-danger">This text was over the word limit when it was marked.</p> : null}
              </div>

              {(evaluation.parts?.length ?? 0) > 0 || evaluation.missingParts.length > 0 ? (
                <section aria-labelledby="eval-parts" className="mt-5 border-t border-line pt-[18px]">
                  <h3 id="eval-parts" className="text-15 font-semibold">
                    What the question asks for
                  </h3>
                  <ul className="mt-2.5 flex flex-col gap-3">
                    {(evaluation.parts?.length ? evaluation.parts : evaluation.missingParts.map((part) => ({ part, status: "missing" as const, note: "" }))).map((part, index) => (
                      <li key={index} className="flex gap-2.5" data-part-status={part.status}>
                        {PART_ICON[part.status]}
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold">{part.part}</span>
                          <span className="text-13">
                            {PART_WORD[part.status]} {part.note}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {evaluation.improvements.length > 0 ? (
                <section aria-labelledby="eval-fixes" className="mt-5 border-t border-line pt-[18px]">
                  <h3 id="eval-fixes" className="text-15 font-semibold">
                    {nextRow ? `What ${/^[aeiou8]/i.test(nextRow.score) ? "an" : "a"} ${nextRow.score} needs` : "What would strengthen it further"}
                  </h3>
                  <ol className="mt-2.5 flex flex-col gap-3.5">
                    {evaluation.improvements.map((improvement, index) => (
                      <li key={index} className="flex gap-2.5" data-testid="improvement">
                        <span className="font-mono w-5 shrink-0 text-13 text-ink-2">{index + 1}</span>
                        <span className="flex min-w-0 flex-col items-start gap-1">
                          <span className="text-sm font-semibold">{improvement.suggestion}</span>
                          {improvement.rationale ? <span className="text-13">{improvement.rationale}</span> : null}
                          {improvement.needsEvidence ? (
                            <span className="text-13 text-accent-ink">
                              Needs evidence your documents do not hold.{" "}
                              {gaps.length > 0 ? (
                                <a href="#gap-1" className="link font-medium">
                                  Go to the first gap
                                </a>
                              ) : null}
                            </span>
                          ) : null}
                          {!readOnly ? (
                            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-13">
                              <Checkbox checked={selectedFixes.includes(index)} onCheckedChange={(checked) => setSelectedFixes((value) => (checked === true ? [...value, index] : value.filter((item) => item !== index)))} />
                              Include when revising
                            </label>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {!readOnly ? (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <Button variant="outline"
                        type="button"
                        className="self-start"
                        disabled={busy !== null || evaluationStale}
                        data-testid="apply-suggestions"
                        onClick={() => void run("apply", () => applySuggestionsAction(bidId, question.id, selectedFixes.length > 0 ? selectedFixes : evaluation.improvements.map((_, index) => index)))}
>
                        {selectedFixes.length > 0 ? `Revise with ${selectedFixes.length} selected` : "Revise with all of these"}
                      </Button>
                      <span className="text-xs text-ink-2">Writes a new draft from your documents. The current text stays in History.</span>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {evaluation.strengths.length > 0 ? (
                <section aria-labelledby="eval-credit" className="mt-5 border-t border-line pt-[18px]">
                  <h3 id="eval-credit" className="text-15 font-semibold">
                    An evaluator would credit
                  </h3>
                  <ul className="mt-2.5 flex flex-col gap-2.5 text-13">
                    {evaluation.strengths.map((strength) => (
                      <li key={strength} className="flex gap-2.5">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.4} />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 rounded-card bg-paper px-4 py-5 text-sm">
              {text.trim() ? "Not marked yet. Marking reads the answer strictly against the scoring scale and lists what would gain marks." : "Write or draft an answer, then mark it."}
            </p>
          )}

          {text.trim() ? (
            <section aria-labelledby="eval-check" className="mt-5 border-t border-line pt-[18px]" data-testid="check-list">
              <h3 id="eval-check" className="text-15 font-semibold">
                Check before you submit
              </h3>
              <ul className="mt-2.5 flex flex-col gap-2.5 text-13">
                {flagged.map((flag, index) => (
                  <li key={`f${index}`} className="flex gap-2.5" data-testid="flagged-claim">
                    <span aria-hidden className="w-4 shrink-0 text-center font-bold text-danger">!</span>
                    <span>{flag.claim === "Claims check" ? flag.reason : <>No source for: “{flag.claim}”. {flag.reason} Evidence it or take it out.</>}</span>
                  </li>
                ))}
                {gaps.length > 0 ? (
                  <li className="flex gap-2.5">
                    <span aria-hidden className="w-4 shrink-0 text-center font-bold text-danger">!</span>
                    <span>
                      {countWord(gaps.length)} {gaps.length === 1 ? "gap" : "gaps"} to fill: {gaps.join("; ")}. Never submit a placeholder.{" "}
                      <a href="#gap-1" className="link font-medium">
                        Go to the first
                      </a>
                    </span>
                  </li>
                ) : null}
                {!evaluation?.parts?.length && (question.draftMeta?.unansweredParts ?? []).length > 0 && !dirty ? (
                  <li className="flex gap-2.5">
                    <span aria-hidden className="w-4 shrink-0 text-center font-bold text-danger">!</span>
                    <span>Not answered: {question.draftMeta!.unansweredParts.join("; ")}.</span>
                  </li>
                ) : null}
                {question.limit ? (
                  <li className="flex gap-2.5">
                    <span aria-hidden className={cn("w-4 shrink-0 text-center font-bold", limitState === "over" ? "text-danger" : "text-info")}>{limitState === "over" ? "!" : "i"}</span>
                    <span>{limitState === "over" ? `Over the limit by ${words - question.limit} words. Cut before you submit.` : `You have ${(question.limit - words).toLocaleString("en-GB")} words in hand.`}</span>
                  </li>
                ) : null}
                <li className="flex gap-2.5">
                  <span aria-hidden className="w-4 shrink-0 text-center font-bold text-info">i</span>
                  <span>The automatic claims check catches most unsupported statements, not all. Read every factual sentence against your own records.</span>
                </li>
              </ul>
            </section>
          ) : null}

          <div className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4">
            <span className="hidden @[900px]:block">{markControl("panel")}</span>
            <p className="text-xs text-ink-2">
              A reading of the scoring scheme, not a forecast of {buyer === "the buyer" ? "the buyer’s" : `${buyer}’s`} decision. It marks against the published criteria only and is not legal advice.
            </p>
          </div>
        </aside>
      </div>

      {/* Small screens: the two main actions stay within reach. */}
      {!readOnly ? (
        <div className="print:hidden sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-2 border-t border-line bg-surface px-4 py-3 @[900px]:hidden">
          {finalControl("bar")}
          {markControl("bar")}
        </div>
      ) : null}
    </div>
  );
}
