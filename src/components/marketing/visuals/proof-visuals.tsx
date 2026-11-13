import { AlertCircleIcon, ArrowDownIcon, TickSmallIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/*
 * The proof of the cited bid check, drawn in HTML to the designer's artboard: a page of the
 * buyer's specification with one sentence highlighted, and the same sentence as it appears
 * in the check — quoted, with file, page and clause, its verification state, and the check
 * against the supplier's own documents. Fictional sample data.
 */

const QUOTE = "All operatives working in occupied buildings must hold an Enhanced DBS certificate issued within the three years before the Contract Commencement Date.";

/**
 * A page of the tender pack. Deliberately not in the product's typefaces: it is the buyer's
 * document (Arial, square corners), so the quote visibly comes from somewhere else.
 * Phones show the one clause; from 640 px the page around it.
 */
export function DocumentExcerpt({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="Page 31 of the buyer’s specification. In clause 7.4.2, the sentence about Enhanced DBS certificates is highlighted."
      className={cn(
        "flex flex-col gap-2.5 border border-line bg-surface px-[1.125rem] py-4 font-[Arial,Helvetica,sans-serif] text-13 leading-[1.55] text-ink-2 sm:gap-3 sm:px-11 sm:pt-9 sm:pb-7 sm:leading-[1.6] sm:shadow-[0_1px_2px_rgb(22_26_29/0.05),0_20px_40px_-28px_rgb(22_26_29/0.25)]",
        className,
      )}
    >
      <div className="flex justify-between gap-3 border-b border-line pb-2 text-xs leading-[inherit] sm:gap-4 sm:pb-2.5">
        <span className="hidden sm:inline">Planned and Responsive Maintenance 2027–2031</span>
        <span>Volume 2: Specification</span>
        <span className="sm:hidden">Page 31 of 96</span>
      </div>
      <p className="hidden pt-1.5 text-sm leading-[inherit] font-bold text-ink sm:block">7.4 Safeguarding and vetting</p>
      <p className="hidden sm:block">
        7.4.1 The Contractor shall comply with the Council’s Safeguarding Policy (Appendix H) at all times when working in schools, libraries, children’s centres and
        sheltered housing schemes.
      </p>
      <p>
        7.4.2 <span className="bg-brand-mark box-decoration-clone py-0.5 text-ink">{QUOTE}</span> The Contractor shall keep a register of certificates and provide
        it to the Council within two Working Days of a request.
      </p>
      <p className="hidden sm:block">7.4.3 Operatives awaiting a certificate may attend site only when accompanied at all times by a vetted supervisor.</p>
      <p className="hidden pt-1.5 text-sm leading-[inherit] font-bold text-ink sm:block">7.5 Identification</p>
      <p className="hidden sm:block">
        7.5.1 All operatives shall wear photographic identification showing the Contractor’s name and the operative’s name, and shall present it on request to any
        building user.
      </p>
      <div className="mt-1 hidden justify-between border-t border-line pt-3.5 text-xs leading-[inherit] sm:flex">
        <span>Calderbrook Metropolitan Borough Council</span>
        <span>Page 31 of 96</span>
      </div>
    </figure>
  );
}

/** "↓ appears in your check as" — shown between the two pictures when they are stacked. */
export function ProofBridge({ children, className }: { children: string; className?: string }) {
  return (
    <p aria-hidden className={cn("flex items-center justify-center gap-2 text-13 leading-[1.5] text-ink-2", className)}>
      <ArrowDownIcon />
      <span>{children}</span>
    </p>
  );
}

const reference = [
  /* Bases as in the artboard, where they measure the text box: 220 / 90 / 90 px plus the 32 px of padding (and the 1 px rule). */
  { term: "File", value: "Vol 2 Specification.pdf", className: "basis-full border-b sm:flex-[2_1_15.75rem] sm:border-b-0" },
  { term: "Page", value: "31 of 96", className: "flex-1 sm:flex-[1_1_7.6875rem] sm:border-l" },
  { term: "Clause", value: "7.4.2", className: "flex-1 border-l sm:flex-[1_1_7.6875rem]" },
] as const;

/** The same sentence as a line of the check: quoted, cited, verified against the file, and checked. */
export function RequirementCard({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="The same requirement in a cited bid check: R-14, mandatory, pass or fail. The buyer’s sentence is quoted exactly, with its file (Vol 2 Specification.pdf), page (31 of 96) and clause (7.4.2). Verified: the quote matches the file word for word. Checked against your company: gap, no evidence found."
      className={cn("flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:gap-[1.375rem] sm:px-8 sm:py-[1.875rem]", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-13 leading-[1.5] font-medium text-ink sm:mr-1.5">R-14</span>
        <span className="rounded-chip border border-ink px-2 py-0.5 text-xs leading-[1.5] font-semibold text-ink">Mandatory</span>
        <span className="rounded-chip bg-paper-deep px-2 py-[0.1875rem] text-xs leading-[1.5] font-semibold text-ink">Pass or fail</span>
      </div>

      <p className="type-quote-lg text-ink">“{QUOTE}”</p>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap rounded-control border border-line bg-paper">
          {reference.map((item) => (
            <div key={item.term} className={cn("flex min-w-0 flex-col gap-0.5 border-line px-3.5 py-2.5 sm:px-4 sm:py-3", item.className)}>
              <span className="text-xs leading-[1.5] text-ink-2">{item.term}</span>
              <span className="truncate font-mono text-sm leading-[1.5] font-medium text-ink">{item.value}</span>
            </div>
          ))}
        </div>
        {/* The verification state of the reference: the quote was found in the file, character for character. */}
        <p className="flex items-center gap-1.5 text-13 leading-[1.5] text-ink">
          <TickSmallIcon className="text-brand" />
          <span>
            <span className="font-semibold">Verified.</span> <span className="sm:hidden">Matches the file word for word.</span>
            <span className="hidden sm:inline">The quote matches the file word for word.</span>
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-4 sm:pt-5">
        <span className="text-13 leading-[1.5] font-semibold text-ink">Checked against your company</span>
        <div className="flex gap-2.5 rounded-control bg-danger-tint px-3.5 py-3 sm:gap-3 sm:px-4 sm:py-3.5">
          <AlertCircleIcon className="mt-px text-danger" />
          <div className="flex flex-col gap-1">
            <span className="text-15 leading-[1.5] font-semibold text-danger">Gap: no evidence found</span>
            <span className="text-sm leading-[1.5] text-ink">None of the 12 documents you have uploaded contains a DBS register or certificate dates. Add one before you answer Q3.</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
