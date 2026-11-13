import "server-only";
import { env, type ServerEnv } from "@/env";

/**
 * One-off products: things sold once, without a subscription (a Paddle price with no billing
 * cycle). The foundation only knows WHAT was bought and for which workspace; handing it over
 * is the job of the fulfilment hook (./fulfilment.ts).
 *
 * To add a product: add an entry here, the env var to src/env.ts and .env.example, and a
 * case to fulfilPurchase() / revokePurchase() in ./fulfilment.ts.
 */
export const ONE_OFF_PRODUCTS = {
  bid_pass: { priceEnvVar: "PADDLE_PRICE_BID_PASS", label: "Bid Pass" },
} as const satisfies Record<string, { priceEnvVar: keyof ServerEnv; label: string }>;

export type OneOffKind = keyof typeof ONE_OFF_PRODUCTS;
export const ONE_OFF_KINDS = Object.keys(ONE_OFF_PRODUCTS) as [OneOffKind, ...OneOffKind[]];

export function isOneOffKind(value: unknown): value is OneOffKind {
  return typeof value === "string" && (ONE_OFF_KINDS as readonly string[]).includes(value);
}

/** Paddle price id of a one-off product from env, or null when it is not configured. */
export function getOneOffPriceId(kind: OneOffKind): string | null {
  const value = env[ONE_OFF_PRODUCTS[kind].priceEnvVar];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Reverse lookup used by webhooks: which one-off product does this Paddle price sell? */
export function oneOffFromPriceId(priceId: string | null | undefined): OneOffKind | null {
  if (!priceId) return null;
  for (const kind of ONE_OFF_KINDS) {
    if (getOneOffPriceId(kind) === priceId) return kind;
  }
  return null;
}
