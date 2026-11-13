import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Rendered (with HTTP 403) whenever a page calls forbidden(). */
export default function Forbidden() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="text-2xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your role in this workspace does not allow it. Ask a workspace owner if you think this is a mistake.
      </p>
      <Button asChild>
        <Link href="/app">Back to the app</Link>
      </Button>
    </main>
  );
}
