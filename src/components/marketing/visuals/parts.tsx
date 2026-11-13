import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/*
 * Building blocks for the product visuals on the marketing pages.
 *
 * The visuals are real HTML and CSS, drawn with the same tokens as the product, and filled
 * with clearly fictional sample data. Each one is exposed to assistive technology as a single
 * image with a description (role="img"), so nothing inside is focusable or announced as page
 * content — which is why these parts are spans and divs, never buttons or links.
 */

/** The frame around a product visual: a hairline card with a slim title bar. */
export function VisualFrame({
  label,
  title,
  elevated = false,
  className,
  children,
}: {
  /** Description for screen readers: what the visual shows. */
  label: string;
  /** Path-like caption in the title bar. */
  title: string;
  /** Overlay shadow: only for the one visual that leads a page. */
  elevated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure
      role="img"
      aria-label={label}
      className={cn("overflow-hidden rounded-modal border border-line bg-surface text-left", elevated ? "shadow-overlay" : "shadow-raised", className)}
    >
      <div className="flex h-9 items-center gap-2 border-b border-line bg-surface-sunken px-3">
        <LogoMark size={16} />
        <span className="type-ref min-w-0 truncate text-ink-2">{title}</span>
        <span className="ml-auto shrink-0 text-xs text-ink-2">Sample data</span>
      </div>
      {children}
    </figure>
  );
}

/** Deadline chip (DESIGN.md §5): relative time + absolute date; colour by urgency. */
export function SampleDeadline({ tone, children, className }: { tone: "neutral" | "soon" | "closing"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-control px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap",
        tone === "neutral" && "bg-surface-sunken text-ink-2",
        tone === "soon" && "bg-accent-tint text-accent-ink",
        tone === "closing" && "bg-danger-tint text-danger",
        className,
      )}
    >
      <Clock aria-hidden className="size-3 shrink-0" />
      {children}
    </span>
  );
}

/** Notice type in the buyer's language. */
export function SampleNotice({ kind }: { kind: "Tender" | "Early notice" | "Award" | "Direct award" | "Framework" }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-control px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap",
        kind === "Tender" && "bg-brand-tint text-brand",
        kind === "Early notice" && "bg-info-tint text-info",
        kind === "Award" && "bg-success-tint text-success",
        kind === "Direct award" && "bg-surface-sunken text-ink-2",
        kind === "Framework" && "border border-line-strong bg-surface text-ink-2",
      )}
    >
      {kind}
    </span>
  );
}

const statusStyles = {
  Met: { className: "bg-success-tint text-success", Icon: CircleCheck },
  Gap: { className: "bg-danger-tint text-danger", Icon: CircleAlert },
  Verify: { className: "bg-accent-tint text-accent-ink", Icon: CircleHelp },
  Unknown: { className: "bg-surface-sunken text-ink-2", Icon: CircleDashed },
} as const;

/** Requirement status: icon + word, never colour alone. */
export function SampleStatus({ status }: { status: keyof typeof statusStyles }) {
  const { className, Icon } = statusStyles[status];
  return (
    <span className={cn("inline-flex w-fit shrink-0 items-center gap-1 rounded-control px-2 py-0.5 text-xs leading-4 font-medium", className)}>
      <Icon aria-hidden className="size-3" />
      {status}
    </span>
  );
}

/** Citation mark: a small reference such as [Spec p.14]. Hollow when not verified against the source text. */
export function SampleCitation({ children, verified = true, active = false }: { children: ReactNode; verified?: boolean; active?: boolean }) {
  return (
    <span
      className={cn(
        "type-ref inline-flex shrink-0 items-center gap-1 rounded-control border px-1.5 py-0.5 font-medium whitespace-nowrap",
        verified ? "border-brand/25 bg-brand-tint text-brand" : "border-dashed border-accent bg-surface text-accent-ink",
        active && "border-brand ring-2 ring-brand/20",
      )}
    >
      {verified ? null : <span aria-hidden className="size-1.5 rounded-full border border-current" />}
      {children}
    </span>
  );
}

/** The verbatim quote on a sunken block, with file name and page. */
export function SampleQuote({ quote, file, page, className }: { quote: string; file: string; page: number; className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-3 shadow-overlay", className)}>
      <p className="type-eyebrow text-ink-2">Quoted from the buyer&apos;s documents</p>
      <blockquote className="mt-2 rounded-control border-l-2 border-brand bg-surface-sunken px-3 py-2 font-display text-base leading-6 text-ink">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="type-ref text-ink-2">
          {file} · <span className="whitespace-nowrap">page {page}</span>
        </span>
        <span className="text-13 font-medium text-brand underline decoration-brand/45 underline-offset-[0.2em]">Open source page</span>
      </div>
    </div>
  );
}

/** Stat block: big tabular number + label + small context line. */
export function SampleStat({ value, label, context }: { value: string; label: string; context?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-display text-2xl leading-8 font-semibold text-ink tabular-nums">{value}</div>
      <div className="text-13 font-medium text-ink">{label}</div>
      {context ? <div className="text-xs text-ink-2">{context}</div> : null}
    </div>
  );
}

/** A button-shaped label inside a visual (not interactive). */
export function SampleButton({ variant = "outline", children, className }: { variant?: "primary" | "outline" | "quiet"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-control px-3 text-13 font-medium whitespace-nowrap",
        variant === "primary" && "bg-brand text-white",
        variant === "outline" && "border border-line-strong bg-surface text-ink",
        variant === "quiet" && "text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "Why it matches" line under a tender title. */
export function SampleMatchReason({ children }: { children: ReactNode }) {
  return (
    <p className="text-13 text-ink-2">
      <span className="font-medium text-ink">Why it matches</span> {children}
    </p>
  );
}
