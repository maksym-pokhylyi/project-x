import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_DEV_TOOLS_SECRET } from "./bids.env";
import { expectAlignedControls } from "./control-heights";

/**
 * The acquisition journey on seeded data (e2e/procurement.global-setup.ts), as the design
 * handoff draws it:
 *
 *   public supplier page → tender and buyer pages → "Flag a mistake"
 *   find your company → no result → set up a radar manually → sign up → the set-up page
 *     opens pre-filled → one button creates the radar
 *   find → "This is my company" → claim (account form in place, then signed in: one tick,
 *     one button) → first-run radar → all matches → save → dismiss and undo → filter →
 *     the Free plan's cap → the other tabs → the tender inside the app
 *
 * Every page is also checked for sideways scroll at phone widths, and every row that holds
 * a field and a button for one shared height (design-system rule).
 */
// One worker, in file order (playwright.procurement.config.ts). Each test brings its own visitor or
// account, so one failing does not hide the rest.
// Needs the seed from e2e/procurement.global-setup.ts: skipped under any other Playwright config.
test.skip(!process.env.PROCUREMENT_E2E, "run with: playwright test -c playwright.procurement.config.ts");

const run = Date.now().toString(36);
const alex = { name: "Alex Acme", email: `alex-${run}@e2e.test`, password: "acme-password-123" };
const nora = { name: "Nora New", email: `nora-${run}@e2e.test`, password: "nora-password-123" };
const SUPPLIER = "/suppliers/acme-grounds-ltd-01111111";
const CLAIM = "/claim/acme-grounds-ltd-01111111";
const OGL = "Contains public sector information licensed under the Open Government Licence v3.0.";
const INDEPENDENCE = "Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government.";
const NOTICE = /^https:\/\/www\.find-tender\.service\.gov\.uk\/Notice\//;
const SHOTS = process.env.PROCUREMENT_SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function expectNoHorizontalScroll(page: Page, label = page.url()) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} must not scroll sideways at ${page.viewportSize()?.width}px`).toBeLessThanOrEqual(1);
}

/** The same check at the widths a phone and a tablet have, then back to the desk. */
async function expectFitsSmallScreens(page: Page, label: string) {
  const before = page.viewportSize();
  for (const width of [768, 390, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoHorizontalScroll(page, label);
  }
  if (before) await page.setViewportSize(before);
}

/** Keyboard focus must be visible: the design system draws a 2 px ring on every control. */
async function expectFocusRing(locator: Locator) {
  await expect(locator).toBeFocused();
  const ring = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2, shadow: style.boxShadow !== "none" };
  });
  expect(ring.outline || ring.shadow, "the focused control shows a focus ring").toBe(true);
}

/** Presses Tab until `target` has focus (a bounded walk: the order may gain a link without breaking the test). */
async function tabTo(page: Page, target: Locator, limit = 40) {
  for (let presses = 0; presses < limit; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target, "reachable with the Tab key").toBeFocused();
}

/** The first whole number in an element's text ("See all 14 matches" → 14). Counts are read from the page, never assumed from the seed. */
async function numberIn(locator: Locator): Promise<number> {
  await expect(locator).toHaveText(/\d/);
  return Number(((await locator.textContent()) ?? "").replace(/,/g, "").match(/\d+/)?.[0]);
}

/** Opens the dev outbox and follows the first link of the newest e-mail for `to`. */
async function followOutboxLink(page: Page, to: string, template: string) {
  // On a production build the outbox opens only with its key.
  await page.goto(`/dev/outbox?key=${E2E_DEV_TOOLS_SECRET}`);
  const email = page.locator(`[data-testid="outbox-email"][data-to="${to}"][data-template="${template}"]`).first();
  await expect(email).toBeVisible();
  await email.getByTestId("outbox-link").first().click();
}

test("supplier page: the company's record, three items a block, where it comes from, nothing personal", async ({ page }) => {
  const response = await page.goto(`${SUPPLIER}?r=e2e-ref-1`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Acme Grounds Ltd" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // The mono line above the name, with the date of the last ingestion; town and number under it.
  await expect(page.locator("[data-slot='meta-line']").first()).toContainText(/built from \d+ published notices · updated \d{1,2} \w{3} \d{4}/);
  await expect(page.locator("main header")).toContainText("Companies House 01111111");
  await expect(page.getByRole("list", { name: "Work this company is awarded" })).toContainText("77314000");

  // "Is this your company?" for a visitor; the header button leads to the same block.
  const claim = page.getByTestId("claim-card");
  await expect(claim).toContainText("Is this your company?");
  await expect(page.getByTestId("claim-cta")).toHaveAttribute("href", CLAIM);
  await expect(claim.getByRole("link", { name: "Flag a mistake" })).toHaveAttribute("href", "/flag-a-mistake?page=%2Fsuppliers%2Facme-grounds-ltd-01111111");
  await expect(page.getByTestId("header-claim")).toHaveAttribute("href", "#claim");

  // Four figures, each read from the notices: the company's own record, and how many open tenders match it
  // (strong matches only — the seed has more of them than a block shows, whatever their exact number).
  const stats = page.locator("dl[aria-label='Summary']");
  await expect(stats).toContainText("public contracts won since");
  await expect(stats).toContainText("£200k");
  await expect(stats).toContainText("total awarded value");
  await expect(stats.locator("dd")).toHaveText(["2", "£200k", "2", /^\d+$/]);
  const openTotal = await numberIn(stats.locator("dd").nth(3));
  expect(openTotal, "more open tenders than one block shows").toBeGreaterThan(3);
  // The row of anchors carries the same counts.
  const anchors = page.getByRole("navigation", { name: "On this page" });
  expect(await numberIn(anchors.getByRole("link", { name: /Open tenders/ }))).toBe(openTotal);
  await expect(anchors.getByRole("link", { name: /Your wins/ })).toHaveAttribute("href", "#wins");

  // "Open tenders like your past work": three rows, each with its closing date, counted reasons and the source.
  const open = page.locator("section[aria-labelledby='open-tenders']");
  const cards = open.getByTestId("tender-card");
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card).toHaveAttribute("data-tier", "strong");
    await expect(card.locator("[data-testid='deadline']:visible").first()).toHaveAttribute("data-state", "open");
    await expect(card.getByTestId("match-reasons")).toContainText("You have won 1 contract from this buyer");
    await expect(card.getByTestId("match-reasons")).toContainText("Same work as 2 of your wins");
    await expect(card.getByRole("link", { name: "Start a bid check" })).toHaveAttribute("href", /^\/sign-up\?next=%2Fapp%2Fbids%2Fnew%3Ftender%3Docds-h6vhtk-e\d{5}$/);
    await expect(card.getByTestId("source-link")).toHaveAttribute("href", NOTICE);
  }
  // Soonest deadline first.
  const days = await cards.locator("[data-testid='deadline']:visible").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-days"))));
  expect([...days].sort((a, b) => a - b)).toEqual(days);
  // Three are shown; the line under them counts the rest.
  await expect(open.getByTestId("more-count")).toContainText(`${openTotal - 3} more open tenders like these`);
  await expect(open.getByTestId("more-count").getByRole("link")).toHaveAttribute("href", CLAIM);
  // The call to action after the tenders.
  await expect(page.getByTestId("free-check-cta")).toHaveText("Get a free cited bid check");
  await expect(page.getByTestId("free-check-cta")).toHaveAttribute("href", "/free-bid-check");
  await expect(open.getByRole("link", { name: "See a sample check" })).toHaveAttribute("href", "/sample-check");

  // "Your contract wins": both awards, each with its notice number linking to the notice.
  const wins = page.getByTestId("contracts-table");
  await expect(wins.locator("tbody tr")).toHaveCount(2);
  await expect(wins).toContainText("Leeds City Council");
  await expect(wins).toContainText("£120,000");
  await expect(wins.locator("tbody").getByTestId("source-link")).toHaveCount(2);
  await expect(wins.locator("tbody").getByTestId("source-link").first()).toHaveAttribute("href", NOTICE);

  // "Rival contracts ending soon" and "Buyers in your trade": company-level data only.
  const rivals = page.locator("section[aria-labelledby='rivals']");
  await expect(rivals.getByTestId("ending-row")).toHaveCount(3);
  await expect(rivals).toContainText("Rival Landscapes Ltd");
  // A possible sole trader is never named.
  await expect(rivals).toContainText("Supplier named in the notice");
  await expect(page.locator("main")).not.toContainText("John Smith");
  const buyers = page.locator("section[aria-labelledby='buyers']");
  await expect(buyers.getByTestId("buyer-row").first()).toBeVisible();
  await expect(buyers).toContainText("Leeds City Council");
  await expect(buyers).toContainText("Went to small firms");

  // "Where this comes from", with its three links.
  const attribution = page.getByTestId("data-attribution");
  await expect(attribution).toContainText("Where this comes from.");
  await expect(attribution).toContainText(OGL);
  await expect(attribution).toContainText(INDEPENDENCE);
  await expect(attribution.getByRole("link", { name: "Flag a mistake" })).toHaveAttribute("href", "/flag-a-mistake?page=%2Fsuppliers%2Facme-grounds-ltd-01111111");
  await expect(attribution.getByRole("link", { name: "Data sources" })).toHaveAttribute("href", "/about-the-data");
  await expect(attribution.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/legal/privacy");

  // No personal data anywhere in the HTML: no e-mail address, no telephone number. (A supplier
  // page ends with "Where this comes from"; the operator's own contact line is on Find, Claim,
  // About the data and Flag a mistake.)
  const html = await page.content();
  expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.(example|com|co\.uk)/);
  expect(html).not.toContain("acmegrounds.example");
  expect(html).not.toMatch(/tel:/);
  // No tracking: no cookies for an anonymous visitor.
  expect(await page.context().cookies()).toEqual([]);

  await expectNoHorizontalScroll(page);
  await shot(page, "supplier-1280");
  // The phone a cold e-mail is opened on: the claim button is on the first screen, and nothing scrolls sideways.
  for (const width of [768, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Acme Grounds Ltd" })).toBeVisible();
    await expect(page.getByTestId("claim-cta")).toBeInViewport();
    await expectNoHorizontalScroll(page);
    await shot(page, `supplier-${width}`);
  }
  // On a phone the list of wins is the rows of one card, not a table that scrolls away.
  await expect(wins.locator("table")).toBeHidden();
  await expect(wins.getByRole("list").getByRole("listitem")).toHaveCount(2);
});

test("supplier page states: one award and no matches; more contracts than a page; pages we do not publish", async ({ page, request }) => {
  // A company with a single award and no open tender in its trade.
  await page.goto("/suppliers/harbour-catering-ltd-07777777");
  await expect(page.getByRole("heading", { level: 1, name: "Harbour Catering Ltd" })).toBeVisible();
  await expect(page.locator("dl[aria-label='Summary'] dd").first()).toHaveText("1");
  await expect(page.locator("dl[aria-label='Summary']")).toContainText("public contract won since");
  const open = page.locator("section[aria-labelledby='open-tenders']");
  await expect(open).toContainText("No open tenders match your past work right now");
  await expect(open).toContainText("One published contract says little about the work a company does");
  await expect(open.getByRole("link", { name: "Claim this page" })).toHaveAttribute("href", "/claim/harbour-catering-ltd-07777777");
  await expect(open.getByTestId("tender-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Your contract win" })).toBeVisible();
  await expect(page.getByTestId("contracts-table").locator("tbody tr")).toHaveCount(1);
  await expectFitsSmallScreens(page, "one-award supplier page");

  // A hundred and twenty contracts: six shown, "Show all" opens them fifty to a page. All of it works as plain links.
  await page.goto("/suppliers/avon-cleaning-services-ltd-08888888");
  await expect(page.locator("dl[aria-label='Summary'] dd").first()).toHaveText("120");
  const wins = page.getByTestId("contracts-table");
  await expect(wins.locator("tbody tr")).toHaveCount(6);
  await expect(page.getByTestId("wins-show-all")).toHaveText("Show all 120 contracts");
  await page.getByTestId("wins-show-all").click();
  await expect(page).toHaveURL(/\/suppliers\/avon-cleaning-services-ltd-08888888\?wins=all#wins$/);
  await expect(wins.locator("tbody tr")).toHaveCount(50);
  await expect(wins).toContainText("Page 1 of 3");
  await wins.getByRole("link", { name: "Go to next page" }).click();
  await expect(page).toHaveURL(/\?wins=2#wins$/);
  await expect(wins.locator("tbody tr")).toHaveCount(50);
  await expect(wins).toContainText("Page 2 of 3");
  await wins.getByRole("link", { name: "Go to next page" }).click();
  await expect(page).toHaveURL(/\?wins=3#wins$/);
  await expect(wins.locator("tbody tr")).toHaveCount(20);
  await expect(wins).toContainText("Page 3 of 3");
  // A page number past the end (an old link) shows the last page, not an empty one.
  await page.goto("/suppliers/avon-cleaning-services-ltd-08888888?wins=9");
  await expect(wins.locator("tbody tr")).toHaveCount(20);
  await expect(wins).toContainText("Page 3 of 3");
  await expectFitsSmallScreens(page, "all contracts");

  // A possible sole trader has no page and cannot be found; an unknown address is a 404.
  expect((await (await request.get("/api/procurement/search?q=john%20smith")).json()).results).toEqual([]);
  expect((await request.get("/suppliers/no-such-company-00000000")).status()).toBe(404);
  expect((await request.get("/claim/no-such-company-00000000")).status()).toBe(404);
});

test("tender and buyer pages: the facts, the way to the official notice, where it comes from", async ({ page, request }) => {
  await page.goto(SUPPLIER);
  const first = page.locator("section[aria-labelledby='open-tenders']").getByTestId("tender-card").first();
  const ocid = (await first.getAttribute("data-ocid"))!;
  const title = (await first.locator("h3").textContent())!.trim();
  await first.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/tenders/${ocid}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  // Tender pages are indexable; they say what kind of notice it is and who the buyer is.
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);
  await expect(page.getByTestId("tender-detail")).toContainText("Tender notice");
  await expect(page.getByTestId("tender-detail").locator("header")).toContainText(/Leeds City Council|City of York Council/);
  // The card of dates, facts and actions.
  const side = page.getByTestId("tender-side");
  await expect(side.getByTestId("deadline")).toHaveAttribute("data-state", "open");
  await expect(side).toContainText("Closes");
  await expect(side).toContainText("Estimated value");
  await expect(side).toContainText("excluding VAT");
  await expect(side).toContainText("Not divided into lots");
  // A visitor starts a bid check by way of sign-up; "Save" leads there too.
  await expect(page.getByTestId("start-bid-check")).toHaveAttribute("href", `/sign-up?next=${encodeURIComponent(`/app/bids/new?tender=${ocid}`)}`);
  await expect(side.getByRole("link", { name: "Save" })).toHaveAttribute("href", `/sign-up?next=${encodeURIComponent(`/app/tenders/${ocid}`)}`);
  // The official notice: always there, never behind anything.
  await expect(side.getByTestId("source-link")).toHaveAttribute("href", NOTICE);
  await expect(side.getByTestId("source-link")).toContainText("Open the official notice on Find a Tender");
  await expect(side).toContainText("Always free.");
  await expect(page.getByRole("heading", { level: 2, name: "The buyer’s description" })).toBeVisible();
  // Nothing about the reader's own record for a visitor.
  await expect(page.getByTestId("why-matches")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Could you win this?" })).toBeVisible();
  await expect(page.getByTestId("data-attribution")).toContainText(OGL);
  await expectFitsSmallScreens(page, "tender page");
  await shot(page, "tender-1280");

  // A notice that gives no value says so in words.
  await page.goto("/tenders/ocds-h6vhtk-e00004");
  await expect(page.getByTestId("tender-side")).toContainText("Value not published");

  // The buyer's page, reached from the tender.
  await page.getByTestId("tender-detail").locator("header").getByRole("link").click();
  await expect(page).toHaveURL(/\/buyers\/(leeds-city-council|city-of-york-council)-/);
  await page.goto((await page.getByRole("heading", { level: 1 }).textContent())?.includes("Leeds") ? page.url() : SUPPLIER);
  if (!page.url().includes("/buyers/")) await page.locator("section[aria-labelledby='buyers']").getByRole("link", { name: "Leeds City Council" }).first().click();
  await expect(page).toHaveURL(/\/buyers\/leeds-city-council-/);
  await expect(page.getByRole("heading", { level: 1, name: "Leeds City Council" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator("section[aria-labelledby='open-tenders']").getByTestId("tender-card").first()).toBeVisible();
  await expect(page.getByTestId("contracts-table")).toContainText("Acme Grounds Ltd");
  await expect(page.getByTestId("contracts-table")).toContainText("Supplier named in the notice");
  await expect(page.locator("main")).not.toContainText("John Smith");
  await expect(page.getByTestId("data-attribution")).toContainText(INDEPENDENCE);
  await expectFitsSmallScreens(page, "buyer page");

  // "About the data" in the same public style, leading to the form.
  await page.goto("/about-the-data");
  await expect(page.getByRole("heading", { level: 1, name: "About the data" })).toBeVisible();
  await expect(page.locator("main")).toContainText(OGL);
  await expect(page.locator("main")).toContainText(INDEPENDENCE);
  await expect(page.locator("main").getByRole("link", { name: "Flag a mistake" })).toHaveAttribute("href", "/flag-a-mistake");
  await expectFitsSmallScreens(page, "about the data");

  // Sitemaps: tenders are listed, supplier and buyer pages are gated off by default.
  expect(await (await request.get("/sitemap-data.xml")).text()).toContain("/sitemaps/tenders-0.xml");
  expect(await (await request.get("/sitemaps/tenders-0.xml")).text()).toContain("/tenders/ocds-h6vhtk-e00000");
  expect((await request.get("/sitemaps/suppliers-0.xml")).status()).toBe(404);
  expect(await (await request.get("/robots.txt")).text()).toContain("/sitemap-data.xml");
  // The ingestion cron is closed without the secret.
  expect((await request.get("/api/cron/ingest")).status()).toBe(401);
});

test("flag a mistake: the page filled in, errors beside the fields, then 'we have your request'", async ({ page }) => {
  await page.goto(SUPPLIER);
  await page.getByTestId("data-attribution").getByRole("link", { name: "Flag a mistake" }).click();
  await expect(page).toHaveURL(/\/flag-a-mistake\?page=%2Fsuppliers%2Facme-grounds-ltd-01111111$/);
  await expect(page.getByRole("heading", { level: 1, name: "Flag a mistake" })).toBeVisible();
  const form = page.getByTestId("flag-form");
  await expect(form.getByTestId("flag-page")).toContainText("/suppliers/acme-grounds-ltd-01111111");
  await expect(page.getByRole("heading", { level: 2, name: "What happens next" })).toBeVisible();
  await expectAlignedControls(page, "flag a mistake");

  // Nothing filled in: every problem is said in words next to its field, and nothing is lost.
  await form.getByLabel("Which contract or detail?").fill("Grounds Maintenance for Parks");
  await form.getByTestId("flag-submit").click();
  await expect(form.getByText("Choose what is wrong.")).toBeVisible();
  await expect(form.getByText("Enter your name.")).toBeVisible();
  await expect(form.getByText("Tick the box to confirm that you work for this company or act for it.")).toBeVisible();
  await expect(form.getByLabel("Which contract or detail?")).toHaveValue("Grounds Maintenance for Parks");

  await form.getByRole("radio", { name: "A contract here is not ours" }).click();
  await form.getByLabel("What should it say?").fill("This contract was awarded to another company with a similar name, not to us.");
  await form.getByLabel("Your name").fill("Dana Director");
  await form.getByLabel("Work email").fill(`director-${run}@acmegrounds.example`);
  await form.getByRole("checkbox", { name: "I work for this company or act for it" }).click();
  await form.getByTestId("flag-submit").click();
  const sent = page.getByTestId("flag-sent");
  await expect(sent).toContainText("Thanks — we have your request");
  await expect(sent).toContainText("Nothing changes on the page until a person has checked it.");
  await expect(sent.getByRole("link", { name: "Back to the page" })).toHaveAttribute("href", "/suppliers/acme-grounds-ltd-01111111");
  await expectFitsSmallScreens(page, "request sent");

  // Without a page in the address the form asks for it.
  await page.goto("/flag-a-mistake");
  await expect(page.getByTestId("flag-form").getByRole("textbox", { name: "Page", exact: true })).toBeEditable();
  await expectFitsSmallScreens(page, "flag a mistake");
});

test("find your company: results, a plain GET without script, then no result → manual set-up through sign-up", async ({ page, browser }) => {
  await page.goto("/find");
  await expect(page.getByRole("heading", { level: 1, name: "Find your company" })).toBeVisible();
  const input = page.getByTestId("company-search-input");
  // The field is ready to type in; the search is a GET form, so Enter is enough.
  await expectFocusRing(input);
  expect(await expectAlignedControls(page, "find")).toBeGreaterThan(0);
  await input.fill("acme grounds");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/find\?q=acme\+grounds$/);
  const results = page.getByTestId("company-result");
  await expect(results).toHaveCount(1);
  await expect(page.getByTestId("company-results")).toContainText("1 company matches “acme grounds”");
  await expect(results.first()).toContainText("Acme Grounds Ltd");
  await expect(results.first()).toContainText("Companies House 01111111");
  await expect(results.first()).toContainText("2 public contracts found");
  await expect(results.first().getByRole("link", { name: /View page/ })).toHaveAttribute("href", SUPPLIER);
  // Keyboard: from the field to "This is my company" with Tab, and on to the claim page with Enter.
  const mine = results.first().getByTestId("company-claim");
  await expect(mine).toHaveAttribute("href", CLAIM);
  await page.getByTestId("company-search-input").focus();
  await tabTo(page, mine);
  await expectFocusRing(mine);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${CLAIM}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Claim this page" })).toBeVisible();

  // By company number, with the leading zero dropped; several results, the closest first with the primary button.
  await page.goto("/find?q=1111111");
  await expect(results).toHaveCount(1);
  await page.goto("/find?q=grounds");
  await expect(results.first().getByTestId("company-claim")).toHaveAttribute("data-variant", "default");
  await expect(page.getByTestId("company-results")).toContainText("Can’t see your company?");
  await expectFitsSmallScreens(page, "find results");
  await shot(page, "find-1280");

  // Without script the results are in the HTML all the same.
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const plainPage = await plain.newPage();
  await plainPage.goto("/find?q=rival");
  await expect(plainPage.getByTestId("company-result")).toContainText("Rival Landscapes Ltd");
  await plain.close();

  // No result: say so, and offer the manual set-up with the name already typed.
  await page.goto("/find?q=Tidewell+Roofing");
  await expect(page.getByTestId("no-result")).toContainText("No company matches “Tidewell Roofing”");
  const manual = page.getByTestId("manual-radar-form");
  await expect(page.getByTestId("manual-radar").getByRole("heading", { name: "Set up a radar manually" })).toBeVisible();
  await expect(manual.getByLabel("Company name")).toHaveValue("Tidewell Roofing");
  // The short list of trades and the twelve UK regions.
  const tradeCount = await manual.locator("fieldset").first().getByRole("checkbox").count();
  expect(tradeCount).toBeGreaterThanOrEqual(12);
  expect(tradeCount).toBeLessThanOrEqual(14);
  await expect(manual.locator("fieldset").nth(1).getByRole("checkbox")).toHaveCount(12);
  await expectAlignedControls(page, "manual set-up");
  await expectFitsSmallScreens(page, "no result");
  await shot(page, "find-no-result-1280");

  // Nothing ticked: the form says what is missing and keeps what was typed.
  await manual.getByLabel("Company name").fill("Tidewell Roofing Ltd");
  await page.getByTestId("manual-radar-submit").click();
  await expect(page.getByTestId("manual-radar-form").getByText("Tick at least one trade.")).toBeVisible();
  await expect(page.getByTestId("manual-radar-form").getByLabel("Company name")).toHaveValue("Tidewell Roofing Ltd");

  await page.getByTestId("manual-radar-form").getByRole("checkbox", { name: "Roofing" }).click();
  await page.getByTestId("manual-radar-form").getByRole("checkbox", { name: "Grounds maintenance" }).click();
  await page.getByTestId("manual-radar-form").getByRole("checkbox", { name: "Yorkshire and the Humber" }).click();
  await page.getByTestId("manual-radar-form").getByLabel("Work email").fill(nora.email);
  await page.getByTestId("manual-radar-submit").click();
  // Signed out: nothing is stored. The selection travels to sign-up in the address it will come back to.
  await expect(page).toHaveURL(/\/sign-up\?redirect=%2Fapp%2Fradar%2Fsetup%3Fname%3DTidewell%2BRoofing%2BLtd%26trade%3Droofing%26trade%3Dgrounds%26region%3DUKE&email=/);
  await expect(page.getByLabel("Work email")).toHaveValue(nora.email);
  await page.getByLabel("Name").fill(nora.name);
  await page.getByLabel("Password").fill(nora.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await followOutboxLink(page, nora.email, "verify-email");

  // After the e-mail is confirmed the set-up page opens with the same choices, and ONE button.
  await expect(page).toHaveURL(/\/app\/radar\/setup\?name=Tidewell\+Roofing\+Ltd&trade=roofing&trade=grounds&region=UKE$/);
  const setup = page.getByTestId("manual-radar-form");
  await expect(setup.getByLabel("Company name")).toHaveValue("Tidewell Roofing Ltd");
  await expect(setup.getByRole("checkbox", { name: "Roofing" })).toBeChecked();
  await expect(setup.getByRole("checkbox", { name: "Grounds maintenance" })).toBeChecked();
  await expect(setup.getByRole("checkbox", { name: "Cleaning" })).not.toBeChecked();
  await expect(setup.getByRole("checkbox", { name: "Yorkshire and the Humber" })).toBeChecked();
  await expect(setup.getByRole("button")).toHaveCount(1);
  await expect(setup.getByRole("button")).toHaveText("Set up my radar");
  await expect(setup.getByLabel("Work email")).toHaveCount(0);
  await expectAlignedControls(page, "set-up page");
  await expectFitsSmallScreens(page, "set-up page");

  // Opening the page created nothing: the radar is still the empty start.
  const setupUrl = page.url();
  await page.goto("/app");
  await expect(page.getByTestId("radar-onboarding")).toBeVisible();
  await expect(page.getByTestId("tender-card")).toHaveCount(0);
  await expectFitsSmallScreens(page, "radar start");

  await page.goto(setupUrl);
  await page.getByTestId("manual-radar-submit").click();
  await expect(page).toHaveURL(/\/app\?profile=r%3A/);
  // The new radar opens on its first-run guide, with what it matches on and its first matches.
  const guide = page.getByTestId("first-run");
  await expect(guide.getByRole("heading", { level: 1 })).toHaveText("Your radar is set up.");
  await expect(guide).toContainText("Tidewell Roofing Ltd");
  await expect(guide.getByRole("list", { name: "Trades" })).toContainText("Grounds maintenance");
  await expect(guide.getByRole("list", { name: "Regions" })).toContainText("Yorkshire and the Humber");
  await expect(guide.getByTestId("tender-card").first()).toContainText("Your trade:");
  await expectFitsSmallScreens(page, "manual first run");

  // In-app "Find your company" finds companies without a public page too, and leads to the claim.
  await page.goto("/app/radar/find?q=rival");
  await expect(page.getByTestId("company-result")).toContainText("Rival Landscapes Ltd");
  await page.goto("/app/radar/find?q=john+smith+gardening");
  await expect(page.getByTestId("company-result")).toContainText("No public page for this supplier.");
  // A second radar is over the Free plan's limit: said plainly, with the way on.
  await page.goto("/claim/rival-landscapes-ltd-02222222");
  await expect(page.getByTestId("claim-limit")).toContainText("Your plan includes 1 radar");
  await expect(page.getByTestId("claim-confirm")).toHaveCount(0);
});

test("claim → first-run radar → all matches → save, dismiss and undo → filter → the Free cap → tabs → tender", async ({ page }) => {
  await page.goto(SUPPLIER);
  await page.getByTestId("claim-cta").click();
  await expect(page).toHaveURL(new RegExp(`${CLAIM}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Claim this page" })).toBeVisible();
  // The company being claimed, and what claiming gives.
  await expect(page.getByTestId("claim-company")).toContainText("Acme Grounds Ltd");
  await expect(page.getByTestId("claim-company").locator("dd")).toHaveText(["2", "£200k", "2"]);
  await expect(page.getByTestId("claim-company").getByRole("link", { name: "View the page" })).toHaveAttribute("href", SUPPLIER);
  const benefits = page.locator("section[aria-labelledby='claim-free-h']");
  await expect(benefits.getByRole("listitem")).toHaveText(["Ask us to correct or hide details on your page", "Your radar, with your top 10 matches", "A weekly digest by email", "1 cited bid check"]);

  // Signed out: the account form in place — the product's own sign-up form, with the tick.
  const signUp = page.getByTestId("claim-sign-up");
  await expect(signUp.getByRole("heading", { level: 2, name: "Your details" })).toBeVisible();
  await expect(signUp).toContainText("We send a confirmation link to this address. Your radar opens once you confirm it.");
  await expect(signUp.getByRole("link", { name: "This is not my company" })).toHaveAttribute("href", "/find");
  await expect(signUp.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/sign-in?redirect=${encodeURIComponent(CLAIM)}`);
  await expectAlignedControls(page, "claim");
  await expectFitsSmallScreens(page, "claim, signed out");
  await shot(page, "claim-1280");
  // Its own validation, and the tick it adds.
  await signUp.getByRole("button", { name: "Create account and claim" }).click();
  await expect(signUp.getByRole("alert").first()).toBeVisible();
  await signUp.getByLabel("Your name").fill(alex.name);
  await signUp.getByLabel("Work email").fill(alex.email);
  await signUp.getByLabel("Password").fill(alex.password);
  await signUp.getByRole("button", { name: "Create account and claim" }).click();
  await expect(signUp.getByText("Tick the box to confirm that you are authorised to act for this company.")).toBeVisible();
  await signUp.getByTestId("claim-authorised").click();
  await signUp.getByRole("button", { name: "Create account and claim" }).click();
  // "Check your inbox", then back to this page once the address is confirmed. Nothing is claimed yet.
  await expect(page).toHaveURL(/\/verify-email/);
  await followOutboxLink(page, alex.email, "verify-email");
  await expect(page).toHaveURL(new RegExp(`${CLAIM}\\?authorised=1$`));

  // Signed in: one tick (remembered from the form) and one button. By keyboard.
  const confirm = page.getByTestId("claim-form");
  await expect(confirm.getByRole("heading", { level: 2 })).toHaveText(`Signed in as ${alex.name}`);
  await expect(confirm).toContainText(alex.email);
  const tick = confirm.getByTestId("claim-authorised");
  await expect(tick).toBeChecked();
  await tick.focus();
  await expectFocusRing(tick);
  // Unticked, the button refuses and says why; nothing is linked.
  await page.keyboard.press("Space");
  await expect(tick).not.toBeChecked();
  await page.keyboard.press("Tab");
  await expectFocusRing(page.getByTestId("claim-confirm"));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${CLAIM}\\?confirm=missing$`));
  await expect(page.getByTestId("claim-form").getByRole("alert")).toContainText("Tick the box to confirm that you are authorised to act for this company.");
  await expectFitsSmallScreens(page, "claim, signed in");
  await shot(page, "claim-signed-in-1280");
  await page.getByTestId("claim-authorised").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  // The radar opens on the first-run guide.
  await expect(page).toHaveURL(/\/app\?claimed=1&profile=s%3A/);
  const guide = page.getByTestId("first-run");
  await expect(guide.getByRole("heading", { level: 1 })).toHaveText("Your page is claimed.");
  await expect(guide).toContainText("Acme Grounds Ltd");
  await expect(guide).toContainText("/suppliers/acme-grounds-ltd-01111111");
  await expect(guide.getByRole("heading", { level: 2, name: "Three things to do first" })).toBeVisible();
  await expect(guide.locator("[data-slot='numbered-card'] h3")).toHaveText(["Check your trades and regions", "Add your company documents", "Run your free cited bid check"]);
  await expect(guide.getByRole("link", { name: "Go to Documents" })).toHaveAttribute("href", "/app/library");
  await expect(guide.getByRole("link", { name: "Start a bid check" }).first()).toHaveAttribute("href", "/app/bids/new");
  await expect(guide).toContainText(`Your weekly digest goes to ${alex.email}.`);
  await expect(guide.getByRole("link", { name: "Change" })).toHaveAttribute("href", "/app/settings/notifications");
  await expect(guide.getByRole("heading", { level: 2, name: "Your first matches" })).toBeVisible();
  await expect(guide.getByTestId("tender-card")).toHaveCount(3);
  await expect(guide.getByTestId("first-run-all")).toHaveText(/^See all \d+ matches$/);
  // Every count below follows from this one. The seed holds more matches than the Free plan lists (10) and previews (2).
  const total = await numberIn(guide.getByTestId("first-run-all"));
  expect(total, "more matches than the Free plan shows and previews").toBeGreaterThan(12);
  await expectNoHorizontalScroll(page);
  await expectFitsSmallScreens(page, "first run");
  await shot(page, "first-run-1280");

  // "See all N matches": the radar itself.
  await guide.getByTestId("first-run-all").click();
  await expect(page).toHaveURL(/\/app\?tab=matches/);
  const radar = page.getByTestId("radar");
  await expect(radar.getByRole("heading", { level: 1, name: "Radar" })).toBeVisible();
  await expect(radar.locator("[data-slot='meta-line']")).toContainText(/Radar · updated \d{1,2} \w{3} \d{4}/);
  await expect(page.getByTestId("matching-on")).toContainText("Matching on");
  await expect(page.getByTestId("matching-on")).toContainText("Yorkshire and the Humber");
  // Tabs are links with counts; the current one is marked by NavLink.
  const tabs = page.getByTestId("radar-tabs");
  await expect(tabs.getByRole("link")).toHaveText([new RegExp(`^Matches\\s*${total}$`), /Ending soon\s*\d+/, /Buyers\s*\d+/, /Early signals\s*\d+/]);
  await expect(page.getByTestId("tab-matches")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("tab-ending")).not.toHaveAttribute("aria-current", "page");

  // Free plan: the ten best in full, soonest deadline first…
  const cards = page.getByTestId("radar-list").getByTestId("tender-card");
  await expect(cards).toHaveCount(10);
  await expect(page.getByTestId("filter-bar")).toContainText("Sorted by soonest deadline");
  const days = await cards.locator("[data-testid='deadline']:visible").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-days"))));
  expect([...days].sort((a, b) => a - b)).toEqual(days);
  await expect(cards.first().getByRole("link", { name: "Start a bid check" })).toHaveAttribute("href", /^\/app\/bids\/new\?tender=ocds-h6vhtk-e\d{5}$/);
  await expect(cards.first().getByTestId("match-reasons")).toContainText("You have won 1 contract from this buyer");
  // …then the band, and two locked rows that give a place and a date and nothing to click.
  const cap = page.getByTestId("free-cap");
  await expect(cap).toContainText(`${total - 10} more matches are waiting`);
  await expect(cap).toContainText("The free radar shows your top 10 matches.");
  // Wider matches (another region, a neighbouring trade) are counted for the upgrade, never listed on Free.
  await expect(cap).toContainText(/with \d+ wider match(es)? from neighbouring categories and other regions/);
  await expect(page.getByTestId("upgrade-cta")).toHaveAttribute("href", "/pricing");
  const locked = page.getByTestId("locked-matches");
  await expect(locked.locator("[data-slot='locked-row']")).toHaveCount(2);
  await expect(locked.locator("[data-slot='locked-row']").first()).toContainText("Match 11");
  await expect(locked.locator("[data-slot='locked-row']").first()).toContainText("Closes");
  // The rest are only counted: "Match 13 is…", "Matches 13 and 14 are…" or "Matches 13 to N are waiting too."
  await expect(locked).toContainText(/Match(es)? 13\b.* waiting too\./);
  await expect(locked).toContainText(String(total));
  await expect(locked.getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("data-attribution")).toContainText(OGL);
  await expectNoHorizontalScroll(page);
  await expectAlignedControls(page, "radar");
  await shot(page, "radar-1280");

  // Keyboard, on a freshly loaded page: the first Tab stop is the skip link, and it leads into the page.
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");

  // Save the first tender: the button turns at once, and its deadline joins the strip at the top.
  const firstTitle = (await cards.first().locator("h3 a").textContent())!.trim();
  const save = cards.first().getByTestId("save-toggle");
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await tabTo(page, save, 60);
  await expectFocusRing(save);
  await page.keyboard.press("Space");
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).toHaveText("Saved");
  const strip = page.getByTestId("deadline-strip");
  await expect(strip).toContainText("Upcoming deadlines");
  await expect(strip).toContainText("1 saved tender");
  await expect(strip).toContainText(firstTitle);
  await expect(page.getByTestId("tab-saved")).toContainText("1");

  // Dismiss the second: its place says so and offers Undo, which has the focus; Undo puts it back.
  const secondOcid = (await cards.nth(1).getAttribute("data-ocid"))!;
  await cards.nth(1).getByTestId("dismiss").click();
  const dismissed = page.getByTestId("dismissed-row");
  await expect(dismissed).toContainText("Dismissed:");
  await expect(dismissed.getByRole("button", { name: /Undo/ })).toBeFocused();
  await expect(page.locator(`[data-testid="tender-card"][data-ocid="${secondOcid}"]`)).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dismissed-row")).toHaveCount(0);
  await expect(page.locator(`[data-testid="tender-card"][data-ocid="${secondOcid}"]`)).toHaveCount(1);
  // A saved tender that is dismissed and brought back is still saved.
  await cards.first().getByTestId("dismiss").click();
  await page.getByTestId("dismissed-row").getByRole("button", { name: /Undo/ }).click();
  await expect(page.getByTestId("dismissed-row")).toHaveCount(0);
  await expect(cards.first().locator("h3 a")).toHaveText(firstTitle);
  await expect(cards.first().getByTestId("save-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("tab-saved")).toContainText("1");
  // Dismissed for good, it leaves the count as well.
  await page.locator(`[data-testid="tender-card"][data-ocid="${secondOcid}"]`).getByTestId("dismiss").click();
  await expect(page.getByTestId("dismissed-row")).toBeVisible();
  await page.reload();
  expect(await numberIn(page.getByTestId("tab-matches"))).toBe(total - 1);
  await expect(page.getByTestId("free-cap")).toContainText(`${total - 11} more matches are waiting`);

  // Filters are links: the choice lives in the address, shows as a chip, and "Clear" removes it.
  await page.getByTestId("filter-bar").getByRole("button", { name: "Closing within" }).click();
  await page.getByRole("menuitem", { name: "14 days" }).click();
  await expect(page).toHaveURL(/closing=14/);
  const applied = page.getByTestId("applied-filters");
  await expect(applied).toContainText("Closing within: 14 days");
  const narrowed = await page.getByTestId("radar-list").getByTestId("tender-card").count();
  expect(narrowed).toBeGreaterThan(0);
  expect(narrowed).toBeLessThan(10);
  for (const value of await page.getByTestId("radar-list").locator("[data-testid='deadline']:visible").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-days"))))) expect(value).toBeLessThanOrEqual(14);
  // The tab still counts everything; the filter is not carried to a tab that does not offer it.
  expect(await numberIn(page.getByTestId("tab-matches"))).toBe(total - 1);
  await expect(page.getByTestId("tab-buyers")).not.toHaveAttribute("href", /closing=/);
  await applied.getByRole("link", { name: /Clear/ }).click();
  await expect(page).not.toHaveURL(/closing=/);
  await expect(page.getByTestId("applied-filters")).toHaveCount(0);
  // A filter that leaves nothing: said in words, with the way back.
  await page.goto("/app?tab=matches&region=UKN&value=large");
  await expect(page.getByTestId("filtered-empty")).toContainText("Nothing in your matches fits these filters");
  await expect(page.getByTestId("applied-filters")).toContainText("Region: Northern Ireland");
  await page.getByTestId("filtered-empty").getByRole("link", { name: "Clear the filters" }).click();
  await expect(page.getByTestId("radar-list").getByTestId("tender-card").first()).toBeVisible();
  // Wider matches are counted, never listed, on the Free plan — whatever the address asks for.
  await page.goto("/app?tab=matches&wider=1&page=2");
  await expect(page.getByTestId("radar-list").getByTestId("tender-card")).toHaveCount(10);
  await expect(page.locator("[data-testid='tender-card'][data-tier='wider']")).toHaveCount(0);
  await expect(page.getByTestId("wider-toggle")).toHaveCount(0);

  // The other tabs carry the same company's data.
  await page.getByTestId("tab-ending").click();
  await expect(page).toHaveURL(/tab=ending/);
  await expect(page.getByTestId("tab-ending")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("ending-row").first()).toBeVisible();
  await expect(page.getByTestId("ending-list")).toContainText("Rival Landscapes Ltd");
  await expect(page.getByTestId("filter-bar")).toContainText("Sorted by soonest end date");
  await expect(page.getByTestId("deadline-strip")).toHaveCount(0);
  await page.getByTestId("tab-buyers").click();
  await expect(page.getByTestId("buyer-row").first()).toContainText(/Council/);
  await expect(page.getByTestId("buyers-list")).toContainText("Contracts you have won from them");
  await page.getByTestId("filter-bar").getByRole("button", { name: /Sorted by awards in your trade/ }).click();
  await page.getByRole("menuitem", { name: "Open tenders" }).click();
  await expect(page).toHaveURL(/sort=open/);
  await page.getByTestId("tab-signals").click();
  await expect(page.getByTestId("radar-list").getByTestId("tender-card")).toHaveCount(await numberIn(page.getByTestId("tab-signals")));
  await expect(page.getByTestId("radar-list")).toContainText("Grounds Maintenance Market Engagement");
  await expect(page.getByTestId("radar-list")).toContainText("Expected to be published");
  await page.getByTestId("tab-saved").click();
  await expect(page.getByTestId("saved-list").getByTestId("tender-card")).toHaveCount(1);
  await expect(page.getByTestId("saved-list")).toContainText(firstTitle);

  // "Edit" opens the trades and regions over the radar; the count follows the ticks before anything is saved.
  await page.goto("/app?tab=matches");
  await page.locator("[data-testid='radar-edit-open']:visible").first().click();
  const panel = page.getByRole("dialog", { name: "Trades and regions" });
  await expect(panel.getByTestId("edit-count")).toHaveText(`${total - 1} open tenders match these choices`);
  await expect(panel.getByTestId("edit-trades").getByRole("checkbox").first()).toBeChecked();
  await expect(panel.getByTestId("edit-trades")).toContainText("From your contract wins");
  await expect(panel.getByTestId("edit-regions").getByRole("checkbox")).toHaveCount(12);
  // One more region: the tender there (a wider match until now) joins the count.
  await panel.getByRole("checkbox", { name: "South West" }).click();
  await expect(panel.getByTestId("edit-count")).not.toHaveText(`${total - 1} open tenders match these choices`);
  const widened = await numberIn(panel.getByTestId("edit-count"));
  expect(widened).toBeGreaterThan(total - 1);
  // Escape closes it without saving and hands the focus back to "Edit".
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.locator("[data-testid='radar-edit-open']:visible").first()).toBeFocused();
  expect(await numberIn(page.getByTestId("tab-matches"))).toBe(total - 1);
  // Saved, the radar under it follows: the tender in the South West is now a match.
  await page.locator("[data-testid='radar-edit-open']:visible").first().click();
  await panel.getByRole("checkbox", { name: "South West" }).click();
  await panel.getByTestId("radar-edit-save").click();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId("tab-matches")).toHaveText(new RegExp(`^Matches\\s*${widened}$`));
  await expect(page.getByTestId("matching-on")).toContainText("South West");
  // On a phone the same form is a page of its own, reached by the same link.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-testid='radar-edit-open']:visible").first().click();
  await expect(page).toHaveURL(/\/app\/radar\/setup\?source=s%3A/);
  await expect(page.getByRole("heading", { level: 1, name: "Trades and regions" })).toBeVisible();
  await expect(page.getByTestId("radar-edit-form").getByRole("checkbox", { name: "South West" })).toBeChecked();
  await expectNoHorizontalScroll(page);
  await expectAlignedControls(page, "edit page");
  await page.setViewportSize({ width: 1280, height: 720 });

  // The tender inside the app: why it matches, who won similar work, Save with its real state.
  await page.goto("/app?tab=saved");
  await page.getByTestId("saved-list").getByRole("link", { name: firstTitle }).click();
  await expect(page).toHaveURL(/\/app\/tenders\/ocds-h6vhtk-e\d{5}$/);
  const ocid = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstTitle);
  await expect(page.getByTestId("start-bid-check")).toHaveAttribute("href", `/app/bids/new?tender=${ocid}`);
  await expect(page.getByTestId("tender-side").getByTestId("save-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("tender-side").getByTestId("source-link")).toHaveAttribute("href", NOTICE);
  const why = page.getByTestId("why-matches");
  await expect(why.getByRole("heading", { level: 2, name: "Why this matches you" })).toBeVisible();
  await expect(why).toContainText("You have won 1 contract from this buyer");
  await expect(why).toContainText("Same work as 2 of your wins");
  await expect(why).toContainText("One of your regions");
  const similar = page.getByTestId("similar-awards");
  await expect(similar.getByRole("heading", { level: 2, name: "Who won similar work from this buyer" })).toBeVisible();
  await expect(similar.locator("tbody tr").first()).toBeVisible();
  // The reader's own company is marked; a possible sole trader is not named here either.
  await expect(similar).toContainText("You");
  await expect(similar).not.toContainText("John Smith");
  await expectFitsSmallScreens(page, "tender in the app");
  await shot(page, "tender-signed-in-1280");

  // The public page now knows this viewer has claimed it.
  await page.goto(SUPPLIER);
  await expect(page.getByTestId("claimed-card")).toContainText("This page is on your radar");
  await expect(page.getByTestId("open-radar")).toHaveAttribute("href", "/app");
  await expect(page.getByTestId("claim-cta")).toHaveCount(0);
  await expect(page.locator("section[aria-labelledby='open-tenders']").getByRole("link", { name: "Start a bid check" }).first()).toHaveAttribute("href", /^\/app\/bids\/new\?tender=/);
  // Claiming again is a no-op with a clear message; a second company is over the Free plan's limit.
  await page.goto(CLAIM);
  await expect(page.getByTestId("claim-already")).toContainText("This company is already on your radar");
  await page.goto("/claim/rival-landscapes-ltd-02222222");
  await expect(page.getByTestId("claim-limit")).toContainText("Your plan includes 1 radar");
  await expect(page.getByTestId("claim-limit").getByRole("link", { name: /See Radar Pro/ })).toHaveAttribute("href", "/pricing");
  await expectFitsSmallScreens(page, "claim limit");

  // The guide comes back on the bare radar until it is hidden — for the workspace, for good.
  await page.goto("/app");
  await expect(page.getByTestId("first-run")).toBeVisible();
  // Step 1 is done: the trades and regions were saved.
  await expect(page.getByTestId("first-run").locator("[data-slot='numbered-card']").first()).toContainText("Done");
  await page.getByTestId("first-run-dismiss").click();
  await expect(page).toHaveURL(/\/app\?tab=matches/);
  await page.goto("/app");
  await expect(page.getByTestId("first-run")).toHaveCount(0);
  await expect(page.getByTestId("radar-list").getByTestId("tender-card")).toHaveCount(10);

  // Tablet and phone widths: every tab, the claim page and the tender.
  for (const width of [768, 390, 360]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/app?tab=matches", "/app?tab=ending", "/app?tab=buyers", "/app?tab=signals", "/app?tab=saved", `/app/tenders/${ocid}`, "/app/radar/find?q=grounds"]) {
      await page.goto(path);
      // The page itself, not its loading skeleton (which has no heading).
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page, path);
    }
    await page.goto("/app?tab=matches");
    await expect(page.getByTestId("radar-list").getByTestId("tender-card").first()).toBeVisible();
    await shot(page, `radar-${width}`);
  }
  // On a phone the row of tabs scrolls sideways, and the current tab is brought into view.
  await page.goto("/app?tab=signals");
  await expect(page.getByTestId("tab-signals")).toHaveAttribute("aria-current", "page");
  await expect
    .poll(async () => {
      const box = await page.getByTestId("tab-signals").boundingBox();
      return box !== null && box.x >= 0 && box.x + box.width <= 360;
    }, { message: "the current tab is inside the 360 px screen" })
    .toBe(true);
  // A line of reasons that runs off a phone card is a Tab stop, so the keyboard can scroll it — and only while it runs off.
  await page.goto("/app?tab=matches");
  const reasons = page.getByTestId("radar-list").getByTestId("match-reasons").first();
  await expect(reasons).toHaveAttribute("tabindex", "0");
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(reasons).not.toHaveAttribute("tabindex");
});
