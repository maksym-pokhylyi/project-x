import type { ReactNode } from "react";
import { SearchIcon, TickIcon } from "@/components/ui/icons";
import { ScoreBars } from "@/components/ui/score-bars";
import { cn } from "@/lib/utils";

/*
 * The three small pictures of "How it works", drawn in HTML to the designer's artboard.
 * Each step has a full card (tablets and desks, above the text: 236 px tall, as drawn) and
 * a one-line summary chip (phones, below the text). They illustrate the step's own words,
 * so they are hidden from assistive technology. Fictional sample data.
 */

const small = "text-xs leading-[1.5] text-ink-2";

function StepCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div aria-hidden className={cn("flex h-[14.75rem] flex-col overflow-hidden rounded-lg border border-line bg-surface p-[1.125rem]", className)}>
      {children}
    </div>
  );
}

function StepChip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-0.5 rounded-control bg-brand-tint px-3 py-2.5", className)}>
      {children}
    </div>
  );
}

function FoundCompany() {
  return (
    <>
      <span className="text-sm leading-[1.5] font-semibold text-ink">Aldermoor &amp; Pike Building Services Ltd</span>
      <span className={small}>Wakefield · 14 public contracts found</span>
    </>
  );
}

/** Step 1: typing a company name finds a page that already exists. */
function FindCard() {
  return (
    <StepCard className="gap-2.5">
      <div className="flex h-10 items-center gap-2 rounded-control border border-line-strong px-3 text-sm leading-[1.5] text-ink">
        <SearchIcon className="text-ink-2" />
        <span>Aldermoor &amp; Pike</span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-control bg-brand-tint px-3 py-2.5">
        <FoundCompany />
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-1">
        <span className="text-sm leading-[1.5] text-ink">Aldermoor Lane Dental Practice Ltd</span>
        <span className={small}>Leeds · no public contracts found</span>
      </div>
    </StepCard>
  );
}

const files = [
  { name: "Vol 1 Instructions to Tenderers.pdf", pages: "38 pages" },
  { name: "Vol 2 Specification.pdf", pages: "96 pages" },
  { name: "Vol 3 Quality Questionnaire.docx", pages: "14 pages" },
] as const;

/** Step 2: the pack as the buyer sent it, checked requirement by requirement. */
function UploadCard() {
  return (
    <StepCard className="gap-[0.5625rem]">
      {files.map((file) => (
        <div key={file.name} className="flex justify-between gap-3 border-b border-line pb-[0.5625rem] text-xs leading-[1.5]">
          <span className="truncate font-mono text-ink">{file.name}</span>
          <span className="whitespace-nowrap text-ink-2">{file.pages}</span>
        </div>
      ))}
      <span className={small}>and 3 more files · 214 pages in all</span>
      <div className="mt-auto flex items-center gap-2 rounded-control bg-brand-tint px-3 py-2.5 text-13 leading-[1.5] font-semibold text-ink">
        <TickIcon className="text-brand" />
        <span>23 requirements checked · 2 gaps</span>
      </div>
    </StepCard>
  );
}

/** "Marked 3 of 5": the draft read against the buyer's scheme, and what a 4 needs. Never a forecast. */
function Mark({ onTint = false }: { onTint?: boolean }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("font-semibold text-ink", onTint ? "text-sm leading-[1.5]" : "text-13 leading-[1.5]")}>Marked 3 of 5</span>
        <span className={small}>a 4 needs two more things</span>
      </div>
      <ScoreBars filled={3} onTint={onTint} className={cn(onTint && "pb-0.5")} />
    </>
  );
}

/** Step 3: a sentence of a draft with its source marker, and the mark against the scheme. */
function DraftCard() {
  return (
    <StepCard className="gap-2.5">
      <span className="font-mono text-xs leading-[1.5] text-ink-2">Q2 · Responsive repairs · 15% · 1,000 words</span>
      <p className="text-sm leading-[1.55] text-ink">
        …our engineers attended 96.2% of emergency call-outs within two hours across 4,180 jobs in 2025–26
        <span className="ml-[0.1875rem] rounded-[3px] bg-brand-tint px-1 font-mono text-xs leading-[inherit] font-medium text-brand">3</span>
      </p>
      <span className="font-mono text-xs leading-[1.5] text-ink-2">3 · KPI report Q4 2025-26.pdf · p. 3</span>
      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
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
        <span className="text-sm leading-[1.5] font-semibold text-ink">23 requirements checked · 2 gaps</span>
        <span className={small}>read from 6 files, 214 pages</span>
      </StepChip>
    ),
  },
  {
    card: <DraftCard />,
    chip: (
      <StepChip className="gap-2">
        <Mark onTint />
      </StepChip>
    ),
  },
];
