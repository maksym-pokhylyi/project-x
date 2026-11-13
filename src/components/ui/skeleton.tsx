import { cn } from "@/lib/utils"

/** Loading placeholder. Wrap a group in an element with aria-busy="true" and a label. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("animate-pulse rounded-control bg-line/70", className)} {...props} />
}

/**
 * Rows that are still loading, in the shape of the list they will become: a title line and
 * a shorter meta line each, divided by hairlines. Put it where the list will be, inside
 * the same card. The group is announced once ("Loading …"); the bars themselves are hidden.
 */
function SkeletonRows({ rows = 3, label = "Loading", className, ...props }: Omit<React.ComponentProps<"div">, "children"> & { rows?: number; label?: string }) {
  return (
    <div data-slot="skeleton-rows" role="status" aria-busy="true" aria-label={label} className={cn("flex flex-col divide-y divide-line", className)} {...props}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
          <Skeleton className={cn("h-4", index % 3 === 0 ? "w-3/5" : index % 3 === 1 ? "w-2/5" : "w-1/2")} />
          <Skeleton className={cn("h-3", index % 2 === 0 ? "w-1/3" : "w-1/4")} />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonRows }
