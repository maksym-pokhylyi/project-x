// Captures the procurement screens — the public data pages and Radar — in every state, at
// 390 × 844, 768 × 900 and 1440 × 900 (full page), into docs/design/screens/data/, and reports
// horizontal overflow, failed responses and console errors for each capture.
//
//   BASE_URL=http://localhost:3161 node scripts/design/data-screens.mjs             every state
//   BASE_URL=… node scripts/design/data-screens.mjs supplier tender                 names starting with these
//   BASE_URL=… OUT_DIR=/tmp/shots WIDTHS=360 node scripts/design/data-screens.mjs   another folder, other widths
//
// These pages show published notices, so WHICH records are captured depends on the database at
// hand: set the records below (or SUPPLIER=…, TENDER=… in the environment) to ones that exist.
// Signed-in states need local accounts in the right state, given as "e-mail:password":
//
//   ACCOUNT_RADAR   has claimed SUPPLIER; a few matches, some of them saved; first-run guide not hidden
//   ACCOUNT_CAP     has claimed a company with more than ten matches (the Free plan's cap)
//   ACCOUNT_EMPTY   has claimed a company with no open tender in its trade
//   ACCOUNT_NEW     has no radar yet
//
// States whose account is not given are skipped. Playwright is resolved from PLAYWRIGHT_MODULE
// (preinstalled copy on this machine) or from the project's own @playwright/test.
// Afterwards: python3 scripts/design/optimise-screens.py docs/design/screens/data
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3161";
const OUT_DIR = resolve(root, process.env.OUT_DIR ?? "docs/design/screens/data");
const WIDTHS = (process.env.WIDTHS ?? "390,768,1440").split(",").map(Number);
const only = process.argv.slice(2);

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "@playwright/test");

// Records in the local data set these captures were taken from (all from published notices).
const SUPPLIER = process.env.SUPPLIER ?? "g-baker-roofing-limited-06322092";
const SUPPLIER_ONE_CONTRACT = process.env.SUPPLIER_ONE_CONTRACT ?? "the-roofing-company-north-west-ltd-11828504";
const SUPPLIER_MANY_CONTRACTS = process.env.SUPPLIER_MANY_CONTRACTS ?? "softcat-plc-02174990";
const SEARCH = process.env.SEARCH ?? "baker roofing";
const TENDER = process.env.TENDER ?? "ocds-h6vhtk-06eb2e";
const TENDER_NO_VALUE_TODAY = process.env.TENDER_NO_VALUE_TODAY ?? "ocds-h6vhtk-078ae8";
const TENDER_CLOSED = process.env.TENDER_CLOSED ?? "ocds-h6vhtk-078908";
const TENDER_NO_DEADLINE = process.env.TENDER_NO_DEADLINE ?? "ocds-h6vhtk-06df03";
const TENDER_MANY_LOTS = process.env.TENDER_MANY_LOTS ?? "ocds-h6vhtk-067dd5";
const BUYER = process.env.BUYER ?? "kent-county-council-7990a3de";
const flagPage = `/flag-a-mistake?page=${encodeURIComponent(`/suppliers/${SUPPLIER}`)}`;

/** name → path; `as` the account it needs; `script: false` for a visitor without JavaScript (also shows loading skeletons); `prepare` puts the page in a state. */
const shots = [
  // Public pages, signed out.
  { name: "supplier", path: `/suppliers/${SUPPLIER}` },
  { name: "supplier-one-contract", path: `/suppliers/${SUPPLIER_ONE_CONTRACT}` },
  { name: "supplier-many-contracts", path: `/suppliers/${SUPPLIER_MANY_CONTRACTS}` },
  { name: "supplier-all-contracts", path: `/suppliers/${SUPPLIER_MANY_CONTRACTS}?wins=all` },
  { name: "find-start", path: "/find" },
  { name: "find", path: `/find?q=${encodeURIComponent(SEARCH)}` },
  { name: "find-no-result", path: "/find?q=Tidewell+Roofing" },
  { name: "claim", path: `/claim/${SUPPLIER_ONE_CONTRACT}` },
  { name: "tender", path: `/tenders/${TENDER}` },
  { name: "tender-no-value-closes-today", path: `/tenders/${TENDER_NO_VALUE_TODAY}` },
  { name: "tender-closed", path: `/tenders/${TENDER_CLOSED}` },
  { name: "tender-no-deadline", path: `/tenders/${TENDER_NO_DEADLINE}` },
  { name: "tender-63-lots", path: `/tenders/${TENDER_MANY_LOTS}` },
  { name: "buyer", path: `/buyers/${BUYER}` },
  { name: "flag-a-mistake", path: flagPage },
  {
    name: "flag-a-mistake-errors",
    path: flagPage,
    prepare: async (page) => {
      await page.getByTestId("flag-submit").click();
      await page.getByText("Choose what is wrong.").waitFor();
    },
  },
  {
    // Sends a real request to the local database (five an hour from one address).
    name: "flag-a-mistake-sent",
    path: flagPage,
    prepare: async (page) => {
      const form = page.getByTestId("flag-form");
      await form.getByRole("radio", { name: "A contract here is not ours" }).click();
      await form.getByLabel("Which contract or detail?").fill("Flat Roofing Contract 2026/27");
      await form.getByLabel("What should it say?").fill("This contract was awarded to another company with a similar name, not to us.");
      await form.getByLabel("Your name").fill("Gill Baker");
      await form.getByLabel("Work email").fill("gill@example.test");
      await form.getByRole("checkbox", { name: "I work for this company or act for it" }).click();
      await form.getByTestId("flag-submit").click();
      await page.getByTestId("flag-sent").waitFor();
    },
  },
  { name: "about-the-data", path: "/about-the-data" },
  // Signed in.
  { name: "claim-signed-in", path: `/claim/${SUPPLIER_ONE_CONTRACT}`, as: "NEW" },
  { name: "claim-already-claimed", path: `/claim/${SUPPLIER}`, as: "RADAR" },
  { name: "claim-plan-limit", path: `/claim/${SUPPLIER_ONE_CONTRACT}`, as: "RADAR" },
  { name: "supplier-claimed", path: `/suppliers/${SUPPLIER}`, as: "RADAR" },
  { name: "find-in-app", path: `/app/radar/find?q=${encodeURIComponent(SEARCH)}`, as: "NEW" },
  { name: "radar-start", path: "/app", as: "NEW" },
  { name: "radar-first-run", path: "/app", as: "RADAR" },
  { name: "radar", path: "/app?tab=matches", as: "RADAR" },
  {
    name: "radar-dismissed-undo",
    path: "/app?tab=matches",
    as: "RADAR",
    prepare: async (page) => {
      await page.locator("[data-testid='tender-card']").nth(1).locator("[data-testid='dismiss']:visible").first().click();
      await page.getByTestId("dismissed-row").waitFor();
    },
    // Put the tender back, so the next capture finds the radar as it was.
    restore: async (page) => {
      await page.getByTestId("dismissed-row").getByRole("button", { name: /Undo/ }).click();
      await page.getByTestId("dismissed-row").waitFor({ state: "detached" });
    },
  },
  { name: "radar-filtered", path: "/app?tab=matches&closing=30", as: "RADAR" },
  { name: "radar-filtered-empty", path: "/app?tab=matches&region=UKN&value=large", as: "RADAR" },
  { name: "radar-ending", path: "/app?tab=ending", as: "RADAR" },
  { name: "radar-buyers", path: "/app?tab=buyers", as: "RADAR" },
  { name: "radar-signals", path: "/app?tab=signals", as: "RADAR" },
  { name: "radar-saved", path: "/app?tab=saved", as: "RADAR" },
  {
    // A panel over the radar from 768 px (a picture of the screen); a page of its own on a phone.
    name: "radar-edit",
    path: "/app?tab=matches",
    as: "RADAR",
    screenOnlyFrom: 768,
    prepare: async (page) => {
      await page.locator("[data-testid='radar-edit-open']:visible").first().click();
      await page.getByTestId("radar-edit-form").waitFor();
      await page.getByTestId("edit-count").first().waitFor();
    },
  },
  { name: "radar-free-cap", path: "/app?tab=matches", as: "CAP" },
  { name: "radar-empty", path: "/app?tab=matches", as: "EMPTY" },
  { name: "radar-loading", path: "/app?tab=matches", as: "RADAR", script: false },
  { name: "tender-signed-in", path: `/app/tenders/${TENDER}`, as: "RADAR" },
  { name: "tender-loading", path: `/app/tenders/${TENDER}`, as: "RADAR", script: false },
];

const browser = await chromium.launch();
mkdirSync(OUT_DIR, { recursive: true });

/** Signs each given account in once and keeps its session. */
const sessions = {};
for (const key of ["RADAR", "CAP", "EMPTY", "NEW"]) {
  const account = process.env[`ACCOUNT_${key}`];
  if (!account) continue;
  const [email, password] = [account.slice(0, account.indexOf(":")), account.slice(account.indexOf(":") + 1)];
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel(/e-?mail/i).first().fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL(/\/app/);
  sessions[key] = await context.storageState();
  await context.close();
}

let problems = 0;
let skipped = 0;
for (const width of WIDTHS) {
  for (const shot of shots) {
    if (only.length > 0 && !only.some((prefix) => shot.name.startsWith(prefix))) continue;
    if (shot.as && !sessions[shot.as]) {
      skipped += 1;
      continue;
    }
    const context = await browser.newContext({
      viewport: { width, height: width < 700 ? 844 : 900 },
      deviceScaleFactor: 1,
      javaScriptEnabled: shot.script !== false,
      storageState: shot.as ? sessions[shot.as] : undefined,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text().slice(0, 200)));
    page.on("pageerror", (error) => errors.push(`pageerror: ${String(error).slice(0, 200)}`));
    try {
      const response = await page.goto(BASE_URL + shot.path, { waitUntil: shot.script === false ? "load" : "networkidle", timeout: 90_000 });
      if (shot.script === false) await page.waitForTimeout(1200);
      else {
        await page.evaluate(() => document.fonts.ready);
        // The dev server's own indicator is not part of the page.
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      }
      if (shot.prepare) await shot.prepare(page);
      // No pointer left over a control, and the page at its top (the app bar is sticky).
      await page.mouse.move(0, 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.screenshot({ path: `${OUT_DIR}/${shot.name}-${width}.png`, fullPage: !(shot.screenOnlyFrom && width >= shot.screenOnlyFrom) });
      if (shot.restore) await shot.restore(page);
      const status = response?.status() ?? 0;
      const bad = overflow > 0 || errors.length > 0 || status >= 400;
      if (bad) problems += 1;
      console.log(`${bad ? "!!" : "ok"} ${shot.name}-${width}: status ${status}, overflow ${overflow}px${errors.length ? `, errors ${JSON.stringify(errors)}` : ""}`);
    } catch (error) {
      problems += 1;
      console.log(`!! ${shot.name}-${width}: ${String(error).slice(0, 300)}`);
    }
    await context.close();
  }
}
await browser.close();
if (skipped > 0) console.log(`${skipped} capture(s) skipped: their account (ACCOUNT_RADAR, ACCOUNT_CAP, ACCOUNT_EMPTY or ACCOUNT_NEW) was not given`);
console.log(problems > 0 ? `${problems} capture(s) need a look` : "all captures clean");
process.exit(problems > 0 ? 1 : 0);
