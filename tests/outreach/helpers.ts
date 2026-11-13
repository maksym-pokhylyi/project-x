import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { OcdsRelease } from "@/features/procurement/domain/ocds";
import { DEFAULT_SEGMENT, type OutreachSegment } from "@/features/outreach/domain/segment";
import { actAs, createTestUser, type TestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { contractRelease, ingest, NOW } from "../procurement/helpers/factory";
import { resetProcurement } from "../procurement/helpers/schema";

/**
 * Fixtures for the outreach suites. EVERYTHING HERE IS FICTIONAL: company names are made
 * up and every address is on a reserved `.example` domain. Never put real prospect data in
 * this repository.
 *
 * Data goes in through the real pipeline (mapRelease -> upsertBatch), so the builder is
 * tested against rows shaped exactly like production's.
 */
export { NOW };

export const DAY_MS = 86_400_000;
export const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA", region: "UKE42" };
const GROUNDS = ["77314000"];

/** Empties every table the outreach tooling reads or writes. */
export async function resetOutreach(): Promise<void> {
  await resetDatabase();
  await resetProcurement(); // truncates suppliers … cascade, which takes outreach_prospects with it
  await db.execute(sql.raw(`truncate table "outreach_audit", "outreach_prospects", "outreach_campaigns", "suppressions" restart identity cascade`));
}

export type AwardSpec = {
  company: string;
  coh?: string;
  email?: string;
  title?: string;
  cpv?: string[];
  value?: number | null;
  publishedDaysAgo?: number;
  region?: string;
  scale?: "sme" | "large";
  /** Company website as the notice gives it, e.g. "https://acme.example". */
  website?: string;
  /** A contact name published next to the address (the name itself is never stored). */
  contactName?: string;
  buyer?: { name: string; ppon: string; region?: string };
};

/** A contract details notice (UK7) naming `company` as the supplier. */
export function award(spec: AwardSpec): OcdsRelease {
  const release = contractRelease({
    title: spec.title ?? "Grounds Maintenance Services",
    buyer: spec.buyer ?? LEEDS,
    suppliers: [{ name: spec.company, coh: spec.coh, email: spec.email, region: spec.region, scale: spec.scale }],
    cpv: spec.cpv ?? GROUNDS,
    value: spec.value,
    publishedDaysAgo: spec.publishedDaysAgo ?? 5,
    signedDaysAgo: (spec.publishedDaysAgo ?? 5) + 2,
  });
  const party = release.parties?.find((candidate) => candidate.roles?.includes("supplier"));
  if (party && spec.website) party.details = { ...party.details, url: spec.website };
  if (party && spec.contactName && party.contactPoint) party.contactPoint = { ...party.contactPoint, name: spec.contactName };
  return release;
}

/**
 * Ingests notices and makes the clocks deterministic: every contact row is "first stored"
 * one day before NOW, whatever the wall clock says while the suite runs.
 */
export async function seed(specs: AwardSpec[], options: { firstStoredDaysAgo?: number } = {}): Promise<void> {
  await ingest(specs.map(award));
  await db.execute(sql`update supplier_contacts set first_ingested_at = ${daysAgo(options.firstStoredDaysAgo ?? 1).toISOString()}::timestamptz`);
}

/** Five companies that pass every rule, each with one generic mailbox. Newest award first: Acme, Brightway, Castle, Dale, Elm. */
export const FIVE_ELIGIBLE: AwardSpec[] = [
  { company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example", publishedDaysAgo: 2, value: 120_000 },
  { company: "Brightway Cleaning Ltd", coh: "02222222", email: "info@brightway.example", publishedDaysAgo: 3, cpv: ["90911200"], title: "Office Cleaning Services" },
  { company: "Castle Roofing Ltd", coh: "03333333", email: "bids@castleroofing.example", publishedDaysAgo: 4, cpv: ["45261210"], title: "Roof Repairs" },
  { company: "Dale Facilities LLP", coh: "OC444444", email: "enquiries@dalefacilities.example", publishedDaysAgo: 5 },
  { company: "Elm Care Ltd", coh: "05555555", email: "office@elmcare.example", publishedDaysAgo: 6, cpv: ["85312000"], title: "Home Care Services" },
];

export const segment = (overrides: Partial<OutreachSegment> = {}): OutreachSegment => ({ ...DEFAULT_SEGMENT, ...overrides });

export const founderEmail = "founder@example.com"; // ADMIN_EMAILS in vitest.config.ts

/** A verified founder session (requireAdmin passes), made the current request. */
export async function signInFounder(): Promise<TestUser> {
  const founder = await createTestUser({ email: founderEmail, name: "Fay Founder" });
  actAs(founder);
  return founder;
}

/** Sender details the export needs, set for the duration of a suite. */
export const SENDER_ENV: Record<string, string> = {
  OUTREACH_SENDER_FIRST_NAME: "Fay",
  OUTREACH_SENDER_FULL_NAME: "Fay Founder",
  OUTREACH_SENDER_LEGAL_NAME: "Fay Founder",
  OUTREACH_SENDER_REGISTER_REFERENCE: "register entry 2 000 000 0000",
  OUTREACH_SENDER_POSTAL_ADDRESS: "1 Example Street, Poltava, 36000, Ukraine",
  OUTREACH_SENDER_CONTACT_EMAIL: "fay@getbidfolio.example",
  OUTREACH_UK_REPRESENTATIVE: "Example Rep Ltd, 2 Sample Road, London",
};

export function setSenderEnv(values: Record<string, string | undefined> = SENDER_ENV): void {
  for (const key of Object.keys(SENDER_ENV)) delete process.env[key];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
}

export const count = async (table: string): Promise<number> => {
  const rows = (await db.execute(sql.raw(`select count(*)::int as n from "${table}"`))) as unknown as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0);
};

/** A snapshot of everything an outreach read must not change. */
export async function fingerprint(): Promise<string> {
  const rows = (await db.execute(sql`
    select
      (select coalesce(json_agg(s order by s.created_at, s.id), '[]') from suppressions s)::text as suppressions,
      (select coalesce(json_agg(json_build_object('id', p.id, 'status', p.status, 'email', p.email, 'opted', p.opted_out_at, 'sent', p.sent_at, 'exported', p.exported_at) order by p.id), '[]') from outreach_prospects p)::text as prospects,
      (select coalesce(json_agg(json_build_object('id', c.id, 'at', c.suppressed_at) order by c.id), '[]') from supplier_contacts c)::text as contacts,
      (select count(*) from events)::text as events,
      (select count(*) from data_requests)::text as requests,
      (select count(*) from outreach_audit)::text as audit,
      (select count(*) from page_visits)::text as visits
  `)) as unknown as Array<Record<string, string>>;
  return JSON.stringify(rows[0]);
}
