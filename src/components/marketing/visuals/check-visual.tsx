import { Award, FileText, Landmark, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SampleCitation, SampleDeadline, SampleNotice, SampleQuote, SampleStatus, VisualFrame } from "./parts";

type Requirement = {
  icon: LucideIcon;
  category: string;
  text: string;
  cite: string;
  verified?: boolean;
  status: "Met" | "Gap" | "Verify";
  note?: string;
  open?: boolean;
};

const requirements: Requirement[] = [
  {
    icon: ShieldCheck,
    category: "Insurance",
    text: "Public liability insurance of at least £10m for any one claim",
    cite: "T&Cs p.14",
    status: "Met",
    note: "Your cover: £10m, renews 30\u00a0Jun\u00a02027",
    open: true,
  },
  {
    icon: Landmark,
    category: "Finance",
    text: "Turnover of at least £750,000 in each of the last two years",
    cite: "SQ p.6",
    status: "Met",
  },
  {
    icon: Award,
    category: "Accreditation",
    text: "SafeContractor or an equivalent SSIP accreditation",
    cite: "Spec p.9",
    status: "Gap",
    note: "No SSIP certificate in your library",
  },
  {
    icon: FileText,
    category: "Policy",
    text: "Modern slavery statement for the current financial year",
    cite: "SQ p.11",
    verified: false,
    status: "Verify",
    note: "Verify in documents",
  },
];

/**
 * Miniature of a cited bid check (the "Brief" tab of a bid): verdict banner, pass/fail
 * requirements with status, and one citation open on its verbatim quote.
 * `compact` drops the last row so the visual stays short beside a hero headline.
 */
export function CheckVisual({ elevated = false, compact = false, className }: { elevated?: boolean; compact?: boolean; className?: string }) {
  const rows = compact ? requirements.slice(0, 3) : requirements;
  return (
    <VisualFrame
      elevated={elevated}
      className={className}
      title="Bids / Civic buildings cleaning / Brief"
      label="Sample cited bid check for a cleaning tender from Calderbrook Borough Council. Verdict: biddable with gaps. Nine of twelve pass/fail requirements are met, two are gaps and one needs verifying. The public liability requirement is shown with its quote from the terms and conditions, page 14."
    >
      <div className="p-4 sm:p-5">
        <p className="text-13 text-ink-2">Calderbrook Borough Council</p>
        <p className="mt-0.5 font-display text-lg leading-6 font-semibold text-ink sm:text-xl sm:leading-7">Cleaning and caretaking services for civic buildings 2027–2030</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <SampleNotice kind="Tender" />
          <span className="text-13 text-ink-2 tabular-nums">£1.2m · North West</span>
          <SampleDeadline tone="soon">Closes in 9 days · 22 Nov 2026, 12:00</SampleDeadline>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-card border border-accent/25 bg-accent-tint px-3.5 py-3">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <div className="min-w-0">
            <p className="text-sm leading-5 font-semibold text-ink">Biddable with gaps</p>
            <p className="mt-0.5 text-13 text-ink">You meet 9 of 12 pass/fail requirements. 2 gaps to close, 1 to verify.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line pb-2">
          <p className="text-sm font-semibold whitespace-nowrap text-ink">Pass/fail requirements</p>
          <p className="text-xs whitespace-nowrap text-ink-2 tabular-nums">12 found · 9 met · 2 gaps · 1 to verify</p>
        </div>

        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.text} className="py-3">
              <div className="flex items-start gap-3">
                <row.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-2" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {row.text} <SampleCitation verified={row.verified ?? true} active={row.open}>{row.cite}</SampleCitation>
                  </p>
                  {row.note ? (
                    <p className={cn("mt-0.5 text-xs", row.status === "Gap" ? "text-danger" : row.status === "Verify" ? "text-accent-ink" : "text-ink-2")}>{row.note}</p>
                  ) : null}
                </div>
                <SampleStatus status={row.status} />
              </div>
              {row.open ? (
                <SampleQuote
                  className="mt-3 ml-7"
                  quote="The Supplier shall maintain Public Liability insurance of not less than £10,000,000 for any one claim."
                  file="ITT Volume 2 – Terms and Conditions.pdf"
                  page={14}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </VisualFrame>
  );
}
