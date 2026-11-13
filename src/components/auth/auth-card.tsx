import type { ReactNode } from "react";
import { controlSize } from "@/components/ui/control-group";
import { cn } from "@/lib/utils";

/**
 * The white card of the sign-in and sign-up artboards: the page's h1 in the display serif,
 * an optional line under it, then the form. Everything inside is a form in the sense of the
 * control scale: fields and buttons are 48 px tall (52 px on phones) without saying so.
 *
 * `footer` is a quieter block inside the card under a hairline (the terms line);
 * `below` sits under the card, centred (the "New to Bidfolio?" line).
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  below,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  below?: ReactNode;
  className?: string;
}) {
  return (
    <>
      <div data-slot="auth-card" className={cn("flex flex-col rounded-card border border-line bg-surface px-5 py-6 sm:px-10 sm:py-9", controlSize("form"), className)}>
        <h1 className="font-display text-3xl leading-[1.15] font-semibold tracking-[-0.015em] text-ink sm:text-4xl sm:leading-[1.12]">{title}</h1>
        {description ? <p className="mt-2.5 text-15 leading-[1.5] text-ink-2">{description}</p> : null}
        <div className="mt-5 sm:mt-6">{children}</div>
        {footer ? <div className="mt-1.5 border-t border-line pt-3.5 text-13 leading-[1.6] text-ink-2 sm:pt-4">{footer}</div> : null}
      </div>
      {below ? <div className="mt-2 flex min-h-11 flex-wrap items-center justify-center gap-x-1.5 text-15 text-ink sm:mt-3">{below}</div> : null}
    </>
  );
}

/** A line of secondary navigation inside the card: "Already have an account? Sign in". */
export function AuthCardLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("flex min-h-11 flex-wrap items-center gap-x-1.5 text-sm text-ink", className)}>{children}</p>;
}
