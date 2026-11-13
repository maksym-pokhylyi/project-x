import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * The mono line above a title: "Supplier page · built from 37 published notices · updated
 * 13 Nov 2026". Mono 12, muted; parts are joined with a middle dot and empty ones skipped.
 * A part marked `wide` is left out on phones, where the line must stay on one row.
 *
 * Candidate for src/components/ui (the bid brief and the radar draw the same line).
 */
export type MetaPart = ReactNode | { text: ReactNode; wide: true };

function isWide(part: MetaPart): part is { text: ReactNode; wide: true } {
  return typeof part === "object" && part !== null && "wide" in part;
}

export function MetaLine({ parts, className, ...props }: Omit<ComponentProps<"p">, "children"> & { parts: MetaPart[] }) {
  const shown = parts.filter((part) => part !== null && part !== undefined && part !== false && part !== "");
  return (
    <p data-slot="meta-line" className={cn("type-ref text-ink-2", className)} {...props}>
      {shown.map((part, index) => {
        const wide = isWide(part);
        // The dot before a part belongs to what precedes it: where only `wide` parts come
        // first, a phone must not start the line with a separator.
        const afterNarrow = shown.slice(0, index).some((earlier) => !isWide(earlier));
        return (
          <span key={index} className={wide ? "max-md:hidden" : undefined}>
            {index > 0 ? <span className={!wide && !afterNarrow ? "max-md:hidden" : undefined}> · </span> : null}
            {wide ? part.text : part}
          </span>
        );
      })}
    </p>
  );
}
