import { cn } from "@/lib/utils";

export type StackedBarPart = { count: number; className: string };

/**
 * One bar split in proportion to counts (met / to confirm / gaps). Drawn as one equal cell
 * per item, so the proportions are exact without a computed width; long lists are scaled
 * down to at most `maxCells` cells, keeping at least one cell for every part that has any.
 *
 *   <StackedBar label="19 met, 2 to confirm, 2 gaps" parts={[{ count: 19, className: "bg-brand" }, …]} />
 */
export function StackedBar({ parts, label, className, maxCells = 120 }: { parts: StackedBarPart[]; label: string; className?: string; maxCells?: number }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.count), 0);
  const scale = total > maxCells ? maxCells / total : 1;
  const cells = parts.flatMap((part, index) =>
    part.count > 0 ? Array.from({ length: Math.max(1, Math.round(part.count * scale)) }, (_, cell) => ({ key: `${index}-${cell}`, className: part.className, first: cell === 0 && index > 0 })) : [],
  );
  return (
    <div role="img" aria-label={label} data-slot="stacked-bar" className={cn("flex h-2 overflow-hidden rounded-chip", className)}>
      {cells.map((cell) => (
        <span key={cell.key} className={cn("flex-1", cell.className, cell.first ? "border-l-2 border-surface" : "")} />
      ))}
    </div>
  );
}
