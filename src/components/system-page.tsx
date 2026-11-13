import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

/**
 * Frame for the pages nobody wants to see: not found, no access, something broke, maintenance.
 * The public header's bar, then one calm column: a mono reference line, what happened in
 * plain words, what to do next, and a reference to quote where there is one.
 */
export function SystemPage({
  code,
  title,
  children,
  actions,
  reference,
}: {
  /** Short reference line above the title, e.g. "404 · Page not found". */
  code: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** A reference the person can quote to support. */
  reference?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex min-h-14 items-center border-b border-line px-5 md:min-h-[4.5rem] md:px-6">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-center px-5 pt-10 pb-24 md:px-6">
        <div className="mx-auto w-full max-w-[35rem]">
          <p className="type-ref text-ink-2">{code}</p>
          <h1 className="type-h1 mt-3 text-ink">{title}</h1>
          <div className="type-lead mt-4 flex flex-col gap-3 text-ink">{children}</div>
          {actions ? <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">{actions}</div> : null}
          {reference ? <p className="mt-8 border-t border-line pt-4 text-13 text-ink-2">{reference}</p> : null}
        </div>
      </main>
    </div>
  );
}
