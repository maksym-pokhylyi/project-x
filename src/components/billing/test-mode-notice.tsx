import { NoticeBand } from "@/components/ui/notice-band";
import { features } from "@/env";

/**
 * "Test mode" band for every screen where a checkout or billing state is shown, as in the
 * billing artboard: an info-tint band with the lead "Test mode." in info blue.
 *
 * Rendered whenever billing runs against the Paddle SANDBOX (`features.billingTestMode`):
 * local development, preview deployments, and a production deployment that explicitly
 * opted in with ALLOW_SANDBOX_BILLING=1. Nobody should mistake a test purchase for a real one.
 * Server component: reads the flag itself, so pages only need to place it.
 *
 * By default it is a full-width band directly under the top bar: the app layout places it
 * there on Billing and the checkout confirmation (see OnBillingRoutes). `inline` makes it a
 * rounded panel for use inside a page column.
 */
export function TestModeNotice({ inline = false }: { inline?: boolean } = {}) {
  if (!features.billingTestMode) return null;
  return (
    <NoticeBand
      tone="info"
      role="status"
      data-testid="billing-test-mode"
      className={inline ? "rounded-control" : undefined}
      containerClassName={inline ? "px-4" : "container-app"}
    >
      <strong className="font-semibold">Test mode.</strong> Payments are simulated and no card is charged.
    </NoticeBand>
  );
}
