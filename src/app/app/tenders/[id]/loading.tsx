import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton for the in-app tender detail. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading tender">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-full max-w-2xl" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
