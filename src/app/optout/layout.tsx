import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { site } from "@/config/site";

/** A quiet shell for the opt-out page: the name of the sender, the content, and where to read more. No navigation to sell anything. */
export default function OptOutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="px-4 py-5">
        <div className="mx-auto max-w-2xl">
          <Logo />
        </div>
      </header>
      <main id="main" className="flex-1 px-4 pb-12 pt-2 sm:pt-6">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
      <footer className="px-4 py-6 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-2xl flex-wrap gap-x-4 gap-y-1">
          <span>{site.name} is an independent commercial service, not part of the UK Government.</span>
          <Link href="/legal/privacy" className="underline underline-offset-4">
            Privacy notice
          </Link>
          <Link href="/about-the-data" className="underline underline-offset-4">
            About the data
          </Link>
          <Link href="/contact" className="underline underline-offset-4">
            Contact
          </Link>
        </div>
      </footer>
    </div>
  );
}
