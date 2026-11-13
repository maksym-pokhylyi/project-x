import { cn } from "@/lib/utils"

/** Loading placeholder. Wrap a group in an element with aria-busy="true" and a label. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("animate-pulse rounded-control bg-line/70", className)} {...props} />
}

export { Skeleton }
