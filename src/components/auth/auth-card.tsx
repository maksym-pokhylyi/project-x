import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
