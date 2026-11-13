import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Badge / chip: 4 px radius, 12/16 medium. Tinted, never loud. Meaning is carried by the
 * words (and an icon where it helps), not by colour alone.
 *
 *   default      solid brand — use sparingly ("Recommended")
 *   secondary    neutral on sunken — plan names, roles, counts
 *   outline      neutral with a hairline — inactive states
 *   brand        brand on brand-tint — selected, "Tender"
 *   success      "Met", "Active"
 *   warning      amber: "Verify", deadline soon
 *   destructive  danger: "Gap", "Past due", closing
 *   info         "Early notice"
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-control border border-transparent px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand text-white [a&]:hover:bg-brand-hover",
        secondary: "bg-surface-sunken text-ink-2 [a&]:hover:bg-line",
        outline: "border-line-strong bg-surface text-ink-2 [a&]:hover:bg-surface-sunken",
        brand: "bg-brand-tint text-brand [a&]:hover:bg-brand-tint/70",
        success: "bg-success-tint text-success",
        warning: "bg-accent-tint text-accent-ink",
        destructive: "bg-danger-tint text-danger",
        info: "bg-info-tint text-info",
        ghost: "text-ink-2 [a&]:hover:bg-surface-sunken",
        link: "px-0 text-brand underline-offset-4 [a&]:hover:underline",
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
