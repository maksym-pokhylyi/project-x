import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

/**
 * Frame for the pages nobody wants to see: not found, no access, something broke, maintenance.
 * One calm column: what happened in plain words, what to do next, and a reference where there is one.
 */
export function SystemPage({
  code,
  title,
  children,
  actions,
  reference,
}: {
  /** Short label above the title, e.g. "404" or "Error". */
  code: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** A reference the person can quote to support. */
  reference?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-5 sm:px-8">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-center px-4 pt-6 pb-24 sm:px-8">
        <div className="mx-auto w-full max-w-lg">
          <p className="type-ref font-medium text-ink-2">{code}</p>
          <h1 className="type-h1 mt-3 text-ink">{title}</h1>
          <div className="type-lead mt-4 space-y-3">{children}</div>
          {actions ? <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
          {reference ? <p className="mt-8 border-t border-line pt-4 text-13 text-ink-2">{reference}</p> : null}
        </div>
      </main>
    </div>
  );
}
