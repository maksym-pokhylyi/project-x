import "./bid-theme.css";
import { AlertTriangle, Check, CircleHelp, Info, Lock, SearchCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { STANDING_NOTICE } from "@/features/bids/constants";
import type { CompanyStatus } from "@/features/bids/types";
import { cn } from "@/lib/utils";

/**
 * Small presentational pieces shared by the bid desk and the library (no client state).
 * Colours come from the handoff tokens in bid-theme.css, and no state is ever conveyed by
 * colour alone: every pill carries an icon and a word. "Met" is the brand green with a
 * tick — there is no separate success colour.
 */

/** The standing notice required on the brief and the editor. */
export function StandingNotice({ className }: { className?: string }) {
  return (
    <p role="note" className={cn("flex items-start gap-2 text-13 leading-5 text-ink-2", className)}>
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{STANDING_NOTICE}</span>
    </p>
  );
}

const TONES = {
  success: "bid-pill-met",
  danger: "bid-pill-danger",
  warning: "bid-pill-amber",
  info: "bid-pill-info",
  neutral: "bid-pill-neutral",
  brand: "bid-pill-brand",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "neutral", icon, children, className, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("bid-pill shrink-0", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export const STATUS_LABELS: Record<CompanyStatus, string> = { met: "Met", gap: "Gap", unknown: "For you to confirm", verify: "Check the source" };

const STATUS: Record<CompanyStatus, { tone: Tone; icon: ReactNode; hint: string }> = {
  met: { tone: "success", icon: <Check aria-hidden className="size-3.5" strokeWidth={2.6} />, hint: "Your confirmed company facts meet this requirement." },
  gap: { tone: "danger", icon: <TriangleAlert aria-hidden className="size-3.5" />, hint: "Your company facts fall short of this requirement." },
  unknown: { tone: "info", icon: <CircleHelp aria-hidden className="size-3.5" />, hint: "Your company facts do not settle this. Only you can confirm it." },
  verify: { tone: "warning", icon: <SearchCheck aria-hidden className="size-3.5" />, hint: "We could not find this wording in the pack. Check it in the tender documents before relying on it." },
};

export function StatusPill({ status }: { status: CompanyStatus }) {
  const key = STATUS[status] ? status : "unknown";
  return (
    <Pill tone={STATUS[key].tone} icon={STATUS[key].icon} title={STATUS[key].hint}>
      {STATUS_LABELS[key]}
    </Pill>
  );
}

/** Inline upgrade notice: what is locked, what unlocks it, one button. Never a modal. */
export function UpgradeNotice({
  title,
  children,
  actionLabel = "See plans",
  href = "/app/settings/billing",
  secondary,
  className,
}: {
  title: string;
  children: ReactNode;
  actionLabel?: string;
  href?: string;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Upgrade"
      data-testid="upgrade-notice"
      className={cn("flex flex-col gap-3 rounded-card bg-brand-tint px-5 py-4 sm:flex-row sm:items-center sm:justify-between", className)}
    >
      <div className="flex min-w-0 gap-3">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <h3 className="text-15 font-semibold">{title}</h3>
          <div className="mt-0.5 text-sm">{children}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {secondary}
        <Link href={href} className="bid-btn bid-btn-primary bid-btn-sm">
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}

const CALLOUT: Record<Tone, string> = {
  success: "bg-brand-tint",
  brand: "bg-brand-tint",
  danger: "bg-danger-tint",
  warning: "bg-accent-tint",
  info: "bg-info-tint",
  neutral: "bg-paper-deep",
};
const CALLOUT_ICON: Record<Tone, string> = {
  success: "text-brand",
  brand: "text-brand",
  danger: "text-danger",
  warning: "text-accent-ink",
  info: "text-info",
  neutral: "text-ink-2",
};

export function Callout({ tone = "neutral", title, children, className, action }: { tone?: Tone; title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  const Icon = tone === "danger" || tone === "warning" ? AlertTriangle : Info;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-card px-4 py-3 text-sm text-ink", CALLOUT[tone], className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", CALLOUT_ICON[tone])} />
      <div className="min-w-0 flex-1 basis-60">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn("text-sm", title ? "mt-0.5" : "")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({ title, count, children, lead }: { title: string; count?: number; children?: ReactNode; lead?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="bid-h2">
          {title}
          {count !== undefined ? <span className="bid-mono ml-3 text-sm font-normal text-ink-2 tabular-nums">{count}</span> : null}
        </h2>
        {lead ? <p className="text-sm text-ink-2">{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}

const DAY = 86_400_000;

export function formatDeadline(deadline: Date, withTime = true): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(deadline);
}

/** "14 days left" / "Closes today" / "Closed": the relative part of a deadline. */
export function daysLeftLabel(deadline: Date, now: Date = new Date()): { label: string; urgent: boolean; past: boolean } {
  const diff = deadline.getTime() - now.getTime();
  if (diff < 0) return { label: "Closed", urgent: false, past: true };
  const days = Math.floor(diff / DAY);
  if (days === 0) return { label: "Closes today", urgent: true, past: false };
  return { label: `${days} day${days === 1 ? "" : "s"} left`, urgent: days <= 3, past: false };
}

/**
 * Deadline as dot + absolute date + days left (always both, so it reads in print and to
 * screen readers). Amber is a marker colour only: the text stays ink.
 */
export function DeadlineChip({ deadline, now = new Date(), className, prefix = "Closes" }: { deadline: Date | null; now?: Date; className?: string; prefix?: string }) {
  if (!deadline) return <span className={cn("text-sm text-ink-2", className)}>No deadline read</span>;
  const left = daysLeftLabel(deadline, now);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium tabular-nums", className)}>
      <span aria-hidden className={cn("size-[9px] rounded-full", left.past ? "bg-line-strong" : left.urgent ? "bg-danger" : "bg-paper-deep")} />
      <span className={left.past ? "line-through" : undefined}>
        {prefix} {formatDeadline(deadline)}
      </span>
      <span className={cn("rounded px-1.5 py-px text-xs font-semibold", left.past ? "bg-paper-deep" : left.urgent ? "bg-danger-tint text-danger" : "bg-accent-tint")}>{left.label}</span>
    </span>
  );
}
