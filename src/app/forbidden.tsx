import { SystemPage } from "@/components/system-page";
import { ButtonLink } from "@/components/ui/button-link";

/** Rendered (with HTTP 403) whenever a page calls forbidden(). */
export default function Forbidden() {
  return (
    <SystemPage code="403" title="You don't have access to this page" actions={<ButtonLink href="/app" size="form">Back to your radar</ButtonLink>}>
      <p>Your role in this workspace does not allow it. If you think that is a mistake, ask a workspace owner to change your role.</p>
    </SystemPage>
  );
}
