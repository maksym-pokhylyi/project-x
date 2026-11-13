import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Action band: a brand-tint panel with a serif heading, one or two sentences and its
 * actions at the right — under the text on phones. "Decided to bid on one of these?",
 * "4 more matches are waiting", "Could you win this?". Inline, never a modal; at most one
 * per list.
 *
 *   <ActionBand title="Could you win this?" actions={<ButtonLink variant="outline" href="/find">Find your company</ButtonLink>}>
 *     Find your company to see how this tender matches your past work.
 *   </ActionBand>
 *
 * `aside` sits between the text and the actions (a price: "£29 a month").
 * Candidate for src/components/ui.
 */
export function ActionBand({
  title,
  children,
  actions,
  aside,
  headingLevel = "h3",
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode;
  actions: ReactNode;
  aside?: ReactNode;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div
      data-slot="action-band"
      className={cn("flex flex-col gap-x-10 gap-y-3.5 rounded-card bg-brand-tint p-5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-y-4 md:px-7 md:py-6", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1.5 md:flex-[1_1_30rem] md:gap-1">
        <Heading className="type-h3 text-ink">{title}</Heading>
        <div className="max-w-[41.25rem] text-15 text-ink">{children}</div>
      </div>
      {aside ? <div className="flex items-baseline gap-1.5">{aside}</div> : null}
      <div className="flex flex-col gap-x-[1.125rem] gap-y-1 md:flex-row md:flex-wrap md:items-center">{actions}</div>
    </div>
  );
}
