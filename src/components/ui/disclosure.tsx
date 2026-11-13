import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Disclosure built on the native <details>/<summary>: works without JavaScript, is findable
 * with in-page search, and prints open. Used for FAQs and "show more" sections.
 *
 *   size   question  (default) as in the artboards: a serif question on a hairline, a
 *                    chevron at the right that turns over, the answer in ink at reading width
 *          sm        a quiet "show more" line inside a card: 14 px, the chevron after the
 *                    words, 44 px tall
 *
 * Give several in a row the same `name` to make them an exclusive accordion.
 */
function DisclosureGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="disclosure-group" className={cn("divide-y divide-line border-y border-line", className)} {...props} />
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("shrink-0 fill-none stroke-current stroke-[1.8] transition-transform duration-150 ease-out [stroke-linecap:round] [stroke-linejoin:round] group-open:rotate-180", className)}
    >
      <path d="M3.5 6l4.5 4.5L12.5 6" />
    </svg>
  )
}

function Disclosure({
  className,
  summary,
  size = "question",
  children,
  ...props
}: Omit<React.ComponentProps<"details">, "children"> & { summary: React.ReactNode; size?: "question" | "sm"; children: React.ReactNode }) {
  if (size === "sm") {
    return (
      <details data-slot="disclosure" data-size="sm" className={cn("group", className)} {...props}>
        <summary className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-ink transition-colors hover:text-brand">
          <span>{summary}</span>
          <Chevron className="size-3.5" />
        </summary>
        <div className="pb-1 text-sm leading-[1.5] text-ink [&>*+*]:mt-2.5">{children}</div>
      </details>
    )
  }
  return (
    <details data-slot="disclosure" className={cn("group", className)} {...props}>
      <summary className="type-question flex items-center justify-between gap-4 rounded-sm py-4 text-ink transition-colors hover:text-brand sm:gap-5 sm:py-5">
        <span className="text-pretty">{summary}</span>
        <Chevron className="size-[1.125rem]" />
      </summary>
      <div className="max-w-[45rem] pb-5 text-base leading-[1.6] text-ink sm:pr-10 sm:pb-6 [&>*+*]:mt-3">{children}</div>
    </details>
  )
}

export { Disclosure, DisclosureGroup }
