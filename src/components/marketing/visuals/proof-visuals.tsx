import { ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/*
 * The proof of the cited bid check, drawn in HTML to the designer's artboard: a page of the
 * buyer's specification with one sentence highlighted, and the same sentence as it appears
 * in the check — quoted, with file, page and clause, and checked against the supplier's own
 * documents. Fictional sample data.
 */

const QUOTE = "All operatives working in occupied buildings must hold an Enhanced DBS certificate issued within the three years before the Contract Commencement Date.";

/**
 * A page of the tender pack. Deliberately not in the product's typefaces: it is the buyer's
 * document (Arial, square corners), so the quote visibly comes from somewhere else.
 */
export function DocumentExcerpt({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="Page 31 of the buyer’s specification. In clause 7.4.2, the sentence about Enhanced DBS certificates is highlighted."
      className={cn(
        "border border-line bg-surface px-5 pt-4 pb-4 font-[Arial,Helvetica,sans-serif] text-13 leading-[1.6] text-ink-2 shadow-[0_1px_2px_rgb(22_26_29/0.05),0_20px_40px_-28px_rgb(22_26_29/0.25)] sm:px-11 sm:pt-9 sm:pb-7",
        className,
      )}
    >
      <div className="flex justify-between gap-4 border-b border-line pb-3 text-xs sm:pb-3.5">
        <span className="hidden sm:inline">Planned and Responsive Maintenance 2027–2031</span>
        <span>Volume 2: Specification</span>
        <span className="sm:hidden">Page 31 of 96</span>
      </div>
      <div className="flex flex-col gap-2.5 pt-3 sm:gap-3 sm:pt-4">
        <p className="hidden pt-1.5 text-sm font-bold text-ink sm:block">7.4 Safeguarding and vetting</p>
        <p className="hidden sm:block">
          7.4.1 The Contractor shall comply with the Council’s Safeguarding Policy (Appendix H) at all times when working in schools, libraries, children’s centres
          and sheltered housing schemes.
        </p>
        <p>
          7.4.2 <span className="bg-brand-mark box-decoration-clone py-0.5 text-ink">{QUOTE}</span> The Contractor shall keep a register of certificates and
          provide it to the Council within two Working Days of a request.
        </p>
        <p className="hidden sm:block">7.4.3 Operatives awaiting a certificate may attend site only when accompanied at all times by a vetted supervisor.</p>
        <p className="hidden pt-1.5 text-sm font-bold text-ink sm:block">7.5 Identification</p>
        <p className="hidden sm:block">
          7.5.1 All operatives shall wear photographic identification showing the Contractor’s name and the operative’s name, and shall present it on request to
          any building user.
        </p>
      </div>
      <div className="mt-4 hidden justify-between gap-4 border-t border-line pt-3.5 text-xs sm:flex">
        <span>Calderbrook Metropolitan Borough Council</span>
        <span>Page 31 of 96</span>
      </div>
    </figure>
  );
}

/** "↓ appears in your check as" — shown between the two pictures when they are stacked. */
export function ProofBridge({ children, className }: { children: string; className?: string }) {
  return (
    <p aria-hidden className={cn("flex items-center justify-center gap-2 text-13 text-ink-2", className)}>
      <ArrowDown className="size-3.5" strokeWidth={1.8} />
      {children}
    </p>
  );
}

/** The same sentence as a line of the check: quoted, cited, and checked. */
export function RequirementCard({ className }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="The same requirement in a cited bid check: R-14, mandatory, pass or fail. The buyer’s sentence is quoted exactly, with its file (Vol 2 Specification.pdf), page (31 of 96) and clause (7.4.2). Checked against your documents: gap, no evidence found."
      className={cn("flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:gap-[1.375rem] sm:px-8 sm:py-[1.875rem]", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1.5 font-mono text-13 font-medium text-ink">R-14</span>
        <Badge variant="strong">Mandatory</Badge>
        <Badge variant="outline">Pass / fail</Badge>
      </div>

      <p className="type-quote-lg tracking-[-0.005em] text-ink">“{QUOTE}”</p>

      <div className="grid grid-cols-2 rounded-control border border-line bg-paper sm:grid-cols-[2fr_1fr_1fr]">
        {[
          { term: "File", value: "Vol 2 Specification.pdf", className: "col-span-2 sm:col-span-1" },
          { term: "Page", value: "31 of 96", className: "border-t border-line sm:border-t-0 sm:border-l" },
          { term: "Clause", value: "7.4.2", className: "border-t border-l border-line sm:border-t-0" },
        ].map((item) => (
          <div key={item.term} className={cn("min-w-0 px-4 py-3", item.className)}>
            <p className="text-xs leading-[1.125rem] text-ink-2">{item.term}</p>
            <p className="mt-0.5 truncate font-mono text-sm leading-5 font-medium text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-5">
        <p className="text-13 font-semibold text-ink">Checked against your documents</p>
        <div className="flex gap-3 rounded-control bg-danger-tint px-4 py-3.5">
          <svg viewBox="0 0 20 20" className="mt-px size-5 shrink-0 fill-none stroke-danger stroke-[1.8] [stroke-linecap:round]">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 5.8v5M10 13.8v.4" />
          </svg>
          <div className="flex flex-col gap-1">
            <p className="text-15 leading-[1.375rem] font-semibold text-danger">Gap: no evidence found</p>
            <p className="text-sm leading-[1.3125rem] text-ink">
              None of the 12 documents you have uploaded contains a DBS register or certificate dates. Add one before you answer Q3.
            </p>
          </div>
        </div>
      </div>
    </figure>
  );
}
