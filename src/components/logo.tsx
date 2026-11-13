import Link from "next/link";
import { MARK, MARK_RATIO, MARK_VIEWBOX } from "@/components/logo-paths";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * The mark on its own (see logo-paths.ts for what it depicts). `size` is its height in
 * pixels; the width follows (3 : 4). One colour: currentColor, brand green by default.
 * Smallest size 16. Decorative by default; pass `title` when it stands alone.
 */
export function LogoMark({ size = 24, title, className }: { size?: number; title?: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MARK_VIEWBOX}
      width={size * MARK_RATIO}
      height={size}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("shrink-0 text-brand", className)}
    >
      <path d={MARK} />
    </svg>
  );
}

/** Font size of the wordmark; the mark is 0.91 of it and sits on the baseline. */
const sizes = {
  sm: "text-[1.375rem]", // 22 px: the app bar and phone headers (smallest lockup)
  md: "text-[1.375rem] md:text-[1.625rem]", // 26 px from 768 px: public header and footer
  lg: "text-[2.75rem]", // 44 px: auth pages on a desk, splash
} as const;

const tones = {
  default: { mark: "text-brand", word: "text-ink" },
  ink: { mark: "text-ink", word: "text-ink" },
  inverse: { mark: "text-white", word: "text-white" },
  paper: { mark: "text-paper", word: "text-paper" },
} as const;

/**
 * The lockup: mark and "Bidfolio" in Source Serif 4 Semibold (−0.015em, optical size 32),
 * aligned on the baseline. One colour pair at a time: green mark with ink word on light,
 * white or paper on dark. Not a link.
 */
export function Wordmark({
  size = "md",
  tone = "default",
  className,
}: {
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-[0.31em] leading-none", sizes[size], className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={MARK_VIEWBOX}
        fill="currentColor"
        aria-hidden
        focusable="false"
        className={cn("h-[0.91em] w-[0.6825em] shrink-0", tones[tone].mark)}
      >
        <path d={MARK} />
      </svg>
      <span
        className={cn("font-display leading-none font-semibold tracking-[-0.015em]", tones[tone].word)}
        style={{ fontVariationSettings: "'opsz' 32" }}
      >
        {site.name}
      </span>
    </span>
  );
}

/** The lockup as a link home. The link's accessible name is the product name. */
export function Logo({
  href = "/",
  size = "md",
  tone = "default",
  className,
}: {
  href?: string;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center rounded-sm py-2", className)}>
      <Wordmark size={size} tone={tone} />
    </Link>
  );
}
