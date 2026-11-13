"use client";

import { History, Loader2, PenLine, RotateCcw, Sparkles, Stamp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition, type ReactNode } from "react";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  applySuggestionsAction,
  draftAnswerAction,
  evaluateAnswerAction,
  restoreVersionAction,
  saveAnswerAction,
  setQuestionStatusAction,
} from "@/features/bids/actions";
import { answerHash, findEvidenceGaps, wordLimitState } from "@/features/bids/answer-text";
import { countWords } from "@/features/bids/constants";
import {
  QUESTION_STATUS_LABELS,
  QUESTION_STATUSES,
  type AnswerEvaluation,
  type AnswerVersion,
  type Citation,
  type DraftMeta,
  type QuestionStatus,
  type ScoringDescriptor,
} from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { CitationMark, type SourceLinks } from "./citation";
import { Callout, Pill, StandingNotice, UpgradeNotice } from "./ui";

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
};

/** Renders answer text with evidence markers as chips and evidence gaps highlighted. */
export function HighlightedAnswer({ text, meta }: { text: string; meta: DraftMeta | null }) {
  const titles = new Map((meta?.evidenceRefs ?? []).map((ref) => [ref.marker, ref.title]));
  const flagged = (meta?.flaggedClaims ?? []).map((flag) => flag.claim).filter((claim) => claim.length > 12 && text.includes(claim));
  const pattern = new RegExp(`(\\[\\s*EVIDENCE[\\s_-]*NEEDED[^\\]]*\\]|\\[E\\d{1,3}\\]${flagged.length ? `|${flagged.map((claim) => claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}` : ""})`, "gi");
  const render = (line: string, lineKey: string): ReactNode =>
    line.split(pattern).map((part, index) => {
      if (!part) return null;
      if (/^\[\s*EVIDENCE/i.test(part)) {
        return (
          <mark key={`${lineKey}-${index}`} data-testid="evidence-gap" className="rounded border border-warning/50 bg-warning/15 px-1 py-0.5 text-[0.92em] font-medium text-foreground">
            {part.replace(/^\[\s*EVIDENCE[\s_-]*NEEDED\s*[:\-–—]?\s*/i, "Evidence needed: ").replace(/\]$/, "")}
          </mark>
        );
      }
      const marker = /^\[(E\d{1,3})\]$/.exec(part);
      if (marker) {
        return (
          <sup key={`${lineKey}-${index}`} data-testid="evidence-marker" title={titles.get(marker[1]!) ?? "Source in your evidence library"} className="mx-0.5 rounded bg-primary/10 px-1 font-mono text-[10px] font-medium text-primary">
            {marker[1]}
          </sup>
        );
      }
      if (flagged.includes(part)) {
        return (
          <span key={`${lineKey}-${index}`} title="Not supported by your evidence — see the claims check below" className="underline decoration-destructive decoration-wavy underline-offset-4">
            {part}
          </span>
        );
      }
      return <Fragment key={`${lineKey}-${index}`}>{part}</Fragment>;
    });
  return (
    <div className="space-y-3 text-[15px] leading-7" data-testid="answer-read">
      {text.split(/\n{2,}/).map((block, blockIndex) => {
        const lines = block.split("\n");
        const heading = lines.length === 1 && block.length < 80 && !/[.!?:;,\]]$/.test(block.trim()) && !block.trim().startsWith("-");
        if (heading) {
          return (
            <h4 key={blockIndex} className="pt-1 text-sm font-semibold">
              {render(block.replace(/^#+\s*/, "").replace(/\*\*/g, ""), `h${blockIndex}`)}
            </h4>
          );
        }
        return (
          <p key={blockIndex} className="whitespace-pre-line">
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? "\n" : null}
                {render(line, `b${blockIndex}l${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const IMPACT_LABEL = { high: "Most marks", medium: "Some marks", low: "Minor" } as const;

/**
 * AnswerEditor: left, the question with its guidance and scoring; right, the answer with a
 * live word count against the limit, evidence markers and highlighted evidence gaps; below,
 * the evaluator panel. AI output is always labelled, editable and replaceable; any AI write
 * keeps the previous text in History.
 */
export function AnswerEditor({ bidId, question, scale, scaleKind, links, locked, canUnlock = false, library }: EditorProps) {
  const router = useRouter();
  const [text, setText] = useState(question.draftText);
  const [mode, setMode] = useState<"read" | "edit">(question.draftText ? "read" : "edit");
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState<null | "draft" | "evaluate" | "apply" | "save" | "restore">(null);
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
  const dirty = text !== savedText;
  const evaluation = question.evaluation;
  const evaluationStale = Boolean(evaluation && evaluation.answerHash !== answerHash(text));
  const libraryEmpty = !library.factsConfirmed && library.documents === 0;

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

  const run = async (kind: "draft" | "evaluate" | "apply" | "restore", work: () => Promise<{ ok: true } | { ok: false; error: { message: string } }>) => {
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

  return (
    <div className="space-y-6" data-testid="answer-editor">
      <StandingNotice />
      {locked === "check_only" || locked === "plan_lapsed" ? (
        <UpgradeNotice
          title={locked === "plan_lapsed" ? "Drafting is paused on this bid" : "Drafting and marking are part of Bid Desk"}
          actionLabel="See plans"
          secondary={
            canUnlock ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/bids/${bidId}/questions`}>Use a Bid Pass</Link>
              </Button>
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
          Drafts only use facts you have confirmed and documents you have uploaded. Without them a draft will be mostly “Evidence needed” placeholders.{" "}
          <Link href="/app/library" className="font-medium underline underline-offset-4">
            Add company facts and documents
          </Link>{" "}
          first.
        </Callout>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: the question */}
        <aside aria-label="Question" className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <div className="rounded-lg border bg-card p-4">
            <p className="font-mono text-xs text-muted-foreground">{question.ref || "Question"}</p>
            {question.title ? <h2 className="mt-1 text-base font-semibold">{question.title}</h2> : null}
            <p className="mt-2 text-sm leading-6 whitespace-pre-line">{question.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {question.weighting !== null ? <Pill tone="brand">Weighting {question.weighting}%</Pill> : <Pill>Weighting not stated</Pill>}
              <Pill>{question.limitText ?? (question.limit ? `${question.limit} words` : "No limit stated")}</Pill>
              <CitationMark citation={question.citation} links={links} />
            </div>
            {question.limitFromPages && question.limit ? (
              <p className="mt-2 text-xs text-muted-foreground">Page limit converted at 450 words per A4 side (our assumption — check the buyer&rsquo;s font and margin rules): about {question.limit} words.</p>
            ) : null}
          </div>
          {question.guidance ? (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold">What the buyer says</h3>
              <p className="mt-1.5 text-sm leading-6 whitespace-pre-line text-muted-foreground">{question.guidance}</p>
            </div>
          ) : null}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold">How it is scored</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {scaleKind === "pack" ? "Scoring descriptors from the tender documents." : "The pack publishes no scoring scale, so a typical public-sector 0–5 scale is shown. Check the buyer's own wording if they publish one later."}
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {scale.map((row, index) => (
                <li key={`${row.score}-${index}`} className="flex gap-2">
                  <span className="w-8 shrink-0 font-mono font-medium tabular-nums">{row.score}</span>
                  <span className="min-w-0">
                    {row.label ? <span className="font-medium">{row.label}. </span> : null}
                    <span className="text-muted-foreground">{row.descriptor}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* Right: the answer */}
        <section aria-label="Answer" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Your answer</h2>
              {question.draftMeta && !question.draftMeta.editedAt && text ? <Pill tone="brand">AI draft — check every claim</Pill> : null}
            </div>
            <div
              data-testid="word-count"
              data-limit-state={limitState}
              aria-live="polite"
              className={cn(
                "rounded border px-2 py-1 font-mono text-xs tabular-nums",
                limitState === "over" ? "border-destructive/40 bg-destructive/10 font-semibold text-destructive" : limitState === "near" ? "border-warning/40 bg-warning/10 text-warning" : "text-muted-foreground",
              )}
            >
              {words}
              {question.limit ? ` / ${question.limit}` : ""} words
              {limitState === "over" ? ` — ${words - question.limit!} over the limit` : limitState === "near" ? " — close to the limit" : ""}
            </div>
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={draft} disabled={busy !== null} data-testid="draft-button">
                {busy === "draft" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Sparkles aria-hidden className="size-3.5" />}
                {busy === "draft" ? "Drafting from your evidence…" : question.draftText ? "Regenerate" : "Draft answer"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowInstructions((value) => !value)} aria-expanded={showInstructions}>
                {question.draftText ? "Regenerate with instructions" : "Add instructions"}
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-md border text-xs">
                  <button type="button" aria-pressed={mode === "read"} onClick={() => void save().then(() => setMode("read"))} className={cn("px-2.5 py-1.5", mode === "read" ? "bg-primary text-primary-foreground" : "bg-background")}>
                    Read
                  </button>
                  <button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")} className={cn("flex items-center gap-1 px-2.5 py-1.5", mode === "edit" ? "bg-primary text-primary-foreground" : "bg-background")}>
                    <PenLine aria-hidden className="size-3" /> Edit
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {showInstructions && !readOnly ? (
            <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
              <Label htmlFor="draft-instructions">Instructions for the next draft</Label>
              <Textarea id="draft-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} maxLength={1500} placeholder="e.g. Lead with the Leeds case study. Shorter sentences. Say more about mobilisation in the first four weeks." />
              <p className="text-xs text-muted-foreground">Instructions shape the writing; they cannot add facts. Anything not in your evidence library still becomes “Evidence needed”.</p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className={cn("rounded-lg border bg-card", limitState === "over" ? "border-destructive/50" : "")}>
            {busy === "draft" || busy === "apply" ? (
              <div className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground" role="status">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {busy === "apply" ? "Revising the answer — the current text is kept in History…" : "Writing a first draft from your evidence, then checking its claims. This takes about a minute."}
              </div>
            ) : mode === "edit" && !readOnly ? (
              <Textarea
                aria-label="Answer text"
                data-testid="answer-textarea"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onBlur={() => void save()}
                rows={18}
                className="min-h-80 resize-y border-0 text-[15px] leading-7 shadow-none focus-visible:ring-0"
                placeholder="Write your answer here, or use “Draft answer” to start from your evidence library."
              />
            ) : text ? (
              <div className="px-4 py-3">
                <HighlightedAnswer text={text} meta={question.draftMeta} />
              </div>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">{readOnly ? "No answer has been written for this question." : "No answer yet."}</p>
            )}
          </div>
          {limitState === "over" ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              Over the word limit. Buyers usually stop reading at the limit or reject the answer — cut {words - question.limit!} words.
            </p>
          ) : null}
          {question.draftMeta?.trimmedToLimit ? <p className="text-xs text-warning">The AI draft ran over the limit twice and was cut at the limit. Read the ending.</p> : null}

          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => void save()} disabled={!dirty || busy !== null}>
                {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
              </Button>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {dirty ? "Unsaved changes" : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor="question-status" className="text-xs text-muted-foreground">
                  Status
                </Label>
                <NativeSelect
                  id="question-status"
                  className="h-8 text-xs"
                  value={question.status}
                  disabled={busy !== null}
                  onChange={(event) => {
                    const next = event.target.value;
                    void save().then(async (ok) => {
                      if (!ok) return;
                      const result = await setQuestionStatusAction(bidId, question.id, next);
                      if (!result.ok) setError(result.error.message);
                      else router.refresh();
                    });
                  }}
                >
                  {QUESTION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {QUESTION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </NativeSelect>
                {question.versions.length > 0 ? (
                  <Button size="sm" variant="ghost" onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory}>
                    <History aria-hidden className="size-3.5" />
                    History ({question.versions.length})
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showHistory && question.versions.length > 0 ? (
            <div className="rounded-lg border bg-card" data-testid="answer-history">
              <h3 className="border-b px-4 py-2 text-sm font-semibold">Earlier versions</h3>
              <ul className="divide-y">
                {question.versions.map((version) => (
                  <li key={version.id} className="flex items-start gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {version.source === "user" ? "Your text" : version.source === "ai_revision" ? "AI revision" : "AI draft"} · {version.wordCount} words ·{" "}
                        {new Date(version.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {version.note ? ` · ${version.note}` : ""}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm">{version.text}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null || readOnly}
                      onClick={() => {
                        if (window.confirm("Restore this version? The current answer is kept in History.")) void run("restore", () => restoreVersionAction(bidId, question.id, version.id));
                      }}
                    >
                      <RotateCcw aria-hidden className="size-3.5" />
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Evidence: what the draft used, what is missing, what could not be supported */}
          {text ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-3" data-testid="evidence-used">
                <h3 className="text-sm font-semibold">Evidence used</h3>
                {(question.draftMeta?.evidenceRefs ?? []).length > 0 ? (
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {question.draftMeta!.evidenceRefs.map((ref) => (
                      <li key={ref.marker} className="flex gap-2">
                        <span className="w-7 shrink-0 rounded bg-primary/10 px-1 text-center font-mono text-[11px] leading-5 font-medium text-primary">{ref.marker}</span>
                        <span className="min-w-0">{ref.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">No sources from your library are cited in this text.</p>
                )}
              </div>
              <div className={cn("rounded-lg border bg-card p-3", gaps.length > 0 ? "border-warning/50" : "")} data-testid="evidence-gaps">
                <h3 className="text-sm font-semibold">
                  Evidence needed <span className="font-normal text-muted-foreground tabular-nums">{gaps.length}</span>
                </h3>
                {gaps.length > 0 ? (
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                    {gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">No placeholders in this text.</p>
                )}
                {gaps.length > 0 ? <p className="mt-2 text-xs text-muted-foreground">Add the evidence to your library, or replace each placeholder with a fact you can stand behind. Never submit a placeholder.</p> : null}
              </div>
              {(question.draftMeta?.flaggedClaims ?? []).length > 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-card p-3 md:col-span-2" data-testid="flagged-claims">
                  <h3 className="text-sm font-semibold">Claims your evidence does not support</h3>
                  <ul className="mt-1.5 space-y-1.5 text-sm">
                    {question.draftMeta!.flaggedClaims.map((flag, index) => (
                      <li key={index}>
                        <span className="font-medium">“{flag.claim}”</span> <span className="text-muted-foreground">— {flag.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">An automatic check: it catches most invented facts, not all. Read every factual statement before you submit.</p>
                </div>
              ) : null}
              {(question.draftMeta?.unansweredParts ?? []).length > 0 ? (
                <div className="rounded-lg border border-warning/50 bg-card p-3 md:col-span-2">
                  <h3 className="text-sm font-semibold">Parts of the question not answered</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                    {question.draftMeta!.unansweredParts.map((part) => (
                      <li key={part}>{part}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Evaluator panel */}
          <section aria-label="Evaluator" className="rounded-lg border bg-card" data-testid="evaluator-panel">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Stamp aria-hidden className="size-4 text-muted-foreground" />
                  Evaluator
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Marks the answer against {scaleKind === "pack" ? "the buyer's published scoring descriptors" : "a typical 0–5 scale (the pack publishes none)"} only. Feedback, not a prediction of your score, and not legal advice.
                </p>
              </div>
              {!readOnly ? (
                <Button size="sm" variant={evaluation && !evaluationStale ? "outline" : "default"} onClick={() => void run("evaluate", () => evaluateAnswerAction(bidId, question.id))} disabled={busy !== null || !text.trim()} data-testid="evaluate-button">
                  {busy === "evaluate" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
                  {busy === "evaluate" ? "Marking…" : evaluation ? "Mark again" : "Mark this answer"}
                </Button>
              ) : null}
            </div>
            {busy === "evaluate" ? (
              <p role="status" className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Reading the answer as an evaluator would…
              </p>
            ) : evaluatorError ? (
              <div role="alert" className="px-4 py-4 text-sm">
                <p className="font-medium text-destructive">The evaluator is unavailable</p>
                <p className="mt-1 text-muted-foreground">{evaluatorError} Your answer is saved; try marking it again in a moment.</p>
              </div>
            ) : evaluation ? (
              <div className="space-y-4 px-4 py-4" data-testid="evaluation-result">
                {evaluationStale ? <Callout tone="warning">The answer has changed since it was marked. Mark it again before relying on this feedback.</Callout> : null}
                <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                  <p className="font-mono text-3xl leading-none font-semibold tabular-nums" data-testid="evaluation-score">
                    {evaluation.score}
                    <span className="text-lg font-normal text-muted-foreground"> / {evaluation.maxScore}</span>
                  </p>
                  {evaluation.band ? <Pill tone="brand">{evaluation.band}</Pill> : null}
                  {evaluation.overWordLimit ? <Pill tone="danger">Over the word limit</Pill> : null}
                </div>
                <p className="text-sm leading-6">{evaluation.rationale}</p>
                {evaluation.missingParts.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold">Not answered</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {evaluation.missingParts.map((part) => (
                        <li key={part}>{part}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {evaluation.improvements.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold">Improvements, most valuable first</h4>
                    <ol className="mt-2 space-y-2">
                      {evaluation.improvements.map((improvement, index) => (
                        <li key={index} className="flex gap-3 rounded-md border px-3 py-2.5" data-testid="improvement">
                          <span className="mt-0.5 w-5 shrink-0 font-mono text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">{improvement.suggestion}</p>
                            {improvement.rationale ? <p className="mt-0.5 text-xs text-muted-foreground">{improvement.rationale}</p> : null}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Pill tone={improvement.impact === "high" ? "brand" : "neutral"}>{IMPACT_LABEL[improvement.impact]}</Pill>
                              {improvement.needsEvidence ? <Pill tone="warning">Needs evidence you have not added</Pill> : null}
                            </div>
                          </div>
                          {!readOnly ? (
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <Button size="sm" variant="outline" disabled={busy !== null || evaluationStale} onClick={() => void run("apply", () => applySuggestionsAction(bidId, question.id, [index]))}>
                                Apply
                              </Button>
                              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="size-3.5 accent-[var(--primary)]"
                                  checked={selected.includes(index)}
                                  onChange={(event) => setSelected((current) => (event.target.checked ? [...current, index] : current.filter((value) => value !== index)))}
                                />
                                Select
                              </label>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                    {!readOnly ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button
                          size="sm"
                          disabled={busy !== null || evaluationStale}
                          data-testid="apply-suggestions"
                          onClick={() => void run("apply", () => applySuggestionsAction(bidId, question.id, selected.length > 0 ? selected : evaluation.improvements.map((_, index) => index)))}
                        >
                          {selected.length > 0 ? `Apply ${selected.length} selected` : "Apply all suggestions"}
                        </Button>
                        <span className="text-xs text-muted-foreground">Creates a revised draft. Your current text stays in History.</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {evaluation.strengths.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold">What already works ({evaluation.strengths.length})</summary>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {evaluation.strengths.map((strength) => (
                        <li key={strength}>{strength}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {text.trim() ? "Not marked yet. Marking reads the answer strictly against the scoring descriptors and lists what would gain marks." : "Write or draft an answer, then mark it."}
              </p>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
