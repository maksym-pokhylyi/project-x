"use client";

import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addQuestionAction, deleteQuestionAction, updateQuestionAction } from "@/features/bids/actions";
import { effectiveWordLimit, wordLimitState } from "@/features/bids/answer-text";
import { QUESTION_STATUS_LABELS, QUESTION_STATUSES, type Citation, type Provenance, type QuestionStatus } from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { CitationMark, type SourceLinks } from "./citation";

export type QuestionItem = {
  id: string;
  ref: string;
  title: string | null;
  text: string;
  section: string | null;
  weighting: number | null;
  maxScore: number | null;
  wordLimit: number | null;
  pageLimit: number | null;
  limitText: string | null;
  guidance: string | null;
  citation: Citation | null;
  status: QuestionStatus;
  wordCount: number;
  gaps: number;
  score: string | null;
  maxEvaluated: string | null;
  provenance: Provenance | null;
  source: string;
};

/** Status stepper: Not started → Draft → Reviewed → Final. */
export function StatusStepper({ status }: { status: QuestionStatus }) {
  const index = QUESTION_STATUSES.indexOf(status);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Status: ${QUESTION_STATUS_LABELS[status]}`}>
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {QUESTION_STATUSES.map((step, position) => (
          <span key={step} className={cn("h-1.5 w-4 rounded-full", position <= index && index > 0 ? (status === "final" ? "bg-success" : "bg-primary") : "bg-muted")} />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">{QUESTION_STATUS_LABELS[status]}</span>
    </span>
  );
}

type Editing = { mode: "add" } | { mode: "edit"; item: QuestionItem } | null;

export function QuestionsView({
  bidId,
  questions,
  links,
  basePath,
  readOnly = false,
  canDraft = true,
}: {
  bidId: string;
  questions: QuestionItem[];
  links: SourceLinks;
  basePath: string;
  readOnly?: boolean;
  canDraft?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const started = questions.filter((question) => question.status !== "not_started").length;
  const final = questions.filter((question) => question.status === "final").length;
  const totalWeight = questions.reduce((sum, question) => sum + (question.weighting ?? 0), 0);

  return (
    <div className="space-y-4" data-testid="questions-view">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" data-testid="questions-progress">
          <span className="font-medium text-foreground tabular-nums">{questions.length}</span> question{questions.length === 1 ? "" : "s"}
          {questions.length > 0 ? (
            <>
              {" · "}
              <span className="tabular-nums">{started}</span> drafted · <span className="tabular-nums">{final}</span> final
              {totalWeight > 0 ? (
                <>
                  {" · "}weightings add up to <span className="tabular-nums">{Math.round(totalWeight * 10) / 10}%</span>
                </>
              ) : null}
            </>
          ) : null}
        </p>
        {!readOnly ? (
          <Button size="sm" onClick={() => setEditing({ mode: "add" })}>
            <Plus aria-hidden className="size-3.5" />
            Add question
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <h3 className="text-base font-semibold">No questions found</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Some buyers keep the questions in their portal or in a response form that was not uploaded. Add each question here with its weighting and word limit, and you can draft and mark it as usual.
          </p>
          {!readOnly ? (
            <Button className="mt-4" size="sm" onClick={() => setEditing({ mode: "add" })}>
              Add the first question
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {questions.map((question) => {
            const { limit, fromPages } = effectiveWordLimit(question);
            const limitState = wordLimitState(question.wordCount, limit);
            return (
              <li key={question.id} data-testid="question-card" data-status={question.status} className="rounded-lg border bg-card p-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 w-12 shrink-0 font-mono text-xs break-words text-muted-foreground">{question.ref || "—"}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      {question.title ? <h3 className="text-sm font-semibold">{question.title}</h3> : null}
                      <p className={cn("line-clamp-3 text-sm whitespace-pre-line", question.title ? "text-muted-foreground" : "")}>{question.text}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      {question.weighting !== null ? (
                        <span className="inline-flex items-center gap-2" title="Weighting">
                          <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, question.weighting)}%` }} />
                          </span>
                          <span className="font-medium tabular-nums">{question.weighting}%</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Weighting not stated</span>
                      )}
                      <span className="text-muted-foreground">
                        {question.limitText ?? (limit ? `${limit} words` : "No limit stated")}
                        {fromPages && limit ? ` (≈ ${limit} words)` : ""}
                      </span>
                      {question.section ? <span className="text-muted-foreground">{question.section}</span> : null}
                      <CitationMark citation={question.citation} links={links} />
                      {(question.provenance?.notes ?? []).map((note) => (
                        <span key={note} className="text-warning">
                          {note}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <StatusStepper status={question.status} />
                      {question.status !== "not_started" ? (
                        <span className={cn("text-xs tabular-nums", limitState === "over" ? "font-medium text-destructive" : limitState === "near" ? "text-warning" : "text-muted-foreground")}>
                          {question.wordCount} words{limit ? ` of ${limit}` : ""}
                          {limitState === "over" ? " — over limit" : ""}
                        </span>
                      ) : null}
                      {question.gaps > 0 ? <span className="text-xs font-medium text-warning">{question.gaps} evidence gap{question.gaps === 1 ? "" : "s"}</span> : null}
                      {question.score !== null ? (
                        <span className="text-xs text-muted-foreground">
                          Marked {question.score}/{question.maxEvaluated}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Button asChild size="sm" variant={question.status === "not_started" && canDraft ? "default" : "outline"}>
                      <Link href={`${basePath}/questions/${question.id}`}>
                        {question.status === "not_started" ? (canDraft ? "Draft" : "Open") : "Open"}
                        <ArrowRight aria-hidden className="size-3.5" />
                      </Link>
                    </Button>
                    {!readOnly ? (
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ mode: "edit", item: question })} aria-label={`Edit question ${question.ref || question.title || ""}`}>
                          <Pencil aria-hidden className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label={`Delete question ${question.ref || question.title || ""}`}
                          onClick={() => {
                            const warning = question.status !== "not_started" ? " Its answer will be deleted too." : "";
                            if (!window.confirm(`Delete this question?${warning}`)) return;
                            startTransition(async () => {
                              const result = await deleteQuestionAction(bidId, question.id);
                              if (!result.ok) setError(result.error.message);
                              else router.refresh();
                            });
                          }}
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <QuestionDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const result = editing.mode === "add" ? await addQuestionAction(bidId, values) : await updateQuestionAction(bidId, editing.item.id, values);
            if (result.ok) {
              setEditing(null);
              router.refresh();
              return null;
            }
            return result.error.message;
          }}
        />
      ) : null}
    </div>
  );
}

function QuestionDialog({ editing, onClose, onSubmit }: { editing: NonNullable<Editing>; onClose: () => void; onSubmit: (values: Record<string, unknown>) => Promise<string | null> }) {
  const item = editing.mode === "edit" ? editing.item : null;
  const [ref, setRef] = useState(item?.ref ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [text, setText] = useState(item?.text ?? "");
  const [weighting, setWeighting] = useState(item?.weighting?.toString() ?? "");
  const [wordLimit, setWordLimit] = useState(item?.wordLimit?.toString() ?? "");
  const [guidance, setGuidance] = useState(item?.guidance ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit question" : "Add a question"}</DialogTitle>
          <DialogDescription>Copy the question exactly as the buyer asks it, with its weighting and limit.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError(null);
            const message = await onSubmit({ ref, title: title || null, text, weighting: weighting === "" ? null : weighting, wordLimit: wordLimit === "" ? null : wordLimit, guidance: guidance || null });
            setSaving(false);
            if (message) setError(message);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="question-ref">Reference</Label>
              <Input id="question-ref" value={ref} onChange={(event) => setRef(event.target.value)} placeholder="Q3" maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-title">Short title (optional)</Label>
              <Input id="question-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mobilisation" maxLength={300} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="question-text">Question</Label>
            <Textarea id="question-text" value={text} onChange={(event) => setText(event.target.value)} rows={5} required minLength={3} maxLength={8000} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="question-weighting">Weighting % (optional)</Label>
              <Input id="question-weighting" inputMode="decimal" value={weighting} onChange={(event) => setWeighting(event.target.value)} placeholder="20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-limit">Word limit (optional)</Label>
              <Input id="question-limit" inputMode="numeric" value={wordLimit} onChange={(event) => setWordLimit(event.target.value)} placeholder="500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="question-guidance">Buyer&rsquo;s guidance or scoring notes (optional)</Label>
            <Textarea id="question-guidance" value={guidance} onChange={(event) => setGuidance(event.target.value)} rows={3} maxLength={8000} />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : item ? "Save changes" : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
