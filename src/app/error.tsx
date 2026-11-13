"use client";

import Link from "next/link";
import { SystemPage } from "@/components/system-page";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";

/**
 * Route-level error boundary. The server error itself is recorded by
 * src/instrumentation.ts (error_log); `digest` is the reference that links the two.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SystemPage
      code="Error"
      title="Something went wrong"
      actions={
        <>
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Back to the homepage</Link>
          </Button>
        </>
      }
      reference={
        error.digest ? (
          <>
            If it keeps happening, write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> and quote reference{" "}
            <span className="type-ref font-medium text-ink">{error.digest}</span>.
          </>
        ) : (
          <>
            If it keeps happening, write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          </>
        )
      }
    >
      <p>The page could not be shown. The problem has been recorded. Nothing you entered has been lost unless you were in the middle of saving it.</p>
    </SystemPage>
  );
}
