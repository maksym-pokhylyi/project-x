import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/*
 * Breadcrumb, as above the title of the bid brief: 14 px, muted, parts separated by a slash;
 * links are underlined in grey (line-strong), the current page is plain text
 * (aria-current="page"). <nav aria-label="Breadcrumb"> with an ordered list.
 */
function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" className={cn("min-w-0", className)} {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="breadcrumb-list" className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2", className)} {...props} />
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="breadcrumb-item" className={cn("inline-flex min-w-0 items-center gap-2", className)} {...props} />
}

function BreadcrumbLink({ asChild, className, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        "truncate rounded-sm text-ink underline decoration-line-strong decoration-1 underline-offset-[3px] transition-colors hover:text-brand hover:decoration-brand",
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="breadcrumb-page" aria-current="page" className={cn("truncate text-ink-2", className)} {...props} />
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" className={cn("shrink-0 text-ink-2", className)} {...props}>
      {children ?? "/"}
    </li>
  )
}

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator }
