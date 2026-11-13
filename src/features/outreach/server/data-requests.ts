import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dataRequests } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { requireAdmin } from "@/server/session";
import { normaliseEmail } from "../domain/suppression";
import { recordOutreachAudit } from "./audit";
import { addSuppressionEntry } from "./suppression-store";

/**
 * The founder's view of `data_requests`: what people asked for on /about-the-data and on
 * the opt-out page ("hide my company page", "delete the contact details you hold").
 * Requests are acted on within five working days (docs/gtm/07-compliance-pack.md §4).
 * Cross-tenant by design: every function starts with requireAdmin().
 */
export type DataRequestRow = {
  id: string;
  kind: string;
  pageUrl: string | null;
  organisationName: string | null;
  requesterEmail: string;
  message: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  /** Slug of the supplier page the request is about, when the page address names one. */
  supplierSlug: string | null;
};

const SUPPLIER_PAGE = /\/suppliers\/([a-z0-9-]{1,120})(?:[/?#]|$)/;

function toRow(row: typeof dataRequests.$inferSelect): DataRequestRow {
  return {
    id: row.id,
    kind: row.kind,
    pageUrl: row.pageUrl,
    organisationName: row.organisationName,
    requesterEmail: row.requesterEmail,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    supplierSlug: SUPPLIER_PAGE.exec(row.pageUrl ?? "")?.[1] ?? null,
  };
}

/** Open requests oldest first (they have a deadline), then the most recently closed. */
export async function listDataRequests(): Promise<{ open: DataRequestRow[]; closed: DataRequestRow[] }> {
  await requireAdmin();
  const [open, closed] = await Promise.all([
    db.select().from(dataRequests).where(eq(dataRequests.status, "open")).orderBy(dataRequests.createdAt).limit(200),
    db.select().from(dataRequests).where(sql`${dataRequests.status} <> 'open'`).orderBy(desc(dataRequests.resolvedAt)).limit(20),
  ]);
  return { open: open.map(toRow), closed: closed.map(toRow) };
}

export async function countOpenDataRequests(): Promise<{ open: number; oldestAt: Date | null }> {
  await requireAdmin();
  const [row] = await db.select({ open: sql<number>`count(*)::int`, oldestAt: sql<Date | null>`min(${dataRequests.createdAt})` }).from(dataRequests).where(eq(dataRequests.status, "open"));
  return { open: row?.open ?? 0, oldestAt: row?.oldestAt ? new Date(row.oldestAt) : null };
}

export type DataRequestAction = "done" | "rejected" | "hide_page" | "erase_contact";

export type DataRequestOutcome = { status: "done" | "rejected"; pageHidden: boolean; prospectsErased: number; contactsDeleted: number };

/**
 * Closes a request, optionally doing what it asked for:
 *  - "hide_page": the supplier is marked as removed — no page, no search result, no outreach
 *    (ingestion never clears that mark);
 *  - "erase_contact": the requester's address is erased from every prospect and deleted from
 *    the contact rows taken from notices; it STAYS on the suppression list, which is what
 *    keeps it from being used when the same notice is read again.
 */
export async function resolveDataRequest(input: { id: string; action: DataRequestAction }): Promise<DataRequestOutcome> {
  const admin = await requireAdmin();
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(dataRequests).where(eq(dataRequests.id, input.id));
    if (!request) throw new NotFoundError("That request no longer exists.");
    if (request.status !== "open") throw new ConflictError("That request is already closed.");
    const outcome: DataRequestOutcome = { status: input.action === "rejected" ? "rejected" : "done", pageHidden: false, prospectsErased: 0, contactsDeleted: 0 };

    if (input.action === "hide_page") {
      const slug = SUPPLIER_PAGE.exec(request.pageUrl ?? "")?.[1];
      if (!slug) throw new ConflictError("This request does not name a company page. Close it as done once you have dealt with it by hand.");
      const hidden = await tx.execute(sql`update suppliers set removed_at = coalesce(removed_at, now()), updated_at = now() where slug = ${slug} returning 1`);
      if (hidden.length === 0) throw new ConflictError("No company page has that address any more.");
      outcome.pageHidden = true;
    }
    if (input.action === "erase_contact") {
      const email = normaliseEmail(request.requesterEmail);
      if (!email) throw new ConflictError("The address on this request is not a valid e-mail address.");
      // First make sure it can never be listed again, then forget it everywhere else.
      await addSuppressionEntry({ kind: "email", value: email.email, domain: email.domain }, { reason: "data_request", source: "admin", createdBy: admin.id }, tx);
      const prospects = await tx.execute(sql`
        update outreach_prospects set email = null, merge_fields = null, erased_at = coalesce(erased_at, now()), updated_at = now()
        where email = ${email.email} returning 1
      `);
      const contacts = await tx.execute(sql`delete from supplier_contacts where email = ${email.email} returning 1`);
      outcome.prospectsErased = prospects.length;
      outcome.contactsDeleted = contacts.length;
    }
    await tx.update(dataRequests).set({ status: outcome.status, resolvedAt: new Date() }).where(eq(dataRequests.id, request.id));
    await recordOutreachAudit(
      {
        actorId: admin.id,
        action: "data_request.resolved",
        count: 1,
        metadata: { kind: request.kind, action: input.action, pageHidden: outcome.pageHidden, prospectsErased: outcome.prospectsErased, contactsDeleted: outcome.contactsDeleted },
      },
      tx,
    );
    return outcome;
  });
}
