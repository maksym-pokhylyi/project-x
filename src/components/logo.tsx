import Link from "next/link";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

/** Text wordmark. Swap for an <Image> when a real logo exists. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-base font-semibold tracking-tight", className)}>
      <span aria-hidden className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        {site.name.charAt(0)}
      </span>
      {site.name}
    </Link>
  );
}
