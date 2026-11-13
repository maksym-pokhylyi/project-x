import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Buttons. 4 px radius, 40 px default height (the minimum touch target), hairline outlines.
 * States: hover, pressed (active), keyboard focus (global ring), disabled, loading.
 * Small sizes keep a 40 px hit area through an invisible ::after (see `hit-40`).
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent text-sm font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[loading]:opacity-80 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]",
        destructive: "bg-danger text-white hover:bg-danger-hover active:bg-danger-hover active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]",
        outline: "border-line-strong bg-surface text-ink hover:border-line-control hover:bg-surface-sunken active:bg-line",
        secondary: "bg-surface-sunken text-ink hover:bg-line active:bg-line-strong",
        ghost: "text-ink-2 hover:bg-surface-sunken hover:text-ink active:bg-line",
        link: "h-auto rounded-sm border-0 p-0 font-medium text-brand underline decoration-brand/45 decoration-1 underline-offset-[0.2em] hover:text-brand-hover hover:decoration-current",
        inverse: "bg-paper text-brand hover:bg-white active:bg-brand-tint",
        "inverse-outline": "border-white/45 bg-transparent text-paper hover:border-white/80 hover:bg-white/10 active:bg-white/15",
      },
      size: {
        default: "h-10 px-4",
        xs: "hit-40 h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "hit-40 h-8 gap-1.5 px-3 text-13",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-xs": "hit-40 size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "hit-40 size-8",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-5",
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
