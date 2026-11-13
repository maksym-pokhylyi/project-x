import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Buttons, as drawn in the artboards: 6 px radius, semibold label.
 *   default              brand green with a white label — one per view
 *   outline              white with a line-strong edge — every secondary action
 *   inverse              white with a green label, for brand-green panels
 *   destructive          filled red: the confirmation of a step that cannot be undone,
 *                        inside the dialog that says what is lost
 *   destructive-outline  white with a red label: the way into such a step from a page
 *   ghost                no edge until hover: icon buttons (IconButton), quiet row actions
 *   menu                 muted 14 px text: the trigger of a menu in a bar (MenuButton)
 * States: hover, pressed (active), keyboard focus (global ring), disabled, loading.
 *
 * HEIGHT follows the control scale shared with fields (see control-group.tsx): 44 / 48 / 52 px.
 * A button with no `size` is as tall as its group says (--control-h): 44 px on its own,
 * 48 / 52 px inside a form or a search row, so it always matches the field beside it.
 *
 *   size       height   label and padding            use
 *   (none)     group's  15 px · 18 px at 44;          the usual case: let the group decide
 *                       16 px · 22 px at 48 and 52
 *   sm         44 px    14 px · 14 px (compact)       row and toolbar actions in tables and lists
 *   md         48 px    16 px · 22 px                 a lone action that belongs to a form
 *   lg         52 px    16 px · 22 px                 a lone action in a search context
 *   form       52 → 48  16 px · 22 px                 a lone call to action on a public page:
 *                                                     52 px on phones, 48 px from 640 px
 *   icon…      square of the same heights             icon-only; always give an aria-label
 *
 * `sm` used to be 36 px tall. The artboards' row actions are 44 px with a 14 px label, so
 * `sm` now keeps the compact label and takes the 44 px height; nothing in the product is
 * shorter than 44 px. `xs` and `icon-xs` remain as aliases of `sm` and `icon-sm`.
 * (Padding is 1 px less than quoted: every variant carries a 1 px edge, visible or not.)
 */
const compact = "controls-sm gap-1.5 px-[0.8125rem] text-sm"
const square = "w-(--control-h) px-0"

const buttonVariants = cva(
  "relative inline-flex h-(--control-h) shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent px-(--control-px) text-(length:--control-text) font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[loading]:opacity-80 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]",
        destructive: "bg-danger text-white hover:bg-danger-hover active:bg-danger-hover active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]",
        "destructive-outline": "border-line-strong bg-surface text-danger hover:border-danger hover:bg-danger-tint active:bg-danger-tint",
        outline: "border-line-strong bg-surface text-ink hover:border-ink hover:bg-paper active:bg-paper-deep",
        secondary: "bg-paper-deep text-ink hover:bg-line active:bg-line",
        ghost: "text-ink hover:bg-paper-deep active:bg-line",
        /* The quiet trigger of a menu in a bar: muted 14 px text (see MenuButton). */
        menu: "gap-2 px-2 text-sm font-normal text-ink-2 hover:bg-paper-deep hover:text-ink active:bg-line data-[state=open]:bg-paper-deep data-[state=open]:text-ink",
        /* A text link that happens to be a button: no height of its own, exempt from the scale. */
        link: "h-auto rounded-sm border-0 p-0 font-medium text-ink underline decoration-brand decoration-1 underline-offset-[3px] hover:text-brand",
        inverse: "bg-white text-brand hover:bg-brand-tint active:bg-brand-tint",
        "inverse-outline": "border-white/60 bg-transparent text-white hover:border-white hover:bg-white/10 active:bg-white/15",
      },
      size: {
        default: "",
        sm: compact,
        md: "controls-md",
        lg: "controls-lg",
        form: "controls-form",
        icon: square,
        "icon-sm": cn("controls-sm", square),
        "icon-md": cn("controls-md", square),
        "icon-lg": cn("controls-lg", square, "[&_svg:not([class*='size-'])]:size-5"),
        /* Kept so that older call sites compile: the scale has nothing below 44 px. */
        xs: compact,
        "icon-xs": cn("controls-sm", square),
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
