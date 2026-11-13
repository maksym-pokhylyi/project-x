import { CircleAlert, ClipboardCheck } from "lucide-react";
import type { ReactNode } from "react";
import { SampleButton, VisualFrame } from "./parts";

/** Source marker: a small numbered reference to a document in the evidence library. */
function Source({ n }: { n: number }) {
  return (
    <sup className="type-ref top-0 mx-0.5 rounded-xs bg-brand-tint px-1 py-px align-[0.2em] leading-none font-medium text-brand">{n}</sup>
  );
}

/** "Evidence needed" highlight: a gap shown as a gap. */
function EvidenceNeeded({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded-xs bg-accent-tint box-decoration-clone px-1 py-0.5 text-ink">
      <span className="font-sans text-xs font-semibold text-accent-ink">Evidence needed: </span>
      {children}
    </mark>
  );
}

/**
 * Miniature of the answer editor: the question with its weighting and word limit, a draft
 * with source markers and an "Evidence needed" gap, the live word count, and the evaluator
 * panel with a score band and two improvements.
 */
export function AnswerEditorVisual({ className }: { className?: string }) {
  return (
    <VisualFrame
      className={className}
      title="Bids / Civic buildings cleaning / Q1"
      label="Sample answer editor for question 1, mobilisation and transition, worth 15 percent with a 500 word limit. The draft is 487 words, cites two documents from the evidence library and highlights one place where evidence is needed. The evaluator panel marks it 3 of 5, Good, and lists two improvements."
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="type-ref rounded-control bg-surface-sunken px-1.5 py-0.5 font-medium text-ink-2">Q1</span>
            <span className="text-13 text-ink-2 tabular-nums">Weighting 15% · Limit 500 words</span>
            <span className="ml-auto rounded-control bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">Draft</span>
          </div>
          <p className="mt-2 text-sm font-medium text-ink">
            Describe your approach to mobilisation and transition, including how you will manage staff transferring under TUPE.
          </p>

          <div className="mt-4 flex-1 space-y-3 rounded-card border border-line bg-paper p-4 font-display text-base leading-6 text-ink">
            <p>
              We will mobilise in six weeks, led by our Operations Manager, who has run eleven council mobilisations since 2019.
              <Source n={1} /> A dated plan covers staff consultation, site surveys, key holding and the first-day checks at each of the nine buildings.
            </p>
            <p>
              Every transferring employee is offered a one-to-one meeting within ten working days of award, and keeps their existing terms.
              <Source n={2} /> <EvidenceNeeded>number of staff transferred under TUPE on a previous contract, and how many stayed after six months.</EvidenceNeeded>
            </p>
            <p className="max-sm:hidden">
              On the first day a supervisor is present in every building until the opening clean has been checked against the specification and signed off with the
              site contact.
              <Source n={1} />
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full w-[97%] rounded-full bg-accent" />
            </span>
            <span className="shrink-0 text-13 font-medium text-accent-ink tabular-nums">487 / 500 words</span>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            <span>
              <Source n={1} /> Case study – Northmere offices.docx
            </span>
            <span>
              <Source n={2} /> TUPE and onboarding policy.pdf
            </span>
          </p>
        </div>

        <div className="border-t border-line bg-surface-sunken p-4 sm:p-5 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-2">
            <ClipboardCheck aria-hidden className="size-4 text-ink-2" />
            <span className="text-sm font-semibold text-ink">Evaluator</span>
          </div>
          <p className="mt-3 font-display text-2xl leading-8 font-semibold text-ink tabular-nums">
            3 of 5 <span className="text-ink-2">—</span> Good
          </p>
          <p className="mt-1 text-xs text-ink-2">Read against the buyer&apos;s scoring guide. A second read, not a prediction.</p>

          <ol className="mt-4 space-y-3">
            <li className="rounded-card border border-line bg-surface p-3">
              <p className="text-13 text-ink">
                <span className="mr-1.5 font-semibold tabular-nums">1.</span>Add the TUPE figures. The guide gives 4 or more only for &ldquo;evidence of outcomes on comparable contracts&rdquo;.
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-accent-ink">
                  <CircleAlert aria-hidden className="size-3" /> Needs evidence
                </span>
                <SampleButton className="h-7 px-2.5 text-xs">Add evidence</SampleButton>
              </div>
            </li>
            <li className="rounded-card border border-line bg-surface p-3">
              <p className="text-13 text-ink">
                <span className="mr-1.5 font-semibold tabular-nums">2.</span>Name the mobilisation lead and their role on day one. The question asks for &ldquo;named responsibilities&rdquo;.
              </p>
              <div className="mt-2 flex justify-end">
                <SampleButton className="h-7 px-2.5 text-xs">Apply</SampleButton>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </VisualFrame>
  );
}
