import { cn } from "@/lib/utils";

/**
 * The scored questions of a check that has no full bid: reference and title only — the
 * matrix (weights, word limits), drafts and marking come with the full bid.
 */
export function LockedQuestions({ items, className }: { items: Array<{ id: string; reference: string; title: string }>; className?: string }) {
  return (
    <ol className={cn("rounded-card border border-line bg-surface", className)} data-testid="scored-questions-locked">
      {items.map((item, index) => (
        <li key={item.id} className={cn("flex items-baseline gap-4 px-5 py-3 text-15 sm:px-6", index > 0 ? "border-t border-line" : "")}>
          <span className="w-14 shrink-0 font-mono text-xs text-ink-2">{item.reference}</span>
          <span className="min-w-0">{item.title}</span>
        </li>
      ))}
    </ol>
  );
}
