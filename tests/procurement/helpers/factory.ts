import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "@/db";
import { mapRelease, type MappedRelease } from "@/features/procurement/domain/map-release";
import type { OcdsRelease } from "@/features/procurement/domain/ocds";
import { upsertBatch, type UpsertSummary } from "@/features/procurement/ingest/upsert";
import { rebuildSupplierProfiles } from "@/features/procurement/profiles/build";
import { clock } from "./releases";

export * from "./releases";

/** Fixed "today" for query tests, so nothing depends on the wall clock. */
export const NOW = clock.now;

/** A real release from tests/fixtures/fts (contact details scrubbed). */
export function fixture(name: string): OcdsRelease {
  const file = fileURLToPath(new URL(`../../fixtures/fts/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(file, "utf8")) as OcdsRelease;
}

export function mapped(release: OcdsRelease): MappedRelease {
  const result = mapRelease(release);
  if (!result) throw new Error("fixture did not map");
  return result;
}

/** Maps and stores releases through the real pipeline, then rebuilds the touched profiles. */
export async function ingest(releases: OcdsRelease[], options: { profiles?: boolean } = {}): Promise<UpsertSummary> {
  const summary = await upsertBatch(db, releases.map(mapped));
  if (options.profiles !== false) await rebuildSupplierProfiles(db, summary.touchedSupplierIds, NOW);
  return summary;
}
