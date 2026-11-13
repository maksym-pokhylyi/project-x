import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { GET as exportRoute } from "@/app/api/workspace/export/route";
import { POST as paddleWebhook } from "@/app/api/webhooks/paddle/route";
import { db } from "@/db";
import {
  accounts,
  aiUsage,
  auditLog,
  emailOutbox,
  errorLog,
  events,
  invitations,
  members,
  organizations,
  sessions,
  subscriptions,
  usageCounters,
  users,
  webhookEvents,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { signCheckoutData } from "@/lib/billing/checkout-signature";
import { orgFileKey, orgStoragePrefix, storage } from "@/lib/storage";
import { deleteAccountAction, deleteWorkspaceAction, previewAccountDeletionAction } from "@/server/actions/account";
import { requireOrg } from "@/server/session";
import { listTenantTables, registerTenantDataHandler, type WorkspaceExport } from "@/server/tenant-data";
import { actAs, addMember, createTestUser, type TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";
import { paddleEvent, signedWebhookRequest } from "./helpers/paddle";

/**
 * F-12 — owners can export and delete a workspace, users can delete their account, and
 * erasure really removes everything: every tenant table (found in the catalogue, so feature
 * tables are covered), stored files, and the copies of personal data elsewhere.
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PASSWORD = "correct-horse-battery";

/** Rows that still mention the workspace, per table with an `organization_id` column. */
async function tenantRowCounts(organizationId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of await listTenantTables()) {
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)} where organization_id = ${organizationId}`);
    if ((row?.n ?? 0) > 0) counts[table] = row!.n;
  }
  return counts;
}

/** Product tables as a feature module might create them: with a cascading FK, a RESTRICT FK, and no FK at all. */
const FEATURE_TABLES = ["zz_feature_cascade", "zz_feature_restrict", "zz_feature_loose"];
beforeAll(async () => {
  await db.execute(sql`create table if not exists zz_feature_cascade (id serial primary key, organization_id text not null references organizations(id) on delete cascade, body text)`);
  await db.execute(sql`create table if not exists zz_feature_restrict (id serial primary key, organization_id text not null references organizations(id), body text)`);
  await db.execute(sql`create table if not exists zz_feature_loose (id serial primary key, organization_id text, body text)`);
});
afterAll(async () => {
  for (const table of FEATURE_TABLES) await db.execute(sql`drop table if exists ${sql.identifier(table)}`);
});

const handlerCalls: string[] = [];
registerTenantDataHandler({
  name: "test-feature",
  onExport: async (organizationId) => ({ note: `extra data for ${organizationId}` }),
  onDelete: async (organizationId) => void handlerCalls.push(organizationId),
});

/** Fills a workspace with one of everything. */
async function populate(owner: TestUser, label: string) {
  const org = owner.organizationId;
  await storage.put(orgFileKey(org, "logo", "logo.png"), PNG, { contentType: "image/png" });
  await storage.put(orgFileKey(org, "documents", "tender-pack.pdf"), new TextEncoder().encode(`confidential ${label}`), { contentType: "application/pdf" });
  await db.insert(usageCounters).values({ organizationId: org, metric: "units", periodStart: new Date(0), quantity: 7 });
  await db.insert(aiUsage).values({ organizationId: org, userId: owner.id, feature: "check", model: "m", costUsd: 0.01 });
  await db.insert(auditLog).values({ organizationId: org, actorType: "user", actorId: owner.id, action: "bid.created", metadata: { label } });
  await db.insert(events).values({ organizationId: org, userId: owner.id, name: "bid.created", properties: { label } });
  await db.insert(errorLog).values({ organizationId: org, userId: owner.id, message: `error in ${label}` });
  for (const table of FEATURE_TABLES) await db.execute(sql`insert into ${sql.identifier(table)} (organization_id, body) values (${org}, ${`tender text of ${label}`})`);
}

/** A subscription that has ended, created through the real webhook path. */
async function endedSubscription(owner: TestUser, subscriptionId: string, customerId: string) {
  const custom = () => signCheckoutData({ organizationId: owner.organizationId, userId: owner.id, issuedAt: new Date(Date.parse("2026-10-01T10:00:00Z") - 60_000) });
  const event = (name: "subscription.created" | "subscription.canceled", occurredAt: string) =>
    paddleEvent(name, {
      organizationId: null,
      occurredAt,
      mutate: (data) => {
        data.id = subscriptionId;
        data.customer_id = customerId;
        data.custom_data = name === "subscription.created" ? custom() : null;
      },
    });
  await paddleWebhook(signedWebhookRequest(paddleEvent("customer.created", { mutate: (data) => void ((data.id = customerId), (data.email = owner.email)) })));
  await paddleWebhook(signedWebhookRequest(event("subscription.created", "2026-10-01T10:00:00Z")));
  await paddleWebhook(signedWebhookRequest(event("subscription.canceled", "2026-10-20T10:00:00Z")));
}

describe("workspace deletion (F-12)", () => {
  let owner: TestUser;
  let member: TestUser;
  let bystander: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    for (const table of FEATURE_TABLES) await db.execute(sql`delete from ${sql.identifier(table)}`);
    handlerCalls.length = 0;
    owner = await createTestUser({ email: "owner@example.com", name: "Olivia Owner" });
    member = await createTestUser({ email: "member@example.com" });
    bystander = await createTestUser({ email: "bystander@example.com" });
    await addMember(owner.organizationId, member, "admin");
    await populate(owner, "ACME");
    await populate(bystander, "OTHER");
    await endedSubscription(owner, "sub_acme_ended", "ctm_acme");
    // A pending invitation and the e-mail that was sent for it.
    await db.insert(invitations).values({ id: "inv_acme", organizationId: owner.organizationId, email: "invited@example.com", role: "member", status: "pending", expiresAt: new Date(Date.now() + 86_400_000), inviterId: owner.id });
    await db.insert(emailOutbox).values({ toEmail: "invited@example.com", subject: "Olivia invited you", template: "invitation", status: "sent" });
    actAs(owner);
  });

  it("requires the owner and the exact workspace name", async () => {
    const name = (await requireOrg()).organization.name;
    expect(await deleteWorkspaceAction({ confirmName: "something else" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    await auth.api.setActiveOrganization({ headers: new Headers({ cookie: member.cookie }), body: { organizationId: owner.organizationId } });
    actAs(member); // an admin, not an owner
    expect(await deleteWorkspaceAction({ confirmName: name })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    actAs(null);
    expect(await deleteWorkspaceAction({ confirmName: name })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(await db.select().from(organizations).where(eq(organizations.id, owner.organizationId))).toHaveLength(1);
    expect(await storage.list(orgStoragePrefix(owner.organizationId))).toHaveLength(2);
  });

  it("refuses while a subscription could still bill", async () => {
    const name = (await requireOrg()).organization.name;
    for (const status of ["active", "trialing", "past_due", "paused"]) {
      await db.update(subscriptions).set({ status }).where(eq(subscriptions.organizationId, owner.organizationId));
      const result = await deleteWorkspaceAction({ confirmName: name });
      expect(result, status).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(!result.ok && result.error.message).toContain("Cancel it");
    }
    expect(Object.keys(await tenantRowCounts(owner.organizationId)).length).toBeGreaterThan(5);
    expect(await storage.list(orgStoragePrefix(owner.organizationId))).toHaveLength(2);
  });

  it("removes every trace of the workspace — rows in every tenant table, files, billing events — and nothing else", async () => {
    const org = owner.organizationId;
    const name = (await requireOrg()).organization.name;
    const before = await tenantRowCounts(org);
    // The fixture really is spread over the whole schema, including the feature tables.
    expect(Object.keys(before)).toEqual(expect.arrayContaining(["ai_usage", "audit_log", "error_log", "events", "invitations", "members", "subscriptions", "usage_counters", ...FEATURE_TABLES]));
    const bystanderBefore = await tenantRowCounts(bystander.organizationId);
    expect((await db.select().from(webhookEvents)).length).toBe(3);

    const result = await deleteWorkspaceAction({ confirmName: name });
    expect(result).toEqual({ ok: true, data: { files: 2 } });

    expect(await tenantRowCounts(org)).toEqual({});
    expect(await db.select().from(organizations).where(eq(organizations.id, org))).toHaveLength(0);
    expect(await storage.list(orgStoragePrefix(org))).toEqual([]);
    expect(await storage.get(orgFileKey(org, "documents", "tender-pack.pdf"))).toBeNull();
    expect(await db.select().from(webhookEvents)).toHaveLength(0); // subscription, customer and checkout events
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, "invited@example.com"))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.activeOrganizationId, org))).toHaveLength(0);
    expect(handlerCalls).toEqual([org]);

    // Other tenants are untouched.
    expect(await tenantRowCounts(bystander.organizationId)).toEqual(bystanderBefore);
    expect(await storage.list(orgStoragePrefix(bystander.organizationId))).toHaveLength(2);
    // The member keeps their account and their own workspace; the owner lands in a fresh personal one.
    expect(await db.select().from(users)).toHaveLength(3);
    actAs(member);
    expect((await requireOrg()).organization.id).toBe(member.organizationId);
    actAs(owner);
    const fresh = await requireOrg();
    expect(fresh.organization.id).not.toBe(org);
    expect(fresh.role).toBe("owner");
  });
});

describe("workspace export (F-12)", () => {
  let owner: TestUser;
  let other: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    for (const table of FEATURE_TABLES) await db.execute(sql`delete from ${sql.identifier(table)}`);
    owner = await createTestUser({ email: "owner@example.com", name: "Olivia Owner" });
    other = await createTestUser({ email: "other@example.com" });
    await populate(owner, "ACME");
    await populate(other, "OTHER");
    await endedSubscription(owner, "sub_acme_ended", "ctm_acme");
  });

  const download = () => exportRoute(new Request("http://localhost:3000/api/workspace/export"), undefined);

  it("gives the owner one JSON file with the workspace's records, and only those", async () => {
    actAs(owner);
    const response = await download();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="workspace-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    const data = JSON.parse(text) as WorkspaceExport;

    expect(data.formatVersion).toBe(1);
    expect(data.workspace).toMatchObject({ id: owner.organizationId });
    expect(data.members).toEqual([expect.objectContaining({ name: "Olivia Owner", email: "owner@example.com", role: "owner" })]);
    expect(Object.keys(data.tables)).toEqual(expect.arrayContaining(["ai_usage", "audit_log", "events", "invitations", "subscriptions", "usage_counters", ...FEATURE_TABLES]));
    expect(data.tables.zz_feature_loose!.rows).toEqual([expect.objectContaining({ body: "tender text of ACME" })]);
    expect(data.tables.subscriptions!.rows).toEqual([expect.objectContaining({ status: "canceled", paddle_subscription_id: "sub_acme_ended" })]);
    expect(data.files).toEqual([`org/${owner.organizationId}/documents/tender-pack.pdf`, `org/${owner.organizationId}/logo/logo.png`]);
    expect(data.extensions).toEqual({ "test-feature": { note: `extra data for ${owner.organizationId}` } });

    // Nothing of another tenant, no internals, no credentials.
    expect(text).not.toContain("OTHER");
    expect(text).not.toContain(other.organizationId);
    expect(data.tables).not.toHaveProperty("error_log");
    expect(data.tables).not.toHaveProperty("billing_checkout_nonces");
    expect(data.tables.subscriptions!.rows[0]).not.toHaveProperty("raw");
    const [credential] = await db.select().from(accounts).where(eq(accounts.userId, owner.id));
    expect(text).not.toContain(credential!.password!);
  });

  it("is for owners only", async () => {
    const member = await createTestUser({ email: "member@example.com" });
    await addMember(owner.organizationId, member, "admin");
    await auth.api.setActiveOrganization({ headers: new Headers({ cookie: member.cookie }), body: { organizationId: owner.organizationId } });
    actAs(member);
    expect((await download()).status).toBe(403);
    actAs(null);
    expect((await download()).status).toBe(401);
  });
});

describe("account deletion (F-12)", () => {
  let user: TestUser;
  let colleague: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    for (const table of FEATURE_TABLES) await db.execute(sql`delete from ${sql.identifier(table)}`);
    user = await createTestUser({ email: "leaver@example.com", name: "Lee Leaver" });
    colleague = await createTestUser({ email: "colleague@example.com" });
    await populate(user, "PERSONAL");
    await populate(colleague, "TEAM");
    actAs(user);
  });

  it("needs the typed email address and the current password", async () => {
    expect(await deleteAccountAction({ confirmEmail: "someone@else.example", password: PASSWORD })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await deleteAccountAction({ confirmEmail: user.email })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await deleteAccountAction({ confirmEmail: user.email, password: "not-my-password" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    actAs(null);
    expect(await deleteAccountAction({ confirmEmail: user.email, password: PASSWORD })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(await db.select().from(users)).toHaveLength(2);
  });

  it("is refused while a workspace would be left without an owner, or a subscription without anyone to manage it", async () => {
    await addMember(user.organizationId, colleague, "member"); // the leaver is the ONLY owner of a shared workspace
    const preview = await previewAccountDeletionAction();
    expect(preview.ok && preview.data.blockers).toHaveLength(1);
    const blocked = await deleteAccountAction({ confirmEmail: user.email, password: PASSWORD });
    expect(blocked).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(!blocked.ok && blocked.error.message).toContain("only owner");

    await db.delete(members).where(eq(members.userId, colleague.id));
    await addMember(colleague.organizationId, colleague, "owner");
    await db.insert(subscriptions).values({ organizationId: user.organizationId, status: "active", planKey: "pro", paddleSubscriptionId: "sub_live" });
    const billing = await deleteAccountAction({ confirmEmail: user.email, password: PASSWORD });
    expect(billing).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(!billing.ok && billing.error.message).toContain("subscription");
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
    expect(await storage.list(orgStoragePrefix(user.organizationId))).toHaveLength(2);
  });

  it("removes the account, its own workspace and files, its memberships, and its email address everywhere", async () => {
    // The leaver is also an admin in a colleague's workspace, and their address was copied around.
    await addMember(colleague.organizationId, user, "admin");
    await db.insert(aiUsage).values({ organizationId: colleague.organizationId, userId: user.id, feature: "check", model: "m" });
    await db.insert(auditLog).values({ organizationId: colleague.organizationId, actorType: "user", actorId: colleague.id, action: "member.invited", metadata: { email: user.email, role: "admin" } });
    await db.insert(invitations).values({ id: "inv_to_leaver", organizationId: colleague.organizationId, email: user.email, role: "member", status: "pending", expiresAt: new Date(Date.now() + 86_400_000), inviterId: colleague.id });
    await db.insert(emailOutbox).values({ toEmail: user.email, subject: "Reset", template: "reset-password", status: "sent" });
    await paddleWebhook(signedWebhookRequest(paddleEvent("customer.created", { mutate: (data) => void (data.email = user.email) })));
    await db.insert(errorLog).values({ userId: user.id, message: "something failed" });

    const preview = await previewAccountDeletionAction();
    expect(preview).toMatchObject({ ok: true, data: { blockers: [], deleteWorkspaces: [{ id: user.organizationId }], leaveWorkspaces: [{ id: colleague.organizationId }] } });

    expect(await deleteAccountAction({ confirmEmail: " Leaver@Example.com ", password: PASSWORD })).toEqual({ ok: true, data: { workspacesDeleted: 1 } });

    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(accounts).where(eq(accounts.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(members).where(eq(members.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(organizations).where(eq(organizations.id, user.organizationId))).toHaveLength(0);
    expect(await storage.list(orgStoragePrefix(user.organizationId))).toEqual([]);
    // No table still holds the address.
    const tables = await db.execute<{ table_name: string }>(sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`);
    for (const { table_name: table } of tables) {
      const [hit] = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)} t where t::text ilike ${`%${user.email}%`}`);
      expect(hit!.n, `email address left in ${table}`).toBe(0);
    }
    expect(await db.select().from(aiUsage).where(eq(aiUsage.userId, user.id))).toHaveLength(0);
    expect((await db.select().from(errorLog).where(eq(errorLog.message, "something failed")))[0]!.userId).toBeNull();
    expect((await auth.api.signInEmail({ body: { email: user.email, password: PASSWORD }, asResponse: true })).status).toBe(401);

    // The colleague's workspace is intact, minus the leaver.
    expect(await db.select().from(members).where(eq(members.organizationId, colleague.organizationId))).toHaveLength(1);
    expect(await storage.list(orgStoragePrefix(colleague.organizationId))).toHaveLength(2);
    expect((await db.select().from(aiUsage).where(eq(aiUsage.organizationId, colleague.organizationId))).length).toBe(2);
    const [invited] = await db.select().from(auditLog).where(eq(auditLog.action, "member.invited"));
    expect(invited!.metadata).toEqual({ role: "admin" });
  });
});

describe("tenant table catalogue", () => {
  it("finds every table that carries organization_id", async () => {
    expect(await listTenantTables()).toEqual(
      expect.arrayContaining(["ai_usage", "audit_log", "billing_checkout_nonces", "error_log", "events", "invitations", "members", "subscriptions", "usage_counters"]),
    );
  });
});
