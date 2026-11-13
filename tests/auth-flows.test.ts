import { and, desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { auditLog, emailOutbox, events, invitations, members, organizations, sessions, subscriptions, users } from "@/db/schema";
import { features } from "@/env";
import { auth } from "@/lib/auth";
import { acceptInvitationAction, cancelInvitationAction, inviteMemberAction } from "@/server/actions/members";
import { createWorkspaceAction, switchWorkspaceAction } from "@/server/actions/workspace";
import { requireOrg } from "@/server/session";
import { actAs, createTestUser, headersFor, type TestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

const PASSWORD = "correct-horse-battery";

async function latestEmail(to: string, template: string) {
  const [row] = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.toEmail, to), eq(emailOutbox.template, template)))
    .orderBy(desc(emailOutbox.createdAt))
    .limit(1);
  return row ?? null;
}

function firstLink(text: string | null, contains: string): string {
  const link = (text?.match(/https?:\/\/[^\s<>"')]+/g) ?? []).find((candidate) => candidate.includes(contains));
  if (!link) throw new Error(`no link containing ${contains}`);
  return link;
}

const cookieFrom = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

const signIn = (email: string, password = PASSWORD) =>
  auth.api.signInEmail({ body: { email, password }, asResponse: true }) as Promise<Response>;

describe("authentication flows (dev outbox mode)", () => {
  beforeEach(async () => {
    await resetDatabase();
    actAs(null);
  });

  it("runs with verification required and emails captured in the outbox", () => {
    expect(features.emailConfigured).toBe(false);
    expect(features.devTools).toBe(true);
    expect(features.requireEmailVerification).toBe(true);
  });

  it("sign-up requires email verification; the outbox link verifies and signs in", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { email: "new@example.com", name: "New User", password: PASSWORD, callbackURL: "/app" },
      returnHeaders: true,
    });
    // The sign-up binding cookie: the link below completes directly only in this browser (F-01).
    const browser = signUp.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(await db.select().from(sessions)).toHaveLength(0);

    const email = await latestEmail("new@example.com", "verify-email");
    // Signing in before verifying is refused (and triggers a fresh verification e-mail).
    expect((await signIn("new@example.com")).status).toBe(403);
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, "new@example.com"))).toHaveLength(2);
    expect(email?.status).toBe("outbox");
    expect(email?.subject).toContain("Verify your email");
    const link = firstLink(email!.text, "/api/auth/verify-email");
    expect(link.startsWith("http://localhost:3000/api/auth/verify-email?token=")).toBe(true);

    const response = await auth.handler(new Request(link, { headers: { cookie: browser } }));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app");
    expect(cookieFrom(response)).toContain("better-auth.session_token=");

    const [user] = await db.select().from(users).where(eq(users.email, "new@example.com"));
    expect(user?.emailVerified).toBe(true);
    expect((await signIn("new@example.com")).status).toBe(200);
    expect((await signIn("new@example.com", "wrong-password")).status).toBe(401);
    const names = (await db.select().from(events)).map((row) => row.name);
    expect(names).toEqual(expect.arrayContaining(["user.signed_up", "user.email_verified", "user.signed_in", "workspace.created"]));
  });

  it("does not reveal whether an email is already registered at sign-up", async () => {
    await createTestUser({ email: "taken@example.com" });
    const usersBefore = (await db.select().from(users)).length;
    const response = (await auth.api.signUpEmail({
      body: { email: "taken@example.com", name: "Impostor", password: "another-password-1" },
      asResponse: true,
    })) as Response;
    expect(response.status).toBe(200);
    expect((await db.select().from(users)).length).toBe(usersBefore);
    // The original password still works; the impostor's does not.
    expect((await signIn("taken@example.com")).status).toBe(200);
    expect((await signIn("taken@example.com", "another-password-1")).status).toBe(401);
  });

  it("password reset: link from the outbox sets a new password and revokes sessions", async () => {
    const user = await createTestUser({ email: "reset@example.com" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(1);

    await auth.api.requestPasswordReset({ body: { email: "reset@example.com", redirectTo: "/reset-password" } });
    const email = await latestEmail("reset@example.com", "reset-password");
    const link = firstLink(email!.text, "/api/auth/reset-password/");
    const redirect = await auth.handler(new Request(link));
    expect(redirect.status).toBe(302);
    const target = new URL(redirect.headers.get("location")!, "http://localhost:3000");
    expect(target.pathname).toBe("/reset-password");
    const token = target.searchParams.get("token");
    expect(token).toBeTruthy();

    await auth.api.resetPassword({ body: { newPassword: "a-brand-new-password", token: token! } });
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    expect((await signIn("reset@example.com")).status).toBe(401);
    expect((await signIn("reset@example.com", "a-brand-new-password")).status).toBe(200);
    // The token is single-use.
    await expect(auth.api.resetPassword({ body: { newPassword: "yet-another-password", token: token! } })).rejects.toBeTruthy();
  });

  it("password reset for an unknown address sends nothing and does not error", async () => {
    await auth.api.requestPasswordReset({ body: { email: "ghost@example.com", redirectTo: "/reset-password" } });
    expect(await latestEmail("ghost@example.com", "reset-password")).toBeNull();
  });

  it("sign-out invalidates the session", async () => {
    const user = await createTestUser();
    actAs(user);
    await expect(requireOrg()).resolves.toBeTruthy();
    await auth.api.signOut({ headers: headersFor(user) });
    await expect(requireOrg()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("workspaces and invitations", () => {
  let owner: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    owner = await createTestUser({ email: "owner@example.com", name: "Olivia Owner" });
    actAs(owner);
  });

  /** Puts the owner's workspace on a paid plan. Free has a single seat, so inviting needs one. */
  const subscribe = (planKey: "starter" | "pro" | "business") =>
    db.insert(subscriptions).values({ organizationId: owner.organizationId, status: "active", planKey, paddleSubscriptionId: `sub_${planKey}` });

  it("invitation by email: invitee signs up, accepts and lands in the workspace", async () => {
    await subscribe("starter"); // Radar Pro: 2 seats
    const invited = await inviteMemberAction({ email: "Invitee@Example.com", role: "member" });
    expect(invited.ok).toBe(true);
    const email = await latestEmail("invitee@example.com", "invitation");
    expect(email?.subject).toContain("Olivia Owner invited you to Olivia's workspace");
    const link = firstLink(email!.text, "/accept-invitation/");
    const invitationId = link.split("/accept-invitation/")[1]!;
    expect(invited.ok && invited.data.invitationId).toBe(invitationId);

    const invitee = await createTestUser({ email: "invitee@example.com", name: "Ivy Invitee" });
    actAs(invitee);
    expect((await requireOrg()).organization.id).toBe(invitee.organizationId); // personal workspace first
    expect(await acceptInvitationAction(invitationId)).toEqual({ ok: true, data: undefined });

    const ctx = await requireOrg();
    expect(ctx.organization.id).toBe(owner.organizationId);
    expect(ctx.role).toBe("member");
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, invitationId));
    expect(invitation?.status).toBe("accepted");
    const actions = (await db.select().from(auditLog).where(eq(auditLog.organizationId, owner.organizationId))).map((row) => `${row.action}:${row.actorId}`);
    expect(actions).toEqual(expect.arrayContaining([`member.invited:${owner.id}`, `member.invitation_accepted:${invitee.id}`]));

    // The invitee keeps their personal workspace and can switch back to it.
    expect(await switchWorkspaceAction({ organizationId: invitee.organizationId })).toMatchObject({ ok: true });
    expect((await requireOrg()).organization.id).toBe(invitee.organizationId);
  });

  it("an invitation can only be accepted by the invited address", async () => {
    await subscribe("starter"); // Radar Pro: 2 seats
    const invited = await inviteMemberAction({ email: "invitee@example.com", role: "member" });
    expect(invited.ok).toBe(true);
    const invitationId = invited.ok ? invited.data.invitationId : "";
    const stranger = await createTestUser({ email: "stranger@example.com" });
    actAs(stranger);
    expect(await acceptInvitationAction(invitationId)).toMatchObject({ ok: false });
    expect(await db.select().from(members).where(eq(members.organizationId, owner.organizationId))).toHaveLength(1);
  });

  it("enforces the plan's seat limit, counting pending invitations", async () => {
    // Free plan: 1 seat, and the owner has it.
    const onFree = await inviteMemberAction({ email: "zero@example.com", role: "member" });
    expect(onFree).toMatchObject({ ok: false, error: { code: "SEAT_LIMIT_REACHED", details: { limit: 1 } } });
    expect(await db.select().from(invitations)).toHaveLength(0);

    // Radar Pro (plan key "starter"): 2 seats. Owner + 1 pending invitation uses both.
    await subscribe("starter");
    actAs(owner);
    expect((await inviteMemberAction({ email: "one@example.com", role: "member" })).ok).toBe(true);
    const blocked = await inviteMemberAction({ email: "two@example.com", role: "member" });
    expect(blocked).toMatchObject({ ok: false, error: { code: "SEAT_LIMIT_REACHED", details: { limit: 2 } } });
    expect(await db.select().from(invitations)).toHaveLength(1);

    // Cancelling the pending invitation frees the seat.
    const [pending] = await db.select().from(invitations);
    expect(await cancelInvitationAction(pending!.id)).toMatchObject({ ok: true });
    expect((await inviteMemberAction({ email: "two@example.com", role: "member" })).ok).toBe(true);

    // Upgrading raises the limit (Bid Desk, plan key "pro": 3 seats).
    await db.update(subscriptions).set({ planKey: "pro" }).where(eq(subscriptions.organizationId, owner.organizationId));
    actAs(owner);
    expect((await inviteMemberAction({ email: "three@example.com", role: "admin" })).ok).toBe(true);
  });

  it("refuses to add a member beyond the seat limit even with a valid invitation (after a downgrade)", async () => {
    await subscribe("pro"); // Bid Desk: 3 seats
    const first = await inviteMemberAction({ email: "first@example.com", role: "member" });
    const second = await inviteMemberAction({ email: "second@example.com", role: "member" });
    expect(first.ok && second.ok).toBe(true);

    const firstUser = await createTestUser({ email: "first@example.com" });
    actAs(firstUser);
    expect(await acceptInvitationAction(first.ok ? first.data.invitationId : "")).toMatchObject({ ok: true });

    // Downgrade to Radar Pro: 2 seats, which are now taken by the owner and the first member.
    await db.update(subscriptions).set({ planKey: "starter" }).where(eq(subscriptions.organizationId, owner.organizationId));
    const secondUser = await createTestUser({ email: "second@example.com" });
    actAs(secondUser);
    expect(await acceptInvitationAction(second.ok ? second.data.invitationId : "")).toMatchObject({ ok: false, error: { code: "SEAT_LIMIT_REACHED" } });
    expect(await db.select().from(members).where(eq(members.organizationId, owner.organizationId))).toHaveLength(2);
  });

  it("validates invitation input on the server", async () => {
    expect(await inviteMemberAction({ email: "not-an-email", role: "member" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", details: { fieldErrors: { email: expect.any(Array) } } },
    });
    expect(await inviteMemberAction({ email: "a@example.com", role: "owner" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await db.select().from(invitations)).toHaveLength(0);
  });

  it("creates an additional workspace owned by the user and switches to it", async () => {
    const result = await createWorkspaceAction({ name: "Second Co" });
    expect(result.ok).toBe(true);
    const ctx = await requireOrg();
    expect(ctx.organization.name).toBe("Second Co");
    expect(ctx.role).toBe("owner");
    expect(ctx.organization.isPersonal).toBe(false);
    expect(ctx.entitlements.planKey).toBe("free");
    expect(await db.select().from(organizations)).toHaveLength(2);
    expect(await createWorkspaceAction({ name: "x" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });
});
