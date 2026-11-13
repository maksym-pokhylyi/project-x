import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { GET as getBillingStatus } from "@/app/api/billing/status/route";
import { GET as getFile } from "@/app/api/files/[...key]/route";
import { POST as uploadLogo } from "@/app/api/workspace/logo/route";
import { db } from "@/db";
import { auditLog, invitations, members, organizations, sessions, subscriptions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { consumeQuota, getUsage } from "@/lib/billing/quota";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { orgFileKey, storage } from "@/lib/storage";
import { openBillingPortalAction, startCheckoutAction, changePlanAction } from "@/server/actions/billing";
import {
  cancelInvitationAction,
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/server/actions/members";
import { switchWorkspaceAction, updateWorkspaceAction } from "@/server/actions/workspace";
import { listAuditLog } from "@/server/audit";
import { getInvitationInOrg, getMemberInOrg, listMembers, listPendingInvitations } from "@/server/members";
import { requireAdmin, requireOrg, requireUser } from "@/server/session";
import { getUsageSummary } from "@/server/usage";
import { actAs, addMember, createTestUser, headersFor, type TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

/**
 * Two workspaces, A and B. Everything here asserts that a user acting in A can neither
 * read nor change B — through the data-access functions, the Server Actions, our Route
 * Handlers and Better Auth's own organization endpoints.
 */
let ownerA: TestUser;
let ownerB: TestUser;
let memberA: TestUser;
let orgA: string;
let orgB: string;
let ownerBMemberId: string;
let invitationBId: string;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function authRequest(user: TestUser, path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
  const headers = headersFor(user);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

const fileRequest = (key: string, user: TestUser | null) =>
  getFile(new Request(`http://localhost:3000/api/files/${key}`, { headers: user ? headersFor(user) : {} }), {
    params: Promise.resolve({ key: key.split("/") }),
  });

beforeEach(async () => {
  await resetDatabase();
  ownerA = await createTestUser({ name: "Alice A" });
  ownerB = await createTestUser({ name: "Bob B" });
  memberA = await createTestUser({ name: "Mia Member" });
  orgA = ownerA.organizationId;
  orgB = ownerB.organizationId;
  await addMember(orgA, memberA, "member");
  // memberA's sessions should act inside workspace A, not in their personal workspace.
  await db.update(sessions).set({ activeOrganizationId: orgA }).where(eq(sessions.userId, memberA.id));

  const [ownerBMember] = await db.select().from(members).where(and(eq(members.userId, ownerB.id), eq(members.organizationId, orgB)));
  ownerBMemberId = ownerBMember!.id;
  // A pending invitation in B. Inserted directly (like addMember) so that this fixture does not
  // depend on the plan's seat limit: the Free plan has a single seat.
  invitationBId = `inv_${Math.random().toString(36).slice(2)}`;
  await db.insert(invitations).values({
    id: invitationBId,
    organizationId: orgB,
    email: "pending-b@example.com",
    role: "member",
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    inviterId: ownerB.id,
  });
  actAs(null);
});

describe("session-derived context", () => {
  it("requires a session", async () => {
    actAs(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requireOrg()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("resolves the workspace and role from the session, never from input", async () => {
    actAs(ownerA);
    expect(await requireOrg()).toMatchObject({ organization: { id: orgA }, role: "owner" });
    actAs(memberA);
    expect(await requireOrg()).toMatchObject({ organization: { id: orgA }, role: "member" });
    actAs(ownerB);
    expect(await requireOrg()).toMatchObject({ organization: { id: orgB }, role: "owner" });
  });

  it("enforces minimum roles", async () => {
    actAs(memberA);
    await expect(requireOrg({ role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireOrg({ role: "owner" })).rejects.toBeInstanceOf(ForbiddenError);
    actAs(ownerA);
    await expect(requireOrg({ role: "owner" })).resolves.toBeTruthy();
  });

  it("falls back to a workspace the user still belongs to after being removed from the active one", async () => {
    await db.delete(members).where(and(eq(members.userId, memberA.id), eq(members.organizationId, orgA)));
    actAs(memberA);
    const ctx = await requireOrg();
    expect(ctx.organization.id).toBe(memberA.organizationId);
    expect(ctx.organization.id).not.toBe(orgA);
    expect(ctx.role).toBe("owner");
  });

  it("does not grant founder admin without ADMIN_EMAILS + verified email", async () => {
    actAs(ownerA);
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
    const founder = await createTestUser({ email: "founder@example.com" });
    actAs(founder);
    await expect(requireAdmin()).resolves.toMatchObject({ isAdmin: true });
  });
});

describe("data-access functions", () => {
  it("only return rows of the caller's workspace", async () => {
    actAs(ownerA);
    const ctxA = await requireOrg();
    const membersOfA = await listMembers(ctxA);
    expect(membersOfA.map((member) => member.userId).sort()).toEqual([ownerA.id, memberA.id].sort());
    expect(await listPendingInvitations(ctxA)).toEqual([]);
    expect((await listAuditLog(ctxA)).every((entry) => !JSON.stringify(entry).includes(orgB))).toBe(true);

    actAs(ownerB);
    const ctxB = await requireOrg();
    expect((await listMembers(ctxB)).map((member) => member.userId)).toEqual([ownerB.id]);
    expect((await listPendingInvitations(ctxB)).map((invitation) => invitation.email)).toEqual(["pending-b@example.com"]);
  });

  it("refuse ids that belong to another workspace", async () => {
    actAs(ownerA);
    const ctxA = await requireOrg();
    await expect(getMemberInOrg(ctxA, ownerBMemberId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getInvitationInOrg(ctxA, invitationBId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keep member-only callers out of admin data", async () => {
    actAs(memberA);
    const ctx = await requireOrg();
    await expect(listPendingInvitations(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAuditLog(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("meter usage per workspace", async () => {
    await consumeQuota(orgA, "units", 7);
    actAs(ownerB);
    const summaryB = await getUsageSummary(await requireOrg());
    expect(summaryB.metrics.find((metric) => metric.key === "units")?.used).toBe(0);
    expect(summaryB.seats).toMatchObject({ members: 1, pendingInvitations: 1 });
    expect(await getUsage(orgB, "units")).toBe(0);
    actAs(ownerA);
    const summaryA = await getUsageSummary(await requireOrg());
    expect(summaryA.metrics.find((metric) => metric.key === "units")?.used).toBe(7);
    expect(summaryA.seats).toMatchObject({ members: 2, pendingInvitations: 0 });
  });
});

describe("server actions", () => {
  it("cannot remove or re-role a member of another workspace", async () => {
    actAs(ownerA);
    expect(await removeMemberAction(ownerBMemberId)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await updateMemberRoleAction({ memberId: ownerBMemberId, role: "member" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    const [stillThere] = await db.select().from(members).where(eq(members.id, ownerBMemberId));
    expect(stillThere).toMatchObject({ role: "owner", organizationId: orgB });
  });

  it("cannot cancel another workspace's invitation", async () => {
    actAs(ownerA);
    expect(await cancelInvitationAction(invitationBId)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, invitationBId));
    expect(invitation?.status).toBe("pending");
  });

  it("cannot switch into a workspace the user is not a member of", async () => {
    actAs(ownerA);
    const result = await switchWorkspaceAction({ organizationId: orgB });
    expect(result.ok).toBe(false);
    expect((await requireOrg()).organization.id).toBe(orgA);
    const [session] = await db.select().from(sessions).where(eq(sessions.userId, ownerA.id));
    expect(session?.activeOrganizationId).toBe(orgA);
  });

  it("always act on the session's workspace, ignoring extra input", async () => {
    actAs(ownerA);
    const result = await updateWorkspaceAction({ name: "Renamed by A", organizationId: orgB, id: orgB });
    expect(result).toEqual({ ok: true, data: { name: "Renamed by A" } });
    const [a] = await db.select().from(organizations).where(eq(organizations.id, orgA));
    const [b] = await db.select().from(organizations).where(eq(organizations.id, orgB));
    expect(a?.name).toBe("Renamed by A");
    expect(b?.name).toBe("Bob's workspace");
    // The mutation was audited against A with the acting user.
    const audit = await db.select().from(auditLog).where(eq(auditLog.action, "workspace.updated"));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ organizationId: orgA, actorId: ownerA.id, actorType: "user" });
  });

  it("reject members for admin and owner actions", async () => {
    actAs(memberA);
    expect(await inviteMemberAction({ email: "x@example.com", role: "member" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await updateWorkspaceAction({ name: "Nope" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await startCheckoutAction({ plan: "pro", interval: "month" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await openBillingPortalAction()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await changePlanAction({ plan: "pro", interval: "month" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await db.select().from(invitations).where(eq(invitations.organizationId, orgA))).toHaveLength(0);
  });

  it("reject admins for owner-only billing actions", async () => {
    const adminA = await createTestUser({ name: "Adam Admin" });
    await addMember(orgA, adminA, "admin");
    await db.update(sessions).set({ activeOrganizationId: orgA }).where(eq(sessions.userId, adminA.id));
    actAs(adminA);
    expect((await requireOrg()).role).toBe("admin");
    expect(await startCheckoutAction({ plan: "pro", interval: "month" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await openBillingPortalAction()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("reject signed-out callers", async () => {
    actAs(null);
    expect(await updateWorkspaceAction({ name: "Anon" })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(await removeMemberAction(ownerBMemberId)).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(await startCheckoutAction({ plan: "pro", interval: "month" })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });

  it("checkout parameters carry the session's workspace and user", async () => {
    actAs(ownerA);
    // No client token in the test env: the action must fail closed, not open a checkout.
    expect(await startCheckoutAction({ plan: "pro", interval: "month" })).toMatchObject({ ok: false, error: { code: "BILLING_NOT_CONFIGURED" } });
    expect(await startCheckoutAction({ plan: "enterprise", interval: "month" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });
});

describe("Better Auth organization endpoints (direct HTTP)", () => {
  it("refuse cross-workspace reads", async () => {
    const full = await authRequest(ownerA, `/organization/get-full-organization?organizationId=${orgB}`);
    expect(full.status).toBeGreaterThanOrEqual(400);
    const list = await authRequest(ownerA, `/organization/list-members?organizationId=${orgB}`);
    expect(list.status).toBeGreaterThanOrEqual(400);
    const invites = await authRequest(ownerA, `/organization/list-invitations?organizationId=${orgB}`);
    expect(invites.status).toBeGreaterThanOrEqual(400);
  });

  it("refuse cross-workspace mutations", async () => {
    const remove = await authRequest(ownerA, "/organization/remove-member", { body: { memberIdOrEmail: ownerBMemberId, organizationId: orgB } });
    expect(remove.status).toBeGreaterThanOrEqual(400);
    const role = await authRequest(ownerA, "/organization/update-member-role", { body: { memberId: ownerBMemberId, role: "member", organizationId: orgB } });
    expect(role.status).toBeGreaterThanOrEqual(400);
    const invite = await authRequest(ownerA, "/organization/invite-member", { body: { email: "evil@example.com", role: "admin", organizationId: orgB } });
    expect(invite.status).toBeGreaterThanOrEqual(400);
    const update = await authRequest(ownerA, "/organization/update", { body: { organizationId: orgB, data: { name: "Hacked" } } });
    expect(update.status).toBeGreaterThanOrEqual(400);
    const cancel = await authRequest(ownerA, "/organization/cancel-invitation", { body: { invitationId: invitationBId } });
    expect(cancel.status).toBeGreaterThanOrEqual(400);
    const setActive = await authRequest(ownerA, "/organization/set-active", { body: { organizationId: orgB } });
    expect(setActive.status).toBeGreaterThanOrEqual(400);

    const [b] = await db.select().from(organizations).where(eq(organizations.id, orgB));
    expect(b?.name).toBe("Bob's workspace");
    expect(await db.select().from(members).where(eq(members.organizationId, orgB))).toHaveLength(1);
    const pending = await db.select().from(invitations).where(eq(invitations.organizationId, orgB));
    expect(pending.map((row) => `${row.email}:${row.status}`)).toEqual(["pending-b@example.com:pending"]);
  });

  it("refuse member-level callers for admin operations in their own workspace", async () => {
    const invite = await authRequest(memberA, "/organization/invite-member", { body: { email: "friend@example.com", role: "member", organizationId: orgA } });
    expect(invite.status).toBeGreaterThanOrEqual(400);
    const update = await authRequest(memberA, "/organization/update", { body: { organizationId: orgA, data: { name: "Member rename" } } });
    expect(update.status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(invitations).where(eq(invitations.organizationId, orgA))).toHaveLength(0);
  });

  it("cannot delete a workspace at all (disabled)", async () => {
    const response = await authRequest(ownerA, "/organization/delete", { body: { organizationId: orgA } });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(organizations).where(eq(organizations.id, orgA))).toHaveLength(1);
  });
});

describe("route handlers", () => {
  it("GET /api/billing/status reports only the caller's workspace", async () => {
    await db.insert(subscriptions).values({ organizationId: orgB, status: "active", planKey: "business", paddleSubscriptionId: "sub_b" });
    actAs(ownerA);
    const a = await getBillingStatus(new Request("http://localhost:3000/api/billing/status"), undefined);
    expect(await a.json()).toMatchObject({ organizationId: orgA, planKey: "free", isPaid: false });
    actAs(ownerB);
    const b = await getBillingStatus(new Request("http://localhost:3000/api/billing/status"), undefined);
    expect(await b.json()).toMatchObject({ organizationId: orgB, planKey: "business", isPaid: true });
    actAs(null);
    const anonymous = await getBillingStatus(new Request("http://localhost:3000/api/billing/status"), undefined);
    expect(anonymous.status).toBe(401);
  });

  it("GET /api/files serves a workspace's files only to its members", async () => {
    const key = orgFileKey(orgB, "logo", "secret.png");
    await storage.put(key, PNG, { contentType: "image/png" });
    try {
      actAs(ownerB);
      const allowed = await fileRequest(key, ownerB);
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("content-type")).toBe("image/png");
      expect(allowed.headers.get("x-content-type-options")).toBe("nosniff");

      actAs(ownerA);
      expect((await fileRequest(key, ownerA)).status).toBe(404);
      actAs(memberA);
      expect((await fileRequest(key, memberA)).status).toBe(404);
      actAs(null);
      expect((await fileRequest(key, null)).status).toBe(401);
      // Path tricks do not escape the tenant namespace.
      actAs(ownerA);
      expect((await fileRequest(`org/${orgA}/../${orgB}/logo/secret.png`, ownerA)).status).toBe(404);
    } finally {
      await storage.delete(key);
    }
  });

  it("GET /api/files accepts a valid signed URL and rejects a forged or expired one", async () => {
    const key = orgFileKey(orgB, "exports", "report.pdf");
    await storage.put(key, new TextEncoder().encode("%PDF-1.4"), { contentType: "application/pdf" });
    try {
      actAs(null);
      const url = new URL(await storage.signedUrl(key, { expiresInSeconds: 60 }));
      const call = (target: URL) => getFile(new Request(target), { params: Promise.resolve({ key: key.split("/") }) });
      expect((await call(url)).status).toBe(200);

      const forged = new URL(url);
      forged.searchParams.set("signature", "0".repeat(64));
      expect((await call(forged)).status).toBe(401);

      const expired = new URL(url);
      expired.searchParams.set("expires", "1");
      expect((await call(expired)).status).toBe(401);

      // A signature for one key does not open another.
      const otherKey = orgFileKey(orgB, "exports", "other.pdf");
      const reused = new URL(url.toString().replace("report.pdf", "other.pdf"));
      const response = await getFile(new Request(reused), { params: Promise.resolve({ key: otherKey.split("/") }) });
      expect(response.status).toBe(401);
    } finally {
      await storage.delete(key);
    }
  });

  it("POST /api/workspace/logo is admin-only and writes into the caller's workspace", async () => {
    const upload = () => {
      const form = new FormData();
      form.set("file", new File([PNG], "logo.png", { type: "image/png" }));
      return uploadLogo(new Request("http://localhost:3000/api/workspace/logo", { method: "POST", body: form }), undefined);
    };
    actAs(memberA);
    expect((await upload()).status).toBe(403);
    actAs(null);
    expect((await upload()).status).toBe(401);

    actAs(ownerA);
    const response = await upload();
    expect(response.status).toBe(200);
    const { logo } = (await response.json()) as { logo: string };
    expect(logo.startsWith(`/api/files/org/${orgA}/logo/`)).toBe(true);
    const [a] = await db.select().from(organizations).where(eq(organizations.id, orgA));
    const [b] = await db.select().from(organizations).where(eq(organizations.id, orgB));
    expect(a?.logo).toBe(logo);
    expect(b?.logo).toBeNull();
    await storage.delete(logo.replace("/api/files/", ""));
  });

  it("POST /api/workspace/logo rejects files that are not images, whatever their declared type", async () => {
    actAs(ownerA);
    const form = new FormData();
    form.set("file", new File(["<svg onload=alert(1)>"], "logo.png", { type: "image/png" }));
    const response = await uploadLogo(new Request("http://localhost:3000/api/workspace/logo", { method: "POST", body: form }), undefined);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });
});
