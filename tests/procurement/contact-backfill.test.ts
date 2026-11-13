import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { neon, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));

import { RETENTION_DAYS } from "@/config/retention";
import { db } from "@/db";
import { backfillContactFingerprints, eraseExpiredContacts } from "@/features/procurement/ingest/contact-erasure";
import { runContactRetention } from "@/features/procurement/retention";
import { resetOutreach } from "../outreach/helpers";
import { ACME, ago, contactOf, contacts, expectErased, HEATH, MOOR, notice, sha256, storedDaysAgo, WEBMAIL, YEW, type ContactRow } from "./helpers/contacts";
import { ingest, NOW } from "./helpers/factory";
import { startNeonHttpProxy } from "./helpers/neon-http-proxy";

/**
 * `supplier_contacts.email_fingerprint` is added empty by its migration. Retention and
 * ingestion fill it on the rows they touch; `pnpm contacts:backfill` fills the rest, once,
 * on either database driver. All data is fictional (./helpers/contacts.ts).
 */
beforeEach(async () => {
  await resetOutreach(); // the procurement tables, and the outreach table the retention step looks at
});

describe("the fingerprint backfill for rows stored before the column existed", () => {
  const run = promisify(execFile);
  let proxy: Awaited<ReturnType<typeof startNeonHttpProxy>>;

  beforeAll(async () => {
    proxy = await startNeonHttpProxy(process.env.DATABASE_URL!);
    neonConfig.fetchEndpoint = () => proxy.url;
  });
  afterAll(async () => {
    await proxy.close();
  });

  /** Five addresses as they were before the migration (no fingerprint) and one that retention has erased since. */
  async function seedBeforeTheColumn(): Promise<ContactRow> {
    await ingest([notice(HEATH), notice(YEW), notice(ACME), notice(MOOR), notice(WEBMAIL), notice({ company: "Elm Care Ltd", coh: "05555555", email: "robin.hall@elmcare.example" })]);
    await db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(31).toISOString()}::timestamptz where email_domain = 'elmcare.example'`);
    expect(await runContactRetention(NOW)).toEqual({ supplierContactsErased: 1 });
    await db.execute(sql`update supplier_contacts set email_fingerprint = null where erased_at is null`);
    return (await contacts()).find((row) => row.erased_at !== null)!;
  }
  const expectAllFilled = async (erased: ContactRow) => {
    const rows = await contacts();
    expect(rows).toHaveLength(6);
    for (const row of rows.filter((candidate) => candidate.erased_at === null)) expect(row.email_fingerprint, row.email_domain).toBe(sha256(row.email));
    expect(rows.find((row) => row.id === erased.id)).toEqual(erased); // an erased row is never written: its fingerprint is that of the address, not of the placeholder
  };

  it("fills every row in batches, with the fingerprint the application computes, and is idempotent", async () => {
    const erased = await seedBeforeTheColumn();
    const progress: number[] = [];
    expect(await backfillContactFingerprints(db, { batchSize: 2, onBatch: (done) => progress.push(done.filled) })).toEqual({ filled: 5, batches: 3 });
    expect(progress).toEqual([2, 4, 5]);
    await expectAllFilled(erased);

    const snapshot = await contacts();
    expect(await backfillContactFingerprints(db, { batchSize: 2 })).toEqual({ filled: 0, batches: 0 });
    expect(await contacts()).toEqual(snapshot);
    // A fingerprint that is there is never rewritten, whatever it is.
    await db.execute(sql`update supplier_contacts set email_fingerprint = 'kept' where email = ${ACME.email!}`);
    expect(await backfillContactFingerprints(db)).toEqual({ filled: 0, batches: 0 });
    expect((await contactOf(ACME)).email_fingerprint).toBe("kept");
  });

  it("does the same over HTTP (neon-http), and so does erasing", async () => {
    const erased = await seedBeforeTheColumn();
    const http = drizzleNeonHttp(neon("postgres://user:password@db.neon.invalid/main"));
    expect(await backfillContactFingerprints(http, { batchSize: 4 })).toEqual({ filled: 5, batches: 2 });
    await expectAllFilled(erased);
    expect(await backfillContactFingerprints(http, { batchSize: 4 })).toEqual({ filled: 0, batches: 0 });

    await storedDaysAgo(HEATH, 31);
    expect(await eraseExpiredContacts(http, { storedBefore: ago(RETENTION_DAYS.supplierNamedContacts), now: NOW, limit: 100, keepIds: [(await contactOf(YEW)).id] })).toEqual({ erased: 1, duplicatesRemoved: 0 });
    expectErased(await contactOf(HEATH), HEATH.email!);
    expect(await eraseExpiredContacts(http, { storedBefore: ago(RETENTION_DAYS.supplierNamedContacts), now: NOW, limit: 100 })).toEqual({ erased: 0, duplicatesRemoved: 0 });
  });

  it("the script (pnpm contacts:backfill): counts only, on either driver, and a second run changes nothing", async () => {
    const erased = await seedBeforeTheColumn();
    const addresses = (await contacts()).filter((row) => row.erased_at === null).map((row) => row.email);
    const script = (args: string[], env: Record<string, string>) =>
      run(process.execPath, ["--import", "tsx", "scripts/backfill-contact-fingerprints.ts", ...args], {
        // DATABASE_URL_UNPOOLED too: whatever a developer's .env.local says, the script must stay on the test database.
        env: { PATH: process.env.PATH ?? "", DATABASE_URL: process.env.DATABASE_URL!, DATABASE_URL_UNPOOLED: process.env.DATABASE_URL!, ...env } as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
        timeout: 90_000,
      });

    const first = await script(["--batch", "2"], {});
    expect(first.stdout).toContain("6 contact rows, 5 without a fingerprint, 1 erased");
    expect(first.stdout).toContain("5 filled in 3 batch(es), 0 left without a fingerprint");
    await expectAllFilled(erased);
    const second = await script(["--batch", "2"], {});
    expect(second.stdout).toContain("6 contact rows, 0 without a fingerprint, 1 erased");
    expect(second.stdout).toContain("0 filled in 0 batch(es), 0 left without a fingerprint");
    await expectAllFilled(erased);

    // Over HTTPS, as against a remote Neon database.
    await db.execute(sql`update supplier_contacts set email_fingerprint = null where erased_at is null`);
    const overHttp = await script(["--driver", "neon-http"], { DATABASE_URL: "postgres://user:password@db.neon.invalid/main", DATABASE_URL_UNPOOLED: "", NEON_HTTP_ENDPOINT: proxy.url });
    expect(overHttp.stdout).toContain("via neon-http");
    expect(overHttp.stdout).toContain("5 filled in 1 batch(es), 0 left without a fingerprint");
    await expectAllFilled(erased);

    // Never an address, a domain or a password in what it prints.
    for (const output of [first, second, overHttp].flatMap((result) => [result.stdout, result.stderr])) {
      for (const address of addresses) {
        expect(output).not.toContain(address);
        expect(output).not.toContain(address.split("@")[1]!);
      }
      expect(output).not.toContain("@");
      expect(output).not.toContain("password");
    }
  });
});
