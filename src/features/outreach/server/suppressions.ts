import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { site } from "@/config/site";
import { db } from "@/db";
import { suppressions } from "@/db/schema";
import { sha256Hex } from "@/lib/crypto";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { requireAdmin } from "@/server/session";
import { outreachSender } from "../config";
import { toCsv } from "../domain/csv";
import { extractEmails, normaliseTarget, type SuppressionReason, type SuppressionTarget } from "../domain/suppression";
import { recordOutreachAudit } from "./audit";
import { addEmailSuppressions, addSuppressionEntry, unstampContacts } from "./suppression-store";

/**
 * The founder's side of the suppression list (/admin/suppressions).
 * Cross-tenant by design: every function starts with requireAdmin().
 */

export type SuppressionRow = {
  id: string;
  kind: "email" | "domain";
  value: string;
  reason: string;
  source: string;
  note: string | null;
  createdAt: Date;
};

const PAGE_SIZE = 100;

function toRow(row: typeof suppressions.$inferSelect): SuppressionRow {
  return { id: row.id, kind: row.email ? "email" : "domain", value: row.email ?? row.domain ?? "", reason: row.reason, source: row.source, note: row.note, createdAt: row.createdAt };
}

export type SuppressionList = { rows: SuppressionRow[]; total: number; matching: number; byReason: Record<string, number>; page: number; pages: number };

/** Newest first, optionally filtered by a fragment of the address or domain. */
export async function listSuppressions(options: { query?: string; page?: number } = {}): Promise<SuppressionList> {
  await requireAdmin();
  const term = (options.query ?? "").trim().toLowerCase().slice(0, 120);
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const where = term ? sql`(${suppressions.email} like ${pattern} or ${suppressions.domain} like ${pattern})` : undefined;
  const [[counts], reasons] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, matching: where ? sql<number>`count(*) filter (where ${where})::int` : sql<number>`count(*)::int` }).from(suppressions),
    db.select({ reason: suppressions.reason, count: sql<number>`count(*)::int` }).from(suppressions).groupBy(suppressions.reason),
  ]);
  const matching = counts?.matching ?? 0;
  const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(options.page ?? 1) || 1), pages);
  const rows = await db
    .select()
    .from(suppressions)
    .where(where)
    .orderBy(desc(suppressions.createdAt), desc(suppressions.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.map(toRow), total: counts?.total ?? 0, matching, byReason: Object.fromEntries(reasons.map((row) => [row.reason, row.count])), page, pages };
}

function requireTarget(input: string): SuppressionTarget {
  const target = normaliseTarget(input);
  if (!target) throw new ValidationError(undefined, { target: ["Enter an e-mail address, or a domain such as example.co.uk."] });
  return target;
}

/** What an audit entry may say about an entry: its kind, its domain and a fingerprint — not the address. */
function describeTarget(target: SuppressionTarget): Record<string, unknown> {
  return target.kind === "domain" ? { kind: "domain", domain: target.value } : { kind: "email", domain: target.domain, fingerprint: sha256Hex(target.value).slice(0, 16) };
}

export type AddSuppressionResult = { created: boolean; kind: "email" | "domain"; contactsStamped: number; prospectsAffected: number };

/** Adds one address or domain by hand (a "stop" reply, a complaint, a bounce). */
export async function addSuppression(input: { target: string; reason: SuppressionReason; note?: string | null }): Promise<AddSuppressionResult> {
  const admin = await requireAdmin();
  const target = requireTarget(input.target);
  return db.transaction(async (tx) => {
    const effects = await addSuppressionEntry(target, { reason: input.reason, source: "admin", note: input.note, createdBy: admin.id }, tx);
    if (effects.created) {
      await recordOutreachAudit({ actorId: admin.id, action: "suppression.added", count: 1, metadata: { ...describeTarget(target), reason: input.reason } }, tx);
    }
    return { created: effects.created, kind: target.kind, contactsStamped: effects.contactsStamped, prospectsAffected: effects.prospectsSkipped + effects.prospectsOptedOut };
  });
}

export type BounceImportResult = { found: number; added: number; alreadyListed: number; ignoredOwn: number; truncated: boolean };

/** Addresses on our own domains turn up in bounce reports (the sender column): never suppress those. */
function ownDomains(): Set<string> {
  const own = new Set<string>([site.domain.toLowerCase()]);
  const support = site.supportEmail.split("@")[1];
  if (support) own.add(support.toLowerCase());
  const contact = outreachSender().contactEmail?.split("@")[1];
  if (contact) own.add(contact.toLowerCase());
  return own;
}

/** Imports a bounce list: pasted text or the text of an uploaded CSV. Every address found is suppressed as a bounce. */
export async function importBounceList(text: string): Promise<BounceImportResult> {
  const admin = await requireAdmin();
  if (text.length > 2_000_000) throw new ValidationError(undefined, { list: ["That list is too large. Import it in parts of up to 2 MB."] });
  const { emails, truncated } = extractEmails(text);
  if (emails.length === 0) throw new ValidationError(undefined, { list: ["No e-mail addresses found. Paste one address per line, or upload the bounce report as CSV or text."] });
  const own = ownDomains();
  const foreign = emails.filter((email) => !own.has(email.slice(email.lastIndexOf("@") + 1)));
  const ignoredOwn = emails.length - foreign.length;
  const added = await db.transaction(async (tx) => {
    const effects = await addEmailSuppressions(foreign, { reason: "bounce", source: "bounce_import", createdBy: admin.id }, tx);
    await recordOutreachAudit({ actorId: admin.id, action: "suppression.imported", count: effects.created, metadata: { found: emails.length, ignoredOwn, truncated } }, tx);
    return effects.created;
  });
  return { found: emails.length, added, alreadyListed: emails.length - added - ignoredOwn, ignoredOwn, truncated };
}

/**
 * Takes an entry off the list. The founder must type the address or domain exactly: a
 * removal makes an address contactable again, so it is never one click, and it is logged.
 * Prospects that opted out stay opted out; their company is still never listed again.
 */
export async function removeSuppression(input: { id: string; confirmation: string }): Promise<{ kind: "email" | "domain"; contactsUnstamped: number }> {
  const admin = await requireAdmin();
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(suppressions).where(eq(suppressions.id, input.id));
    if (!entry) throw new NotFoundError("That entry is no longer on the list.");
    const value = entry.email ?? entry.domain ?? "";
    if (input.confirmation.trim().toLowerCase() !== value) {
      throw new ValidationError("The text you typed does not match the entry.", { confirmation: ["Type the address or domain exactly as shown to remove it."] });
    }
    const target = requireTarget(value);
    await tx.delete(suppressions).where(eq(suppressions.id, entry.id));
    const contactsUnstamped = await unstampContacts(target, tx);
    await recordOutreachAudit(
      { actorId: admin.id, action: "suppression.removed", count: 1, metadata: { ...describeTarget(target), reason: entry.reason, source: entry.source, listedSince: entry.createdAt.toISOString() } },
      tx,
    );
    return { kind: target.kind, contactsUnstamped };
  });
}

/** The whole list as CSV, for the founder's sending tool. Logged, without the addresses. */
export async function exportSuppressionsCsv(): Promise<{ filename: string; csv: string; count: number }> {
  const admin = await requireAdmin();
  const rows = await db.select().from(suppressions).orderBy(desc(suppressions.createdAt), desc(suppressions.id));
  const csv = toCsv(
    ["type", "value", "reason", "source", "note", "added"],
    rows.map((row) => [row.email ? "address" : "domain", row.email ?? row.domain ?? "", row.reason, row.source, row.note ?? "", row.createdAt.toISOString()]),
  );
  await recordOutreachAudit({ actorId: admin.id, action: "suppression.exported", count: rows.length });
  return { filename: `suppressions-${new Date().toISOString().slice(0, 10)}.csv`, csv, count: rows.length };
}
