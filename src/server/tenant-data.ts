import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { invitations, members, organizations, subscriptions, users } from "@/db/schema";
import { track } from "@/lib/analytics";
import { emailKey } from "@/lib/crypto";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { orgStoragePrefix, storage } from "@/lib/storage";
import { assertRole, type OrgContext } from "./session";

/**
 * Erasure and export of tenant data (GDPR Art. 15, 17, 20).
 *
 * Both work from the DATABASE CATALOGUE, not from a hand-kept list: every table that has
 * an `organization_id` column is exported and erased. A feature module only has to follow
 * the convention (tenant tables carry `organization_id`, ideally with a cascading foreign
 * key) to be covered; `registerTenantDataHandler()` exists for anything outside the
 * database or outside the workspace's storage folder.
 */

export type TenantDataHandler = {
  name: string;
  /** Extra data for the export (must be JSON-serialisable). */
  onExport?: (organizationId: string) => Promise<unknown>;
  /** Clean up things the database cannot cascade to (external services, files elsewhere). Runs BEFORE rows are deleted. */
  onDelete?: (organizationId: string) => Promise<void>;
};

const handlers: TenantDataHandler[] = [];

/** Feature modules call this at module load to take part in workspace export and deletion. */
export function registerTenantDataHandler(handler: TenantDataHandler): void {
  if (!handlers.some((existing) => existing.name === handler.name)) handlers.push(handler);
}

const LIVE_OR_PAUSED = ["active", "trialing", "past_due", "paused"];
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const EXPORT_ROW_LIMIT = 50_000;
/** Internal tables that are not part of a customer's export. They are still erased. */
const NOT_EXPORTED = new Set(["error_log", "billing_checkout_nonces"]);
/** Columns never included in an export. */
const EXPORT_OMITS: Record<string, string[]> = { subscriptions: ["raw"] };

type Executor = Pick<typeof db, "execute">;

/** Every table in the public schema that carries an `organization_id` column. */
export async function listTenantTables(executor: Executor = db): Promise<string[]> {
  const rows = await executor.execute<{ table_name: string }>(sql`
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'organization_id' and t.table_type = 'BASE TABLE'
    order by c.table_name
  `);
  return rows.map((row) => row.table_name).filter((name) => IDENTIFIER.test(name));
}

/** Tenant tables whose rows disappear by themselves when the organization row is deleted. */
async function cascadingTenantTables(executor: Executor): Promise<Set<string>> {
  const rows = await executor.execute<{ table_name: string }>(sql`
    select distinct cl.relname as table_name
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where con.contype = 'f' and con.confrelid = 'public.organizations'::regclass and con.confdeltype = 'c' and ns.nspname = 'public'
  `);
  return new Set(rows.map((row) => row.table_name));
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type WorkspaceExport = {
  formatVersion: 1;
  exportedAt: string;
  workspace: { id: string; name: string; slug: string; createdAt: string };
  members: Array<{ name: string; email: string; role: string; joinedAt: string }>;
  /** Rows of every table that belongs to the workspace, keyed by table name. */
  tables: Record<string, { rows: unknown[]; truncated: boolean }>;
  /** Keys of the files stored for the workspace (download them through /api/files/<key>). */
  files: string[];
  extensions: Record<string, unknown>;
};

/** Everything we hold for the active workspace, as plain JSON. Owners only. */
export async function exportWorkspaceData(ctx: OrgContext): Promise<WorkspaceExport> {
  assertRole(ctx, "owner");
  const organizationId = ctx.organization.id;

  const memberRows = await db
    .select({ name: users.name, email: users.email, role: members.role, joinedAt: members.createdAt })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, organizationId))
    .orderBy(members.createdAt);

  const tables: WorkspaceExport["tables"] = {};
  for (const table of await listTenantTables()) {
    if (NOT_EXPORTED.has(table) || table === "members") continue;
    const rows = await db.execute<Record<string, unknown>>(
      sql`select * from ${sql.identifier(table)} where organization_id = ${organizationId} limit ${EXPORT_ROW_LIMIT + 1}`,
    );
    const omit = EXPORT_OMITS[table] ?? [];
    tables[table] = {
      rows: rows.slice(0, EXPORT_ROW_LIMIT).map((row) => (omit.length ? Object.fromEntries(Object.entries(row).filter(([column]) => !omit.includes(column))) : row)),
      truncated: rows.length > EXPORT_ROW_LIMIT,
    };
  }

  const extensions: Record<string, unknown> = {};
  for (const handler of handlers) if (handler.onExport) extensions[handler.name] = await handler.onExport(organizationId);

  await track("workspace.exported", { organizationId, userId: ctx.user.id });
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: { id: organizationId, name: ctx.organization.name, slug: ctx.organization.slug, createdAt: ctx.organization.createdAt.toISOString() },
    members: memberRows.map((row) => ({ ...row, joinedAt: row.joinedAt.toISOString() })),
    tables,
    files: await storage.list(orgStoragePrefix(organizationId)),
    extensions,
  };
}

// ---------------------------------------------------------------------------
// Workspace deletion
// ---------------------------------------------------------------------------

/**
 * Permanently removes a workspace: its files, every row of every tenant table, the Paddle
 * events stored about it, and the organization itself. Refuses while a subscription could
 * still bill (it must be cancelled in Paddle first — we never cancel on someone's behalf
 * by deleting a row).
 *
 * Order: registered handlers and stored files first (if that fails nothing has been lost
 * and the call can be retried), then all database rows in ONE transaction.
 */
export async function deleteWorkspace(organizationId: string): Promise<{ files: number }> {
  const [organization] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId));
  if (!organization) throw new NotFoundError("Workspace not found.");
  const [subscription] = await db
    .select({ status: subscriptions.status, paddleSubscriptionId: subscriptions.paddleSubscriptionId, paddleCustomerId: subscriptions.paddleCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId));
  if (subscription?.paddleSubscriptionId && LIVE_OR_PAUSED.includes(subscription.status)) {
    throw new ConflictError("This workspace still has a subscription. Cancel it under Billing → Manage billing first; it can be deleted once the subscription has ended.");
  }

  for (const handler of handlers) await handler.onDelete?.(organizationId);
  const files = await storage.deletePrefix(orgStoragePrefix(organizationId));

  await db.transaction(async (tx) => {
    await eraseBillingEvents(tx, organizationId, subscription?.paddleSubscriptionId ?? null, subscription?.paddleCustomerId ?? null);
    // Invitation e-mails that were sent on behalf of this workspace.
    await tx.execute(sql`
      delete from email_outbox where template = 'invitation' and to_email in (select lower(email) from invitations where organization_id = ${organizationId})
    `);
    // Tenant tables the organization row does not cascade to (no foreign key, or SET NULL / RESTRICT).
    const cascading = await cascadingTenantTables(tx);
    for (const table of await listTenantTables(tx)) {
      if (cascading.has(table)) continue;
      await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id = ${organizationId}`);
    }
    await tx.execute(sql`update sessions set active_organization_id = null where active_organization_id = ${organizationId}`);
    await tx.delete(organizations).where(eq(organizations.id, organizationId));
  });
  log.info("workspace deleted", { organizationId, files });
  return { files };
}

/** Stored Paddle events about this workspace's subscription, customer and checkouts. */
async function eraseBillingEvents(tx: Tx, organizationId: string, subscriptionId: string | null, customerId: string | null): Promise<void> {
  await tx.execute(sql`delete from webhook_events where payload -> 'data' -> 'custom_data' ->> 'organization_id' = ${organizationId}`);
  if (subscriptionId) {
    await tx.execute(sql`
      delete from webhook_events
      where (payload -> 'data' ->> 'id') = ${subscriptionId} or payload -> 'data' ->> 'subscription_id' = ${subscriptionId}
    `);
  }
  if (customerId) {
    // The Paddle customer may pay for another workspace too: only erase its events when this was the last one.
    const [shared] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.paddleCustomerId, customerId), ne(subscriptions.organizationId, organizationId)))
      .limit(1);
    if (!shared) {
      await tx.execute(sql`
        delete from webhook_events
        where (payload -> 'data' ->> 'id') = ${customerId} or payload -> 'data' ->> 'customer_id' = ${customerId}
      `);
    }
  }
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export type AccountDeletionPlan = {
  /** Workspaces that will be deleted with the account (the user is their only member). */
  deleteWorkspaces: Array<{ id: string; name: string }>;
  /** Workspaces the user simply leaves (another owner remains). */
  leaveWorkspaces: Array<{ id: string; name: string }>;
  /** Reasons the account cannot be deleted yet. Empty = go ahead. */
  blockers: string[];
};

/** What deleting this account would do, and what stands in the way. */
export async function planAccountDeletion(userId: string): Promise<AccountDeletionPlan> {
  const memberships = await db
    .select({ organizationId: members.organizationId, role: members.role, name: organizations.name })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId));

  const plan: AccountDeletionPlan = { deleteWorkspaces: [], leaveWorkspaces: [], blockers: [] };
  for (const membership of memberships) {
    const others = await db
      .select({ role: members.role })
      .from(members)
      .where(and(eq(members.organizationId, membership.organizationId), ne(members.userId, userId)));
    const workspace = { id: membership.organizationId, name: membership.name };
    if (membership.role !== "owner" || others.some((other) => other.role === "owner")) {
      plan.leaveWorkspaces.push(workspace);
      continue;
    }
    // The user is the sole owner.
    if (others.length > 0) {
      plan.blockers.push(`“${membership.name}” has other members and you are its only owner: make someone else an owner, or remove the members and delete the workspace.`);
      continue;
    }
    const [subscription] = await db
      .select({ status: subscriptions.status, paddleSubscriptionId: subscriptions.paddleSubscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, membership.organizationId));
    if (subscription?.paddleSubscriptionId && LIVE_OR_PAUSED.includes(subscription.status)) {
      plan.blockers.push(`“${membership.name}” still has a subscription: cancel it under Billing → Manage billing first.`);
      continue;
    }
    plan.deleteWorkspaces.push(workspace);
  }
  return plan;
}

/**
 * Permanently deletes a user account: the workspaces only they belong to, their
 * memberships elsewhere, sessions, credentials, and every copy of their e-mail address in
 * operational tables. Throws ConflictError (listing what to do) when a workspace would be
 * left without an owner or a subscription without anyone to manage it.
 */
export async function deleteAccount(userId: string): Promise<{ workspacesDeleted: number }> {
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError("Account not found.");
  const plan = await planAccountDeletion(userId);
  if (plan.blockers.length > 0) throw new ConflictError(`Your account cannot be deleted yet. ${plan.blockers.join(" ")}`);

  for (const workspace of plan.deleteWorkspaces) await deleteWorkspace(workspace.id);

  const email = user.email.toLowerCase();
  await db.transaction(async (tx) => {
    // Their address, wherever it was copied to.
    await tx.delete(invitations).where(eq(sql`lower(${invitations.email})`, email));
    await tx.execute(sql`delete from email_outbox where to_email = ${email}`);
    await tx.execute(sql`update audit_log set metadata = metadata - 'email' where metadata ->> 'email' = ${email}`);
    await tx.execute(sql`
      delete from webhook_events where event_type in ('customer.created', 'customer.updated') and lower(payload -> 'data' ->> 'email') = ${email}
    `);
    await tx.execute(sql`delete from rate_limits where key like ${`%${emailKey(email)}%`}`);
    // Their id, wherever it is kept without a foreign key.
    await tx.execute(sql`update ai_usage set user_id = null where user_id = ${userId}`);
    await tx.execute(sql`update error_log set user_id = null where user_id = ${userId}`);
    await tx.execute(sql`update subscriptions set checkout_user_id = null where checkout_user_id = ${userId}`);
    await tx.execute(sql`update billing_checkout_nonces set user_id = 'deleted' where user_id = ${userId}`);
    await tx.execute(sql`delete from verifications where value = ${userId}`);
    // Sessions, credentials, memberships and invitations they sent cascade from the user row;
    // analytics events keep their numbers but lose the link (ON DELETE SET NULL).
    await tx.delete(users).where(eq(users.id, userId));
  });
  await track("user.account_deleted", {}, { workspacesDeleted: plan.deleteWorkspaces.length });
  log.info("account deleted", { workspacesDeleted: plan.deleteWorkspaces.length, workspacesLeft: plan.leaveWorkspaces.length });
  return { workspacesDeleted: plan.deleteWorkspaces.length };
}
