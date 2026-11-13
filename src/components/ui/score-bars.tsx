import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * The bars of a scoring scale, as in the evaluator's view: one bar per point of the buyer's
 * scale, `filled` of them in brand green. Decorative: always put the words next to it —
 * "Marked 3 of 5 against the buyer's scheme". It is a reading of the scoring scheme, never
 * a forecast of the buyer's decision, so do not label it "likely" or "predicted".
 */
function ScoreBars({ filled, total = 5, className, ...props }: React.ComponentProps<"span"> & { filled: number; total?: number }) {
  return (
    <span aria-hidden data-slot="score-bars" className={cn("flex gap-1", className)} {...props}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={cn("h-1.5 flex-1 rounded-full", index < filled ? "bg-brand" : "bg-line")} />
      ))}
    </span>
  )
}

export { ScoreBars }
