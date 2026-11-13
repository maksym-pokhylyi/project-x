import { AlertTriangle, CircleCheck, CircleHelp, CircleX, Info, Lock, SearchCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { STANDING_NOTICE } from "@/features/bids/constants";
import type { CompanyStatus } from "@/features/bids/types";
import { cn } from "@/lib/utils";

/**
 * Small presentational pieces shared by the bid desk and the library (no client state).
 * Colours come from the design tokens only (success / warning / destructive / muted), and
 * no state is ever conveyed by colour alone: every pill carries an icon and a word.
 */

/** The standing notice required on the brief and the editor. */
export function StandingNotice({ className }: { className?: string }) {
  return (
    <p role="note" className={cn("flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground", className)}>
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{STANDING_NOTICE}</span>
    </p>
  );
}

const TONES = {
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
  neutral: "border-border bg-muted text-muted-foreground",
  brand: "border-primary/20 bg-primary/5 text-primary",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "neutral", icon, children, className, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex w-fit shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const STATUS: Record<CompanyStatus, { label: string; tone: Tone; icon: ReactNode; hint: string }> = {
  met: { label: "Met", tone: "success", icon: <CircleCheck aria-hidden className="size-3" />, hint: "Your confirmed company facts meet this requirement." },
  gap: { label: "Gap", tone: "danger", icon: <CircleX aria-hidden className="size-3" />, hint: "Your company facts fall short of this requirement." },
  unknown: { label: "Unknown", tone: "neutral", icon: <CircleHelp aria-hidden className="size-3" />, hint: "Your company facts do not say. Check it yourself." },
  verify: { label: "Verify", tone: "warning", icon: <SearchCheck aria-hidden className="size-3" />, hint: "Check this against the tender documents before relying on it." },
};

export function StatusPill({ status }: { status: CompanyStatus }) {
  const config = STATUS[status] ?? STATUS.unknown;
  return (
    <Pill tone={config.tone} icon={config.icon} title={config.hint}>
      {config.label}
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
    <section aria-label="Upgrade" data-testid="upgrade-notice" className={cn("flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 gap-3">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {secondary}
        <Button asChild size="sm">
          <Link href={href}>{actionLabel}</Link>
        </Button>
      </div>
    </section>
  );
}

export function Callout({ tone = "neutral", title, children, className, action }: { tone?: Tone; title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  const Icon = tone === "danger" || tone === "warning" ? AlertTriangle : Info;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", TONES[tone], className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-foreground">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn("text-sm", title ? "mt-0.5 text-muted-foreground" : "")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold tracking-tight">
        {title}
        {count !== undefined ? <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">{count}</span> : null}
      </h2>
      {children}
    </div>
  );
}

const DAY = 86_400_000;

/**
 * Deadline with urgency colour + relative time + absolute date (always both, so it reads
 * in print and to screen readers). >14 days neutral, 4–14 amber, ≤3 danger, past = struck.
 */
export function DeadlineChip({ deadline, now = new Date(), className }: { deadline: Date | null; now?: Date; className?: string }) {
  if (!deadline) return <Pill className={className}>No deadline read</Pill>;
  const absolute = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(deadline);
  const diff = deadline.getTime() - now.getTime();
  const days = Math.floor(diff / DAY);
  if (diff < 0) {
    return (
      <Pill className={className}>
        <span className="line-through">Closed · {absolute}</span>
      </Pill>
    );
  }
  const relative = days === 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
  const tone: Tone = days <= 3 ? "danger" : days <= 14 ? "warning" : "neutral";
  return (
    <Pill tone={tone} className={className}>
      {relative} · {absolute}
    </Pill>
  );
}
