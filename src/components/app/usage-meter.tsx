import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** One "used of limit" row with a progress bar. `limit: null` means unlimited. */
export function UsageMeter({
  label,
  used,
  limit,
  hint,
  format = (value) => value.toLocaleString("en-US"),
}: {
  label: string;
  used: number;
  limit: number | null;
  hint?: string;
  format?: (value: number) => string;
}) {
  const percent = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const atLimit = limit !== null && used >= limit;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums text-muted-foreground", atLimit && "font-medium text-destructive")}>
          {format(used)} {limit === null ? "· unlimited" : `of ${format(limit)}`}
        </span>
      </div>
      {limit === null ? null : <Progress value={percent} aria-label={`${label}: ${percent}% used`} />}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
