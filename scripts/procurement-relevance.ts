/**
 * Eyeball check of radar relevance on real suppliers.
 *
 *   pnpm exec tsx --import ./scripts/register-server-only.mjs scripts/procurement-relevance.ts            # one SME per major trade
 *   pnpm exec tsx --import ./scripts/register-server-only.mjs scripts/procurement-relevance.ts <slug>...  # specific suppliers
 *
 * Prints, per supplier: profile, top matches with scores and reasons, contracts ending
 * soon in the trade, buyers awarding in the trade, early signals.
 */
import { sql } from "drizzle-orm";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const DIVISIONS = ["45", "85", "79", "72", "71", "50", "48", "80", "90", "60", "33", "77", "55", "98", "34", "92", "66", "39"];

async function main() {
  const { db, pg } = await import("../src/db");
  const { queryRows } = await import("../src/features/procurement/ingest/sql");
  const { getSupplierBySlug } = await import("../src/features/procurement/queries/suppliers");
  const { getSupplierMatches, getEarlySignals } = await import("../src/features/procurement/queries/matches");
  const { getEndingSoon } = await import("../src/features/procurement/queries/contracts");
  const { getBuyersForSupplier } = await import("../src/features/procurement/queries/buyers");
  const { formatMoneyShort } = await import("../src/features/procurement/domain/money");
  const { cpvDivisionLabel } = await import("../src/features/procurement/domain/cpv");

  const slugs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (slugs.length === 0) {
    for (const division of DIVISIONS) {
      // A typical outreach target: an SME with a company number and 2–8 awards, mostly in this division.
      const rows = await queryRows<{ slug: string }>(
        db,
        sql`
          select s.slug from suppliers s join supplier_profiles p on p.supplier_id = s.id
          where s.scale = 'sme' and s.coh is not null and s.merged_into is null and s.awards_count between 2 and 8
            and p.cpv_divisions[1] = ${division}
          order by md5(s.id) limit 1
        `,
      );
      if (rows[0]) slugs.push(rows[0].slug);
    }
  }

  const money = (value: number | null) => formatMoneyShort(value) ?? "n/p";
  for (const slug of slugs) {
    const supplier = await getSupplierBySlug(slug);
    if (!supplier) {
      console.log(`\n### ${slug}: not found`);
      continue;
    }
    const started = Date.now();
    const [matches, ending, buyers, signals] = await Promise.all([
      getSupplierMatches(supplier.id, { limit: 6 }),
      getEndingSoon(supplier.id, 9, { limit: 4 }),
      getBuyersForSupplier(supplier.id, { limit: 4 }),
      getEarlySignals(supplier.id, { limit: 3 }),
    ]);
    const elapsed = Date.now() - started;
    console.log(`\n### ${supplier.name}  [${supplier.companyNumber ?? "no CH number"}]  ${supplier.awardsCount} contracts · ${money(supplier.totalValue)} · ${supplier.buyersCount} buyers  (${elapsed} ms)`);
    console.log(`    trade: ${supplier.profile?.cpvDivisions.map((division) => cpvDivisionLabel(division)).join("; ")}`);
    console.log(`    top CPV: ${supplier.profile?.topCpv.map((entry) => `${entry.code} ${entry.label ?? ""}`).join(" | ")}`);
    console.log(`    keywords: ${supplier.profile?.keywords.join(", ")}`);
    console.log(`    regions: ${supplier.profile?.regions.join(", ")}  band: ${money(supplier.profile?.valueLow ?? null)}–${money(supplier.profile?.valueHigh ?? null)}`);
    console.log(`  MATCHES (${matches.total})`);
    for (const item of matches.items) {
      console.log(
        `    ${item.score.toFixed(2)} [cpv ${item.breakdown.cpv.toFixed(2)} txt ${item.breakdown.text.toFixed(2)} reg ${item.breakdown.regionMatch}] ${item.title.slice(0, 80)} — ${item.buyerName ?? "?"} · ${money(item.valueAmount)} · ${item.regions.join("/")}`,
      );
      console.log(`         why: ${item.reason}`);
    }
    console.log(`  ENDING SOON (${ending.total})`);
    for (const item of ending.items) {
      console.log(`    ${item.contractEnd?.slice(0, 10)} ${item.title.slice(0, 70)} — ${item.buyerName ?? "?"} · incumbent ${item.supplierLabel} · ${money(item.valueAmount)} ${item.sameRegion ? "· same region" : ""}`);
    }
    console.log(`  BUYERS (${buyers.total})`);
    for (const item of buyers.items) {
      console.log(`    ${item.name} — ${item.awards} awards, ${item.withoutOpenCompetition} without open competition (${Math.round(item.shareWithoutOpen * 100)}%) · ${money(item.totalValue)} ${item.sameRegion ? "· same region" : ""}`);
    }
    console.log(`  EARLY SIGNALS (${signals.total})`);
    for (const item of signals.items) console.log(`    ${item.score.toFixed(2)} ${item.title.slice(0, 80)} — ${item.buyerName ?? "?"}  why: ${item.reason}`);
  }
  await pg.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message).slice(0, 1500) : error, error instanceof Error && error.cause ? `\ncause: ${String(error.cause).slice(0, 500)}` : "");
  process.exit(1);
});
