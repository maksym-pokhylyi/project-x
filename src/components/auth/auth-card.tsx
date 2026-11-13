import type { ReactNode } from "react";

/**
 * Title, short description, the form, and a line of secondary navigation under it.
 * The title is the page's h1 in the display serif; the form sits directly on paper
 * (inputs are white with a line-strong edge, so they need no card behind them).
 */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-[25rem]">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.015em] text-balance text-ink md:text-[2rem] md:leading-[2.375rem]">{title}</h1>
      {description ? <p className="mt-2.5 text-base text-ink-2">{description}</p> : null}
      <div className="mt-7">{children}</div>
      {footer ? <div className="mt-7 border-t border-line pt-5 text-sm text-ink-2">{footer}</div> : null}
    </div>
  );
}
