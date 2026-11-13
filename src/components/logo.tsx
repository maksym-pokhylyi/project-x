import Link from "next/link";
import { MARK_16, MARK_24 } from "@/components/logo-paths";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * The mark on its own (see logo-paths.ts for what it depicts). One colour: currentColor,
 * brand green by default. Below 20 px it switches to the drawing made for the 16 px grid.
 * Decorative by default; pass `title` when it stands alone as a link or image.
 */
export function LogoMark({ size = 24, title, className }: { size?: number; title?: string; className?: string }) {
  const small = size < 20;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={small ? "0 0 16 16" : "0 0 24 24"}
      width={size}
      height={size}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("shrink-0 text-brand", className)}
    >
      <path d={small ? MARK_16 : MARK_24} />
    </svg>
  );
}

const sizes = {
  sm: { mark: 20, text: "text-lg leading-6" },
  md: { mark: 24, text: "text-xl leading-7" },
  lg: { mark: 32, text: "text-2xl leading-8" },
} as const;

/** The lockup (mark + wordmark in the display serif, sentence case). Not a link. */
export function Wordmark({
  size = "md",
  tone = "default",
  className,
}: {
  size?: keyof typeof sizes;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={sizes[size].mark} className={tone === "inverse" ? "text-paper" : undefined} />
      <span className={cn("font-display font-semibold tracking-[-0.01em]", sizes[size].text, tone === "inverse" ? "text-paper" : "text-ink")}>{site.name}</span>
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
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center rounded-sm", className)}>
      <Wordmark size={size} tone={tone} />
    </Link>
  );
}
