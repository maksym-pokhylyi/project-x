import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

/*
 * Alert / callout. Tinted background, hairline in the same hue, icon + words (never colour
 * alone). The icon follows the variant; pass `icon={<Custom />}` to replace it or
 * `icon={false}` to leave it out.
 *
 * `role` defaults to "alert", which interrupts screen readers. For information that is not
 * urgent pass role="status" (polite) or role="note".
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[1rem_1fr] items-start gap-x-3 gap-y-1 rounded-card border px-4 py-3 text-sm text-ink data-[icon=none]:grid-cols-1 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "border-line bg-surface [&>svg]:text-ink-2",
        info: "border-info/20 bg-info-tint [&>svg]:text-info",
        success: "border-success/20 bg-success-tint [&>svg]:text-success",
        warning: "border-accent/25 bg-accent-tint [&>svg]:text-accent-ink",
        destructive: "border-danger/20 bg-danger-tint [&>svg]:text-danger",
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
      {icon === false ? null : (icon ?? <DefaultIcon aria-hidden />)}
      {children}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-5 leading-5 font-semibold in-data-[icon=none]:col-start-1", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 text-sm text-ink in-data-[icon=none]:col-start-1 [&_p]:leading-5", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
