import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Buttons, as drawn in the artboards: 6 px radius, 44 px tall, 15 px semibold.
 *   default          brand green with a white label — one per view
 *   outline          white with a line-strong edge — every secondary action
 *   inverse          white with a green label, for brand-green panels
 * States: hover, pressed (active), keyboard focus (global ring), disabled, loading.
 * Small sizes keep a 44 px hit area through an invisible ::after (see `hit-40`).
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent text-15 font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[loading]:opacity-80 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]",
        destructive: "bg-danger text-white hover:bg-danger-hover active:bg-danger-hover active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]",
        outline: "border-line-strong bg-surface text-ink hover:border-ink hover:bg-paper active:bg-paper-deep",
        secondary: "bg-paper-deep text-ink hover:bg-line active:bg-line",
        ghost: "text-ink hover:bg-paper-deep active:bg-line",
        link: "h-auto rounded-sm border-0 p-0 font-medium text-ink underline decoration-brand decoration-1 underline-offset-[3px] hover:text-brand",
        inverse: "bg-white text-brand hover:bg-brand-tint active:bg-brand-tint",
        "inverse-outline": "border-white/60 bg-transparent text-white hover:border-white hover:bg-white/10 active:bg-white/15",
      },
      size: {
        default: "h-11 px-[1.125rem]",
        xs: "hit-40 h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "hit-40 h-9 gap-1.5 px-3.5 text-sm",
        lg: "h-[3.25rem] px-[1.375rem] text-base",
        icon: "size-11",
        "icon-xs": "hit-40 size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "hit-40 size-9",
        "icon-lg": "size-[3.25rem] [&_svg:not([class*='size-'])]:size-5",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, sets aria-busy and blocks clicks. Keep the label: say what is happening. */
    loading?: boolean
  }) {
  const classes = cn(buttonVariants({ variant, size, className }))

  if (asChild) {
    return (
      <Slot.Root data-slot="button" data-variant={variant} data-size={size} className={classes} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </button>
  )
}

export { Button, buttonVariants }
