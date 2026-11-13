/**
 * Writes model-generated match reasons for one supplier's top matches and prints them
 * next to the rule-based ones — a live check of the optional LLM step.
 *
 *   NODE_USE_ENV_PROXY=1 pnpm exec tsx --import ./scripts/register-server-only.mjs scripts/procurement-reasons.ts <supplier-slug> [--limit 5]
 *
 * Needs AI Gateway credentials (AI_GATEWAY_API_KEY, or VERCEL_OIDC_TOKEN from `vercel env pull`);
 * `--env-file <path>` loads them from another file. The model comes from
 * AI_MODEL_MATCH_REASON (default google/gemini-2.5-flash-lite). Spend is charged to a local
 * "dev-match-reasons" workspace and logged in ai_usage. Local databases only.
 */
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { loadEnv } from "./load-env.mjs";

loadEnv();

async function main() {
  const args = process.argv.slice(2);
  const valueOf = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const envFile = valueOf("--env-file");
  if (envFile && existsSync(envFile)) process.loadEnvFile(envFile);
  const slug = args.find((arg, index) => !arg.startsWith("--") && !["--limit", "--env-file"].includes(args[index - 1] ?? ""));
  if (!slug) throw new Error("Usage: procurement-reasons <supplier-slug> [--limit n] [--env-file path]");
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error("procurement-reasons is a development tool: local databases only.");

  const { db, pg } = await import("../src/db");
  const { getSupplierBySlug } = await import("../src/features/procurement/queries/suppliers");
  const { getSupplierSpec } = await import("../src/features/procurement/queries/shared");
  const { getMatchesForSpec } = await import("../src/features/procurement/queries/matches");
  const { generateMatchReasons } = await import("../src/features/procurement/radar/reasons-ai");
  const { procurementConfig } = await import("../src/features/procurement/config");
  try {
    const supplier = await getSupplierBySlug(slug);
    const spec = supplier ? await getSupplierSpec(supplier.id) : null;
    if (!supplier || !spec) throw new Error(`No supplier profile for "${slug}"`);
    await db.execute(sql`
      insert into organizations (id, name, slug, created_at, metadata)
      values ('dev-match-reasons', 'Dev match reasons', 'dev-match-reasons', now(), '{"personal":false}')
      on conflict (id) do nothing
    `);
    const limit = Number(valueOf("--limit") ?? 5);
    const before = await getMatchesForSpec(spec, { limit });
    console.log(`${supplier.name}: ${before.total} matches; asking ${procurementConfig.matchReasonModel} about the top ${before.items.length}`);
    const cached = await generateMatchReasons({ organizationId: "dev-match-reasons" }, spec, before.items);
    const after = await getMatchesForSpec(spec, { limit });
    for (const [index, item] of after.items.entries()) {
      console.log(`\n${index + 1}. ${item.title.slice(0, 90)} — ${item.buyerName ?? "?"}`);
      console.log(`   rule: ${before.items[index]?.reasonSource === "rule" ? before.items[index]!.reason : "(already cached)"}`);
      console.log(`   ${item.reasonSource === "ai" ? "ai:  " : "ai:   (none — rule-based reason stays)"} ${item.reasonSource === "ai" ? item.reason : ""}`);
    }
    const usage = await db.execute<{ calls: string; input: string; output: string; cost: string }>(sql`
      select count(*) as calls, coalesce(sum(input_tokens), 0) as input, coalesce(sum(output_tokens), 0) as output, coalesce(sum(cost_usd), 0) as cost
      from ai_usage where organization_id = 'dev-match-reasons' and feature = 'radar-match-reasons'
    `);
    console.log(`\ncached ${cached} reasons. ai_usage so far for this dev workspace:`, usage[0]);
  } finally {
    await pg.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message).slice(0, 1200) : error);
  process.exit(1);
});
