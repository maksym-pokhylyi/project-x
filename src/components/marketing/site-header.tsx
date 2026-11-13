import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

/** Marketing header. Static (no session read) so marketing pages stay cacheable. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Start free</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
