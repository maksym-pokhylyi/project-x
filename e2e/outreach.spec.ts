import { readFileSync } from "node:fs";
import { devices, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { site } from "../src/config/site";
import { parseCsv } from "../src/features/outreach/domain/csv";
import { expectAlignedControls } from "./control-heights";

/**
 * The outreach journey on seeded FICTIONAL data (e2e/outreach.global-setup.ts):
 *
 *   the founder builds a segment → previews it → creates a campaign → exports the CSV
 *   → marks the batch as sent → a recipient opens the personal link → opts out with
 *   JavaScript switched off → the address is on the suppression list and the company
 *   cannot be listed again.
 *
 * The app never sends these letters: the dev outbox holds nothing but the founder's own
 * verification e-mail at the end.
 */
test.describe.configure({ mode: "serial" });
// Needs the seed from e2e/outreach.global-setup.ts: skipped under any other Playwright config.
test.skip(!process.env.OUTREACH_E2E, "run with: playwright test -c playwright.outreach.config.ts");

// ADMIN_EMAILS and DEV_TOOLS_SECRET of playwright.outreach.config.ts. (Not imported from it:
// loading that file sets OUTREACH_E2E, and this spec must stay skipped under the main config.)
const founder = { name: "Fay Founder", email: "founder@e2e.test", password: "founder-password-123" };
const OUTBOX = "/dev/outbox?key=e2e-dev-tools-secret-0123456789";
const SEGMENT = "/admin/outreach?preview=1&divisions=77&batch=10";
/** Every address in the seed is on one of these domains; none may reach a page a prospect list is shown on. */
const SEEDED_ADDRESS = /acmegrounds\.example|brightway\.example|castlegardens\.example|heathgardens\.example|soletrader\.example|fenwickgrounds\.example|oldaward\.example/;
const representativeAppointed = !site.company.ukRepresentative.includes("[[");

type Letter = { email: string; company: string; first_name: string; subject: string; body: string; page_link: string; optout_link: string; contact_by: string; ref_code: string };

let adminContext: BrowserContext;
let admin: Page;
let campaignUrl = "";
let acme: Letter;
/** Content-Security-Policy violations reported by any page with scripts switched on. */
const cspViolations: string[] = [];

/** A browser context that reports CSP violations: these pages run under the per-request nonce policy. */
async function watchedContext(browser: import("@playwright/test").Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ ...devices["Desktop Chrome"] });
  await context.exposeFunction("__reportCspViolation", (violation: string) => void cspViolations.push(violation));
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as { __reportCspViolation: (violation: string) => void }).__reportCspViolation;
      report(`${location.pathname}: ${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  return context;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(1);
}

/** A recipient: no session, an ordinary browser, and no JavaScript — the opt-out must not need any. */
async function recipient(browser: import("@playwright/test").Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...devices["Desktop Chrome"], javaScriptEnabled: false });
  return { context, page: await context.newPage() };
}

test.beforeAll(async ({ browser }) => {
  adminContext = await watchedContext(browser);
  admin = await adminContext.newPage();
});
test.afterAll(async () => {
  await adminContext.close();
});

test("the outreach pages are for the founder only", async ({ page }) => {
  for (const path of ["/admin/outreach", "/admin/suppressions", "/admin/outreach/campaigns/00000000-0000-4000-8000-000000000000"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/sign-in\?redirect=/);
  }
  // A download is not a page either: no session, no file. (The proxy sends a signed-out
  // request for /admin to the sign-in page; the handler itself answers 401, see tests/outreach/access.test.ts.)
  const origin = new URL(page.url()).origin;
  for (const path of ["/admin/suppressions/export", "/admin/outreach/campaigns/00000000-0000-4000-8000-000000000000/export"]) {
    const response = await page.request.post(path, { headers: { origin }, maxRedirects: 0 });
    expect([302, 303, 307, 308, 401], path).toContain(response.status());
    expect(response.headers()["content-type"] ?? "", path).not.toContain("text/csv");
    expect(response.headers()["content-disposition"] ?? "", path).not.toContain("attachment");
  }
});

test("the founder signs in and finds Outreach, Suppressions and Ingestion in the admin navigation", async () => {
  await admin.goto("/sign-up?redirect=/admin");
  await admin.getByLabel("Name").fill(founder.name);
  await admin.getByLabel("Work e-mail").fill(founder.email);
  await admin.getByLabel("Password").fill(founder.password);
  await admin.getByRole("button", { name: "Create account" }).click();
  await expect(admin).toHaveURL(/\/verify-email/);
  await admin.goto(OUTBOX);
  await admin.locator(`[data-testid="outbox-email"][data-to="${founder.email}"][data-template="verify-email"]`).first().getByTestId("outbox-link").first().click();
  await expect(admin).toHaveURL(/\/admin$/);

  const nav = admin.getByRole("navigation", { name: "Admin" });
  for (const name of ["Outreach", "Suppressions", "Ingestion"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  // The overview carries the founder's sixteen numbers, the outreach summary among them.
  await expect(admin.getByTestId("admin-stat")).toHaveCount(16);
  await expect(admin.locator('[data-kpi="outreach"]')).toContainText("0 sent");
  await expect(admin.locator('[data-kpi="bid-pass"]')).toContainText("0 in 7 days · 0 in 30 days");
  const list = admin.locator('[data-kpi="suppressions"]');
  await expect(list).toContainText("Do-not-contact list");
  await expect(list.getByRole("link", { name: "Open the list" })).toHaveAttribute("href", "/admin/suppressions");

  await nav.getByRole("link", { name: "Ingestion", exact: true }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Data ingestion" })).toBeVisible();
  await nav.getByRole("link", { name: "Outreach", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/outreach$/);
  await expect(admin.getByRole("heading", { level: 1, name: "Outreach" })).toBeVisible();
});

test("builds a segment: who would be listed, who is left out and why — and nothing is stored", async () => {
  await expect(admin.getByTestId("lawful-use")).toContainText("Never phone, text or message a prospect.");
  await expect(admin.getByTestId("lawful-use").locator("ol > li")).toHaveCount(9);
  // Without a UK representative the builder says so and offers generic mailboxes only.
  await expect(admin.getByTestId("named-addresses-blocked")).toHaveCount(representativeAppointed ? 0 : 1);
  if (!representativeAppointed) {
    await expect(admin.getByTestId("named-addresses-blocked")).toContainText("Do not send to named addresses until a UK representative is appointed");
    await expect(admin.locator('#segment-mailbox option[value="generic_and_named"]')).toBeDisabled();
  }

  // Tick the trade (the box needs the page's script: try until the tick holds).
  const trade = admin.locator("#division-77");
  await expect(async () => {
    if ((await trade.getAttribute("aria-checked")) !== "true") await trade.click();
    await expect(trade).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
  }).toPass();
  await admin.getByLabel("Batch size").fill("10");
  await admin.getByTestId("preview-button").click();
  await expect(admin).toHaveURL(/preview=1/);
  await expect(admin).toHaveURL(/divisions=77/);

  await expect(admin.getByTestId("preview-headline")).toContainText("3 companies would be listed");
  const rows = admin.getByTestId("preview-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Acme Grounds Ltd");
  await expect(rows.nth(0)).toContainText("Grounds Maintenance Services");
  await expect(rows.nth(0)).toContainText("Leeds City Council · £120,000");
  await expect(rows.nth(0)).toContainText("Generic mailbox");
  await expect(rows.nth(1)).toContainText("Brightway Landscapes Ltd");
  await expect(rows.nth(2)).toContainText("Castle Gardens LLP");
  // Everyone else, counted under the rule that left them out.
  await expect(admin.getByTestId("summary-listed")).toContainText("3");
  await expect(admin.getByTestId("excluded-not_eligible")).toContainText("No Companies House number in the notice");
  await expect(admin.getByTestId("excluded-named_not_selected").locator("td").last()).toHaveText("1");
  await expect(admin.getByTestId("excluded-not_sme").locator("td").last()).toHaveText("1");
  await expect(admin.getByTestId("excluded-suppressed").locator("td").last()).toHaveText("0");
  // A prospect's address is in the exported file only: never on the page.
  expect(await admin.content()).not.toMatch(SEEDED_ADDRESS);
  await expectNoHorizontalScroll(admin);
  await expectAlignedControls(admin, "outreach builder");

  // Looking stored nothing.
  await admin.goto("/admin/outreach");
  await expect(admin.getByText("No campaigns yet")).toBeVisible();
  await expect(admin.getByText("Nothing has been recorded yet.")).toBeVisible();
});

test("creates a campaign and exports the letters as CSV", async () => {
  await admin.goto(SEGMENT);
  await admin.getByTestId("create-campaign-form").getByLabel("Name").fill("E2E week one");
  await admin.getByTestId("create-campaign-button").click();
  await expect(admin).toHaveURL(/\/admin\/outreach\/campaigns\/[0-9a-f-]{36}\?notice=created&n=3$/);
  campaignUrl = new URL(admin.url()).pathname;
  await expect(admin.getByTestId("flash-notice")).toContainText("Campaign created with 3 companies");
  await expect(admin.getByRole("heading", { level: 1, name: "E2E week one" })).toBeVisible();
  await expect(admin.getByTestId("prospect-row")).toHaveCount(3);
  await expect(admin.locator('[data-testid="prospect-row"][data-status="listed"]')).toHaveCount(3);
  expect(await admin.content()).not.toMatch(SEEDED_ADDRESS);
  // The letter can be read before anything is exported.
  await admin.getByTestId("prospect-row").filter({ hasText: "Acme Grounds Ltd" }).getByTestId("letter-link").click();
  await expect(admin.getByTestId("letter-preview")).toContainText("Acme Grounds Ltd is named as the supplier on");
  await expect(admin.getByTestId("letter-preview")).toContainText("To stop these emails");
  expect(await admin.content()).not.toMatch(SEEDED_ADDRESS);

  const [download] = await Promise.all([admin.waitForEvent("download"), admin.getByTestId("export-button").click()]);
  expect(download.suggestedFilename()).toMatch(/^outreach-e2e-week-one-first-\d{4}-\d{2}-\d{2}\.csv$/);
  const file = readFileSync((await download.path())!);
  expect([...file.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 with a byte-order mark
  const [header, ...records] = parseCsv(file.toString("utf8"));
  expect(header).toEqual(["email", "company", "first_name", "subject", "body", "page_link", "optout_link", "contact_by", "ref_code"]);
  const letters = records.map((record) => Object.fromEntries(header!.map((column, index) => [column, record[index] ?? ""])) as Letter);
  expect(letters.map((letter) => letter.email).sort()).toEqual(["bids@castlegardens.example", "info@brightway.example", "tenders@acmegrounds.example"]);

  acme = letters.find((letter) => letter.company === "Acme Grounds Ltd")!;
  const origin = new URL(admin.url()).origin;
  expect(acme.ref_code).toMatch(/^[0-9A-Za-z]{10}$/);
  expect(acme.page_link).toBe(`${origin}/suppliers/acme-grounds-ltd-01111111?r=${acme.ref_code}`);
  expect(acme.optout_link).toBe(`${origin}/optout?c=${acme.ref_code}`);
  expect(acme.first_name).toBe("");
  expect(acme.subject).toBe("Acme Grounds Ltd: your public contract awards on one page (from Bidfolio)");
  expect(acme.body).toContain("Hello,");
  expect(acme.body).toContain(acme.page_link);
  expect(acme.body).toContain(`To stop these emails, reply "stop" or use this link: ${acme.optout_link}`);
  expect(acme.body).toContain("Bidfolio is operated by");
  expect(acme.body).toContain("Contains public sector information licensed under the Open Government Licence v3.0.");
  // Plain text: no markup (so no pixel), and only our own three links.
  expect(acme.body).not.toMatch(/<[a-z!/]/i);
  expect((acme.body.match(/https?:\/\/\S+/g) ?? []).every((link) => link.startsWith(origin))).toBe(true);
  expect(acme.body.match(/https?:\/\/\S+/g)).toHaveLength(3);

  await admin.goto(campaignUrl);
  await expect(admin.locator('[data-testid="prospect-row"][data-status="exported"]')).toHaveCount(3);
});

test("marks the batch as sent: the record of first contact", async () => {
  await admin.goto(campaignUrl);
  // A campaign is part of Outreach: the admin bar says so, and the trail above the title leads back.
  await expect(admin.getByRole("navigation", { name: "Admin" }).locator('[aria-current="page"]')).toHaveText("Outreach");
  await expect(admin.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Outreach" })).toHaveAttribute("href", "/admin/outreach");
  await admin.getByLabel("How many, in list order").fill("3");
  await admin.getByTestId("mark-first-exported").click();
  await expect(admin.getByTestId("flash-notice")).toContainText("3 companies marked as sent.");
  await expect(admin.locator('[data-testid="prospect-row"][data-status="sent"]')).toHaveCount(3);
  await expect(admin.getByTestId("funnel-sent")).toContainText("3");
  await expect(admin.getByTestId("funnel-verdict")).toContainText("Too few e-mails to judge: 3 sent");
  await expectNoHorizontalScroll(admin);
  await expectAlignedControls(admin, "campaign");
});

test("a recipient opens the personal link, then the opt-out link: looking changes nothing", async ({ browser }) => {
  const { context, page } = await recipient(browser);
  const response = await page.goto(acme.page_link);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Acme Grounds Ltd" })).toBeVisible();

  for (let visit = 0; visit < 3; visit += 1) {
    await page.goto(acme.optout_link);
    await expect(page.getByRole("heading", { level: 1, name: "Stop emails to this address?" })).toBeVisible();
  }
  const main = page.locator("main");
  await expect(main).toContainText("Acme Grounds Ltd");
  await expect(main).toContainText("Nothing changes until you press the button.");
  await expect(main.getByRole("button")).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // The page names the company, never the address; and it sets no cookie.
  expect(await page.content()).not.toMatch(SEEDED_ADDRESS);
  expect(await context.cookies()).toEqual([]);
  await expect(page.getByTestId("optout-operator")).toContainText("Bidfolio is operated by");
  await context.close();

  // Three looks later nothing is on the list, and the company is still "sent".
  await admin.goto("/admin/suppressions");
  await expect(admin.getByTestId("suppression-counts")).toContainText("0 on the list");
  await admin.goto(campaignUrl);
  await expect(admin.locator('[data-testid="prospect-row"][data-status="sent"]')).toHaveCount(3);
});

test("the recipient opts out with one button, without JavaScript", async ({ browser }) => {
  const { context, page } = await recipient(browser);
  await page.goto(acme.optout_link);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page).toHaveURL(new RegExp(`/optout\\?c=${acme.ref_code}$`));
  await expect(page.getByRole("heading", { level: 1, name: "You are unsubscribed" })).toBeVisible();
  const main = page.locator("main");
  await expect(main).toContainText("We will not email Acme Grounds Ltd again");
  // What we hold and why, and how to have it removed.
  await expect(page.getByTestId("optout-held")).toContainText("contract notices published on Find a Tender");
  await expect(page.getByTestId("optout-held")).toContainText("Open Government Licence v3.0");
  await expect(page.getByTestId("optout-held")).toContainText("no contact name and no telephone number");
  await expect(page.getByTestId("optout-request")).toHaveAttribute("href", "/about-the-data?page=%2Fsuppliers%2Facme-grounds-ltd-01111111#request");
  await expect(main.getByRole("button")).toHaveCount(0);
  expect(await page.content()).not.toMatch(SEEDED_ADDRESS);
  expect(await context.cookies()).toEqual([]);

  // Coming back to the link, or reloading, shows the same and changes nothing more.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "You are unsubscribed" })).toBeVisible();
  // The further step is the request form ("Flag a mistake"), with the company's page filled in: the link goes on to it.
  await page.getByTestId("optout-request").click();
  await expect(page).toHaveURL(/\/flag-a-mistake\?page=%2Fsuppliers%2Facme-grounds-ltd-01111111(#request)?$/);
  await expect(page.getByTestId("flag-form").getByTestId("flag-page")).toContainText("/suppliers/acme-grounds-ltd-01111111");
  await expect(page.getByTestId("flag-form").locator("input[name='page']")).toHaveValue("/suppliers/acme-grounds-ltd-01111111");
  await context.close();
});

test("the opt-out page fits a phone and a tablet", async ({ browser }) => {
  const context = await watchedContext(browser);
  const page = await context.newPage();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 780 });
    for (const path of [`/optout?c=${acme.ref_code}`, "/optout", "/optout?done=1", "/optout?c=0000000000"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  }
  // "Where you are" is marked by the shared navigation link, and neither link is this page.
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveCount(2);
  await expect(page.locator('nav[aria-label="Main"] [aria-current="page"]')).toHaveCount(0);
  await context.close();
});

test("the address is on the suppression list, the campaign shows the opt-out and the visit", async () => {
  await admin.goto("/admin/suppressions");
  // The admin bar marks where we are: Suppressions, and only that.
  const current = admin.getByRole("navigation", { name: "Admin" }).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("Suppressions");
  // The search field and its button are one row of one height.
  expect(await expectAlignedControls(admin, "suppressions")).toBeGreaterThan(0);
  await expect(admin.getByTestId("suppression-counts")).toContainText("2 on the list");
  const address = admin.getByTestId("suppression-row").filter({ hasText: "tenders@acmegrounds.example" });
  await expect(address).toContainText("Opted out");
  await expect(address).toContainText("Opt-out link");
  // The domain is this company's alone in the notices, so the whole company is covered.
  await expect(admin.locator('[data-testid="suppression-row"][data-kind="domain"]')).toContainText("acmegrounds.example");

  const [download] = await Promise.all([admin.waitForEvent("download"), admin.getByTestId("export-suppressions").click()]);
  const exported = parseCsv(readFileSync((await download.path())!, "utf8"));
  expect(exported[0]).toEqual(["type", "value", "reason", "source", "note", "added"]);
  expect(exported.slice(1).map((row) => row.slice(0, 4))).toContainEqual(["address", "tenders@acmegrounds.example", "optout", "optout_link"]);

  await expect(async () => {
    await admin.goto(campaignUrl);
    await expect(admin.getByTestId("funnel-visits")).toContainText("1 of 3", { timeout: 2_000 }); // the visit is written after the response
  }).toPass();
  await expect(admin.locator('[data-testid="prospect-row"][data-status="opted_out"]')).toContainText("Acme Grounds Ltd");
  await expect(admin.locator('[data-testid="prospect-row"][data-status="sent"]')).toHaveCount(2);
  await expect(admin.getByTestId("funnel-sent")).toContainText("3"); // an opt-out does not unsend a letter
  await expect(admin.getByTestId("funnel-optouts")).toContainText("1 of 3");
  // Reminders would go to the two that did not opt out.
  await expect(admin.locator("#export-letter option").nth(1)).toHaveText("Reminder 1 — 2 to export");
});

test("the company cannot be listed again", async () => {
  await admin.goto(SEGMENT);
  await expect(admin.getByTestId("preview-headline")).toContainText("0 companies would be listed");
  await expect(admin.getByTestId("preview-row")).toHaveCount(0);
  await expect(admin.getByTestId("excluded-suppressed").locator("td").last()).toHaveText("1"); // Acme: on the do-not-contact list
  await expect(admin.getByTestId("excluded-cool_off").locator("td").last()).toHaveText("2"); // the other two were written to this week
  await expect(admin.getByTestId("preview-empty")).toBeVisible();
  await expect(admin.getByTestId("create-campaign-form")).toHaveCount(0);

  // Every step is in the audit trail — with numbers, not addresses.
  await admin.goto("/admin/outreach");
  const trail = admin.getByTestId("audit-trail");
  for (const action of ["campaign.created", "campaign.exported", "campaign.marked_sent", "suppression.exported"]) {
    await expect(trail.locator(`[data-testid="audit-row"][data-action="${action}"]`).first()).toBeVisible();
  }
  expect(await trail.innerText()).not.toMatch(/@/);
});

test("the form without a link answers every address in the same way", async ({ browser }) => {
  const { context, page } = await recipient(browser);
  const answers: string[] = [];
  for (const email of ["info@brightway.example", "nobody@never-seen.example"]) {
    await page.goto("/optout");
    await expect(page.getByRole("heading", { level: 1, name: "Stop emails from Bidfolio" })).toBeVisible();
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(page).toHaveURL(/\/optout\?done=1$/);
    await expect(page.getByRole("heading", { level: 1, name: "You are unsubscribed" })).toBeVisible();
    answers.push(await page.locator("main").innerText());
  }
  expect(answers[0]).toBe(answers[1]);
  expect(answers[0]).not.toMatch(/brightway|never-seen/);
  // Something that is not an address is asked for again.
  await page.goto("/optout");
  await page.getByLabel("Email address").fill("not-an-address@nowhere");
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page).toHaveURL(/\/optout\?error=email$/);
  await expect(page.getByText("Enter the email address in full")).toBeVisible();
  await context.close();

  await admin.goto("/admin/suppressions?q=brightway");
  await expect(admin.getByTestId("suppression-row")).toHaveCount(1);
  await expect(admin.getByTestId("suppression-row")).toContainText("Opt-out form");
  await admin.goto(campaignUrl);
  await expect(admin.locator('[data-testid="prospect-row"][data-status="opted_out"]')).toHaveCount(2);
});

test("corrections: a wrong sent date is cleared, and an entry leaves the list only when typed out", async () => {
  // 1. Castle was marked by mistake: tick the row, open the correction, clear its date.
  await admin.goto(campaignUrl);
  const castle = admin.getByTestId("prospect-row").filter({ hasText: "Castle Gardens LLP" });
  await expect(castle).toHaveAttribute("data-status", "sent");
  const tick = castle.getByTestId("prospect-tick");
  const tickIt = () =>
    expect(async () => {
      if ((await tick.getAttribute("aria-checked")) !== "true") await tick.click();
      await expect(tick).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
    }).toPass();
  await tickIt();
  const correction = admin.locator("details", { hasText: "Marked the wrong rows, or the wrong day?" });
  await expect(admin.getByTestId("clear-sent")).toBeHidden();
  await correction.locator("summary").click();
  await admin.getByTestId("clear-sent").click();
  await expect(admin.getByTestId("flash-notice")).toContainText("Sent date cleared for 1 company. The correction is in the audit trail.");
  await expect(castle).toHaveAttribute("data-status", "exported");
  await expect(admin.getByTestId("funnel-sent")).toContainText("2");
  // The tick went with the action (the form is reset once it has run): nothing stays
  // selected for the next action by accident.
  await expect(tick).toHaveAttribute("aria-checked", "false");
  // …and it is marked again, this time by its tick.
  await tickIt();
  await admin.getByTestId("mark-selected").click();
  await expect(admin.getByTestId("flash-notice")).toContainText("1 company marked as sent.");
  await expect(castle).toHaveAttribute("data-status", "sent");
  await expect(admin.getByTestId("funnel-sent")).toContainText("3");

  // 2. An address added to the list by mistake: one click does not remove it.
  await admin.goto("/admin/suppressions");
  const before = await admin.getByTestId("suppression-counts").innerText();
  await admin.getByLabel("Address or domain").fill("mistake@wrong-entry.example");
  await admin.getByTestId("add-suppression-button").click();
  await expect(admin.getByTestId("flash-notice")).toContainText("Added to the list.");
  const entry = admin.getByTestId("suppression-row").filter({ hasText: "mistake@wrong-entry.example" });
  await expect(entry.getByTestId("remove-suppression-form")).toBeHidden();
  await entry.locator("summary").click();
  await entry.getByLabel("Type the address to confirm").fill("mistake@wrong-entry");
  await entry.getByRole("button", { name: "Remove from the list" }).click();
  await expect(admin.getByTestId("flash-error")).toContainText("Type the address or domain exactly as shown to remove it.");
  await expect(entry).toHaveCount(1);
  await entry.locator("summary").click();
  await entry.getByLabel("Type the address to confirm").fill("mistake@wrong-entry.example");
  await entry.getByRole("button", { name: "Remove from the list" }).click();
  await expect(admin.getByTestId("flash-notice")).toContainText("Entry removed. The removal is in the audit trail.");
  await expect(entry).toHaveCount(0);
  expect(await admin.getByTestId("suppression-counts").innerText()).toBe(before);
  // The people who opted out are still on it.
  await expect(admin.getByTestId("suppression-row").filter({ hasText: "tenders@acmegrounds.example" })).toHaveCount(1);

  await admin.goto("/admin/outreach");
  const trail = admin.getByTestId("audit-trail");
  for (const action of ["campaign.sent_cleared", "suppression.added", "suppression.removed"]) {
    await expect(trail.locator(`[data-testid="audit-row"][data-action="${action}"]`).first()).toBeVisible();
  }
  expect(await trail.innerText()).not.toMatch(/@/);
});

test("the app sent no e-mail to anyone on the list", async () => {
  await admin.goto(OUTBOX);
  const emails = admin.getByTestId("outbox-email");
  await expect(emails.first()).toBeVisible();
  // Whatever the app sent, it sent to the founder's own account: nothing to a company on the list.
  const recipients = await emails.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-to")));
  expect(recipients.length).toBeGreaterThan(0);
  expect(new Set(recipients)).toEqual(new Set([founder.email]));
  expect(await admin.content()).not.toMatch(SEEDED_ADDRESS);
});

test("no page of the journey broke the Content-Security-Policy", async () => {
  expect(cspViolations).toEqual([]);
});
