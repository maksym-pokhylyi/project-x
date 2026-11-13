import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Indeterminate spinner. Give it a label when it is the only sign that something is loading. */
function Spinner({ className, label, ...props }: React.ComponentProps<"svg"> & { label?: string }) {
  return (
    <Loader2
      data-slot="spinner"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-4 animate-spin text-ink-2", className)}
      {...props}
    />
  )
}

export { Spinner }
