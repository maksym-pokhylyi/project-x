import * as React from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/*
 * Disclosure built on the native <details>/<summary>: works without JavaScript, is findable
 * with in-page search, and prints open. Used for FAQs and "show more" sections.
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
      <summary className="flex min-h-14 items-center justify-between gap-4 rounded-sm py-3 text-base font-medium text-ink transition-colors hover:text-brand">
        <span className="text-pretty">{summary}</span>
        <Plus aria-hidden className="size-5 shrink-0 text-ink-2 transition-transform duration-150 ease-out group-open:rotate-45" />
      </summary>
      <div className="max-w-reading pr-9 pb-5 text-base text-ink-2 [&>*+*]:mt-3">{children}</div>
    </details>
  )
}

export { Disclosure, DisclosureGroup }
