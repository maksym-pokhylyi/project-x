import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ControlGroup } from "@/components/ui/control-group";
import { ArrowRightIcon, SearchIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { landing } from "@/config/landing";
import { cn } from "@/lib/utils";

/**
 * "Find your company's page" — the one call to action of the public site. A plain GET form:
 * it works before any script has loaded and sends the visitor to /find?q=…
 * A search row: the field and the button are both 52 px tall (the row says so once, through
 * <ControlGroup size="lg">); on phones the button takes the full width under the field.
 * Pass a distinct `id` for each instance on a page (it links the label to the field).
 *
 * `variant="outline"` is the quieter row of the 404 page: an outline "Search" button with
 * the magnifier in front, under its own label.
 */
export function CompanySearch({
  id,
  label,
  submit,
  variant = "default",
  className,
  children,
}: {
  id: string;
  /** Replaces "Find your company's page. It's free." */
  label?: string;
  /** Replaces the label of the button. */
  submit?: string;
  variant?: "default" | "outline";
  className?: string;
  children?: ReactNode;
}) {
  const { search } = landing;
  return (
    <form action={search.action} method="get" role="search" aria-label="Find your company" className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm leading-[1.5] font-semibold text-ink">
        {label ?? search.label}
      </label>
      <ControlGroup size="lg" className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          name="q"
          type="search"
          required
          autoComplete="organization"
          enterKeyHint="search"
          spellCheck={false}
          placeholder={search.placeholder}
          className="shrink-0 placeholder:text-sm sm:flex-1 sm:basis-64 sm:placeholder:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        <Button type="submit" variant={variant}>
          {variant === "outline" ? <SearchIcon /> : null}
          {submit ?? search.submit}
          {variant === "outline" ? null : <ArrowRightIcon />}
        </Button>
      </ControlGroup>
      {children}
    </form>
  );
}
