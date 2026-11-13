import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { expect } from "vitest";
import { db } from "@/db";
import type { OcdsRelease } from "@/features/procurement/domain/ocds";
import { contractRelease, NOW } from "./factory";

/**
 * Fixtures for the suites about contact addresses taken from notices (`supplier_contacts`):
 * their retention, what ingestion does afterwards, and the fingerprint backfill.
 *
 * EVERYTHING HERE IS FICTIONAL: made-up companies, every address on a reserved `.example`
 * domain. Never put a real contact address in this repository.
 *
 * Rows are found by their DOMAIN, which survives erasure; the address does not.
 */
export const DAY_MS = 86_400_000;
export const ago = (days: number, from: Date = NOW) => new Date(from.getTime() - days * DAY_MS);
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const LEEDS = { name: "Leeds City Council", ppon: "PLDS-1111-AAAA" };

export type ContactSpec = { company: string; coh?: string; ppon?: string; email?: string; contactName?: string; title?: string };

/** A contract details notice naming `company`, with the contact address the buyer published for it. */
export function notice(spec: ContactSpec): OcdsRelease {
  const release = contractRelease({ title: spec.title ?? "Roof repairs", buyer: LEEDS, suppliers: [{ name: spec.company, coh: spec.coh, ppon: spec.ppon, email: spec.email }], cpv: ["45261000"] });
  const party = release.parties?.find((candidate) => candidate.roles?.includes("supplier"));
  if (party?.contactPoint && spec.contactName) party.contactPoint = { ...party.contactPoint, name: spec.contactName };
  return release;
}

/** A person's address. */
export const HEATH: ContactSpec = { company: "Heath Roofing Ltd", coh: "05050505", email: "sam.taylor@heathroofing.example" };
/** A person's address. */
export const YEW: ContactSpec = { company: "Yew Joinery Ltd", coh: "05353535", email: "pat.jones@yewjoinery.example" };
/** A role mailbox of a company. */
export const ACME: ContactSpec = { company: "Acme Grounds Ltd", coh: "01111111", email: "tenders@acmegrounds.example" };
/** A role mailbox published with a contact name (the name itself is never stored). */
export const MOOR: ContactSpec = { company: "Moor Cleaning Ltd", coh: "05151515", email: "info@moorcleaning.example", contactName: "Jo Example" };
/** A role mailbox; a suite that needs a webmail address turns its `kind` into "freemail". */
export const WEBMAIL: ContactSpec = { company: "Webmail Builders Ltd", coh: "07070707", email: "office@webmailbuilders.example" };

export type ContactRow = {
  id: string;
  supplier_id: string;
  email: string;
  email_fingerprint: string | null;
  email_domain: string;
  kind: string;
  name_present: boolean;
  first_ingested_at: string;
  erased_at: string | null;
  suppressed_at: string | null;
};

/** Every contact row, timestamps as ISO strings. */
export const contacts = async (): Promise<ContactRow[]> => [
  ...(await db.execute<ContactRow>(sql`
    select id, supplier_id, email, email_fingerprint, email_domain, kind, name_present,
           to_char(first_ingested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as first_ingested_at,
           to_char(erased_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as erased_at,
           to_char(suppressed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as suppressed_at
    from supplier_contacts order by email_domain, first_ingested_at, id
  `)),
];

export const domainOf = (spec: ContactSpec) => spec.email!.split("@")[1]!;

/** The one contact row of a company. */
export async function contactOf(spec: ContactSpec): Promise<ContactRow> {
  const rows = (await contacts()).filter((row) => row.email_domain === domainOf(spec));
  if (rows.length !== 1) throw new Error(`${rows.length} contact rows on ${domainOf(spec)}`);
  return rows[0]!;
}

/** Says when we first stored a company's address(es): the clock every retention rule runs on. */
export const storedDaysAgo = (spec: ContactSpec, days: number) =>
  db.execute(sql`update supplier_contacts set first_ingested_at = ${ago(days).toISOString()}::timestamptz where email_domain = ${domainOf(spec)}`);

/** Nothing in the table gives the address away any more. */
export async function expectAddressGone(spec: ContactSpec): Promise<void> {
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from supplier_contacts c where c::text ilike ${`%${spec.email!.split("@")[0]}%`}`);
  expect(row!.n).toBe(0);
}

/** The row holds a placeholder and the fingerprint of `address`, erased at `at`; its domain is still there. */
export function expectErased(row: ContactRow, address: string, at: Date = NOW): void {
  const fingerprint = sha256(address);
  expect(row).toMatchObject({ email: `erased:${fingerprint.slice(0, 16)}`, email_fingerprint: fingerprint, erased_at: at.toISOString(), email_domain: address.split("@")[1] });
}
