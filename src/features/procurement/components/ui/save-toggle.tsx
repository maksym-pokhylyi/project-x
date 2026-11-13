import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Save / Saved: the toggle that keeps something on the user's list. An outline button with
 * a bookmark — hollow and "Save" when off, filled brand green and "Saved" when on. State is
 * carried by the words and aria-pressed, never by the fill alone. Presentational: the
 * caller owns the state and the request (see how it is used with useOptimistic).
 *
 *   <SaveToggle pressed={saved} onClick={toggle} itemLabel="Roof repairs at Hollin Bank" />
 *
 * `itemLabel` completes the accessible name where many toggles share a screen.
 * <BookmarkIcon> is exported for the same control drawn as a link (a visitor's "Save"
 * leads to sign-up: <ButtonLink variant="outline"><BookmarkIcon pressed={false} />Save</ButtonLink>).
 * Candidate for src/components/ui.
 */
export function BookmarkIcon({ pressed, className }: { pressed: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("size-3.5 stroke-[1.6] [stroke-linejoin:round]", pressed ? "fill-brand stroke-brand" : "fill-none stroke-current", className)}>
      <path d="M4.5 2.5h7v11L8 10.8l-3.5 2.7z" />
    </svg>
  );
}

export function SaveToggle({ pressed, itemLabel, className, ...props }: Omit<ComponentProps<typeof Button>, "children" | "variant"> & { pressed: boolean; itemLabel?: string }) {
  return (
    <Button type="button" variant="outline" aria-pressed={pressed} aria-label={itemLabel ? `${pressed ? "Saved" : "Save"}: ${itemLabel}` : undefined} data-slot="save-toggle" className={cn("gap-1.5 px-3.5 text-sm", className)} {...props}>
      <BookmarkIcon pressed={pressed} />
      {pressed ? "Saved" : "Save"}
    </Button>
  );
}
