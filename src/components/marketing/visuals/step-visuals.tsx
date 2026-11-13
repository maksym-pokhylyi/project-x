import { Check, Search } from "lucide-react";
import type { ReactNode } from "react";
import { ScoreBars } from "@/components/ui/score-bars";
import { cn } from "@/lib/utils";

/*
 * The three small pictures of "How it works", drawn in HTML to the designer's artboard.
 * Each step has a full card (tablets and desks, above the text) and a one-line summary chip
 * (phones, below the text). They illustrate the step's own words, so they are hidden from
 * assistive technology. Fictional sample data.
 */

function StepCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div aria-hidden className={cn("flex h-full min-h-[15.25rem] flex-col rounded-lg border border-line bg-surface p-[1.125rem]", className)}>
      {children}
    </div>
  );
}

function StepChip({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="rounded-control bg-brand-tint px-3 py-2.5">
      {children}
    </div>
  );
}

function FoundCompany() {
  return (
    <>
      <p className="text-sm leading-5 font-semibold text-ink">Aldermoor &amp; Pike Building Services Ltd</p>
      <p className="mt-0.5 text-xs leading-[1.125rem] text-ink-2">Wakefield · 14 public contracts found</p>
    </>
  );
}

/** Step 1: typing a company name finds a page that already exists. */
function FindCard() {
  return (
    <StepCard className="gap-2.5">
      <div className="flex h-10 items-center gap-2.5 rounded-control border border-line-strong px-3 text-sm text-ink">
        <Search className="size-4 shrink-0 text-ink-2" strokeWidth={1.8} />
        Aldermoor &amp; Pike
      </div>
      <div className="rounded-control bg-brand-tint px-3 py-2.5">
        <FoundCompany />
      </div>
      <div className="px-3 py-1.5">
        <p className="text-sm leading-5 text-ink">Aldermoor Lane Dental Practice Ltd</p>
        <p className="mt-0.5 text-xs leading-[1.125rem] text-ink-2">Leeds · no public contracts found</p>
      </div>
    </StepCard>
  );
}

const files = [
  { name: "Vol 1 Instructions to Tenderers.pdf", pages: "38 pages" },
  { name: "Vol 2 Specification.pdf", pages: "96 pages" },
  { name: "Vol 3 Quality Questionnaire.docx", pages: "14 pages" },
] as const;

/** Step 2: the pack as the buyer sent it, read into requirements and scored questions. */
function UploadCard() {
  return (
    <StepCard>
      <ul>
        {files.map((file) => (
          <li key={file.name} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 not-first:pt-2">
            <span className="type-ref truncate text-ink">{file.name}</span>
            <span className="shrink-0 text-xs leading-[1.125rem] text-ink-2 tabular-nums">{file.pages}</span>
          </li>
        ))}
      </ul>
      <p className="pt-2.5 pb-3 text-xs leading-[1.125rem] text-ink-2">and 3 more files · 214 pages in all</p>
      <p className="mt-auto flex items-center gap-2.5 rounded-control bg-brand-tint px-3 py-2.5 text-13 font-semibold text-ink">
        <Check className="size-4 shrink-0 text-brand" strokeWidth={2.2} />
        23 requirements · 6 scored questions
      </p>
    </StepCard>
  );
}

/** "Marked 3 of 5 against the buyer's scheme": a reading of the scheme, never a forecast. */
function Mark() {
  return (
    <>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-13 leading-5 text-ink">
        <span>
          <span className="font-semibold">Marked 3 of 5</span> against the buyer’s scheme
        </span>
      </p>
      <ScoreBars filled={3} className="mt-2" />
      <p className="mt-1.5 text-xs leading-[1.125rem] text-ink-2">Two fixes to reach 4</p>
    </>
  );
}

/** Step 3: a sentence of a draft with its source marker, and the mark against the scheme. */
function DraftCard() {
  return (
    <StepCard>
      <p className="type-ref text-ink-2">Q2 · Responsive repairs · 15% · 1,000 words</p>
      <p className="mt-2.5 text-sm leading-[1.55] text-ink">
        …our engineers attended 96.2% of emergency call-outs within two hours across 4,180 jobs in 2025–26{" "}
        <span className="rounded-[3px] bg-brand-tint px-1 font-mono text-xs font-medium text-brand">2</span>
      </p>
      <p className="type-ref mt-2.5 pb-3 text-ink-2">2 · KPI report Q4 2025-26.pdf · p. 3</p>
      <div className="mt-auto border-t border-line pt-3">
        <Mark />
      </div>
    </StepCard>
  );
}

/** In step order: the card for tablets and desks, the chip for phones. */
export const stepVisuals: { card: ReactNode; chip: ReactNode }[] = [
  {
    card: <FindCard />,
    chip: (
      <StepChip>
        <FoundCompany />
      </StepChip>
    ),
  },
  {
    card: <UploadCard />,
    chip: (
      <StepChip>
        <p className="text-sm leading-5 font-semibold text-ink">23 requirements · 6 scored questions</p>
        <p className="mt-0.5 text-xs leading-[1.125rem] text-ink-2">read from 6 files, 214 pages</p>
      </StepChip>
    ),
  },
  {
    card: <DraftCard />,
    chip: (
      <StepChip>
        <Mark />
      </StepChip>
    ),
  },
];
