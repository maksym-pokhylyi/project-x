import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** One "used of limit" row with a progress bar. `limit: null` means unlimited. */
export function UsageMeter({
  label,
  used,
  limit,
  hint,
  valueText,
  format = (value) => value.toLocaleString("en-GB"),
}: {
  label: string;
  used: number;
  limit: number | null;
  hint?: string;
  /** Replaces the default "used of limit" text, e.g. "12% used". */
  valueText?: string;
  format?: (value: number) => string;
}) {
  const percent = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const atLimit = limit !== null && used >= limit;
  const nearLimit = !atLimit && limit !== null && percent >= 90;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className={cn("shrink-0 whitespace-nowrap text-ink-2 tabular-nums", nearLimit && "font-semibold text-accent-ink", atLimit && "font-semibold text-danger")}>
          {valueText ?? `${format(used)} ${limit === null ? "· unlimited" : `of ${format(limit)}`}`}
          {atLimit ? <span className="ml-1.5">· limit reached</span> : null}
        </span>
      </div>
      {limit === null ? null : <Progress value={percent} tone={atLimit ? "danger" : nearLimit ? "warning" : "brand"} aria-label={`${label}: ${percent}% used`} />}
      {hint ? <p className="text-13 text-ink-2">{hint}</p> : null}
    </div>
  );
}
