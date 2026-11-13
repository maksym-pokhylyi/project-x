/**
 * Dry run of the outreach list builder from the command line: the same selection the
 * /admin/outreach preview makes, printed as COUNTS ONLY — no company, no address.
 * Stores nothing.
 *
 *   pnpm exec tsx --import ./scripts/register-server-only.mjs scripts/outreach-preview.ts
 *   … scripts/outreach-preview.ts --days 21 --divisions 45,50 --groups 797 --regions UKE,UKF
 *   … scripts/outreach-preview.ts --named --any-size --batch 400 --min 25000 --max 500000
 *   … scripts/outreach-preview.ts --now 2026-09-25        # as if run on that day
 *
 * Uses DATABASE_URL from the environment / .env.local.
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : (process.argv[index + 1] ?? "");
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const { pg } = await import("../src/db");
  const { segmentFromParams, describeSegment } = await import("../src/features/outreach/domain/segment");
  const { EXCLUSION_LABELS, EXCLUSION_ORDER, reasonLabel } = await import("../src/features/outreach/domain/select");
  const { buildSelection } = await import("../src/features/outreach/server/builder");
  try {
    const parsed = segmentFromParams({
      divisions: flag("divisions"),
      groups: flag("groups"),
      regions: flag("regions"),
      days: flag("days"),
      min: flag("min"),
      max: flag("max"),
      mailbox: has("named") ? "generic_and_named" : "generic",
      size: has("any-size") ? "any" : "sme",
      batch: flag("batch"),
    });
    if (!parsed.segment) throw new Error(`Invalid segment: ${JSON.stringify(parsed.fieldErrors)}`);
    const nowFlag = flag("now");
    const now = nowFlag ? new Date(`${nowFlag}T12:00:00Z`) : new Date();
    if (Number.isNaN(now.getTime())) throw new Error("--now must be a date such as 2026-09-25");

    const { summary } = await buildSelection(parsed.segment, now);
    const database = new URL(process.env.DATABASE_URL ?? "postgres://unknown/unknown");
    const line = (label: string, value: number) => console.log(`${String(value).padStart(7)}  ${label}`);
    console.log(`Database: ${database.hostname}${database.pathname} · as of ${now.toISOString().slice(0, 10)}`);
    console.log(`Segment:  ${describeSegment(parsed.segment)} · batch ${parsed.segment.batchSize}\n`);
    line("companies with a matching award", summary.companiesMatched);
    line("  of them without a published contact address", summary.companiesWithoutAddress);
    line("addresses considered", summary.addressesConsidered);
    console.log("");
    line(`ON THE LIST (${summary.listedGeneric} generic, ${summary.listedNamed} named)`, summary.listed);
    line("companies that pass every rule (before the batch size)", summary.eligibleCompanies);
    console.log("\nLeft out, by the first rule that applied (addresses):");
    for (const key of EXCLUSION_ORDER) {
      line(EXCLUSION_LABELS[key], summary.excluded[key]);
      if (key === "not_eligible") {
        for (const [reason, value] of Object.entries(summary.notEligibleByReason).sort((a, b) => b[1] - a[1])) line(`    ${reasonLabel(reason)}`, value);
      }
    }
  } finally {
    await pg.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
