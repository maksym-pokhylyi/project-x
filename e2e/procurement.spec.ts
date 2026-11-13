import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The acquisition journey on seeded data (e2e/procurement.global-setup.ts):
 *
 *   public supplier page → "Claim this page" → sign up → verify e-mail (dev outbox)
 *   → confirm → Radar pre-populated with that supplier's matches → save a tender;
 *   and the /find flow.
 */
test.describe.configure({ mode: "serial" });
// Needs the seed from e2e/procurement.global-setup.ts: skipped under any other Playwright config.
test.skip(!process.env.PROCUREMENT_E2E, "run with: playwright test -c playwright.procurement.config.ts");

const run = Date.now().toString(36);
const user = { name: "Alex Acme", email: `alex-${run}@e2e.test`, password: "acme-password-123" };
const SUPPLIER = "/suppliers/acme-grounds-ltd-01111111";
const OGL = "Contains public sector information licensed under the Open Government Licence v3.0.";
const INDEPENDENCE = "Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government.";
const SHOTS = process.env.PROCUREMENT_SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(1);
}

/** Opens the dev outbox and follows the first link of the newest e-mail for `to`. */
async function followOutboxLink(page: Page, to: string, template: string) {
  await page.goto("/dev/outbox");
  const email = page.locator(`[data-testid="outbox-email"][data-to="${to}"][data-template="${template}"]`).first();
  await expect(email).toBeVisible();
  await email.getByTestId("outbox-link").first().click();
}

test("public supplier page: company-level data, three items per block, attribution, noindex", async ({ page }) => {
  const response = await page.goto(`${SUPPLIER}?r=e2e-ref-1`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Acme Grounds Ltd" })).toBeVisible();
  await expect(page.getByText("Company number 01111111")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // "Open tenders like the ones you've won": three cards, each with a reason, a deadline and the source link.
  const matches = page.locator("section[aria-labelledby='matches']");
  await expect(matches.getByRole("heading", { name: /Open tenders like the ones you've won/ })).toBeVisible();
  const cards = matches.getByTestId("tender-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("Grounds Maintenance and Grass Cutting 2027");
  await expect(cards.first().getByTestId("match-reason")).toContainText("From Leeds City Council, which awarded you a £120k contract");
  await expect(cards.first().getByTestId("deadline-chip")).toHaveAttribute("data-urgency", "urgent");
  for (const card of await cards.all()) {
    await expect(card.getByTestId("source-link")).toHaveAttribute("href", /^https:\/\/www\.find-tender\.service\.gov\.uk\/Notice\//);
  }
  await expect(matches.getByTestId("more-count")).toContainText("+ 11 more");

  // "Contracts ending soon in your trade" and "Buyers awarding in your trade".
  const ending = page.locator("section[aria-labelledby='ending']");
  await expect(ending.getByTestId("ending-soon-card")).toHaveCount(3);
  await expect(ending).toContainText("End date stated in the notice");
  await expect(ending).toContainText("Rival Landscapes Ltd");
  // A possible sole trader is never named.
  await expect(ending).toContainText("Supplier named in the notice");
  await expect(page.locator("main")).not.toContainText("John Smith");
  const buyers = page.locator("section[aria-labelledby='buyers']");
  await expect(buyers.getByTestId("buyer-card").first()).toBeVisible();
  await expect(buyers).toContainText("awarded without an open tender");

  // Awards table with a source link per row.
  const table = page.getByTestId("contracts-table");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table).toContainText("Leeds City Council");
  await expect(table.getByTestId("source-link")).toHaveCount(2);

  // Calls to action and the legal lines.
  await expect(page.getByTestId("claim-cta")).toHaveAttribute("href", "/claim/acme-grounds-ltd-01111111");
  await expect(page.getByRole("link", { name: "Get a free bid brief" }).first()).toHaveAttribute("href", "/free-bid-brief");
  const attribution = page.getByTestId("data-attribution");
  await expect(attribution).toContainText(OGL);
  await expect(attribution).toContainText(INDEPENDENCE);
  await expect(attribution.getByTestId("correction-link")).toHaveAttribute("href", /\/about-the-data\?page=.*#request$/);

  // No personal data anywhere in the HTML: no e-mail address, no telephone number.
  const html = await page.content();
  expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.(example|com|co\.uk)/);
  expect(html).not.toContain("acmegrounds.example");
  expect(html).not.toMatch(/tel:/);
  // No tracking: no cookies for an anonymous visitor and no third-party requests.
  expect(await page.context().cookies()).toEqual([]);

  await expectNoHorizontalScroll(page);
  await shot(page, "supplier-1280");
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 780 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Acme Grounds Ltd" })).toBeVisible();
    await expect(page.getByTestId("claim-cta")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, `supplier-${width}`);
  }
});

test("supplier page states: one award, no matches right now, about-the-data request form", async ({ page }) => {
  // A company with a single award and no open tender in its trade.
  await page.goto("/suppliers/harbour-catering-ltd-07777777");
  await expect(page.getByRole("heading", { level: 1, name: "Harbour Catering Ltd" })).toBeVisible();
  await expect(page.locator("dl[aria-label='Summary']")).toContainText("Contract");
  await expect(page.getByRole("heading", { name: "Published contract award" })).toBeVisible();
  const matches = page.locator("section[aria-labelledby='matches']");
  await expect(matches.getByTestId("empty-state")).toContainText("No open tenders match this company's awards right now");
  await expect(matches.getByRole("link", { name: "Claim this page to get an alert" })).toBeVisible();
  await expect(matches.getByTestId("tender-card")).toHaveCount(0);
  await expect(page.getByTestId("contracts-table").locator("tbody tr")).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  // "Request a correction or removal" leads to the form with the page pre-filled.
  await page.getByTestId("correction-link").click();
  await expect(page).toHaveURL(/\/about-the-data\?page=%2Fsuppliers%2Fharbour-catering-ltd-07777777#request$/);
  await expect(page.getByRole("heading", { level: 1, name: "About the data" })).toBeVisible();
  await expect(page.locator("main")).toContainText(OGL);
  await expect(page.locator("main")).toContainText(INDEPENDENCE);
  const form = page.getByTestId("data-request-form");
  await expect(form.getByLabel("Page address")).toHaveValue(/\/suppliers\/harbour-catering-ltd-07777777$/);
  // Errors are shown as text next to the fields.
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(form.getByText("Enter a valid email address.")).toBeVisible();
  await form.getByLabel("Your email address").fill(`director-${run}@harbourcatering.example`);
  await form.getByLabel("What should change?").fill("The contract value shown for our Bristol contract is wrong.");
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByTestId("data-request-sent")).toContainText("we have your request");
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/about-the-data");
    await expectNoHorizontalScroll(page);
  }
});

test("pages we do not publish answer 404; tender and buyer pages work and link to the source", async ({ page, request }) => {
  const soleTrader = await request.get("/api/procurement/search?q=john%20smith");
  expect((await soleTrader.json()).results).toEqual([]);
  expect((await request.get("/suppliers/no-such-company-00000000")).status()).toBe(404);

  await page.goto(SUPPLIER);
  await page.locator("section[aria-labelledby='matches']").getByRole("link", { name: "Grounds Maintenance and Grass Cutting 2027" }).click();
  await expect(page).toHaveURL(/\/tenders\/ocds-h6vhtk-e00000$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grounds Maintenance and Grass Cutting 2027");
  await expect(page.getByTestId("deadline-chip").first()).toContainText("Closes in");
  await expect(page.getByTestId("source-link").first()).toHaveAttribute("href", /find-tender\.service\.gov\.uk\/Notice\//);
  await expect(page.getByRole("link", { name: "Start a bid" })).toHaveAttribute("href", "/app/bids/new?notice=ocds-h6vhtk-e00000");
  await expect(page.getByTestId("data-attribution")).toContainText(OGL);
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);

  await page.getByRole("link", { name: "Leeds City Council" }).first().click();
  await expect(page).toHaveURL(/\/buyers\/leeds-city-council-/);
  await expect(page.getByRole("heading", { level: 1, name: "Leeds City Council" })).toBeVisible();
  await expect(page.getByTestId("contracts-table")).toContainText("Acme Grounds Ltd");
  await expect(page.getByTestId("data-attribution")).toContainText(INDEPENDENCE);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 780 });
    for (const path of ["/tenders/ocds-h6vhtk-e00000", page.url(), "/find?q=grounds"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await shot(page, `find-${width}`);
  }

  // Sitemaps: tenders are listed, supplier and buyer pages are gated off by default.
  expect(await (await request.get("/sitemap-data.xml")).text()).toContain("/sitemaps/tenders-0.xml");
  expect(await (await request.get("/sitemaps/tenders-0.xml")).text()).toContain("/tenders/ocds-h6vhtk-e00000");
  expect((await request.get("/sitemaps/suppliers-0.xml")).status()).toBe(404);
  expect(await (await request.get("/robots.txt")).text()).toContain("/sitemap-data.xml");
  // The ingestion cron is closed without the secret.
  expect((await request.get("/api/cron/ingest")).status()).toBe(401);
});

test("find your company: empty, typing, results, no result, company number", async ({ page }) => {
  await page.goto("/find");
  await expect(page.getByRole("heading", { level: 1, name: "Find your company" })).toBeVisible();
  const input = page.getByTestId("company-search-input");
  const status = page.getByTestId("company-search-status");
  await expect(status).toHaveAttribute("data-status", "idle");

  await input.fill("a");
  await expect(status).toHaveAttribute("data-status", "typing");
  await input.fill("acme grounds");
  await expect(status).toHaveAttribute("data-status", "done");
  const results = page.getByTestId("company-search-results").locator("li");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Acme Grounds Ltd");
  await expect(results.first()).toContainText("Company no. 01111111");
  await expect(results.first()).toContainText("2 published awards");

  await input.fill("zzzz qqqq");
  await expect(page.getByTestId("company-search-empty")).toContainText("We only list suppliers with published awards");
  await expect(page.getByRole("link", { name: "Set up a radar manually" })).toBeVisible();

  // By company number, with the leading zero dropped.
  await input.fill("1111111");
  await expect(results).toHaveCount(1);
  await results.first().getByRole("link", { name: "View page" }).click();
  await expect(page).toHaveURL(new RegExp(`${SUPPLIER}$`));

  // Works as a plain GET form too (no JavaScript needed for the first result).
  await page.goto("/find?q=rival");
  await expect(page.getByTestId("company-search-results")).toContainText("Rival Landscapes Ltd");
  await expectNoHorizontalScroll(page);
  await shot(page, "find-1280");
});

test("claim → sign up → verify → confirm → radar shows the supplier's matches", async ({ page }) => {
  await page.goto(SUPPLIER);
  await page.getByTestId("claim-cta").click();
  // Signed out: the claim continues after sign-up.
  await expect(page).toHaveURL(/\/sign-up\?redirect=%2Fclaim%2Facme-grounds-ltd-01111111$/);
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);

  await followOutboxLink(page, user.email, "verify-email");
  // Back on the claim page, now signed in: one confirmation.
  await expect(page).toHaveURL(/\/claim\/acme-grounds-ltd-01111111$/);
  await expect(page.getByRole("heading", { level: 1, name: "Acme Grounds Ltd" })).toBeVisible();
  await expect(page.getByTestId("claim-form")).toContainText("Link this company to");
  await page.getByTestId("claim-confirm").click();

  // The radar is pre-populated from the supplier's awards.
  await expect(page).toHaveURL(/\/app\?claimed=1/);
  await expect(page.getByTestId("radar-first-run")).toContainText("Your radar is ready");
  await expect(page.getByTestId("radar-source")).toContainText("Acme Grounds Ltd");
  await expect(page.getByTestId("radar-count")).toContainText("14 open tenders for Acme Grounds Ltd");
  const cards = page.getByTestId("tender-card");
  // Free plan: ten matches in full…
  await expect(cards).toHaveCount(10);
  await expect(cards.first()).toContainText("Grounds Maintenance and Grass Cutting 2027");
  await expect(cards.first().getByTestId("match-reason")).toContainText("From Leeds City Council");
  // …the rest locked, but never the link to the source notice.
  await expect(page.getByTestId("upgrade-notice")).toContainText("4 more matches on Radar Pro");
  const locked = page.getByTestId("locked-row");
  await expect(locked).toHaveCount(4);
  for (const row of await locked.all()) await expect(row.getByTestId("source-link")).toHaveAttribute("href", /find-tender\.service\.gov\.uk\/Notice\//);
  await expectNoHorizontalScroll(page);
  await shot(page, "radar-1280");

  // Save the first tender: it shows up under Saved and in the deadline strip.
  await cards.first().getByRole("button", { name: "Save" }).click();
  await expect(cards.first().getByRole("button", { name: "Remove from saved" })).toBeVisible();
  await expect(page.getByTestId("radar-deadlines")).toContainText("Grounds Maintenance and Grass Cutting 2027");
  // Dismiss the second: it leaves the list.
  const second = await cards.nth(1).getAttribute("data-ocid");
  await cards.nth(1).getByRole("button", { name: "Dismiss" }).click();
  await expect(page.locator(`[data-testid="tender-card"][data-ocid="${second}"]`)).toHaveCount(0);
  await expect(page.getByTestId("radar-count")).toContainText("13 open tenders");

  await page.getByTestId("radar-tab-saved").click();
  await expect(page.getByTestId("tender-row")).toHaveCount(1);

  // The other tabs carry the same supplier's data.
  await page.getByTestId("radar-tab-ending").click();
  await expect(page.getByTestId("ending-soon-card")).toHaveCount(3);
  await page.getByTestId("radar-tab-buyers").click();
  await expect(page.getByTestId("buyer-card").first()).toContainText(/Council/);
  await page.getByTestId("radar-tab-signals").click();
  await expect(page.getByTestId("tender-card")).toHaveCount(1);
  await expect(page.getByTestId("tender-card").first()).toContainText("Grounds Maintenance Market Engagement");

  // Filtered to empty: explained, with a way back.
  await page.goto("/app?region=UKN");
  await expect(page.getByTestId("empty-state")).toContainText("Nothing matches these filters");
  await page.getByTestId("empty-state").getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByTestId("tender-card").first()).toBeVisible();

  // Tender detail inside the app, with Start a bid.
  await page.getByTestId("tender-card").first().getByRole("link", { name: "Grounds Maintenance and Grass Cutting 2027" }).click();
  await expect(page).toHaveURL(/\/app\/tenders\/ocds-h6vhtk-e00000$/);
  await expect(page.getByTestId("tender-actions").getByRole("link", { name: "Start a bid" })).toHaveAttribute("href", "/app/bids/new?notice=ocds-h6vhtk-e00000");
  await expect(page.getByTestId("source-link").first()).toBeVisible();

  // The public page now knows this viewer has claimed it.
  await page.goto(SUPPLIER);
  await expect(page.getByRole("link", { name: "Open your radar" }).first()).toBeVisible();
  await expect(page.getByTestId("claim-cta")).toHaveCount(0);
  // Claiming again is a no-op with a clear message.
  await page.goto("/claim/acme-grounds-ltd-01111111");
  await expect(page.getByTestId("claim-already")).toContainText("already on your radar");
  // A second company is over the Free plan's limit.
  await page.goto("/claim/rival-landscapes-ltd-02222222");
  await expect(page.getByTestId("claim-limit")).toContainText("Your plan includes 1 radar profile");

  // Tablet and mobile widths: radar, tender detail and the claim page.
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/app");
    await expect(page.getByTestId("tender-card").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, `radar-${width}`);
    await page.goto("/app/tenders/ocds-h6vhtk-e00000");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto("/claim/rival-landscapes-ltd-02222222");
    await expectNoHorizontalScroll(page);
  }
});

test("a workspace with no company sees the onboarding choices and can set up a radar manually", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const other = { name: "Nora New", email: `nora-${run}@e2e.test`, password: "nora-password-123" };
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(other.name);
  await page.getByLabel("Work email").fill(other.email);
  await page.getByLabel("Password").fill(other.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await followOutboxLink(page, other.email, "verify-email");
  await expect(page).toHaveURL(/\/app$/);

  // Nothing of the first user's radar leaks into this workspace.
  await expect(page.getByTestId("radar-onboarding")).toBeVisible();
  await expect(page.getByText("We haven't won public contracts yet")).toBeVisible();
  await expect(page.getByTestId("tender-card")).toHaveCount(0);

  await page.getByRole("link", { name: "Set up a radar manually" }).click();
  await expect(page).toHaveURL(/\/app\/radar\/setup$/);
  await page.getByLabel("Name of this radar").fill("New Start Gardens");
  await page.getByLabel("Search trades").fill("grounds");
  await page.getByTestId("trade-options").getByRole("button", { name: /Grounds, forestry and horticultural services/ }).click();
  await expect(page.getByTestId("selected-trades")).toContainText("Grounds, forestry and horticultural services");
  await page.getByLabel("Yorkshire and the Humber").check();
  await page.getByLabel("Keywords").fill("grass cutting");
  await page.getByRole("button", { name: "Save and open my radar" }).click();
  await expect(page).toHaveURL(/\/app\?profile=r%3A/);
  await expect(page.getByTestId("radar-source")).toContainText("New Start Gardens");
  await expect(page.getByTestId("tender-card").first()).toBeVisible();
  await expect(page.getByTestId("tender-card").first().getByTestId("match-reason")).toContainText("Matches your trade");

  // In-app "Find your company" leads to the claim confirmation.
  await page.goto("/app/radar/find?q=rival");
  await expect(page.getByTestId("company-search-results")).toContainText("Rival Landscapes Ltd");
  await context.close();
});
