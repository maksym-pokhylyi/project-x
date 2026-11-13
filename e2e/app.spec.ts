import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * One serial journey through the critical paths, against a production build:
 *
 *   public pages → sign up → verify e-mail (dev outbox) → app with auto-created workspace
 *   → rename workspace → (workspace moves to a two-seat plan) → invite a member
 *   → invitee accepts in a second browser
 *   → member is locked out of owner/admin surfaces → sign out / sign in → data persisted
 *   → password reset → founder admin.
 */
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const owner = { name: "Olivia Owner", email: `olivia-${run}@e2e.test`, password: "owner-password-123" };
const invitee = { name: "Ivan Invitee", email: `ivan-${run}@e2e.test`, password: "invitee-password-123" };
const founder = { name: "Fay Founder", email: "founder@e2e.test", password: "founder-password-123" };
const WORKSPACE = `Acme Bids ${run}`;

let ownerContext: BrowserContext;
let ownerPage: Page;
let memberContext: BrowserContext;
let memberPage: Page;

/** The plan badge is in the account menu (opened from the avatar in the top bar). */
async function expectPlanBadge(page: Page, plan: string) {
  await page.getByTestId("user-menu").first().click();
  await expect(page.getByTestId("plan-badge")).toHaveText(plan);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("plan-badge")).toHaveCount(0);
}

async function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext();
}

/**
 * Gives a workspace an active subscription the way a Paddle webhook would: a row in
 * `subscriptions`. The Free plan has a single seat, so the invitation journey needs a paid
 * plan, and there is no Paddle in e2e to buy one with.
 */
async function subscribeWorkspace(workspaceName: string, planKey: "starter" | "pro" | "business") {
  const sql = postgres(process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/app_e2e", { prepare: false, max: 1, onnotice: () => {} });
  try {
    const rows = await sql`
      insert into subscriptions (organization_id, status, plan_key, paddle_subscription_id)
      select id, 'active', ${planKey}, ${`sub_e2e_${planKey}`} from organizations where name = ${workspaceName}
      returning id`;
    expect(rows, `workspace "${workspaceName}" not found`).toHaveLength(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Opens the dev outbox and follows the first link of the newest e-mail for `to`. */
async function followOutboxLink(page: Page, to: string, template: string) {
  await page.goto("/dev/outbox");
  const email = page.locator(`[data-testid="outbox-email"][data-to="${to}"][data-template="${template}"]`).first();
  await expect(email).toBeVisible();
  await email.getByTestId("outbox-link").first().click();
}

async function fillSignUp(page: Page, user: { name: string; email: string; password: string }) {
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Work e-mail").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.beforeAll(async ({ browser }) => {
  ownerContext = await newContext(browser);
  ownerPage = await ownerContext.newPage();
  memberContext = await newContext(browser);
  memberPage = await memberContext.newPage();
});

test.afterAll(async () => {
  await ownerContext?.close();
  await memberContext?.close();
});

test("public pages render with security headers and a healthy backend", async ({ page, request }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("https://cdn.paddle.com");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toBeVisible();

  for (const path of ["/legal/terms", "/legal/privacy", "/legal/refunds", "/legal/dpa", "/contact"]) {
    const legal = await page.goto(path);
    expect(legal?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", database: "ok" });
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/pricing");
  expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png");
});

test("pricing page renders the plan catalogue with a monthly/annual toggle", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible();
  for (const plan of ["free", "starter", "pro", "business"]) await expect(page.getByTestId(`plan-${plan}`)).toBeVisible();

  // Radar Pro (plan key "starter"): £29 a month, £290 a year (two months free).
  await expect(page.getByTestId("plan-starter")).toContainText("Radar Pro");
  await expect(page.getByTestId("price-starter")).toHaveText("£29");
  await expect(page.getByTestId("plan-starter")).toContainText("Billed monthly");
  await page.getByTestId("interval-year").click();
  await expect(page.getByTestId("interval-year")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("price-starter")).toHaveText("£290");
  await expect(page.getByTestId("plan-starter")).toContainText("Two months free. Works out at £24.17 a month.");
  await expect(page.getByTestId("price-free")).toHaveText("£0");
  await page.getByTestId("interval-month").click();
  await expect(page.getByTestId("price-pro")).toHaveText("£149");
  // The one-off Bid Pass sits next to the plans.
  await expect(page.getByTestId("price-bid-pass")).toHaveText("£99");

  // Paid plans lead to sign-up with the plan carried along.
  await expect(page.getByTestId("plan-pro").getByRole("link")).toHaveAttribute("href", "/sign-up?plan=pro&interval=month");
});

test("signed-out visitors are redirected to sign-in from /app and /admin", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fapp$/);
  await expect(page.getByRole("heading", { name: /Sign in to/ })).toBeVisible();
  await page.goto("/app/settings/billing");
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fapp%2Fsettings%2Fbilling$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fadmin$/);

  // A forged session cookie gets past the optimistic proxy check but not the real one.
  await page.context().addCookies([{ name: "better-auth.session_token", value: "forged.value", url: page.url() }]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("sign up, verify e-mail through the dev outbox, land in an auto-created workspace", async () => {
  const page = ownerPage;
  await page.goto("/sign-up");

  // Client-side validation
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Enter a valid e-mail address.")).toBeVisible();

  await fillSignUp(page, owner);
  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.getByTestId("dev-outbox-hint")).toBeVisible();

  // Not verified yet: the app is not reachable.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);

  await followOutboxLink(page, owner.email, "verify-email");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome, Olivia" })).toBeVisible();
  await expect(page.getByTestId("current-workspace-name").first()).toHaveText("Olivia's workspace");
  await expectPlanBadge(page, "Free");
  await expect(page.getByTestId("onboarding-checklist")).toContainText("0 of 3 steps completed");
});

test("rename the workspace", async () => {
  const page = ownerPage;
  await page.goto("/app/settings/workspace");
  const name = page.getByLabel("Workspace name");
  await expect(name).toHaveValue("Olivia's workspace");

  await name.fill("x");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Use at least 2 characters.")).toBeVisible();

  await name.fill(WORKSPACE);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Workspace updated.")).toBeVisible();
  await expect(page.getByTestId("current-workspace-name").first()).toHaveText(WORKSPACE);

  await page.goto("/app");
  await expect(page.getByTestId("onboarding-checklist")).toContainText("1 of 3 steps completed");
});

test("upload a workspace logo through the storage abstraction", async () => {
  const page = ownerPage;
  await page.goto("/app/settings/workspace");
  // 1x1 transparent PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await page.locator("#workspace-logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Logo updated.")).toBeVisible();
  const logo = page.getByTestId("workspace-switcher").locator("img");
  await expect(logo).toHaveAttribute("src", /^\/api\/files\/org\/.+\/logo\/.+\.png$/);
  const src = await logo.getAttribute("src");
  expect((await page.request.get(src!)).status()).toBe(200);

  // The file is private: an anonymous client cannot fetch it.
  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get(src!)).status()).toBe(401);
  await anonymous.close();
});

test("the Free plan has a single seat; Radar Pro has two", async () => {
  const page = ownerPage;
  await page.goto("/app/settings/members");
  await expect(page.getByTestId("seat-usage")).toContainText("1 of 1 seats in use on the Free plan");
  await expect(page.getByRole("button", { name: "Send invitation" })).toBeDisabled();

  await subscribeWorkspace(WORKSPACE, "starter");
  await page.reload();
  await expectPlanBadge(page, "Radar Pro");
  await expect(page.getByTestId("seat-usage")).toContainText("1 of 2 seats in use on the Radar Pro plan");
});

test("invite a member by e-mail", async () => {
  const page = ownerPage;
  await page.goto("/app/settings/members");
  await expect(page.getByTestId("seat-usage")).toContainText("1 of 2 seats in use");
  await expect(page.getByTestId("member-row")).toHaveCount(1);

  await page.getByLabel("E-mail address").fill("not-an-email");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Enter a valid e-mail address.")).toBeVisible();

  await page.getByLabel("E-mail address").fill(invitee.email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(`Invitation sent to ${invitee.email}.`)).toBeVisible();
  await expect(page.getByTestId("invitations-list")).toContainText(invitee.email);
  // Radar Pro has 2 seats: owner + pending invitation uses both.
  await expect(page.getByTestId("seat-usage")).toContainText("2 of 2 seats in use");
  await expect(page.getByRole("button", { name: "Send invitation" })).toBeDisabled();
});

test("the invitee accepts from a second browser via the outbox link", async () => {
  const page = memberPage;
  await followOutboxLink(page, invitee.email, "invitation");
  await expect(page).toHaveURL(/\/accept-invitation\//);
  const invitationUrl = page.url();
  await expect(page.getByRole("heading", { name: `Join ${WORKSPACE}` })).toBeVisible();

  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/sign-up\?/);
  await expect(page.getByLabel("Work e-mail")).toHaveValue(invitee.email);
  await fillSignUp(page, invitee);
  await expect(page).toHaveURL(/\/verify-email/);

  // Verifying returns the invitee to the invitation, now signed in.
  await followOutboxLink(page, invitee.email, "verify-email");
  await expect(page).toHaveURL(invitationUrl);
  await page.getByRole("button", { name: `Join ${WORKSPACE}` }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("current-workspace-name").first()).toHaveText(WORKSPACE);

  // The invitation cannot be used twice.
  await page.goto(invitationUrl);
  await expect(page.getByRole("heading", { name: "This invitation is no longer valid" })).toBeVisible();
});

test("a member cannot reach billing or other owner/admin-only actions", async () => {
  const page = memberPage;
  await page.goto("/app");
  await expect(page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Billing" })).toHaveCount(0);

  const billing = await page.goto("/app/settings/billing");
  expect(billing?.status()).toBe(403);
  await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
  const success = await page.goto("/app/settings/billing/success");
  expect(success?.status()).toBe(403);

  await page.goto("/app/settings/members");
  await expect(page.getByTestId("member-row")).toHaveCount(2);
  await expect(page.getByText("Only owners and admins can invite members.")).toBeVisible();
  await expect(page.getByTestId("invite-form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(page.getByTestId("invitations-list")).toHaveCount(0);

  await page.goto("/app/settings/workspace");
  await expect(page.getByLabel("Workspace name")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);

  // Server-side enforcement, independent of the UI.
  const upload = await page.request.post("/api/workspace/logo", {
    multipart: { file: { name: "logo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) } },
  });
  expect(upload.status()).toBe(403);
  const invite = await page.request.post("/api/auth/organization/invite-member", {
    data: { email: "sneaky@e2e.test", role: "admin" },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(invite.status()).toBeGreaterThanOrEqual(400);

  // Members can see usage.
  await page.goto("/app/usage");
  await expect(page.getByTestId("usage-panel")).toContainText("Seats");
});

test("the owner sees the new member and the billing page without Paddle configured", async () => {
  const page = ownerPage;
  await page.goto("/app/settings/members");
  await expect(page.getByTestId("member-row")).toHaveCount(2);
  await expect(page.getByTestId("members-list")).toContainText(invitee.name);
  await expect(page.getByTestId("seat-usage")).toContainText("2 of 2 seats in use");

  const billing = await page.goto("/app/settings/billing");
  expect(billing?.status()).toBe(200);
  await expect(page.getByTestId("current-plan")).toContainText("Radar Pro plan");
  await expect(page.getByTestId("usage-panel")).toContainText("2 of 2");
  // No Paddle env in e2e: checkout is clearly disabled instead of crashing.
  await expect(page.getByTestId("billing-not-configured")).toHaveCount(3);
  await expect(page.getByTestId("billing-not-configured").first()).toContainText("Billing not configured");

  const status = await page.request.get("/api/billing/status");
  expect(await status.json()).toMatchObject({ planKey: "starter", isPaid: true });
});

test("sign out and back in: workspace, members and settings persisted", async () => {
  const page = ownerPage;
  await page.goto("/app");
  await page.getByTestId("user-menu").first().click();
  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fapp$/);

  await page.getByLabel("E-mail").fill(owner.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Wrong e-mail or password.")).toBeVisible();

  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("current-workspace-name").first()).toHaveText(WORKSPACE);
  await expect(page.getByTestId("workspace-switcher").locator("img")).toBeVisible();
  await page.goto("/app/settings/members");
  await expect(page.getByTestId("member-row")).toHaveCount(2);
  await page.goto("/app");
  await expect(page.getByTestId("onboarding-checklist")).toContainText("2 of 3 steps completed");
});

test("/admin is forbidden for non-admins", async () => {
  const response = await ownerPage.goto("/admin");
  expect(response?.status()).toBe(403);
  await expect(ownerPage.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
  const organizations = await ownerPage.goto("/admin/organizations");
  expect(organizations?.status()).toBe(403);
  expect((await memberPage.goto("/admin"))?.status()).toBe(403);
});

test("password reset through the outbox link", async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail").fill(invitee.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("we have sent a link to reset the password")).toBeVisible();

  await followOutboxLink(page, invitee.email, "reset-password");
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  const newPassword = "a-brand-new-password-456";
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  // The old session (second browser) was revoked by the reset.
  await memberPage.goto("/app");
  await expect(memberPage).toHaveURL(/\/sign-in/);

  await signIn(page, { email: invitee.email, password: invitee.password });
  await expect(page.getByText("Wrong e-mail or password.")).toBeVisible();
  await signIn(page, { email: invitee.email, password: newPassword });
  await expect(page).toHaveURL(/\/app$/);
  await context.close();
});

test("the founder (ADMIN_EMAILS) can open /admin and drill into a workspace", async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  await page.goto("/sign-up?redirect=/admin");
  await fillSignUp(page, founder);
  await expect(page).toHaveURL(/\/verify-email/);
  await followOutboxLink(page, founder.email, "verify-email");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByTestId("admin-stat").first()).toContainText("Sign-ups");
  await expect(page.getByTestId("admin-stat").first()).toContainText("3");
  await expect(page.getByText("member.invited").first()).toBeVisible();

  await page.goto(`/admin/organizations?q=${encodeURIComponent(WORKSPACE)}`);
  await page.getByRole("link", { name: WORKSPACE }).click();
  await expect(page.getByRole("heading", { level: 1, name: WORKSPACE })).toBeVisible();
  await expect(page.getByText(owner.email)).toBeVisible();
  await expect(page.getByText(invitee.email)).toBeVisible();
  await context.close();
});

test("layout holds at 360px without horizontal scrolling", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, storageState: await ownerContext.storageState() });
  const page = await context.newPage();
  for (const path of ["/", "/pricing", "/legal/terms", "/sign-in", "/app", "/app/settings/members", "/app/settings/billing", "/app/usage"]) {
    await page.goto(path);
    await expect(page.locator("#main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
  await context.close();
});

test("operational endpoints: dev outbox is enabled only by DEV_TOOLS, cron requires its secret", async ({ request }) => {
  // This run sets DEV_TOOLS=1, so the outbox exists (tests/env.test.ts covers the cases where it must not).
  expect((await request.get("/dev/outbox")).status()).toBe(200);
  expect((await request.get("/api/cron/jobs")).status()).toBe(401);
  expect((await request.get("/api/cron/jobs", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  expect((await request.get("/api/cron/jobs", { headers: { authorization: "Bearer e2e-cron-secret-0123456789" } })).status()).toBe(200);
});
