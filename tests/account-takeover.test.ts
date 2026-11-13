import { and, asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { accounts, emailOutbox, sessions, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { SIGNUP_BINDING_COOKIE } from "@/lib/signup-binding";
import { confirmEmailAction } from "@/server/actions/auth";
import { isAdminUser } from "@/server/session";
import { actAs, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

/**
 * F-01 — pre-registration account takeover.
 *
 * Requirement: whoever controls the mailbox ends up controlling the account, and a
 * password chosen by anyone else never survives verification — in either order of events.
 */
const ORIGIN = "http://localhost:3000";
const VICTIM = "bids@supplier.example";
const ATTACKER_PASSWORD = "attacker-knows-this-1";
const VICTIM_PASSWORD = "victim-chose-this-2";
const NEW_PASSWORD = "set-after-confirming-3";

const cookieFrom = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

async function signUp(email: string, password: string, name = "Someone") {
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password, name, callbackURL: "/app" }),
    }),
  );
  return { response, cookie: cookieFrom(response), setCookies: response.headers.getSetCookie() };
}

const signInStatus = async (email: string, password: string) =>
  ((await auth.api.signInEmail({ body: { email, password }, asResponse: true })) as Response).status;

async function verificationLinks(to: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.toEmail, to), eq(emailOutbox.template, "verify-email")))
    .orderBy(asc(emailOutbox.createdAt));
  return rows.map((row) => {
    const link = (row.text?.match(/https?:\/\/[^\s<>"')]+/g) ?? []).find((candidate) => candidate.includes("/api/auth/verify-email"));
    if (!link) throw new Error("verification e-mail without a link");
    return link;
  });
}

const openLink = (link: string, cookie?: string) => auth.handler(new Request(link, { headers: cookie ? { cookie } : {} }));
const userByEmail = async (email: string) => (await db.select().from(users).where(eq(users.email, email)))[0]!;
const passwordHashOf = async (userId: string) =>
  (await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))))[0]?.password ?? null;

/** Follows a no-binding verification link to the confirm page and returns the token it carries. */
async function tokenFromConfirmRedirect(response: Response): Promise<string> {
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location")!);
  expect(location.origin).toBe(ORIGIN);
  expect(location.pathname).toBe("/verify-email/confirm");
  return location.searchParams.get("token")!;
}

describe("F-01 pre-registration account takeover", () => {
  beforeEach(async () => {
    await resetDatabase();
    actAs(null);
  });

  describe("attacker registers the victim's address first", () => {
    it("the victim who later signs up and verifies ends up with their own password; the attacker's never works", async () => {
      const attacker = await signUp(VICTIM, ATTACKER_PASSWORD, "Bid Manager");
      expect(attacker.response.status).toBe(200);
      const account = await userByEmail(VICTIM);
      const attackerHash = await passwordHashOf(account.id);

      // The real owner signs up through the normal form. Nothing about the account changes…
      const victim = await signUp(VICTIM, VICTIM_PASSWORD, "Real Owner");
      expect(victim.response.status).toBe(200);
      expect(await db.select().from(users)).toHaveLength(1);
      expect(await passwordHashOf(account.id)).toBe(attackerHash);
      expect((await userByEmail(VICTIM)).name).toBe("Bid Manager");
      // …but the mailbox receives a fresh link, so it is not a dead end.
      const links = await verificationLinks(VICTIM);
      expect(links).toHaveLength(2);

      // Opening it in the victim's browser must NOT activate the attacker's password.
      const opened = await openLink(links[1]!, victim.cookie);
      const token = await tokenFromConfirmRedirect(opened);
      expect(cookieFrom(opened)).not.toContain("session_token");
      expect((await userByEmail(VICTIM)).emailVerified).toBe(false);
      expect(await db.select().from(sessions)).toHaveLength(0);

      // The mailbox owner chooses the password; that is what verifies the account.
      const confirmed = await confirmEmailAction({ token, password: NEW_PASSWORD, redirect: "/app" });
      expect(confirmed).toEqual({ ok: true, data: { redirectTo: "/app", signedIn: true } });
      expect((await userByEmail(VICTIM)).emailVerified).toBe(true);
      expect(await passwordHashOf(account.id)).not.toBe(attackerHash);

      expect(await signInStatus(VICTIM, ATTACKER_PASSWORD)).toBe(401);
      expect(await signInStatus(VICTIM, VICTIM_PASSWORD)).toBe(401); // discarded with the second sign-up
      expect(await signInStatus(VICTIM, NEW_PASSWORD)).toBe(200);
    });

    it("the victim who only clicks the unsolicited verification e-mail does not activate the attacker's password", async () => {
      await signUp(VICTIM, ATTACKER_PASSWORD);
      const [link] = await verificationLinks(VICTIM);

      const opened = await openLink(link!); // victim's browser: no binding cookie at all
      const token = await tokenFromConfirmRedirect(opened);
      // A link scanner or mail preview fetching the URL changes nothing either.
      await openLink(link!);
      expect((await userByEmail(VICTIM)).emailVerified).toBe(false);
      // Until the mailbox owner acts, the attacker still cannot sign in (unverified).
      expect(await signInStatus(VICTIM, ATTACKER_PASSWORD)).toBe(403);
      expect(await db.select().from(sessions)).toHaveLength(0);

      expect((await confirmEmailAction({ token, password: NEW_PASSWORD })).ok).toBe(true);
      expect(await signInStatus(VICTIM, ATTACKER_PASSWORD)).toBe(401);
      expect(await signInStatus(VICTIM, NEW_PASSWORD)).toBe(200);
    });

    it("revokes sessions that existed before the mailbox owner confirmed", async () => {
      await signUp(VICTIM, ATTACKER_PASSWORD);
      const account = await userByEmail(VICTIM);
      // e.g. a session issued while verification was not enforced (ALLOW_UNVERIFIED_SIGNUP).
      const now = new Date();
      await db.insert(sessions).values({ id: "sess_attacker", token: "attacker-session-token", userId: account.id, expiresAt: new Date(now.getTime() + 86_400_000), createdAt: now, updatedAt: now });
      const [link] = await verificationLinks(VICTIM);
      const token = await tokenFromConfirmRedirect(await openLink(link!));

      expect((await confirmEmailAction({ token, password: NEW_PASSWORD })).ok).toBe(true);
      const remaining = await db.select().from(sessions).where(eq(sessions.userId, account.id));
      expect(remaining.map((row) => row.id)).not.toContain("sess_attacker");
      expect(remaining).toHaveLength(1); // the mailbox owner's fresh session
    });

    it("does not hand out /admin: the founder's address registered by someone else never becomes a usable admin account", async () => {
      const FOUNDER = "founder@example.com"; // ADMIN_EMAILS in the test environment
      await signUp(FOUNDER, ATTACKER_PASSWORD, "Founder");
      const account = await userByEmail(FOUNDER);
      expect(isAdminUser(account)).toBe(false); // unverified: never an admin
      expect(await signInStatus(FOUNDER, ATTACKER_PASSWORD)).toBe(403);

      // The founder follows README step "sign up with an ADMIN_EMAILS address".
      const founder = await signUp(FOUNDER, VICTIM_PASSWORD, "Founder");
      const links = await verificationLinks(FOUNDER);
      const token = await tokenFromConfirmRedirect(await openLink(links.at(-1)!, founder.cookie));
      expect((await confirmEmailAction({ token, password: NEW_PASSWORD })).ok).toBe(true);

      expect(isAdminUser(await userByEmail(FOUNDER))).toBe(true);
      // The admin account is now the founder's alone.
      expect(await signInStatus(FOUNDER, ATTACKER_PASSWORD)).toBe(401);
      expect(await signInStatus(FOUNDER, NEW_PASSWORD)).toBe(200);
      expect(await db.select().from(sessions).where(eq(sessions.userId, account.id))).toHaveLength(2); // confirm + the sign-in above
    });
  });

  describe("victim registers first", () => {
    it("a later sign-up by an attacker changes nothing; the victim verifies in their own browser and keeps their password", async () => {
      const victim = await signUp(VICTIM, VICTIM_PASSWORD, "Real Owner");
      const account = await userByEmail(VICTIM);
      const victimHash = await passwordHashOf(account.id);

      const attacker = await signUp(VICTIM, ATTACKER_PASSWORD, "Impostor");
      expect(attacker.response.status).toBe(200);
      expect(await passwordHashOf(account.id)).toBe(victimHash);
      expect((await userByEmail(VICTIM)).name).toBe("Real Owner");

      const links = await verificationLinks(VICTIM);
      const opened = await openLink(links[0]!, victim.cookie);
      expect(opened.status).toBe(302);
      expect(opened.headers.get("location")).toBe("/app");
      expect(cookieFrom(opened)).toContain("better-auth.session_token=");
      expect((await userByEmail(VICTIM)).emailVerified).toBe(true);

      expect(await signInStatus(VICTIM, VICTIM_PASSWORD)).toBe(200);
      expect(await signInStatus(VICTIM, ATTACKER_PASSWORD)).toBe(401);
    });

    it("the attacker's cookie from the repeated sign-up is a decoy that verifies nothing", async () => {
      await signUp(VICTIM, VICTIM_PASSWORD);
      const attacker = await signUp(VICTIM, ATTACKER_PASSWORD);
      const links = await verificationLinks(VICTIM);
      // Even with a leaked link, the attacker's browser is not treated as the one that chose the password.
      const opened = await openLink(links[0]!, attacker.cookie);
      await tokenFromConfirmRedirect(opened);
      expect((await userByEmail(VICTIM)).emailVerified).toBe(false);
    });
  });

  it("the binding cookie is set on every sign-up response, so it does not reveal whether an address is registered", async () => {
    const first = await signUp(VICTIM, VICTIM_PASSWORD);
    const repeat = await signUp(VICTIM, ATTACKER_PASSWORD);
    const shape = new RegExp(`^${SIGNUP_BINDING_COOKIE}=v1\\.[A-Za-z0-9]{32}\\.\\d{10}\\.[A-Za-z0-9_-]{43}; Max-Age=90000; Path=/; HttpOnly; SameSite=Lax$`);
    for (const { setCookies } of [first, repeat]) {
      const binding = setCookies.filter((value) => value.startsWith(`${SIGNUP_BINDING_COOKIE}=`));
      expect(binding).toHaveLength(1);
      expect(binding[0]).toMatch(shape);
    }
  });

  it("a binding does not survive a password change", async () => {
    const victim = await signUp(VICTIM, VICTIM_PASSWORD);
    const account = await userByEmail(VICTIM);
    // Someone else's hash ends up on the account (should never happen; the binding must not vouch for it).
    await db.update(accounts).set({ password: "other-hash" }).where(eq(accounts.userId, account.id));
    const [link] = await verificationLinks(VICTIM);
    await tokenFromConfirmRedirect(await openLink(link!, victim.cookie));
    expect((await userByEmail(VICTIM)).emailVerified).toBe(false);
  });

  describe("confirming with a chosen password", () => {
    it("cannot be replayed once the account is verified", async () => {
      await signUp(VICTIM, ATTACKER_PASSWORD);
      const [link] = await verificationLinks(VICTIM);
      const token = await tokenFromConfirmRedirect(await openLink(link!));
      expect((await confirmEmailAction({ token, password: NEW_PASSWORD })).ok).toBe(true);

      const replay = await confirmEmailAction({ token, password: "someone-elses-password-9" });
      expect(replay).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(await signInStatus(VICTIM, "someone-elses-password-9")).toBe(401);
      expect(await signInStatus(VICTIM, NEW_PASSWORD)).toBe(200);
    });

    it("never touches an account that is already verified", async () => {
      const existing = await createTestUser({ email: "settled@example.com" });
      await signUp("fresh@example.com", VICTIM_PASSWORD);
      const [link] = await verificationLinks("fresh@example.com");
      const token = new URL(link!).searchParams.get("token")!;
      // A valid token for ANOTHER address is of no use against the verified account.
      expect((await confirmEmailAction({ token, password: NEW_PASSWORD })).ok).toBe(true);
      expect(await signInStatus(existing.email, "correct-horse-battery")).toBe(200);
      expect(await signInStatus(existing.email, NEW_PASSWORD)).toBe(401);
    });

    it("rejects forged, garbage and too-short input", async () => {
      await signUp(VICTIM, ATTACKER_PASSWORD);
      const [link] = await verificationLinks(VICTIM);
      const token = new URL(link!).searchParams.get("token")!;
      const forged = `${token.slice(0, token.lastIndexOf("."))}.${"A".repeat(43)}`;
      expect(await confirmEmailAction({ token: forged, password: NEW_PASSWORD })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
      expect(await confirmEmailAction({ token: "not-a-token-not-a-token-not-a-token", password: NEW_PASSWORD })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
      expect(await confirmEmailAction({ token, password: "short" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
      expect((await userByEmail(VICTIM)).emailVerified).toBe(false);
      expect(await signInStatus(VICTIM, ATTACKER_PASSWORD)).toBe(403);
    });
  });

  it("a completed password reset verifies the address (it proves the mailbox and replaces the password)", async () => {
    await signUp(VICTIM, ATTACKER_PASSWORD);
    await auth.api.requestPasswordReset({ body: { email: VICTIM, redirectTo: "/reset-password" } });
    const [row] = await db.select().from(emailOutbox).where(and(eq(emailOutbox.toEmail, VICTIM), eq(emailOutbox.template, "reset-password")));
    const link = (row!.text!.match(/https?:\/\/[^\s<>"')]+/g) ?? []).find((candidate) => candidate.includes("/api/auth/reset-password/"))!;
    const redirect = await auth.handler(new Request(link));
    const token = new URL(redirect.headers.get("location")!, ORIGIN).searchParams.get("token")!;
    await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } });

    expect((await userByEmail(VICTIM)).emailVerified).toBe(true);
    expect(await signInStatus(VICTIM, ATTACKER_PASSWORD)).toBe(401);
    expect(await signInStatus(VICTIM, NEW_PASSWORD)).toBe(200);
  });

  it("a repeated sign-up for a VERIFIED address only sends a no-token notice, at most three per hour", async () => {
    const existing = await createTestUser({ email: "settled@example.com" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await signUp(existing.email, ATTACKER_PASSWORD)).response.status).toBe(200);
    }
    const notices = await db.select().from(emailOutbox).where(and(eq(emailOutbox.toEmail, existing.email), eq(emailOutbox.template, "account-exists")));
    expect(notices).toHaveLength(3);
    expect(notices[0]!.text).not.toMatch(/token=/);
    expect(await verificationLinks(existing.email)).toHaveLength(1); // only the one from the original sign-up
    expect(await signInStatus(existing.email, "correct-horse-battery")).toBe(200);
    expect(await signInStatus(existing.email, ATTACKER_PASSWORD)).toBe(401);
  });
});

describe("ADMIN_USER_IDS pin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("requires the pinned user id in addition to a verified ADMIN_EMAILS address", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "usr_founder_1, usr_founder_2");
    vi.resetModules();
    const { adminUserIds } = await import("@/env");
    expect([...adminUserIds]).toEqual(["usr_founder_1", "usr_founder_2"]);
    const session = await import("@/server/session");
    const founder = { email: "Founder@Example.com", emailVerified: true };
    expect(session.isAdminUser({ ...founder, id: "usr_founder_1" })).toBe(true);
    expect(session.isAdminUser({ ...founder, id: "usr_somebody_else" })).toBe(false);
    expect(session.isAdminUser({ ...founder, id: "usr_founder_1", emailVerified: false })).toBe(false);
    expect(session.isAdminUser({ id: "usr_founder_1", email: "not-listed@example.com", emailVerified: true })).toBe(false);
  });
});
