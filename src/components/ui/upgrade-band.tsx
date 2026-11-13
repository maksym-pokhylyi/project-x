import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Upgrade band: the one place on a screen that offers the next plan, as under the matches
 * on the Radar artboard ("4 more matches are waiting … £29 a month · See Radar Pro"). A
 * brand-tint band with a serif line that states the fact, one sentence, the price and ONE
 * green action. It reports what is waiting; it never interrupts or covers the work.
 *
 *   <UpgradeBand
 *     title="4 more matches are waiting"
 *     price={{ amount: "£29", period: "a month" }}
 *     action={<ButtonLink href="/pricing">See Radar Pro</ButtonLink>}
 *   >
 *     The free radar shows your top 10 matches. Radar Pro shows every match and sends daily alerts.
 *   </UpgradeBand>
 *
 * From 640 px the words are at the left and the price and action at the right; on phones
 * everything stacks and the action takes the full width at 48 px. Prices come from
 * src/config/plans.ts (planPrice / BID_PASS_DISPLAY), never from a literal. The action is a
 * ButtonLink to /pricing or to the Billing hand-off (src/lib/billing/handoff.ts).
 */
function UpgradeBand({
  title,
  price,
  action,
  headingLevel = 2,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  /** The fact, as a short line: "4 more matches are waiting". */
  title: React.ReactNode
  /** "£29" and "a month" (or "one-off"). Leave out when the band is not about a price. */
  price?: { amount: string; period: string }
  /** One ButtonLink. */
  action: React.ReactNode
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <div data-slot="upgrade-band" className={cn("flex flex-col rounded-card bg-brand-tint p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-10 sm:gap-y-4 sm:px-7 sm:py-6", className)} {...props}>
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-[1_1_30rem] sm:gap-1">
        <Heading className="font-display text-xl leading-[1.25] font-semibold tracking-normal text-ink sm:text-22 sm:leading-[1.25]">{title}</Heading>
        {children ? <p className="max-w-[47.5rem] text-15 leading-[1.5] text-ink">{children}</p> : null}
      </div>
      <div className="flex flex-col gap-3 max-sm:mt-3 max-sm:controls-md sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
        {price ? (
          <p className="flex items-baseline gap-1.5 text-ink">
            <span className="type-figure text-3xl leading-none tracking-[-0.01em]">{price.amount}</span>
            <span className="text-sm leading-[1.5]">{price.period}</span>
          </p>
        ) : null}
        <div className="flex max-sm:[&>*]:w-full">{action}</div>
      </div>
    </div>
  )
}

export { UpgradeBand }
