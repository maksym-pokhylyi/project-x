import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Badge / chip: 4 px radius, 12 px, 22 px tall. Tinted, never loud. Meaning is carried by
 * the words (and an icon where it helps), not by colour alone.
 *
 *   default      solid brand, white label — the "Verdict" label; use sparingly
 *   secondary    ink on paper-deep — quiet facts: categories, plan names, roles, "Pass or fail"
 *   brand        ink on brand-tint — the strongest reason, "selected"
 *   outline      line-strong edge — a quiet property that needs an edge on a tinted panel
 *   strong       ink edge — the property that matters most ("Mandatory")
 *   warning      amber ink on amber-tint — time left ("14 days left"), a state with a date on it ("Ending")
 *   success      brand green on success-tint — "Met", "Active" (add a tick)
 *   destructive  danger on danger-tint — "Gap", "Past due"
 *   info         info on info-tint — neutral labels: notice types, "For you to confirm"
 *
 * For requirement statuses use <StatusPill>; for deadlines <DeadlineMarker>.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-chip border border-transparent px-2 py-px text-xs leading-[1.125rem] font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand text-white [a&]:hover:bg-brand-hover",
        secondary: "bg-paper-deep font-medium text-ink [a&]:hover:bg-line",
        brand: "bg-brand-tint font-medium text-ink [a&]:hover:bg-brand-mark",
        outline: "border-line-strong bg-surface text-ink [a&]:hover:bg-paper",
        strong: "border-ink bg-surface text-ink",
        warning: "bg-accent-tint text-accent-ink",
        success: "bg-success-tint text-brand",
        destructive: "bg-danger-tint text-danger",
        info: "bg-info-tint text-info",
        ghost: "font-medium text-ink-2 [a&]:hover:bg-paper-deep",
        link: "px-0 font-medium text-ink underline decoration-brand underline-offset-[3px] [a&]:hover:text-brand",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
