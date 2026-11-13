"use client";

import "./bid-theme.css";
import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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

/** The line under each stage: real counts only, never an estimate. */
function detail(stage: ProcessingStage, status: StageStatus, counts: StatusPayload["counts"]): string {
  const done = status === "done";
  switch (stage) {
    case "reading":
      return status === "pending" ? "Starts in a moment" : `${counts.filesRead} of ${counts.files} file${counts.files === 1 ? "" : "s"} read`;
    case "requirements":
      return status === "pending" ? "Starts when the files are read" : counts.requirements > 0 ? `${counts.requirements} found${done ? "" : " so far"}` : "Two independent readings of the whole pack";
    case "questions":
      return status === "pending" ? "Starts when the files are read" : counts.questions > 0 ? `${counts.questions} found${done ? "" : " so far"}` : "Including questionnaires and response forms";
    case "company":
      return status === "pending" ? "Starts when the questions are listed" : done ? "Checked" : "Comparing each requirement with your company facts";
  }
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "done") {
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" role="img" aria-label="Done" className="mt-px shrink-0">
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--brand)" strokeWidth="1.8" />
        <path d="M6.3 10.3l2.6 2.6 4.8-5" fill="none" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" role="img" aria-label="Stopped" className="mt-px shrink-0">
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--danger)" strokeWidth="1.8" />
        <path d="M10 5.8v5M10 13.8v.4" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return status === "running" ? (
    <svg viewBox="0 0 20 20" width="20" height="20" role="img" aria-label="In progress" className="mt-px shrink-0">
      <circle cx="10" cy="10" r="7.2" fill="none" stroke="var(--ink)" strokeWidth="3.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" width="20" height="20" role="img" aria-label="Waiting" className="mt-px shrink-0">
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
    </svg>
  );
}

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

  const stages = state.stages.map((entry) => {
    const failed = entry.status === "failed" || (state.status === "failed" && state.failure?.stage === entry.stage);
    const status: StageStatus = failed ? "failed" : state.status === "failed" && entry.status === "running" ? "pending" : entry.status;
    return { ...entry, status };
  });
  const current = stages.findIndex((entry) => entry.status === "running" || entry.status === "failed");
  const stageNumber = current >= 0 ? current + 1 : Math.min(stages.length, stages.filter((entry) => entry.status === "done").length + 1);

  return (
    <section aria-labelledby="progress-h" data-testid="processing-state" data-status={state.status} className={cn("bid-card bid-scope px-5 py-6 sm:px-7", state.status === "failed" ? "border-danger" : "")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="progress-h" className="bid-h3">
          {state.status === "failed" ? "The check stopped" : "Building the check"}{" "}
          <span className="font-normal text-ink-2">
            · stage {stageNumber} of {stages.length}
          </span>
        </h2>
        {active ? (
          <p className="bid-mono text-xs text-ink-2 tabular-nums" aria-hidden>
            {elapsedLabel(state.startedAt, now)}
          </p>
        ) : null}
      </div>

      <ol className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-x-6 gap-y-5" aria-live="polite">
        {stages.map((entry) => (
          <li key={entry.stage} data-stage={entry.stage} data-stage-status={entry.status} aria-current={entry.status === "running" ? "step" : undefined} className="flex flex-col gap-3.5">
            <span
              aria-hidden
              className={cn("h-1.5 rounded-chip", entry.status === "done" ? "bg-brand" : entry.status === "running" ? "bg-ink motion-safe:animate-pulse" : entry.status === "failed" ? "bg-danger" : "bg-line")}
            />
            <div className="flex gap-2.5">
              <StageIcon status={entry.status} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("text-15", entry.status === "running" ? "font-semibold" : "font-medium", entry.status === "pending" ? "text-ink-2" : "")}>{PROCESSING_STAGE_LABELS[entry.stage]}</span>
                <span className={cn("text-13 tabular-nums", entry.status === "running" ? "" : "text-ink-2")}>{detail(entry.stage, entry.status, state.counts)}</span>
                {entry.status !== "done" && entry.note && state.status !== "failed" ? <span className="text-13 text-accent-ink">{entry.note}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {active ? (
        <p className="mt-5 border-t border-line pt-4 text-15">
          You can leave this page. The check carries on, and it will be here when you come back. It usually takes two to four minutes; we e-mail you when it is ready.
        </p>
      ) : null}

      {state.status === "failed" && state.failure ? (
        <div role="alert" className="mt-5 rounded-card bg-danger-tint px-4 py-3.5 text-sm">
          <p className="font-semibold text-danger">Stopped at “{PROCESSING_STAGE_LABELS[state.failure.stage]}”</p>
          <p className="mt-1">{state.failure.message}</p>
          <p className="mt-1">Nothing found so far has been lost. Trying again continues from this stage and does not use another check from your plan.</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button type="button" className="bid-btn bid-btn-primary bid-btn-sm" onClick={retry} disabled={retrying} data-testid="retry-check">
              <RotateCw aria-hidden className={cn("size-4", retrying ? "animate-spin" : "")} />
              {retrying ? "Trying again…" : "Try again"}
            </button>
            <a href="/contact" className="bid-link text-sm font-medium">
              Contact support
            </a>
          </div>
          {retryError ? <p className="mt-2 text-sm text-danger">{retryError}</p> : null}
        </div>
      ) : null}
      {pollError && active ? <p className="mt-3 text-13 text-ink-2">Connection lost — still trying. The check carries on at our end.</p> : null}
    </section>
  );
}
