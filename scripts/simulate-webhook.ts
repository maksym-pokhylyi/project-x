/**
 * Sends a correctly SIGNED fake Paddle subscription event to the local app, so paid
 * states can be exercised without a Paddle account.
 *
 *   pnpm paddle:simulate <organizationId> [plan=pro] [interval=month] [status=active]
 *
 *   status: active | trialing | past_due | paused | canceled
 *   Requires PADDLE_WEBHOOK_SECRET and the PADDLE_PRICE_* variables in .env.local (any
 *   placeholder values work locally, e.g. PADDLE_PRICE_PRO_MONTHLY=pri_local_pro_monthly).
 *   Target URL: SIMULATE_URL or NEXT_PUBLIC_APP_URL or http://localhost:3000.
 *
 * Refuses to run against non-local URLs: never point it at production.
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

async function main() {
  const [organizationId, plan = "pro", interval = "month", status = "active"] = process.argv.slice(2);
  if (!organizationId) throw new Error("Usage: pnpm paddle:simulate <organizationId> [plan] [interval] [status]");

  const base = process.env.SIMULATE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error(`Refusing to simulate against ${base}`);
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) throw new Error("PADDLE_WEBHOOK_SECRET is not set");

  const { isBillingInterval, isPlanKey } = await import("../src/config/plans");
  const { getPriceId } = await import("../src/lib/billing/prices");
  const { signPaddlePayload } = await import("../src/lib/billing/webhook-signature");
  if (!isPlanKey(plan) || plan === "free" || !isBillingInterval(interval)) throw new Error("Unknown plan or interval");
  const priceId = getPriceId(plan, interval);
  if (!priceId) throw new Error(`No price id configured for ${plan}/${interval}`);

  const now = new Date();
  const periodEnd = new Date(now.getTime() + (interval === "year" ? 365 : 30) * 24 * 60 * 60 * 1000);
  const suffix = organizationId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  const body = JSON.stringify({
    event_id: `evt_sim_${Date.now()}`,
    event_type: "subscription.updated",
    occurred_at: now.toISOString(),
    notification_id: `ntf_sim_${Date.now()}`,
    data: {
      id: `sub_sim_${suffix}`,
      status,
      customer_id: `ctm_sim_${suffix}`,
      custom_data: { organization_id: organizationId },
      items: [{ quantity: 1, price: { id: priceId, product_id: "pro_sim" }, trial_dates: null }],
      billing_cycle: { interval, frequency: 1 },
      current_billing_period: { starts_at: now.toISOString(), ends_at: periodEnd.toISOString() },
      scheduled_change: null,
      canceled_at: status === "canceled" ? now.toISOString() : null,
      paused_at: status === "paused" ? now.toISOString() : null,
      next_billed_at: periodEnd.toISOString(),
    },
  });

  const response = await fetch(`${base}/api/webhooks/paddle`, {
    method: "POST",
    headers: { "content-type": "application/json", "paddle-signature": signPaddlePayload(body, secret) },
    body,
  });
  console.log(response.status, await response.text());
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
