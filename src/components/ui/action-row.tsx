import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * A setting said in a sentence, with the one thing to do about it: a semibold line and a
 * muted line at the left, the action at the right. On phones the action moves under the
 * text and takes the full width at 48 px, like the buttons of the phone artboards.
 *
 * Put the rows in an <ActionList>: hairlines separate them, and the first and last row sit
 * flush with the card's padding.
 *
 *   <ActionList>
 *     <ActionRow title="Export data" description="Everything stored for this workspace, as one JSON file."
 *                action={<ButtonLink href="…" download variant="outline">Export data</ButtonLink>} />
 *   </ActionList>
 */
export function ActionList({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="action-list" className={cn("flex flex-col divide-y divide-line", className)} {...props} />;
}

export function ActionRow({
  title,
  description,
  action,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  /** What this is, in a few words. */
  title: ReactNode;
  /** What happens, in one sentence. */
  description?: ReactNode;
  /** One Button or ButtonLink. */
  action: ReactNode;
}) {
  return (
    <div
      data-slot="action-row"
      className={cn("flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8", className)}
      {...props}
    >
      <div className="min-w-0">
        <p className="text-15 font-semibold text-ink">{title}</p>
        {description ? <p className="mt-0.5 max-w-[34rem] text-sm text-ink-2">{description}</p> : null}
      </div>
      <div className="flex shrink-0 max-sm:controls-md max-sm:[&>*]:w-full">{action}</div>
    </div>
  );
}
