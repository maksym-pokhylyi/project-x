/**
 * Checks that every configured model step answers through the gateway (a few tokens each).
 * Run it after changing AI_MODEL_* or when the account's model access changes:
 *
 *   NODE_USE_ENV_PROXY=1 pnpm tsx --import ./scripts/register-server-only.mjs scripts/bids/model-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { loadEnv } from "../load-env.mjs";

loadEnv();
const gatewayEnv = process.env.BIDS_GATEWAY_ENV_FILE ?? "/home/user/vtest/.env.local";
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && existsSync(gatewayEnv)) {
  for (const line of readFileSync(gatewayEnv, "utf8").split("\n")) {
    const match = /^(VERCEL_OIDC_TOKEN|AI_GATEWAY_API_KEY)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]!] = match[2]!.replace(/^"|"$/g, "");
  }
}

async function main() {
  const { db, pg } = await import("../../src/db");
  const { organizations } = await import("../../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const { MODEL_STEPS, modelIdsFor } = await import("../../src/features/bids/server/ai/models");
  const { callText } = await import("../../src/features/bids/server/ai/call");
  const organizationId = `modelcheck_${Date.now().toString(36)}`;
  await db.insert(organizations).values({ id: organizationId, name: "Model check", slug: organizationId, createdAt: new Date() });
  const seen = new Set<string>();
  for (const step of Object.keys(MODEL_STEPS) as Array<keyof typeof MODEL_STEPS>) {
    const { primary } = modelIdsFor(step);
    if (seen.has(primary)) continue;
    seen.add(primary);
    const started = Date.now();
    try {
      const result = await callText({ organizationId, feature: "bids.model_check", step, system: "Answer with one word.", messages: "Reply with the single word OK.", maxOutputTokens: 2_000, timeoutMs: 60_000 });
      console.log(`${step.padEnd(10)} ${result.model.padEnd(30)} ok "${result.text.trim().slice(0, 20)}" in=${result.usage.inputTokens} out=${result.usage.outputTokens} ${Date.now() - started}ms $${result.usage.costUsd.toFixed(5)}`);
    } catch (error) {
      console.log(`${step.padEnd(10)} ${primary.padEnd(30)} FAILED ${error instanceof Error ? `${error.name}: ${error.message.slice(0, 160)}` : String(error)}`);
    }
  }
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  await pg.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
