import { Award, CalendarClock, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SampleCitation, SampleStatus } from "./parts";

/** Small titled card used for the three close-ups of a bid check. */
function DetailCard({ label, icon, title, meta, children, className }: { label: string; icon: ReactNode; title: string; meta: string; children: ReactNode; className?: string }) {
  return (
    <figure role="img" aria-label={label} className={cn("flex flex-col rounded-card border border-line bg-surface", className)}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-ink-2 [&>svg]:size-4">{icon}</span>
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="ml-auto text-xs text-ink-2 tabular-nums">{meta}</span>
      </div>
      <div className="flex-1 p-4">{children}</div>
    </figure>
  );
}

/** One requirement, close up: the gap, the buyer's exact words, the file and page. */
export function RequirementCloseup({ className }: { className?: string }) {
  return (
    <DetailCard
      className={className}
      icon={<Award aria-hidden />}
      title="Pass/fail requirement"
      meta="Accreditation"
      label="Close-up of one pass/fail requirement: SafeContractor or an equivalent SSIP accreditation, marked as a gap, with the quote from the specification, page 9."
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink">SafeContractor or an equivalent SSIP accreditation</p>
        <SampleStatus status="Gap" />
      </div>
      <blockquote className="mt-3 rounded-control border-l-2 border-brand bg-surface-sunken px-3 py-2 font-display text-base leading-6 text-ink">
        &ldquo;Bidders must hold, at the tender deadline, a current SafeContractor accreditation or an equivalent scheme registered with SSIP. Bids without it will be
        rejected.&rdquo;
      </blockquote>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <SampleCitation>Spec p.9</SampleCitation>
        <span className="type-ref text-ink-2">
          ITT Volume 1 – Specification.pdf · <span className="whitespace-nowrap">page 9</span>
        </span>
      </div>
      <p className="mt-3 border-t border-line pt-3 text-13 text-ink-2">
        <span className="font-medium text-ink">Checked against your company:</span> no SSIP certificate in your library. Add one, or decide not to bid.
      </p>
    </DetailCard>
  );
}

const dates = [
  { label: "Clarification questions close", date: "14 Nov 2026, 17:00", cite: "ITT p.4", flag: "Tomorrow" },
  { label: "Site visits", date: "17–18 Nov 2026", cite: "ITT p.5" },
  { label: "Tender deadline", date: "22 Nov 2026, 12:00", cite: "ITT p.4", flag: "9 days" },
  { label: "Award decision", date: "w/c 11 Jan 2027", cite: "ITT p.5" },
  { label: "Contract start", date: "1 Apr 2027", cite: "T&Cs p.3" },
];

/** Key dates, each with the page it was read from. */
export function KeyDatesCard({ className }: { className?: string }) {
  return (
    <DetailCard
      className={className}
      icon={<CalendarClock aria-hidden />}
      title="Key dates"
      meta="5 found"
      label="Key dates from the tender pack, each with its page reference: clarification questions close 14 November 2026, site visits 17 to 18 November, tender deadline 22 November 2026 at 12:00, award decision in the week of 11 January 2027, contract start 1 April 2027."
    >
      <ul className="-my-2 divide-y divide-line">
        {dates.map((item) => (
          <li key={item.label} className="py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-13 text-ink-2">{item.label}</p>
              <SampleCitation>{item.cite}</SampleCitation>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink tabular-nums">
              <span className="whitespace-nowrap">{item.date}</span>
              {item.flag ? <span className="rounded-control bg-accent-tint px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-accent-ink">{item.flag}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </DetailCard>
  );
}

const questions = [
  { ref: "Q1", title: "Mobilisation and transition", weight: 15, limit: "500 words" },
  { ref: "Q2", title: "Quality management", weight: 20, limit: "750 words" },
  { ref: "Q3", title: "Staffing, training and TUPE", weight: 15, limit: "500 words" },
  { ref: "Q4", title: "Social value", weight: 10, limit: "500 words" },
];

/** The scored questions with weightings and word limits. */
export function QuestionsCard({ className }: { className?: string }) {
  return (
    <DetailCard
      className={className}
      icon={<ListChecks aria-hidden />}
      title="Scored questions"
      meta="4 found"
      label="Scored questions from the tender pack with weightings and word limits: Q1 mobilisation and transition, 15 percent, 500 words; Q2 quality management, 20 percent, 750 words; Q3 staffing, training and TUPE, 15 percent, 500 words; Q4 social value, 10 percent, 500 words."
    >
      <ul className="-my-2 divide-y divide-line">
        {questions.map((question) => (
          <li key={question.ref} className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-sm text-ink">
                <span className="type-ref mr-2 font-medium text-ink-2">{question.ref}</span>
                {question.title}
              </p>
              <span className="shrink-0 text-sm font-medium text-ink tabular-nums">{question.weight}%</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${(question.weight / 20) * 100}%` }} />
              </span>
              <span className="w-20 shrink-0 text-right text-xs text-ink-2 tabular-nums">{question.limit}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-13 text-ink-2">
        Quality 60%, price 40%. Marked 0 to 5; an answer below 2 fails the bid. <SampleCitation>ITT p.12</SampleCitation>
      </p>
    </DetailCard>
  );
}
