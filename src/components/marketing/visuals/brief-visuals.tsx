import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { cn } from "@/lib/utils";

/*
 * Pictures of a cited bid check, drawn in HTML to the designer's bid brief artboard
 * (docs/design/handoff/Brief-*): the verdict panel, the key dates and the scored questions.
 * Each is exposed to assistive technology as one described image. Fictional sample data.
 */

function CircleIcon({ tone, children }: { tone: "brand" | "danger" | "info"; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={cn(
        "mt-px size-5 shrink-0 fill-none stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]",
        tone === "brand" && "stroke-brand",
        tone === "danger" && "stroke-danger",
        tone === "info" && "stroke-info",
      )}
    >
      <circle cx="10" cy="10" r="8" />
      {children}
    </svg>
  );
}

/** The verdict that opens every check: a plain sentence, its three reasons and the count. */
export function VerdictPanel({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="Sample verdict of a cited bid check: worth bidding, if you close two gaps first. 19 of the 23 pass-or-fail requirements are met by your documents, 2 are for you to confirm and 2 are gaps: no DBS register and no Cyber Essentials certificate. At £4.2m the contract is more than twice your largest."
      className={cn("rounded-modal bg-brand-tint p-5 sm:px-8 sm:py-7", className)}
    >
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-13 text-ink">
        <Badge className="text-13">Verdict</Badge>
        <span>Based on the whole pack and the 12 documents you have uploaded</span>
      </p>
      <p className="mt-3 font-display text-26 leading-[1.15] font-semibold tracking-[-0.015em] text-balance text-ink sm:text-32">
        Worth bidding, if you close two gaps first.
      </p>
      <ul className="mt-4 flex flex-col gap-2.5 text-15 text-ink">
        <li className="flex gap-2.5">
          <CircleIcon tone="brand">
            <path d="M6.3 10.3l2.6 2.6 4.8-5" />
          </CircleIcon>
          <span>
            <span className="font-semibold">You can comply.</span> 19 of the 23 pass-or-fail requirements are already met by your documents, and nothing in the pack
            rules you out.
          </span>
        </li>
        <li className="flex gap-2.5">
          <CircleIcon tone="danger">
            <path d="M10 5.8v5M10 13.8v.4" />
          </CircleIcon>
          <span>
            <span className="font-semibold">Two gaps.</span> No DBS register (<span className="font-mono text-13">R-14</span>) and no Cyber Essentials certificate (
            <span className="font-mono text-13">R-09</span>). Both must be in place by the deadline.
          </span>
        </li>
        <li className="flex gap-2.5">
          <CircleIcon tone="info">
            <path d="M10 9.2v4.6M10 6v.4" />
          </CircleIcon>
          <span>
            <span className="font-semibold">A stretch on size.</span> At £4.2m this is more than twice your largest contract (£1.85m). Expect to be marked on capacity
            in Q4.
          </span>
        </li>
      </ul>
      <div className="mt-5 flex flex-col gap-2">
        <div className="flex h-2 gap-[3px]">
          <span className="flex-[19_1_0] rounded-l-full bg-brand" />
          <span className="flex-[2_1_0] bg-info" />
          <span className="flex-[2_1_0] rounded-r-full bg-danger" />
        </div>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-13 text-ink">
          <span>
            <span className="font-semibold">19</span> met
          </span>
          <span>
            <span className="font-semibold">2</span> for you to confirm
          </span>
          <span>
            <span className="font-semibold">2</span> gaps
          </span>
          <span className="text-ink-2">of 23 pass-or-fail requirements</span>
        </p>
      </div>
    </figure>
  );
}

function Fact({ term, children, source, first = false }: { term: string; children: ReactNode; source?: string; first?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5 py-3", !first && "border-t border-line")}>
      <p className="text-xs leading-[1.125rem] text-ink-2">{term}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-15 text-ink">
        {children}
        {source ? <span className="ml-auto font-mono text-xs text-ink-2 underline decoration-line-strong underline-offset-[3px]">{source}</span> : null}
      </div>
    </div>
  );
}

/** Key dates and the scoring model, each with the page it was read from. */
export function KeyDatesCard({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="Sample key facts of a tender, each with the page it was read from: tender deadline 27 November 2026 at noon, 14 days left; clarification questions by 18 November 2026 at 17:00, 5 days left; value £4.2m estimated over four years; marked on quality 50%, price 40% and social value 10%."
      className={cn("rounded-card border border-line bg-surface px-5 py-1.5", className)}
    >
      <Fact term="Tender deadline" source="Vol 1 · p. 4" first>
        <DeadlineMarker size="lg" left="14 days left">
          27 Nov 2026, 12:00 noon
        </DeadlineMarker>
      </Fact>
      <Fact term="Clarification questions by" source="Vol 1 · p. 5">
        <DeadlineMarker size="lg" left="5 days left">
          18 Nov 2026, 17:00
        </DeadlineMarker>
      </Fact>
      <Fact term="Value and term" source="Vol 1 · p. 3">
        <p>
          <span className="font-semibold">£4.2m estimated.</span> 1 Apr 2027 to 31 Mar 2031, with an option of two more years.
        </p>
      </Fact>
      <Fact term="How it is marked" source="Vol 1 · pp. 13–14">
        <p>
          <span className="font-semibold">Quality 50%, price 40%, social value 10%.</span> Answers scored 0 to 5.
        </p>
      </Fact>
    </figure>
  );
}

const scored = [
  { ref: "Q1", title: "Mobilisation and contract management", meta: "10% · limit 750 words" },
  { ref: "Q2", title: "Delivering responsive repairs within target times", meta: "15% · limit 1,000 words" },
  { ref: "Q3", title: "Health, safety and working in occupied buildings", meta: "10% · limit 750 words", flag: "waiting on gap R-14" },
  { ref: "Q4", title: "Resources, capacity and supply chain", meta: "10% · limit 750 words" },
  { ref: "Q5", title: "Customer care and complaints", meta: "5% · limit 500 words" },
  { ref: "Q6", title: "Social value", meta: "10% · limit 750 words" },
] as const;

/** The questions the buyer will mark, with weighting and word limit. */
export function ScoredQuestionsCard({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="Sample list of the six scored questions in a tender, each with its weighting and word limit. Question 3, on health and safety, is waiting on gap R-14."
      className={cn("rounded-card border border-line bg-surface", className)}
    >
      <ul className="divide-y divide-line">
        {scored.map((question) => (
          <li key={question.ref} className="px-5 py-3">
            <p className="text-15 leading-[1.375rem] font-semibold text-ink">
              <span className="mr-2 font-mono text-13 font-normal text-ink-2">{question.ref}</span>
              {question.title}
            </p>
            <p className="mt-0.5 text-13 text-ink-2">
              {question.meta}
              {"flag" in question ? <span className="font-semibold text-danger"> · {question.flag}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </figure>
  );
}
