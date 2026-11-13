"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { controlSize } from "./control-size";

/*
 * A filter (or sort) as a menu button in a toolbar: "Region ▾". 44 px, outline, 14 px
 * medium. The options are LINKS — the choice lives in the URL — and the one in force is
 * ticked; choosing it again does nothing. Keyboard: Enter/Space/ArrowDown opens, arrows
 * move, Escape closes (Radix menu).
 *
 *   <MenuFilter label="Region" options={[{ label: "Any region", href: "/app", selected: true }, …]} />
 *
 * `value` replaces the label on the button when the button itself should say what is chosen
 * ("Sorted by awards in your trade").
 * Candidate for src/components/ui.
 */
export type MenuFilterOption = { label: string; href: string; selected?: boolean };

export function MenuFilter({
  label,
  value,
  options,
  align = "start",
  className,
}: {
  label: string;
  value?: string;
  options: MenuFilterOption[];
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={cn(controlSize.bar, "shrink-0 gap-1.5 pr-2.5 pl-3.5 text-sm font-medium", className)} aria-label={value ? `${label}: ${value}` : label}>
          {value ?? label}
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] min-w-[12.5rem]">
        {options.map((option) => (
          <DropdownMenuItem key={option.href + option.label} asChild>
            <Link href={option.href} scroll={false} className={cn("justify-between", option.selected && "font-semibold")}>
              {option.label}
              {option.selected ? (
                <svg viewBox="0 0 16 16" aria-hidden className="size-4 fill-none stroke-brand stroke-2 [stroke-linecap:round] [stroke-linejoin:round]">
                  <path d="M3 8.5l3.2 3.2L13 4.8" />
                </svg>
              ) : null}
              {option.selected ? <span className="sr-only"> (chosen)</span> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
