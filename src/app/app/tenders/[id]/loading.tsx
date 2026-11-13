import { BreadcrumbTrail } from "@/components/app/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";

/** The tender page while it loads: the head, the card of dates and the description at their final sizes. */
export default function Loading() {
  return (
    <>
      {/* The same trail as the page, so the way back does not change its words when the tender arrives. */}
      <BreadcrumbTrail items={[{ label: "Radar", href: "/app" }, { label: "Tender" }]} />
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28.75rem)]" aria-busy="true" aria-label="Loading tender">
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-[3.75rem] w-full max-w-2xl md:h-[5.25rem]" />
          <Skeleton className="h-6 w-72 max-w-full" />
          <Skeleton className="mt-6 hidden h-8 w-64 lg:block" />
          <Skeleton className="hidden h-48 lg:block" />
        </div>
        <Skeleton className="h-[23rem] rounded-card" />
        <Skeleton className="h-48 lg:hidden" />
      </div>
    </>
  );
}
