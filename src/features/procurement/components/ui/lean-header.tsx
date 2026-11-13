import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/ui/nav-link";
import { cn } from "@/lib/utils";

/*
 * Lean public header, for a page somebody lands on from an e-mail or a search result and
 * has one thing to do (a supplier page, a tender, "Flag a mistake"): the lockup on the
 * left; on the right one or two quiet links and at most one button. 64 px on a hairline,
 * 56 px on phones. Not sticky: the page's own first screen matters more than the bar.
 *
 *   <LeanHeader
 *     links={[{ href: "/", label: "What is Bidfolio?", phoneLabel: "What is this?" }, { href: "/sign-in", label: "Sign in", wideOnly: true }]}
 *     action={<ButtonLink href="#claim">Claim this page</ButtonLink>}
 *   />
 *
 * Links are <NavLink variant="header">, so "where you are" is marked the shared way.
 * `phoneLabel` is a shorter wording under 768 px; `wideOnly` hides a link there.
 *
 * Under 768 px the bar has room for little, and the page says what it keeps:
 *   phoneAction={false}  (default) the links not marked `wideOnly`, underlined so that bare
 *                        words beside the lockup read as links; the button is hidden, because
 *                        the page carries that action in its first screen
 *   phoneAction          the button stays, with the links not marked `wideOnly` as plain words
 *
 * Candidate for src/components/ui or src/components/marketing (a `lean` SiteHeader).
 */
export type LeanHeaderLink = { href: string; label: string; phoneLabel?: string; wideOnly?: boolean };

export function LeanHeader({
  links,
  action,
  phoneAction = false,
  home = "/",
  className,
}: {
  links: LeanHeaderLink[];
  action?: ReactNode;
  phoneAction?: boolean;
  home?: string;
  className?: string;
}) {
  const buttonOnPhone = Boolean(action) && phoneAction;
  return (
    <header data-slot="lean-header" className={cn("border-b border-line bg-paper", className)}>
      <div className={cn("container-content flex min-h-14 items-center justify-between gap-x-4 gap-y-2 md:min-h-16 md:gap-x-8", buttonOnPhone && "max-md:pr-3")}>
        <Logo href={home} size="md" className="shrink-0" />
        <nav aria-label="Main" className={cn("flex min-w-0 items-center md:gap-x-7", buttonOnPhone ? "gap-x-3.5" : "gap-x-[1.125rem]")}>
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              variant="header"
              match="exact"
              className={cn(
                "shrink-0 text-sm whitespace-nowrap md:text-15",
                link.wideOnly && "max-md:hidden",
                !buttonOnPhone && "max-md:underline max-md:decoration-brand max-md:decoration-1 max-md:underline-offset-[3px]",
              )}
            >
              {link.phoneLabel ? (
                <>
                  <span className="md:hidden">{link.phoneLabel}</span>
                  <span className="max-md:hidden">{link.label}</span>
                </>
              ) : (
                link.label
              )}
            </NavLink>
          ))}
          {action ? <span className={cn("flex min-w-0", !buttonOnPhone && "max-md:hidden")}>{action}</span> : null}
        </nav>
      </div>
    </header>
  );
}
