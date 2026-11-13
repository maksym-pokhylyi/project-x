import { features } from "@/env";
import { json, route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Billing state of the ACTIVE workspace, read from our database (which only webhooks
 * write). The checkout success page polls this until the plan is active — the browser's
 * "payment succeeded" signal is never trusted on its own.
 */
export const dynamic = "force-dynamic";

export const GET = route(async (_request, _context, { requestId }) => {
  const ctx = await requireOrg();
  return json(
    {
      organizationId: ctx.organization.id,
      planKey: ctx.entitlements.planKey,
      isPaid: ctx.entitlements.isPaid,
      source: ctx.entitlements.source,
      subscriptionStatus: ctx.subscription?.status ?? null,
      /** Billing runs against the Paddle sandbox: the UI must show "Test mode — no real payments". */
      testMode: features.billingTestMode,
    },
    { requestId },
  );
});
