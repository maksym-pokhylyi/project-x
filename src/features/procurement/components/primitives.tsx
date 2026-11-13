import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { describeDeadline, type DeadlineUrgency } from "../domain/format";
import { formatMoneyExact, formatMoneyShort } from "../domain/money";
import { NOTICE_BADGE_LABELS, noticeBadgeKind, type NoticeBadgeKind, type NoticeStage } from "../domain/notice-types";
import { regionsLabel } from "../domain/regions";

/**
 * Domain primitives (DESIGN.md §5). Server-safe: no hooks, no client JS.
 *
 * COLOUR: only semantic Tailwind tokens that already exist in globals.css (muted, border,
 * foreground, primary, warning, destructive, success) plus two design-system variables read
 * with fallbacks until the theme defines them: --info / --info-tint (planning-stage notices).
 * Tinted chips keep `text-foreground`, so contrast holds under any theme, and every state
 * is also carried by words or an icon, never by colour alone.
 */

const CHIP = "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium leading-5 tabular-nums";

const URGENCY_CLASS: Record<DeadlineUrgency, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  soon: "border-warning/50 bg-warning/15 text-foreground",
  urgent: "border-destructive/50 bg-destructive/10 text-foreground",
  closed: "border-border bg-muted text-muted-foreground",
};

/** `Closes in 9 days · 22 Nov 2026, 12:00` — relative and absolute, always together. */
export function DeadlineChip({ deadline, now, className }: { deadline: string | null; now?: Date; className?: string }) {
  const described = describeDeadline(deadline, now);
  if (!described) {
    return <span className={cn(CHIP, URGENCY_CLASS.neutral, className)}>No deadline published</span>;
  }
  const Icon = described.urgency === "urgent" ? AlertTriangle : Clock;
  return (
    <span className={cn(CHIP, URGENCY_CLASS[described.urgency], className)} data-urgency={described.urgency} data-testid="deadline-chip">
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className={described.urgency === "closed" ? "line-through" : undefined}>{described.label}</span>
      <span aria-hidden>·</span>
      <time dateTime={deadline ?? undefined}>{described.absolute}</time>
    </span>
  );
}

/**
 * `£102k`, `£1.2m`; the exact figure on hover/focus and for screen readers; "value not
 * published" instead of zero or £1 placeholders.
 */
export function Money({ amount, currency = "GBP", className, fallback = "Value not published" }: { amount: number | null; currency?: string | null; className?: string; fallback?: string }) {
  const short = formatMoneyShort(amount, currency);
  if (!short) return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
  const exact = formatMoneyExact(amount, currency) ?? short;
  return (
    <span className={cn("tabular-nums", className)} title={exact} tabIndex={exact !== short ? 0 : undefined}>
      <span aria-hidden>{short}</span>
      <span className="sr-only">{exact}</span>
    </span>
  );
}

const BADGE_CLASS: Record<NoticeBadgeKind, string> = {
  tender: "border-primary/30 bg-primary/5 text-foreground",
  below_threshold: "border-success/40 bg-success/10 text-foreground",
  framework: "border-border bg-secondary text-secondary-foreground",
  early: "border-[color:var(--info,var(--border))] bg-[var(--info-tint,var(--muted))] text-foreground",
  award: "border-border bg-muted text-foreground",
  contract: "border-border bg-muted text-muted-foreground",
  market: "border-border bg-secondary text-secondary-foreground",
  closed: "border-border bg-muted text-muted-foreground line-through",
};

/** Notice type in the buyer's language: Tender, Early notice, Award, Below-threshold, Framework. */
export function NoticeBadge({
  notice,
  className,
}: {
  notice: { stage: string; noticeType: string | null; aboveThreshold: boolean | null; isFramework: boolean; status?: string | null };
  className?: string;
}) {
  const kind = noticeBadgeKind({ ...notice, stage: notice.stage as NoticeStage });
  return (
    <span className={cn(CHIP, BADGE_CLASS[kind], className)} data-kind={kind}>
      {NOTICE_BADGE_LABELS[kind]}
    </span>
  );
}

/** Big tabular number + label + small context line. */
export function StatBlock({ value, label, context, className }: { value: ReactNode; label: string; context?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3", className)}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</dd>
      {context ? <p className="mt-0.5 text-xs text-muted-foreground">{context}</p> : null}
    </div>
  );
}

/** One sentence of what belongs here, one action, optional example. No illustrations. */
export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed px-5 py-8 text-center", className)} data-testid="empty-state">
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * Link to the source notice on Find a Tender. ALWAYS rendered next to anything we show
 * about a notice — never behind sign-up, the free-plan cap or a paid plan.
 */
export function SourceLink({ href, label = "View on Find a Tender", className }: { href: string; label?: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn("inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline sm:min-h-0", className)}
      data-testid="source-link"
    >
      {label}
      <ExternalLink aria-hidden className="size-3.5" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function RegionText({ regions, source }: { regions: string[]; source?: string | null }) {
  const label = regionsLabel(regions);
  if (!label) return null;
  return <span title={source === "buyer" ? "Buyer's location; the notice gives no delivery region" : undefined}>{label}</span>;
}

/** Section heading with an optional count and trailing action. */
export function SectionHeading({ id, title, count, description, action }: { id?: string; title: string; count?: number; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="text-lg font-semibold tracking-tight sm:text-xl">
          {title}
          {typeof count === "number" && count > 0 ? <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">{count.toLocaleString("en-GB")}</span> : null}
        </h2>
        {description ? <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** "+ 12 more — claim this page to see them all". */
export function MoreCount({ hidden, noun, href, cta }: { hidden: number; noun: string; href: string; cta: string }) {
  if (hidden <= 0) return null;
  return (
    <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm" data-testid="more-count">
      <span className="font-medium tabular-nums">+ {hidden.toLocaleString("en-GB")} more</span> {noun}.{" "}
      <Link href={href} className="font-medium text-primary underline underline-offset-4 hover:no-underline">
        {cta}
      </Link>
    </p>
  );
}
