import Link from "next/link";
import { SystemPage } from "@/components/system-page";
import { Button } from "@/components/ui/button";

/** Rendered (with HTTP 403) whenever a page calls forbidden(). */
export default function Forbidden() {
  return (
    <SystemPage
      code="403"
      title="You don't have access to this page"
      actions={
        <Button asChild size="lg">
          <Link href="/app">Back to your radar</Link>
        </Button>
      }
    >
      <p>Your role in this workspace does not allow it. If you think that is a mistake, ask a workspace owner to change your role.</p>
    </SystemPage>
  );
}
