import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * 404 inside the app: the top bar stays, so the way back is one click away. Same words and
 * type as the public 404 (NotFound artboards), with the app's own destinations.
 */
export default function AppNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col py-8 md:py-14">
      <p className="font-mono text-13 leading-[1.5] text-ink-2">404</p>
      <h1 className="type-h1 mt-2.5 text-ink md:mt-3">This page is not here</h1>
      <p className="type-lead mt-2.5 text-ink md:mt-3.5">The link may be old, or the item may have been removed from this workspace.</p>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row md:mt-8">
        <ButtonLink href="/app">Go to your radar</ButtonLink>
      </div>
      <nav aria-label="Other pages" className="mt-3 flex flex-wrap gap-x-6 md:mt-4 md:gap-x-7">
        <Link href="/app/settings/workspace" className="link inline-flex min-h-11 items-center rounded-sm text-15">
          Workspace settings
        </Link>
        <Link href="/contact" className="link inline-flex min-h-11 items-center rounded-sm text-15">
          Contact us
        </Link>
      </nav>
    </div>
  );
}
