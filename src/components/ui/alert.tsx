import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

/*
 * Alert / callout, as the "Gap: no evidence found" box in the artboards: a tinted panel with
 * a 6 px radius and no outline, a 20 px icon, a title in the hue of the state and the text
 * in ink. Icon + words, never colour alone. The icon follows the variant; pass
 * `icon={<Custom />}` to replace it or `icon={false}` to leave it out.
 *
 * `role` defaults to "alert", which interrupts screen readers. For information that is not
 * urgent pass role="status" (polite) or role="note".
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[1.25rem_1fr] items-start gap-x-3 gap-y-1 rounded-control border border-transparent px-4 py-3.5 text-sm text-ink data-[icon=none]:grid-cols-1 [&>svg]:size-5",
  {
    variants: {
      variant: {
        default: "border-line bg-surface [&>svg]:text-ink-2",
        info: "bg-info-tint [&_[data-slot=alert-title]]:text-info [&>svg]:text-info",
        success: "bg-success-tint [&_[data-slot=alert-title]]:text-brand [&>svg]:text-brand",
        warning: "bg-accent-tint [&_[data-slot=alert-title]]:text-accent-ink [&>svg]:text-accent",
        destructive: "bg-danger-tint [&_[data-slot=alert-title]]:text-danger [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const defaultIcons = {
  default: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleAlert,
} as const

function Alert({
  className,
  variant = "default",
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants> & { icon?: React.ReactNode | false }) {
  const DefaultIcon = defaultIcons[variant ?? "default"]
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      data-icon={icon === false ? "none" : undefined}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon === false ? null : (icon ?? <DefaultIcon aria-hidden strokeWidth={1.8} />)}
      {children}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-5 text-15 leading-5 font-semibold in-data-[icon=none]:col-start-1", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 text-sm text-ink in-data-[icon=none]:col-start-1 [&_p]:leading-[1.3125rem]", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
