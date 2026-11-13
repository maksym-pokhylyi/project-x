import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Step tracker: the stages of a job that takes minutes, as on the Processing artboard
 * ("Reading files · Finding requirements · Listing questions · Checking your company").
 * Each stage has a state, a name and one line of what it has found so far.
 *
 *   done      a green ring with a tick; the name in medium weight
 *   current   a heavy ink ring; the name in semibold; aria-current="step"
 *   waiting   a thin muted ring; muted words
 *   failed    a danger ring with a bar; say what happened in the note
 *
 * From 640 px the stages sit side by side under a 6 px bar each (green, ink, line); on
 * phones they are a plain list divided by hairlines. States are told by the ring's form
 * and by words ("Done", "In progress", "Waiting"), never by colour alone. Put it in a card
 * with a heading that says which stage of how many ("Building the check · stage 3 of 4"),
 * and announce changes with role="status" on that heading, not on every stage.
 */
export type StepState = "done" | "current" | "waiting" | "failed"
export type Step = { name: string; state: StepState; note?: React.ReactNode }

const stateLabel: Record<StepState, string> = { done: "Done", current: "In progress", waiting: "Waiting", failed: "Failed" }
const barColour: Record<StepState, string> = { done: "bg-brand", current: "bg-ink", waiting: "bg-line", failed: "bg-danger" }

function StateRing({ state }: { state: StepState }) {
  return (
    <svg viewBox="0 0 20 20" role="img" aria-label={stateLabel[state]} className="mt-px size-5 shrink-0 fill-none [stroke-linecap:round] [stroke-linejoin:round]">
      {state === "done" ? (
        <g className="stroke-brand stroke-[1.8]">
          <circle cx="10" cy="10" r="8" />
          <path d="M6.3 10.3l2.6 2.6 4.8-5" />
        </g>
      ) : state === "current" ? (
        <circle cx="10" cy="10" r="7.2" className="stroke-ink stroke-[3.4]" />
      ) : state === "failed" ? (
        <g className="stroke-danger stroke-[1.8]">
          <circle cx="10" cy="10" r="8" />
          <path d="M6.5 10h7" />
        </g>
      ) : (
        <circle cx="10" cy="10" r="8" className="stroke-ink-2 stroke-[1.5]" />
      )}
    </svg>
  )
}

function StepTracker({ steps, className, ...props }: Omit<React.ComponentProps<"ol">, "children"> & { steps: Step[] }) {
  return (
    <ol data-slot="step-tracker" className={cn("flex flex-col divide-y divide-line sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(13.75rem,100%),1fr))] sm:gap-x-6 sm:gap-y-5 sm:divide-y-0", className)} {...props}>
      {steps.map((step) => (
        <li key={step.name} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined} className="flex flex-col py-3 first:pt-0 last:pb-0 sm:gap-3.5 sm:py-0">
          <span aria-hidden className={cn("h-1.5 rounded-[3px] max-sm:hidden", barColour[step.state])} />
          <div className="flex gap-3 sm:gap-2.5">
            <StateRing state={step.state} />
            <div className="flex min-w-0 flex-col gap-px sm:gap-0.5">
              <span className={cn("text-15 leading-[1.5]", step.state === "current" ? "font-semibold text-ink" : step.state === "waiting" ? "font-medium text-ink-2" : "font-medium text-ink")}>{step.name}</span>
              {step.note ? <span className={cn("text-13 leading-[1.5] tabular-nums", step.state === "current" ? "text-ink" : step.state === "failed" ? "text-danger" : "text-ink-2")}>{step.note}</span> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export { StepTracker }
