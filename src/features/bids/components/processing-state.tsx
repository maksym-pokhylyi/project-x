"use client";

import { Check, CircleDashed, Loader2, RotateCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { retryProcessingAction } from "@/features/bids/actions";
import { PROCESSING_STAGE_LABELS, type ProcessingStage } from "@/features/bids/types";
import { cn } from "@/lib/utils";

type StageStatus = "pending" | "running" | "done" | "failed";

export type StatusPayload = {
  status: string;
  stage: string | null;
  progress: number;
  stages: Array<{ stage: ProcessingStage; status: StageStatus; note: string | null }>;
  failure: { step: string; stage: ProcessingStage; message: string; retryable: boolean } | null;
  counts: { files: number; filesRead: number; requirements: number; passFail: number; questions: number };
  startedAt: string | null;
  readyAt: string | null;
  version: string;
};

function elapsedLabel(startedAt: string | null, now: number): string {
  if (!startedAt) return "";
  const seconds = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} min ${String(seconds % 60).padStart(2, "0")} s` : `${seconds} s`;
}

const DETAIL: Record<ProcessingStage, (counts: StatusPayload["counts"]) => string> = {
  reading: (counts) => (counts.files > 0 ? `${counts.filesRead} of ${counts.files} files read` : ""),
  requirements: (counts) => (counts.requirements > 0 ? `${counts.requirements} found so far${counts.passFail ? `, ${counts.passFail} pass/fail` : ""}` : "Two independent readings of the whole pack"),
  questions: (counts) => (counts.questions > 0 ? `${counts.questions} found so far` : "Including questionnaires and clarification files"),
  company: () => "Comparing requirements with your confirmed company facts",
};

/**
 * ProcessingState: the real stages of the pack pipeline with elapsed time. The state lives
 * in the database, so it survives refresh and navigation; this component only polls it and
 * refreshes the page when new partial results have landed (requirements and questions
 * appear below while later stages are still running). Failures are loud and per stage,
 * with a retry that continues from the failed step.
 */
export function ProcessingState({ bidId, initial }: { bidId: string; initial: StatusPayload }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [pollError, setPollError] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrying, startRetry] = useTransition();
  const version = useRef(initial.version);

  const active = state.status === "processing";

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/bids/${bidId}/status`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as StatusPayload;
        if (cancelled) return;
        setPollError(false);
        setState(next);
        if (next.version !== version.current) {
          version.current = next.version;
          router.refresh(); // partial results landed, or the run finished
        }
        if (next.status !== "processing") return;
      } catch {
        if (!cancelled) setPollError(true);
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 1200);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [active, bidId, router]);

  if (state.status !== "processing" && state.status !== "failed") return null;

  const retry = () =>
    startRetry(async () => {
      setRetryError(null);
      const result = await retryProcessingAction(bidId);
      if (!result.ok) {
        setRetryError(result.error.message);
        return;
      }
      setState((current) => ({ ...current, status: "processing", failure: null }));
      router.refresh();
    });

  return (
    <section
      aria-label="Analysis progress"
      data-testid="processing-state"
      data-status={state.status}
      className={cn("rounded-lg border bg-card p-4 sm:p-5", state.status === "failed" ? "border-destructive/40" : "")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{state.status === "failed" ? "The analysis stopped" : "Reading your tender pack"}</h2>
        {active ? (
          <p className="font-mono text-xs text-muted-foreground tabular-nums" aria-hidden>
            {elapsedLabel(state.startedAt, now)}
          </p>
        ) : null}
      </div>
      {active ? <p className="mt-1 text-sm text-muted-foreground">Usually two to four minutes. You can leave this page — we will e-mail you when it is ready, and results appear here as they are found.</p> : null}

      <ol className="mt-4 space-y-2.5" aria-live="polite">
        {state.stages.map((entry) => {
          const failed = entry.status === "failed" || (state.status === "failed" && state.failure?.stage === entry.stage);
          const status: StageStatus = failed ? "failed" : state.status === "failed" && entry.status === "running" ? "pending" : entry.status;
          return (
            <li key={entry.stage} data-stage={entry.stage} data-stage-status={status} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                {status === "done" ? (
                  <Check aria-hidden className="size-4 text-success" />
                ) : status === "running" ? (
                  <Loader2 aria-hidden className="size-4 animate-spin text-primary motion-reduce:animate-none" />
                ) : status === "failed" ? (
                  <TriangleAlert aria-hidden className="size-4 text-destructive" />
                ) : (
                  <CircleDashed aria-hidden className="size-4 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", status === "pending" ? "text-muted-foreground" : "")}>
                  {PROCESSING_STAGE_LABELS[entry.stage]}
                  <span className="sr-only"> — {status === "done" ? "done" : status === "running" ? "in progress" : status === "failed" ? "failed" : "waiting"}</span>
                </p>
                {status === "running" || status === "done" ? <p className="text-xs text-muted-foreground">{DETAIL[entry.stage](state.counts)}</p> : null}
                {status !== "done" && entry.note && state.status !== "failed" ? <p className="text-xs text-warning">{entry.note}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {state.status === "failed" && state.failure ? (
        <div role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">
            Stopped at “{PROCESSING_STAGE_LABELS[state.failure.stage]}”
          </p>
          <p className="mt-1 text-foreground">{state.failure.message}</p>
          <p className="mt-1 text-muted-foreground">Nothing found so far has been lost. Retrying continues from this step and does not use another check from your plan.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={retry} disabled={retrying}>
              <RotateCw aria-hidden className={cn("size-3.5", retrying ? "animate-spin" : "")} />
              {retrying ? "Retrying…" : "Retry"}
            </Button>
            <a href="/contact" className="text-sm text-muted-foreground underline underline-offset-4">
              Contact support
            </a>
          </div>
          {retryError ? <p className="mt-2 text-sm text-destructive">{retryError}</p> : null}
        </div>
      ) : null}
      {pollError && active ? <p className="mt-3 text-xs text-muted-foreground">Connection lost — still trying. The analysis continues on our side.</p> : null}
    </section>
  );
}
