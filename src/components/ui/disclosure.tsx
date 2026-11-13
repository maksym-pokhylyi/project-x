import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Disclosure built on the native <details>/<summary>: works without JavaScript, is findable
 * with in-page search, and prints open. Used for FAQs and "show more" sections.
 * As in the artboards: a serif question on a hairline, a chevron that turns over, and the
 * answer in ink at reading width.
 * Give several in a row the same `name` to make them an exclusive accordion.
 *
 * `variant="inline"` is the small one, for a secondary step tucked into a card or a table
 * row ("Remove", "Marked the wrong rows?"): the summary reads as a link with the same
 * chevron, and what it reveals follows in the text size of its surroundings. The summary is
 * as wide as its words, with a 44 px hit area.
 */
const summaryClasses = {
  default:
    "flex items-center justify-between gap-5 rounded-sm py-4 font-display text-lg leading-6 font-semibold text-ink transition-colors hover:text-brand sm:py-5 sm:text-xl sm:leading-[1.625rem]",
  inline: "link hit-40 inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium",
} as const

const contentClasses = {
  default: "type-reading max-w-[42.5rem] pb-6 text-ink sm:pr-10 [&>*+*]:mt-3",
  inline: "pt-3 text-sm text-ink [&>*+*]:mt-3",
} as const

function DisclosureGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="disclosure-group" className={cn("divide-y divide-line border-y border-line", className)} {...props} />
}

function Disclosure({
  className,
  summary,
  children,
  variant = "default",
  ...props
}: Omit<React.ComponentProps<"details">, "children"> & { summary: React.ReactNode; children: React.ReactNode; variant?: keyof typeof summaryClasses }) {
  return (
    <details data-slot="disclosure" data-variant={variant} className={cn("group", className)} {...props}>
      <summary className={summaryClasses[variant]}>
        <span className="text-pretty">{summary}</span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={cn(
            "shrink-0 fill-none stroke-current stroke-[1.8] transition-transform duration-150 ease-out [stroke-linecap:round] [stroke-linejoin:round] group-open:rotate-180",
            variant === "inline" ? "size-3.5" : "size-[1.125rem]"
          )}
        >
          <path d="M3.5 6l4.5 4.5L12.5 6" />
        </svg>
      </summary>
      <div className={contentClasses[variant]}>{children}</div>
    </details>
  )
}

export { Disclosure, DisclosureGroup }
