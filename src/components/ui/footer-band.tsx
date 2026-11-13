import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * The paper-deep band that closes a page: where the data comes from, the legal line.
 * 13 px muted text; a short bold lead in ink may start the sentence.
 *
 *   page    a <footer> across the full width, text on the page column (`containerClassName`);
 *           in a column-flex page shell it grows to fill a short page (`flex-1`).
 *   inset   for a page that is rendered INSIDE a padded container it does not own (the app
 *           shell's <main>): the band stays in the column and its colour floods to the screen
 *           edges and down to the bottom of the page — without widening the page (a box-shadow
 *           is not scrollable overflow).
 *
 * Candidate for src/components/ui (the app layout could then own the inset one).
 */
export function FooterBand({
  variant = "page",
  containerClassName = "container-content",
  className,
  children,
  ...props
}: ComponentProps<"footer"> & { variant?: "page" | "inset"; containerClassName?: string }) {
  if (variant === "inset") {
    return (
      <footer
        data-slot="footer-band"
        className={cn(
          "mt-14 bg-paper-deep pt-5 pb-1 text-13 leading-[1.6] text-ink-2 shadow-[0_0_0_100vmax_var(--color-paper-deep)] [clip-path:inset(0_-100vmax_-100vmax_-100vmax)] md:mt-18",
          className,
        )}
        {...props}
      >
        {children}
      </footer>
    );
  }
  return (
    <footer data-slot="footer-band" className={cn("flex-1 bg-paper-deep pt-7 pb-8 text-13 leading-[1.6] text-ink-2 md:pt-8 md:pb-9", className)} {...props}>
      <div className={containerClassName}>{children}</div>
    </footer>
  );
}
