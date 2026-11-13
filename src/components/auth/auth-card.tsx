import type { ReactNode } from "react";

/** Title, short description, the form, and a line of secondary navigation under it. */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-sm">
      <h1 className="type-h2 text-ink">{title}</h1>
      {description ? <p className="mt-2 text-base text-ink-2">{description}</p> : null}
      <div className="mt-8">{children}</div>
      {footer ? <div className="mt-8 border-t border-line pt-5 text-sm text-ink-2">{footer}</div> : null}
    </div>
  );
}
