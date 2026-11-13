/**
 * Creates/updates the Paddle products and prices described by src/config/plans.ts:
 * every paid plan (monthly and annual, with the plan's trial where it has one) and the
 * one-off Bid Pass, all in the catalogue currency (GBP) and tax-exclusive ("external" tax
 * mode: the amounts are net and Paddle adds VAT at checkout where it applies).
 *
 *   PADDLE_API_KEY=... PADDLE_ENV=sandbox pnpm paddle:setup            # apply
 *   PADDLE_API_KEY=... PADDLE_ENV=sandbox pnpm paddle:setup --dry-run  # only print the plan
 *
 * Idempotent: objects are matched by the custom_data this script writes, so running it
 * again changes nothing unless the catalogue changed. If a price's amount, currency, cycle,
 * trial or tax mode differs, a NEW price is created and the old one archived (existing
 * subscribers stay on the old price — migrating them is a business decision, do it
 * deliberately in Paddle).
 * Prints the PADDLE_PRICE_* env lines to set. The API key needs Product and Price write
 * permissions. Optional: PADDLE_TAX_CATEGORY (default "standard"; "saas" once approved).
 */
import { Environment, LogLevel, Paddle, type TaxCategory } from "@paddle/paddle-node-sdk";
import {
  formatEnvLines,
  planPriceActions,
  planProductActions,
  type CatalogueKey,
  type DesiredPrice,
  type PriceInterval,
  type RemotePrice,
  type RemoteProduct,
} from "../src/lib/billing/paddle-catalogue";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const dryRun = process.argv.includes("--dry-run");
const apiKey = process.env.PADDLE_API_KEY;
const environment = process.env.PADDLE_ENV === "production" ? Environment.production : Environment.sandbox;
const taxCategory = (process.env.PADDLE_TAX_CATEGORY ?? "standard") as TaxCategory;

if (!apiKey) {
  console.error("PADDLE_API_KEY is not set. Create one in Paddle > Developer tools > Authentication.");
  process.exit(1);
}

const paddle = new Paddle(apiKey, { environment, logLevel: LogLevel.error });

async function listProducts(): Promise<RemoteProduct[]> {
  const out: RemoteProduct[] = [];
  for await (const product of paddle.products.list({ status: ["active"], perPage: 200 })) {
    out.push({
      id: product.id,
      name: product.name,
      description: product.description,
      status: product.status,
      customData: (product.customData as Record<string, unknown> | null) ?? null,
    });
  }
  return out;
}

async function listPrices(productId: string): Promise<RemotePrice[]> {
  const out: RemotePrice[] = [];
  for await (const price of paddle.prices.list({ productId: [productId], status: ["active"], perPage: 200 })) {
    out.push({
      id: price.id,
      productId: price.productId,
      status: price.status,
      amount: price.unitPrice.amount,
      currencyCode: price.unitPrice.currencyCode,
      interval: price.billingCycle?.interval ?? null,
      frequency: price.billingCycle?.frequency ?? null,
      trial: price.trialPeriod ? { interval: price.trialPeriod.interval, frequency: price.trialPeriod.frequency } : null,
      taxMode: price.taxMode,
      customData: (price.customData as Record<string, unknown> | null) ?? null,
    });
  }
  return out;
}

/** "pro/month GBP 149.00 excl. tax, 14-day trial" */
function describe(price: DesiredPrice): string {
  const amount = `${price.currencyCode} ${(Number(price.amount) / 100).toFixed(2)}`;
  return `${price.plan}/${price.interval} ${amount} excl. tax${price.trialDays ? `, ${price.trialDays}-day trial` : ""}`;
}

async function main() {
  console.log(`Paddle ${environment}${dryRun ? " (dry run — nothing will be changed)" : ""}`);
  const products = await listProducts();
  const priceIds: Array<{ plan: CatalogueKey; interval: PriceInterval; id: string }> = [];

  for (const action of planProductActions(products)) {
    const { desired } = action;
    let productId: string | null = action.type === "create" ? null : action.id;

    if (action.type === "create") {
      console.log(`+ product  ${desired.name}`);
      if (!dryRun) {
        const created = await paddle.products.create({
          name: desired.name,
          description: desired.description,
          taxCategory,
          customData: desired.customData,
        });
        productId = created.id;
      }
    } else if (action.type === "update") {
      console.log(`~ product  ${desired.name} (${action.id})`);
      if (!dryRun) await paddle.products.update(action.id, { name: desired.name, description: desired.description });
    } else {
      console.log(`= product  ${desired.name} (${action.id})`);
    }

    const existingPrices = productId ? await listPrices(productId) : [];
    for (const priceAction of planPriceActions(desired.plan, existingPrices)) {
      const price = priceAction.desired;
      const label = describe(price);
      if (priceAction.type === "keep") {
        console.log(`  = price  ${label} (${priceAction.id})`);
        priceIds.push({ plan: price.plan, interval: price.interval, id: priceAction.id });
        continue;
      }
      console.log(`  ${priceAction.type === "create" ? "+" : "~"} price  ${label}${priceAction.type === "replace" ? ` (replaces ${priceAction.archiveId})` : ""}`);
      if (dryRun || !productId) continue;
      const created = await paddle.prices.create({
        productId,
        name: price.name,
        description: price.description,
        unitPrice: { amount: price.amount, currencyCode: price.currencyCode },
        /* Net amounts: Paddle adds VAT on top at checkout (its default would include it). */
        taxMode: price.taxMode,
        /* A one-off price (the Bid Pass) has no billing cycle and no trial. */
        ...(price.interval === "once" ? {} : { billingCycle: { interval: price.interval, frequency: 1 } }),
        ...(price.trialDays ? { trialPeriod: { interval: "day" as const, frequency: price.trialDays } } : {}),
        quantity: { minimum: 1, maximum: 1 },
        customData: price.customData,
      });
      priceIds.push({ plan: price.plan, interval: price.interval, id: created.id });
      if (priceAction.type === "replace") {
        await paddle.prices.update(priceAction.archiveId, { status: "archived" });
        console.log(`    archived ${priceAction.archiveId} — existing subscribers stay on it until you migrate them`);
      }
    }
  }

  console.log("\nSet these environment variables (Vercel > Project > Settings > Environment Variables, and .env.local):\n");
  for (const line of formatEnvLines(priceIds)) console.log(line);
  if (dryRun) console.log("\nDry run: price ids are only shown for prices that already exist.");
}

main().catch((error) => {
  console.error("paddle:setup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
