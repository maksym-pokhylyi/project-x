import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/*
 * Pagination: <nav aria-label="Pagination">. Every target is 40 px. The current page is
 * marked with aria-current="page"; Previous/Next are real links so they work without script.
 * On phones show only Previous / "Page 2 of 7" / Next.
 */
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav role="navigation" aria-label="Pagination" data-slot="pagination" className={cn("flex w-full justify-center", className)} {...props} />
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("flex flex-row items-center gap-1", className)} {...props} />
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = { isActive?: boolean; disabled?: boolean } & React.ComponentProps<"a">

function PaginationLink({ className, isActive, disabled, ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size: "icon" }),
        "tabular-nums",
        isActive && "border-brand bg-brand-tint text-brand hover:border-brand hover:bg-brand-tint",
        className
      )}
      {...props}
    />
  )
}

function PaginationPrevious({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Go to previous page" className={cn("w-auto gap-1 px-3", className)} {...props}>
      <ChevronLeft aria-hidden />
      <span>Previous</span>
    </PaginationLink>
  )
}

function PaginationNext({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Go to next page" className={cn("w-auto gap-1 px-3", className)} {...props}>
      <span>Next</span>
      <ChevronRight aria-hidden />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span aria-hidden data-slot="pagination-ellipsis" className={cn("grid size-10 place-items-center text-ink-3", className)} {...props}>
      <MoreHorizontal className="size-4" />
    </span>
  )
}

export { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis }
