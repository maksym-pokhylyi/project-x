import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Breadcrumb: <nav aria-label="Breadcrumb"> with an ordered list. The current page is text
 * (aria-current="page"), not a link. Long trails truncate in the middle items first.
 */
function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" className={cn("min-w-0", className)} {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="breadcrumb-list" className={cn("flex min-w-0 items-center gap-1.5 text-sm text-ink-2", className)} {...props} />
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="breadcrumb-item" className={cn("inline-flex min-w-0 items-center gap-1.5", className)} {...props} />
}

function BreadcrumbLink({ asChild, className, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn("truncate rounded-sm text-ink-2 underline-offset-[0.2em] transition-colors hover:text-ink hover:underline", className)}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="breadcrumb-page" aria-current="page" className={cn("truncate font-medium text-ink", className)} {...props} />
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" className={cn("shrink-0 text-ink-3 [&>svg]:size-3.5", className)} {...props}>
      {children ?? <ChevronRight />}
    </li>
  )
}

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator }
