import { features } from "@/env";

/**
 * "Test mode" banner for every screen where a checkout or billing state is shown.
 *
 * Rendered whenever billing runs against the Paddle SANDBOX (`features.billingTestMode`):
 * local development, preview deployments, and a production deployment that explicitly
 * opted in with ALLOW_SANDBOX_BILLING=1. Nobody should mistake a test purchase for a real one.
 * Server component: reads the flag itself, so pages only need to place it.
 */
export function TestModeNotice() {
  if (!features.billingTestMode) return null;
  return (
    <p role="status" data-testid="billing-test-mode" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
      <strong>Test mode — no real payments.</strong> Billing is connected to the Paddle sandbox: use Paddle&apos;s test cards. Plans bought
      here are not real purchases.
    </p>
  );
}
