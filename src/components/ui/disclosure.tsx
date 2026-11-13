import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Disclosure built on the native <details>/<summary>: works without JavaScript, is findable
 * with in-page search, and prints open. Used for FAQs and "show more" sections.
 * As in the artboards: a serif question on a hairline, a chevron that turns over, and the
 * answer in ink at reading width.
 * Give several in a row the same `name` to make them an exclusive accordion.
 */
function DisclosureGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="disclosure-group" className={cn("divide-y divide-line border-y border-line", className)} {...props} />
}

function Disclosure({
  className,
  summary,
  children,
  ...props
}: Omit<React.ComponentProps<"details">, "children"> & { summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <details data-slot="disclosure" className={cn("group", className)} {...props}>
      <summary className="type-question flex items-center justify-between gap-4 rounded-sm py-4 text-ink transition-colors hover:text-brand sm:gap-5 sm:py-5">
        <span className="text-pretty">{summary}</span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="size-[1.125rem] shrink-0 fill-none stroke-current stroke-[1.8] transition-transform duration-150 ease-out [stroke-linecap:round] [stroke-linejoin:round] group-open:rotate-180"
        >
          <path d="M3.5 6l4.5 4.5L12.5 6" />
        </svg>
      </summary>
      <div className="max-w-[45rem] pb-5 text-base leading-[1.6] text-ink sm:pr-10 sm:pb-6 [&>*+*]:mt-3">{children}</div>
    </details>
  )
}

export { Disclosure, DisclosureGroup }
