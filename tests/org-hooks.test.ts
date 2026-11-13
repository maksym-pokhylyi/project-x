import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { emailOutbox, invitations, members, organizations, subscriptions, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sanitizeDisplayName } from "@/lib/validation";
import { inviteMemberAction, removeMemberAction } from "@/server/actions/members";
import { updateProfileAction } from "@/server/actions/profile";
import { createWorkspaceAction, updateWorkspaceAction } from "@/server/actions/workspace";
import { assertWorkspaceWritable, requireOrg } from "@/server/session";
import { actAs, addMember, createTestUser, headersFor, type TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

const ORIGIN = "http://localhost:3000";
const PHISHING = "URGENT: your Bidfolio account is suspended – verify at https://evil.example/login to keep access to your tenders";

/** A direct call to a Better Auth endpoint, as any HTTP client could make it. */
async function raw(user: TestUser | null, path: string, body: unknown) {
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...(user ? { cookie: user.cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
  const json = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
  return { status: response.status, code: json.code, message: json.message };
}

const organizationOf = async (id: string) => (await db.select().from(organizations).where(eq(organizations.id, id)))[0]!;

/** Gives a workspace an active subscription, as a Paddle webhook would. The Free plan has a single seat, so anything that invites needs one. */
const subscribe = (organizationId: string, planKey: "starter" | "pro" | "business") =>
  db.insert(subscriptions).values({ organizationId, status: "active", planKey, paddleSubscriptionId: `sub_${planKey}_${organizationId}` });

describe("raw Better Auth endpoints obey the app's rules (F-13)", () => {
  let owner: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    owner = await createTestUser({ email: "owner@example.com", name: "Olivia Owner" });
    actAs(owner);
  });

  describe("workspace create", () => {
    it("rejects names that are too long, contain links or control characters", async () => {
      for (const name of [PHISHING, "Verify at https://evil.example", "see www.evil.example now", "evil.example/login", "Line\nbreak", "x", " padded "]) {
        const result = await raw(owner, "/organization/create", { name, slug: `slug-${Math.random().toString(36).slice(2, 8)}` });
        expect(result, JSON.stringify(name)).toMatchObject({ status: 400, code: "VALIDATION" });
      }
      expect(await db.select().from(organizations)).toHaveLength(1); // only the personal workspace
    });

    it("rejects client-supplied slug formats, logo and metadata", async () => {
      expect(await raw(owner, "/organization/create", { name: "Acme Ltd", slug: "Not A Slug" })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await raw(owner, "/organization/create", { name: "Acme Ltd", slug: "../admin" })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await raw(owner, "/organization/create", { name: "Acme Ltd", slug: "acme-1", logo: "https://evil.example/pixel.png" })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await raw(owner, "/organization/create", { name: "Acme Ltd", slug: "acme-2", metadata: { personal: true, plan: "business" } })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await db.select().from(organizations)).toHaveLength(1);
    });

    it("still accepts a valid workspace, directly and through the Server Action", async () => {
      expect((await raw(owner, "/organization/create", { name: "Acme.io Bids", slug: "acme-io-bids" })).status).toBe(200);
      expect((await createWorkspaceAction({ name: "Second Co" })).ok).toBe(true);
      expect(await createWorkspaceAction({ name: "Join https://evil.example" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
      expect(await db.select().from(organizations)).toHaveLength(3);
    });
  });

  describe("workspace update", () => {
    it("accepts only a logo this workspace uploaded, and no slug games or metadata", async () => {
      const update = (data: Record<string, unknown>) => raw(owner, "/organization/update", { organizationId: owner.organizationId, data });
      const before = await organizationOf(owner.organizationId);

      expect(await update({ logo: "https://evil.example/tracking-pixel.png" })).toMatchObject({ status: 400, code: "VALIDATION" });
      // Another key in the own namespace: the upload route would later DELETE whatever the logo names.
      expect(await update({ logo: `/api/files/org/${owner.organizationId}/documents/tender.pdf` })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await update({ logo: `/api/files/org/someone-else/logo/a.png` })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await update({ logo: `/api/files/org/${owner.organizationId}/logo/../../x` })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await update({ slug: "Totally Different!" })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await update({ metadata: { personal: false } })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await update({ name: PHISHING })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await organizationOf(owner.organizationId)).toEqual(before);

      expect((await update({ logo: `/api/files/org/${owner.organizationId}/logo/abc123.png` })).status).toBe(200);
      expect((await update({ logo: null })).status).toBe(200);
      expect((await update({ name: "Renamed Co", slug: "renamed-co" })).status).toBe(200);
      expect(await organizationOf(owner.organizationId)).toMatchObject({ name: "Renamed Co", slug: "renamed-co", logo: null, metadata: before.metadata });
      expect(await updateWorkspaceAction({ name: "Via Action" })).toEqual({ ok: true, data: { name: "Via Action" } });
    });
  });

  describe("user names", () => {
    it("a phishing text cannot become a user name through sign-up or update-user, so it never reaches an invitation e-mail", async () => {
      expect(await raw(null, "/sign-up/email", { email: "new@example.com", password: "a-good-password-1", name: PHISHING })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await raw(null, "/sign-up/email", { email: "new@example.com", password: "a-good-password-1", name: "Jo", image: "https://evil.example/a.png" })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await db.select().from(users)).toHaveLength(1);

      expect(await raw(owner, "/update-user", { name: PHISHING })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await raw(owner, "/update-user", { name: "Visit www.evil.example" })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await raw(owner, "/update-user", { image: "https://evil.example/avatar.png" })).toMatchObject({ status: 400, code: "VALIDATION" });
      expect((await db.select().from(users))[0]).toMatchObject({ name: "Olivia Owner", image: null });

      expect((await raw(owner, "/update-user", { name: "  Olivia O'Brien-Smith  " })).status).toBe(200);
      expect((await db.select().from(users))[0]!.name).toBe("Olivia O'Brien-Smith");
      expect(await updateProfileAction({ name: "Join https://evil.example" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });

      await subscribe(owner.organizationId, "starter"); // Radar Pro: 2 seats, so there is room for one invitation
      await raw(owner, "/organization/invite-member", { email: "invitee@example.com", role: "member", organizationId: owner.organizationId });
      const [mail] = await db.select().from(emailOutbox).where(eq(emailOutbox.template, "invitation"));
      expect(mail!.subject).toBe("Olivia O'Brien-Smith invited you to Olivia's workspace on Bidfolio");
    });

    it("cleans names it cannot reject (OAuth profiles)", () => {
      expect(sanitizeDisplayName("Jo\nBloggs https://evil.example/x  www.evil.example evil.example/path", "jo")).toBe("Jo Bloggs");
      expect(sanitizeDisplayName("https://evil.example", "jo")).toBe("jo");
      expect(sanitizeDisplayName("  Dr. Ada   Lovelace ", "x")).toBe("Dr. Ada Lovelace");
      expect(sanitizeDisplayName("A".repeat(200), "x")).toHaveLength(80);
    });
  });

  describe("invitations and roles", () => {
    it("only member/admin can be invited, even by an owner calling the endpoint directly", async () => {
      await subscribe(owner.organizationId, "starter"); // Radar Pro: 2 seats
      const invite = (role: unknown, email = "invitee@example.com") => raw(owner, "/organization/invite-member", { email, role, organizationId: owner.organizationId });
      expect(await invite("owner")).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await invite(["member", "owner"])).toMatchObject({ status: 400, code: "VALIDATION" });
      expect(await invite("superuser")).toMatchObject({ status: 400 });
      expect(await db.select().from(invitations)).toHaveLength(0);
      expect((await invite("admin")).status).toBe(200);
    });

    it("member roles can only be set to a known role", async () => {
      const member = await createTestUser({ email: "member@example.com" });
      const memberId = await addMember(owner.organizationId, member, "member");
      const setRole = (role: unknown) => raw(owner, "/organization/update-member-role", { memberId, role, organizationId: owner.organizationId });
      expect((await setRole("superuser")).status).toBe(400);
      expect((await db.select().from(members).where(eq(members.id, memberId)))[0]!.role).toBe("member");
      expect((await setRole("admin")).status).toBe(200);
    });

    it("the per-workspace invitation limit also applies to the raw endpoint (invite → cancel → invite cannot spam)", async () => {
      await db.insert(subscriptions).values({ organizationId: owner.organizationId, status: "active", planKey: "business", paddleSubscriptionId: "sub_many_seats" });
      const statuses: number[] = [];
      for (let i = 0; i < 32; i += 1) {
        const result = await raw(owner, "/organization/invite-member", { email: `spam-target@example.com`, role: "member", organizationId: owner.organizationId, resend: true });
        statuses.push(result.status);
        const [pending] = await db.select().from(invitations).where(eq(invitations.status, "pending"));
        if (pending) await raw(owner, "/organization/cancel-invitation", { invitationId: pending.id });
      }
      expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
      expect(statuses.slice(30)).toEqual([429, 429]);
      expect(await db.select().from(emailOutbox).where(eq(emailOutbox.template, "invitation"))).toHaveLength(30);
      // The Server Action reports the same limit as a typed error.
      expect(await inviteMemberAction({ email: "one-more@example.com", role: "member" })).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    });
  });
});

describe("seat limits after a downgrade (F-15)", () => {
  let owner: TestUser;
  let extra: TestUser[];

  beforeEach(async () => {
    await resetDatabase();
    owner = await createTestUser({ email: "owner@example.com" });
    // On Bid Desk Plus (10 seats) the workspace grows to 4 members…
    await db.insert(subscriptions).values({ organizationId: owner.organizationId, status: "active", planKey: "business", paddleSubscriptionId: "sub_seats" });
    extra = [];
    for (const [index, role] of (["admin", "member", "member"] as const).entries()) {
      const user = await createTestUser({ email: `member${index}@example.com` });
      await addMember(owner.organizationId, user, role);
      await auth.api.setActiveOrganization({ headers: headersFor(user), body: { organizationId: owner.organizationId } });
      extra.push(user);
    }
  });

  const cancelPlan = () => db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.organizationId, owner.organizationId));

  it("within the limit nothing is flagged", async () => {
    actAs(owner);
    const ctx = await requireOrg({ write: true });
    expect(ctx.seats).toEqual({ used: 4, limit: 10, overLimit: false });
  });

  it("after the plan ends: members keep read access, the workspace is flagged and read-only, nobody can be added", async () => {
    await cancelPlan(); // back to Free: 1 seat, 4 members

    for (const user of [owner, ...extra]) {
      actAs(user);
      const ctx = await requireOrg(); // reading still works for everyone
      expect(ctx.organization.id).toBe(owner.organizationId);
      expect(ctx.seats).toEqual({ used: 4, limit: 1, overLimit: true });
      const error = await requireOrg({ write: true }).catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: "SEAT_LIMIT_REACHED", status: 402, details: { limit: 1, used: 4, readOnly: true } });
      expect(() => assertWorkspaceWritable(ctx)).toThrow(/read-only/);
    }

    actAs(owner);
    expect(await inviteMemberAction({ email: "another@example.com", role: "member" })).toMatchObject({ ok: false, error: { code: "SEAT_LIMIT_REACHED" } });
    expect((await raw(owner, "/organization/invite-member", { email: "another@example.com", role: "member", organizationId: owner.organizationId })).status).toBe(403);
    expect(await db.select().from(invitations)).toHaveLength(0);
  });

  it("the owner repairs it by removing members (or upgrading)", async () => {
    await cancelPlan();
    actAs(owner);
    const rows = await db.select().from(members).where(eq(members.organizationId, owner.organizationId));
    for (const user of extra) {
      expect(await removeMemberAction(rows.find((row) => row.userId === user.id)!.id)).toMatchObject({ ok: true });
    }
    const ctx = await requireOrg({ write: true });
    expect(ctx.seats).toEqual({ used: 1, limit: 1, overLimit: false });

    await addMember(owner.organizationId, extra[1]!, "member");
    await expect(requireOrg({ write: true })).rejects.toMatchObject({ code: "SEAT_LIMIT_REACHED" });
    await db.update(subscriptions).set({ status: "active", planKey: "pro" }).where(eq(subscriptions.organizationId, owner.organizationId));
    expect((await requireOrg({ write: true })).seats.overLimit).toBe(false);
  });

  it("two invitations accepted at the same moment cannot exceed the limit", async () => {
    // Fresh workspace: Bid Desk (3 seats) with the owner and two pending invitations, then a downgrade to Radar Pro (2 seats).
    const boss = await createTestUser({ email: "boss@example.com" });
    await db.insert(subscriptions).values({ organizationId: boss.organizationId, status: "active", planKey: "pro", paddleSubscriptionId: "sub_race" });
    actAs(boss);
    const first = await inviteMemberAction({ email: "racer1@example.com", role: "member" });
    const second = await inviteMemberAction({ email: "racer2@example.com", role: "member" });
    expect(first.ok && second.ok).toBe(true);
    await db.update(subscriptions).set({ planKey: "starter" }).where(eq(subscriptions.organizationId, boss.organizationId));
    const racers = [await createTestUser({ email: "racer1@example.com" }), await createTestUser({ email: "racer2@example.com" })];
    const ids = [first.ok ? first.data.invitationId : "", second.ok ? second.data.invitationId : ""];

    const results = await Promise.allSettled(
      racers.map((racer, index) => auth.api.acceptInvitation({ headers: headersFor(racer), body: { invitationId: ids[index]! } })),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const joined = await db.select().from(members).where(eq(members.organizationId, boss.organizationId));
    expect(joined).toHaveLength(2); // the owner + exactly one of the two
    const states = (await db.select().from(invitations).where(eq(invitations.organizationId, boss.organizationId))).map((row) => row.status).sort();
    expect(states).toEqual(["accepted", "pending"]); // the loser can accept later, once there is room
  });
});
