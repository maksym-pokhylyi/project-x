import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { emailOutbox, invitations, sessions, subscriptions, users } from "@/db/schema";
import { createTestUser, headersFor } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

/**
 * F-04 / F-19 — a deployment that cannot deliver e-mail must not silently drop
 * verification. Each case loads the app fresh with a production environment.
 */
const ORIGIN = "http://localhost:3000";
const PRODUCTION = { NODE_ENV: "production", VERCEL_ENV: "production" };

async function loadApp(overrides: Record<string, string>) {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
  const [{ features }, { auth }, { getConfigWarnings }, { sendEmail }, { emailFrom }] = await Promise.all([
    import("@/env"),
    import("@/lib/auth"),
    import("@/lib/config-warnings"),
    import("@/lib/email/send"),
    import("@/lib/email/deliver"),
  ]);
  return { features, auth, getConfigWarnings, sendEmail, emailFrom };
}

type App = Awaited<ReturnType<typeof loadApp>>;

const post = (app: App, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  );

const signUp = (app: App, email: string) => post(app, "/sign-up/email", { email, name: "New User", password: "a-good-password-1" });

describe("email delivery and the security posture (F-04)", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("production without RESEND_API_KEY", () => {
    it("keeps verification required and disables sign-up with a clear message", async () => {
      const app = await loadApp(PRODUCTION);
      expect(app.features).toMatchObject({ requireEmailVerification: true, signUpEnabled: false, passwordResetEnabled: false, mailDelivery: "none", devTools: false });

      const response = await signUp(app, "someone-elses@address.example");
      expect(response.status).toBe(503);
      const body = (await response.json()) as { code: string; message: string };
      expect(body.code).toBe("SIGN_UP_DISABLED");
      expect(body.message).toMatch(/cannot send the email needed to confirm your address/);
      expect(await db.select().from(users)).toHaveLength(0);
      expect(await db.select().from(sessions)).toHaveLength(0);
    });

    it("disables password reset and verification emails instead of pretending to send them", async () => {
      const existing = await createTestUser({ email: "member@example.com" });
      const app = await loadApp(PRODUCTION);
      for (const [path, body] of [
        ["/request-password-reset", { email: existing.email, redirectTo: "/reset-password" }],
        ["/request-password-reset", { email: "nobody@example.com", redirectTo: "/reset-password" }],
        ["/send-verification-email", { email: existing.email }],
      ] as const) {
        const response = await post(app, path, body);
        expect(response.status, path).toBe(503);
        expect(((await response.json()) as { code: string }).code).toBe("EMAIL_DELIVERY_UNAVAILABLE");
      }
      expect(await db.select().from(emailOutbox).where(eq(emailOutbox.template, "reset-password"))).toHaveLength(0);
    });

    it("existing verified users can still sign in; invitations cannot be sent into the void", async () => {
      const owner = await createTestUser({ email: "owner@example.com" });
      // Radar Pro has a second seat: without it the invitation would stop at the seat limit of the Free plan, not at e-mail delivery.
      await db.insert(subscriptions).values({ organizationId: owner.organizationId, status: "active", planKey: "starter", paddleSubscriptionId: "sub_posture" });
      const app = await loadApp(PRODUCTION);
      expect((await post(app, "/sign-in/email", { email: owner.email, password: "correct-horse-battery" })).status).toBe(200);

      const invite = await post(app, "/organization/invite-member", { email: "invitee@example.com", role: "member", organizationId: owner.organizationId }, { cookie: headersFor(owner).get("cookie")! });
      expect(invite.status).toBe(503);
      expect(await db.select().from(invitations)).toHaveLength(0);
    });

    it("never stores an undeliverable message body, and says so loudly", async () => {
      const app = await loadApp({ ...PRODUCTION, LOG_LEVEL: "error" });
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((line: unknown) => void errors.push(String(line)));
      const id = await app.sendEmail("someone@example.com", { name: "reset-password", props: { name: "Jo", url: "https://app.example/reset?token=secret" } });
      const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
      expect(row).toMatchObject({ status: "failed", html: null, text: null, error: "no email provider configured" });
      expect(errors.join("\n")).toContain("NOT delivered");
      vi.restoreAllMocks();
    });

    it("is reported as an error-level configuration warning", async () => {
      const app = await loadApp(PRODUCTION);
      const warning = app.getConfigWarnings().find((entry) => entry.code === "EMAIL_NOT_CONFIGURED");
      expect(warning).toMatchObject({ level: "error" });
      expect(warning?.message).toContain("RESEND_API_KEY is not set");
    });
  });

  it("production with a key but no EMAIL_FROM is NOT configured: no fallback to the shared test sender (F-19)", async () => {
    const app = await loadApp({ ...PRODUCTION, RESEND_API_KEY: "re_live_key" });
    expect(app.features).toMatchObject({ emailConfigured: false, signUpEnabled: false, mailDelivery: "none" });
    expect(() => app.emailFrom()).toThrow(/EMAIL_FROM/);
    expect(app.getConfigWarnings().find((entry) => entry.code === "EMAIL_NOT_CONFIGURED")?.message).toContain("EMAIL_FROM is not set");
    expect((await signUp(app, "x@example.com")).status).toBe(503);
    // Outside production the test sender stays available for development.
    const dev = await loadApp({ RESEND_API_KEY: "re_test_key" });
    expect(dev.features.emailConfigured).toBe(true);
    expect(dev.emailFrom()).toContain("onboarding@resend.dev");
  });

  it("production with RESEND_API_KEY + EMAIL_FROM: sign-up works and requires verification", async () => {
    const app = await loadApp({ ...PRODUCTION, RESEND_API_KEY: "re_live_key", EMAIL_FROM: "Bidfolio <no-reply@bidfolio.co.uk>" });
    expect(app.features).toMatchObject({ emailConfigured: true, requireEmailVerification: true, signUpEnabled: true, passwordResetEnabled: true });
    expect(app.emailFrom()).toBe("Bidfolio <no-reply@bidfolio.co.uk>");
    expect(app.getConfigWarnings().some((entry) => entry.code.startsWith("EMAIL") || entry.code.startsWith("UNVERIFIED"))).toBe(false);
    const response = await signUp(app, "new@example.com");
    expect(response.status).toBe(200);
    expect(((await response.json()) as { token: string | null }).token).toBeNull(); // no session before verification
    expect(await db.select().from(sessions)).toHaveLength(0);
    const [queued] = await db.select().from(emailOutbox);
    expect(queued).toMatchObject({ toEmail: "new@example.com", template: "verify-email", status: "queued" });
  });

  describe("ALLOW_UNVERIFIED_SIGNUP=1 (explicit pre-launch escape hatch)", () => {
    it("allows sign-up without verification and is reported loudly", async () => {
      const app = await loadApp({ ...PRODUCTION, ALLOW_UNVERIFIED_SIGNUP: "1" });
      expect(app.features).toMatchObject({ requireEmailVerification: false, signUpEnabled: true, passwordResetEnabled: false, unverifiedSignupAllowed: true });
      const response = await signUp(app, "tester@example.com");
      expect(response.status).toBe(200);
      expect(((await response.json()) as { token: string | null }).token).toBeTruthy();
      const warning = app.getConfigWarnings().find((entry) => entry.code === "UNVERIFIED_SIGNUP_ALLOWED");
      expect(warning).toMatchObject({ level: "error" });
      expect(warning?.message).toContain("WITHOUT email verification");
    });

    it("logs the warning at start-up", async () => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((line: unknown) => void errors.push(String(line)));
      await loadApp({ ...PRODUCTION, ALLOW_UNVERIFIED_SIGNUP: "1", LOG_LEVEL: "error" });
      expect(errors.some((line) => line.includes("UNVERIFIED_SIGNUP_ALLOWED"))).toBe(true);
      vi.restoreAllMocks();
    });

    it("is ignored (and flagged) once email delivery works", async () => {
      const app = await loadApp({ ...PRODUCTION, ALLOW_UNVERIFIED_SIGNUP: "1", RESEND_API_KEY: "re_live_key", EMAIL_FROM: "no-reply@bidfolio.co.uk" });
      expect(app.features).toMatchObject({ requireEmailVerification: true, unverifiedSignupAllowed: false });
      expect(app.getConfigWarnings().map((entry) => entry.code)).toContain("UNVERIFIED_SIGNUP_IGNORED");
    });

    it("an unverified account still cannot accept an invitation", async () => {
      const owner = await createTestUser({ email: "owner@example.com" });
      await db.insert(invitations).values({ id: "inv_1", organizationId: owner.organizationId, email: "invited@example.com", role: "admin", status: "pending", expiresAt: new Date(Date.now() + 86_400_000), inviterId: owner.id });
      const app = await loadApp({ ...PRODUCTION, ALLOW_UNVERIFIED_SIGNUP: "1" });
      const signedUp = await signUp(app, "invited@example.com"); // anyone can register the invited address in this mode
      const cookie = signedUp.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
      const accepted = await post(app, "/organization/accept-invitation", { invitationId: "inv_1" }, { cookie });
      expect(accepted.status).toBe(403);
      expect((await db.select().from(invitations))[0]?.status).toBe("pending");
    });
  });

  it("a production BUILD outside Vercel behaves the same unless dev tools are switched on", async () => {
    expect((await loadApp({ NODE_ENV: "production" })).features).toMatchObject({ signUpEnabled: false, requireEmailVerification: true });
    expect((await loadApp({ NODE_ENV: "production", DEV_TOOLS: "1" })).features).toMatchObject({ signUpEnabled: true, requireEmailVerification: true, mailDelivery: "outbox", devToolsProtected: true });
    expect((await loadApp({})).features).toMatchObject({ signUpEnabled: true, mailDelivery: "outbox", devToolsProtected: false });
  });
});
