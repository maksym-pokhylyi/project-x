"use client";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. The server error itself is recorded by
 * src/instrumentation.ts (error_log); `digest` is the reference that links the two.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We have been notified. You can try again; if it keeps happening, contact support
        {error.digest ? ` and mention reference ${error.digest}` : ""}.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
