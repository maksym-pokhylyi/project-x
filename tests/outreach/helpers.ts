import { sql } from "drizzle-orm";
import { db } from "@/db";
import { billingPurchases } from "@/db/schema";
import type { OcdsRelease } from "@/features/procurement/domain/ocds";
import { DEFAULT_SEGMENT, type OutreachSegment } from "@/features/outreach/domain/segment";
import { forgetOptionalTables } from "@/lib/optional-table";
import { actAs, createTestUser, requestState, type TestUser } from "../helpers/auth";
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

/**
 * The words of rendered markup, as someone reads them: tags become spaces, the comment
 * markers React puts between adjacent pieces of text disappear, entities are decoded.
 */
export function pageText(html: string): string {
  return html
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** A request with no session, from one client address (the opt-out page's visitor). */
export function asVisitor(ip = "203.0.113.10"): void {
  requestState.headers = new Headers({ "x-forwarded-for": ip, origin: "http://localhost:3000", host: "localhost:3000" });
}

/** Form data from plain values; an array repeats the field (ticked rows). */
export function form(values: Record<string, string | string[] | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  return data;
}

export type Sent = { url: string; path: string; params: URLSearchParams };

/**
 * Posts a form to a Server Action and says where it sent the browser. The outreach actions
 * always answer with a redirect; with next/navigation mocked as in ./mocks/next that is an
 * error "REDIRECT:<url>" — or "FORBIDDEN" for someone who is not the founder.
 */
export async function submit(action: (formData: FormData) => Promise<void>, values: Record<string, string | string[] | File>): Promise<Sent> {
  try {
    await action(form(values));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") return { url: "FORBIDDEN", path: "FORBIDDEN", params: new URLSearchParams() };
    if (message.startsWith("REDIRECT:")) {
      const url = message.slice("REDIRECT:".length);
      const parsed = new URL(url, "http://localhost:3000");
      return { url, path: parsed.pathname, params: parsed.searchParams };
    }
    throw error;
  }
  throw new Error("the action returned without redirecting");
}

export type ProspectState = {
  id: string;
  company: string;
  email: string | null;
  emailKind: string;
  status: string;
  skippedReason: string | null;
  refCode: string;
  exportedAt: Date | null;
  sentAt: Date | null;
  optedOutAt: Date | null;
  erasedAt: Date | null;
};

/** Prospects with their company, in list order (the order of the table and of the exported file). */
export async function prospectStates(campaignId?: string): Promise<ProspectState[]> {
  const rows = (await db.execute(sql`
    select p.id, s.name as company, p.email, p.email_kind, p.status, p.skipped_reason, p.ref_code, p.exported_at, p.sent_at, p.opted_out_at, p.erased_at
    from outreach_prospects p join suppliers s on s.id = p.supplier_id
    ${campaignId ? sql`where p.campaign_id = ${campaignId}::uuid` : sql``}
    order by p.created_at asc, p.id asc
  `)) as unknown as Array<Record<string, unknown>>;
  const date = (value: unknown) => (value === null || value === undefined ? null : value instanceof Date ? value : new Date(String(value)));
  return rows.map((row) => ({
    id: String(row.id),
    company: String(row.company),
    email: row.email === null ? null : String(row.email),
    emailKind: String(row.email_kind),
    status: String(row.status),
    skippedReason: row.skipped_reason === null ? null : String(row.skipped_reason),
    refCode: String(row.ref_code),
    exportedAt: date(row.exported_at),
    sentAt: date(row.sent_at),
    optedOutAt: date(row.opted_out_at),
    erasedAt: date(row.erased_at),
  }));
}

/** One company's prospect. */
export async function prospectOf(company: string, campaignId?: string): Promise<ProspectState> {
  const found = (await prospectStates(campaignId)).find((prospect) => prospect.company === company);
  if (!found) throw new Error(`no prospect for ${company}`);
  return found;
}

const tableExists = async (table: string): Promise<boolean> => {
  const rows = (await db.execute(sql`select to_regclass(${`public.${table}`}) is not null as present`)) as unknown as Array<{ present: boolean }>;
  return rows[0]?.present === true;
};

/** Has the bid desk's migration been applied to the test database? (It arrives with another branch.) */
export const bidDeskInstalled = (): Promise<boolean> => tableExists("bids");

/**
 * Runs `run` with the bid desk's table present. Where its migration is not installed, a
 * stand-in is created with the columns the outreach results and the founder's numbers read
 * (named as in that migration: `bids.organization_id/title/created_at/ready_at`) and
 * dropped again afterwards.
 */
export async function withBidDeskTables<T>(run: () => Promise<T>): Promise<T> {
  const created: string[] = [];
  if (!(await tableExists("bids"))) {
    await db.execute(sql`create table bids (id uuid primary key default gen_random_uuid(), organization_id text not null, title text not null, created_at timestamptz not null default now(), ready_at timestamptz)`);
    created.push("bids");
  }
  forgetOptionalTables();
  try {
    return await run();
  } finally {
    for (const table of created.reverse()) await db.execute(sql.raw(`drop table if exists "${table}"`));
    forgetOptionalTables();
  }
}

let purchases = 0;

/**
 * A one-off purchase as the billing webhook records it: one Bid Pass, paid in full, unless
 * said otherwise. `status` is completed | partially_refunded | refunded | disputed.
 */
export async function recordPurchase(organizationId: string, options: { at: Date; quantity?: number; status?: string }): Promise<void> {
  purchases += 1;
  const quantity = options.quantity ?? 1;
  await db.insert(billingPurchases).values({
    organizationId,
    kind: "bid_pass",
    paddleTransactionId: `txn_test_outreach_${purchases}`,
    priceId: "pri_test_bid_pass",
    quantity,
    amountMinor: 9_900 * quantity,
    currency: "GBP",
    status: options.status ?? "completed",
    paddleEnvironment: "sandbox",
    createdAt: options.at,
  });
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
