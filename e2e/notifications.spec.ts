import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { CRON_SECRET, DEV_TOOLS_SECRET, FIRST_MONDAY, LATER_TENDER, SECOND_MONDAY } from "./notifications.shared";

/**
 * Scheduled e-mails, end to end, on seeded data (e2e/notifications.global-setup.ts):
 *
 *   two people each claim Acme Grounds Ltd → the Monday tick → a digest for each in the dev
 *   outbox → a tender link opens the tender page and the server records `digest_clicked`
 *   → one of them unsubscribes, signed out and without JavaScript → the next Monday's tick
 *   sends that person nothing, and the other one their second digest.
 *
 * "Monday" is simulated: the cron tick takes `?now=` where dev tools are on.
 */
test.describe.configure({ mode: "serial" });
// Needs the seed and the server of playwright.notifications.config.ts: skipped under any other Playwright config.
test.skip(!process.env.NOTIFICATIONS_E2E, "run with: playwright test -c playwright.notifications.config.ts");

const run = Date.now().toString(36);
const alex = { name: "Alex Acme", email: `alex-${run}@e2e.test`, password: "acme-password-123" };
const bea = { name: "Bea Control", email: `bea-${run}@e2e.test`, password: "acme-password-456" };
const SUPPLIER = "/suppliers/acme-grounds-ltd-01111111";
const OUTBOX = `/dev/outbox?key=${DEV_TOOLS_SECRET}`;
const SHOTS = process.env.NOTIFICATIONS_SHOTS_DIR;

/** The journey looks at what the server stored (events, the log) directly in the e2e database. */
let client: ReturnType<typeof postgres> | null = null;
const sql = ((...args: Parameters<ReturnType<typeof postgres>>) => {
  client ??= postgres(process.env.E2E_DATABASE_URL ?? "", { prepare: false, max: 1, onnotice: () => {} });
  return client(...args);
}) as ReturnType<typeof postgres>;
test.afterAll(async () => {
  await client?.end({ timeout: 5 });
});

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/** Public supplier page → "Claim this page" → the account form on the claim page → verify (dev outbox) → confirm → Radar. */
async function signUpAndClaim(page: Page, user: typeof alex) {
  await page.goto(SUPPLIER);
  await page.getByTestId("claim-cta").click();
  await expect(page).toHaveURL(/\/claim\/acme-grounds-ltd-01111111$/);
  const account = page.getByTestId("claim-sign-up");
  await account.getByLabel("Your name").fill(user.name);
  await account.getByLabel("Work email").fill(user.email);
  await account.getByLabel("Password").fill(user.password);
  await account.getByTestId("claim-authorised").click();
  await account.getByRole("button", { name: "Create account and claim" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await page.goto(OUTBOX);
  const email = page.locator(`[data-testid="outbox-email"][data-to="${user.email}"][data-template="verify-email"]`).first();
  await expect(email).toBeVisible();
  await email.getByTestId("outbox-link").first().click();
  // Back on the claim page, signed in, with the tick remembered: one button.
  await expect(page).toHaveURL(/\/claim\/acme-grounds-ltd-01111111\?authorised=1$/);
  await page.getByTestId("claim-confirm").click();
  await expect(page).toHaveURL(/\/app\?claimed=1/);
  await expect(page.getByTestId("first-run")).toContainText("Acme Grounds Ltd");
}

/** The five-minute cron tick, as if it were `now`. */
async function tick(request: APIRequestContext, now: Date) {
  const response = await request.get(`/api/cron/jobs?now=${encodeURIComponent(now.toISOString())}`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(response.status()).toBe(200);
  expect((await response.json()).ok).toBe(true);
}

const digestsFor = (page: Page, to: string) => page.locator(`[data-testid="outbox-email"][data-to="${to}"][data-template="radar-digest"]`);

async function newPerson(browser: Browser, user: typeof alex): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUpAndClaim(page, user);
  return page;
}

let alexPage: Page;
let unsubscribeUrl = "";

test("two people claim their company; nothing is e-mailed before Monday", async ({ browser, request }) => {
  alexPage = await newPerson(browser, alex);
  const beaPage = await newPerson(browser, bea);
  await beaPage.context().close();

  // Settings → Notifications: everything on by default, sent to the address of the account.
  await alexPage.goto("/app/settings/notifications");
  await expect(alexPage.getByRole("heading", { level: 2, name: "Notifications" })).toBeVisible();
  await expect(alexPage.locator("main")).toContainText(alex.email);
  await expect(alexPage.getByTestId("notify-switch-weeklyDigest")).toHaveAttribute("aria-checked", "true");
  await expect(alexPage.getByTestId("notify-switch-deadlineReminders")).toHaveAttribute("aria-checked", "true");
  // Free plan: daily alerts are named, without a switch.
  await expect(alexPage.getByTestId("notify-switch-dailyAlerts")).toHaveCount(0);
  await expect(alexPage.locator("main")).toContainText("Part of the paid plans.");
  await shot(alexPage, "settings-notifications-1280");

  // The day before, the tick has no digest to start.
  await tick(request, new Date(FIRST_MONDAY.getTime() - 86_400_000));
  await alexPage.goto(OUTBOX);
  await expect(digestsFor(alexPage, alex.email)).toHaveCount(0);
});

test("Monday's tick puts one digest per person in the outbox, however often it ticks", async ({ request }) => {
  await tick(request, FIRST_MONDAY);
  await tick(request, new Date(FIRST_MONDAY.getTime() + 5 * 60_000));
  await tick(request, new Date(FIRST_MONDAY.getTime() + 10 * 60_000));

  await alexPage.goto(OUTBOX);
  for (const person of [alex, bea]) await expect(digestsFor(alexPage, person.email)).toHaveCount(1);
  const digest = digestsFor(alexPage, alex.email).first();
  // Free plan: the ten best of fourteen, and one plain line about the rest.
  await expect(digest.getByRole("heading")).toHaveText("10 new tenders for Acme Grounds");
  await digest.locator("summary").click();
  const body = digest.locator("pre");
  await expect(body).toContainText("Alex,");
  await expect(body).toContainText("New matches");
  await expect(body).toContainText("4 more matches are waiting on your radar.");
  await expect(body).toContainText("Open on Bidfolio: ");
  await expect(body).toContainText("Reply to this email if anything looks wrong.");
  await expect(body).toContainText("Contains public sector information licensed under the Open Government Licence v3.0.");
  await expect(body).not.toContainText(LATER_TENDER.title); // not known yet that Monday
  // Five tenders listed, each with one link carrying the e-mail's id; the others only counted.
  const tenderLinks = digest.locator('[data-testid="outbox-link"][href*="/tenders/"]');
  await expect(tenderLinks).toHaveCount(5);
  for (const link of await tenderLinks.all()) await expect(link).toHaveAttribute("href", /\/tenders\/ocds-h6vhtk-e\d{5}\?d=[0-9a-f-]{36}$/);
  await shot(alexPage, "outbox-digest-1280");

  const [log] = await sql<Array<{ status: string; period_key: string; item_count: number }>>`
    select l.status, l.period_key, l.item_count from notification_log l join users u on u.id = l.user_id where u.email = ${alex.email} and l.kind = 'digest'`;
  expect(log).toMatchObject({ status: "sent", item_count: 5 });
  unsubscribeUrl = (await digest.locator('[data-testid="outbox-link"][href*="/unsubscribe?t="]').getAttribute("href")) ?? "";
  expect(unsubscribeUrl).toMatch(/\/unsubscribe\?t=[\w-]+\.[\w-]{43}$/);
});

test("a link in the digest opens the tender page and the server records digest_clicked", async () => {
  await alexPage.goto(OUTBOX);
  const link = digestsFor(alexPage, alex.email).first().locator('[data-testid="outbox-link"][href*="/tenders/"]').first();
  const href = (await link.getAttribute("href"))!;
  const ocid = new URL(href).pathname.split("/").pop()!;
  await link.click();
  await expect(alexPage).toHaveURL(new RegExp(`/tenders/${ocid}\\?d=`));
  await expect(alexPage.getByRole("heading", { level: 1 })).toContainText("Grounds Maintenance");

  const clicks = () => sql<Array<{ properties: { kind: string; ocid: string }; email: string }>>`
    select e.properties, u.email from events e join users u on u.id = e.user_id where e.name = 'digest_clicked'`;
  await expect.poll(async () => (await clicks()).length).toBe(1);
  expect((await clicks())[0]).toEqual({ properties: { kind: "digest", ocid }, email: alex.email });
  // Reloading the page, or a crawler following the link, is not another click.
  await alexPage.reload();
  await alexPage.request.get(href, { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } });
  await alexPage.waitForTimeout(1500);
  expect(await clicks()).toHaveLength(1);
  // No pixel, no redirect: the page carries no tracking request of ours beyond itself.
  const [row] = await sql<Array<{ clicked: string[] }>>`select l.clicked from notification_log l join users u on u.id = l.user_id where u.email = ${alex.email} and l.kind = 'digest'`;
  expect(row!.clicked).toEqual([ocid]);
});

test("unsubscribe works signed out and without JavaScript; opening the link changes nothing", async ({ browser, request }) => {
  const prefs = () => sql<Array<{ weekly_digest: boolean; off: boolean }>>`
    select p.weekly_digest, p.unsubscribed_all_at is not null as off from notification_prefs p join users u on u.id = p.user_id where u.email = ${alex.email}`;
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  // A mail client's link scanner fetches the address in the List-Unsubscribe header: nothing happens.
  const oneClickUrl = unsubscribeUrl.replace("/unsubscribe?", "/api/notifications/unsubscribe?");
  expect((await request.get(oneClickUrl, { maxRedirects: 0 })).status()).toBe(303);
  await page.goto(unsubscribeUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Stop emails to this address?" })).toBeVisible();
  await expect(page.locator("main")).toContainText(alex.email);
  expect(await prefs()).toEqual([]);
  await shot(page, "unsubscribe-confirm-1280");

  await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
  await expect(page).toHaveURL(/\/unsubscribe\?t=.+&done=all$/);
  await expect(page.getByRole("heading", { level: 1, name: "You are unsubscribed" })).toBeVisible();
  await expect(page.locator("main")).toContainText(`We will not email ${alex.email} again, unless you ask us to.`);
  await expect(page.getByRole("button", { name: "Subscribe again" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What we hold" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Send a request" })).toHaveAttribute("href", "/about-the-data#request");
  expect(await prefs()).toEqual([{ weekly_digest: false, off: true }]);
  await shot(page, "unsubscribe-done-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await shot(page, "unsubscribe-done-390");

  // A link that is not ours gets one answer and no form.
  await page.goto(`${unsubscribeUrl.slice(0, -3)}AAA`);
  await expect(page.getByRole("heading", { level: 1, name: "This link does not work" })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await context.close();

  // Signed in, Settings says the same thing in words.
  await alexPage.goto("/app/settings/notifications");
  await expect(alexPage.getByTestId("notifications-all-off")).toContainText("Emails are off");
  await expect(alexPage.getByTestId("notify-switch-weeklyDigest")).toHaveAttribute("aria-checked", "false");
});

test("the next Monday sends the unsubscribed person nothing, and the other one their digest", async ({ request }) => {
  await tick(request, SECOND_MONDAY);
  await tick(request, new Date(SECOND_MONDAY.getTime() + 5 * 60_000));

  await alexPage.goto(OUTBOX);
  await expect(digestsFor(alexPage, bea.email)).toHaveCount(2);
  await expect(digestsFor(alexPage, alex.email)).toHaveCount(1);
  // Bea's second digest is about what arrived in between, and nothing from last week again.
  const second = digestsFor(alexPage, bea.email).first();
  await expect(second.getByRole("heading")).toHaveText("1 new tender for Acme Grounds");
  await second.locator("summary").click();
  await expect(second.locator("pre")).toContainText(LATER_TENDER.title);
  await expect(second.locator('[data-testid="outbox-link"][href*="/tenders/"]')).toHaveCount(1);

  const sent = await sql<Array<{ email: string; period_key: string; status: string }>>`
    select u.email, l.period_key, l.status from notification_log l join users u on u.id = l.user_id where l.kind = 'digest' order by l.period_key, u.email`;
  expect(sent.filter((row) => row.email === alex.email)).toHaveLength(1);
  expect(sent.filter((row) => row.email === bea.email).map((row) => row.status)).toEqual(["sent", "sent"]);
  // Nothing was even queued for the unsubscribed person in the second week.
  const queued = await sql<Array<{ count: number }>>`
    select count(*)::int as count from jobs j join users u on u.id = j.payload->>'userId' where j.type = 'notifications.send' and u.email = ${alex.email}`;
  expect(queued[0]!.count).toBe(1);
  const unsubscribed = await sql<Array<{ properties: { scope: string; via: string; kind: string } }>>`select properties from events where name = 'notification_unsubscribed'`;
  expect(unsubscribed.map((row) => row.properties)).toEqual([{ kind: "digest", scope: "all", via: "page" }]);
});
