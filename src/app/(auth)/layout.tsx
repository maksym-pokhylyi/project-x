import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="px-4 py-5">
        <div className="mx-auto max-w-6xl">
          <Logo />
        </div>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
