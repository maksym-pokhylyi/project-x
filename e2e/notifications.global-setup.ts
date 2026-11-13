import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { mapRelease, type MappedRelease } from "../src/features/procurement/domain/map-release";
import { upsertBatch } from "../src/features/procurement/ingest/upsert";
import { clock, tenderRelease } from "../tests/procurement/helpers/releases";
import { daysFrom, FIRST_MONDAY, LATER_TENDER, SECOND_MONDAY } from "./notifications.shared";
import seedProcurement, { E2E_DATABASE_URL } from "./procurement.global-setup";

/**
 * The procurement market of e2e/procurement.global-setup.ts (Acme Grounds Ltd and 14 open
 * tenders in its trade), plus what the scheduled e-mails need to tell a story:
 *
 *  - every seeded tender "reached us" two days before the first Monday, so the first
 *    digest has news;
 *  - one more tender reaches us between the two Mondays (and closes soonest of all), so the
 *    second digest has news too — for those who still get it.
 */
export default async function globalSetup() {
  await seedProcurement();
  const client = postgres(E2E_DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    clock.now = new Date();
    const closes = daysFrom(SECOND_MONDAY, 1);
    const release = tenderRelease({
      ocid: LATER_TENDER.ocid,
      title: LATER_TENDER.title,
      buyer: { name: "Leeds City Council", ppon: "PLDS-1111-AAAA", region: "UKE42" },
      cpv: ["77314000"],
      regions: ["UKE"],
      value: 110_000,
      deadlineInDays: (closes.getTime() - clock.now.getTime()) / 86_400_000,
    });
    const mapped = [mapRelease(release)].filter((entry): entry is MappedRelease => entry !== null);
    await upsertBatch(db, mapped);

    const seen = daysFrom(FIRST_MONDAY, -2).toISOString();
    const later = daysFrom(FIRST_MONDAY, 2).toISOString();
    await db.execute(sql`update notices set ingested_at = ${seen}::timestamptz, published_at = ${seen}::timestamptz where stage = 'tender' and ocid <> ${LATER_TENDER.ocid}`);
    await db.execute(sql`update notices set ingested_at = ${later}::timestamptz, published_at = ${later}::timestamptz where ocid = ${LATER_TENDER.ocid}`);
  } finally {
    await client.end({ timeout: 5 });
  }
}
