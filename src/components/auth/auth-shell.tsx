import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { identity } from "@/config/site";
import { cn } from "@/lib/utils";
import { AuthHeaderLink } from "./auth-header-link";

/**
 * Frame of the sign-in, sign-up, password and invitation pages, as in the SignIn / SignUp
 * artboards: the public header's bar with one link, the page's column on paper, and the
 * independence line under a hairline at the foot of the window. No imagery, no animation.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="container-content flex min-h-14 items-center justify-between gap-4 md:min-h-[4.5rem]">
          <Logo />
          {/* Reads the address bar: it must not hold up the static shell around it. */}
          <Suspense fallback={null}>
            <AuthHeaderLink />
          </Suspense>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="container-content flex flex-1 flex-col justify-end pb-7">
        <p className="border-t border-line pt-4 text-13 leading-[1.6] text-ink-2 sm:pt-5">{identity.independence}</p>
      </footer>
    </div>
  );
}

/** One centred column, 440 px wide: sign in, passwords, verification, invitations. */
export function AuthColumn({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto flex w-full max-w-[30.5rem] flex-col px-5 pt-6 pb-9 sm:px-6 sm:pt-[4.5rem] sm:pb-14", className)}>{children}</div>;
}
