// Captures every page the design system owns at 360 × 800, 768 × 1024 and 1280 × 900
// (full page) into docs/design/screens/, and reports horizontal overflow at each width.
//
//   BASE_URL=http://localhost:3121 node scripts/design/screenshots.mjs            all pages
//   BASE_URL=… node scripts/design/screenshots.mjs landing pricing               only these
//   BASE_URL=… OUT_DIR=/tmp/shots WIDTHS=1280 node scripts/design/screenshots.mjs landing
//
// Signed-in pages use the seeded demo owner (pnpm db:seed): demo@example.com.
// Playwright is resolved from PLAYWRIGHT_MODULE (preinstalled copy on this machine) or from
// the project's own @playwright/test.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3121";
const OUT_DIR = resolve(root, process.env.OUT_DIR ?? "docs/design/screens");
const DEMO = { email: process.env.DEMO_EMAIL ?? "demo@example.com", password: process.env.DEMO_PASSWORD ?? "demo-password-123" };

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "@playwright/test");

const viewports = [
  { name: "360", width: 360, height: 800 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
].filter((viewport) => !process.env.WIDTHS || process.env.WIDTHS.split(",").includes(viewport.name));

/** name → path, whether it needs the demo session, and an optional step to put the page in a state. */
const pages = [
  { name: "landing", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "pricing-annual", path: "/pricing", prepare: (page) => page.getByTestId("interval-year").click() },
  { name: "free-bid-check", path: "/free-bid-check" },
  { name: "contact", path: "/contact" },
  { name: "legal-terms", path: "/legal/terms" },
  { name: "legal-privacy", path: "/legal/privacy" },
  { name: "legal-refunds", path: "/legal/refunds" },
  { name: "legal-dpa", path: "/legal/dpa" },
  { name: "legal-acceptable-use", path: "/legal/acceptable-use" },
  { name: "sign-up", path: "/sign-up" },
  {
    name: "sign-up-errors",
    path: "/sign-up",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Create account" }).click();
      await page.getByText("Enter your name.").waitFor();
    },
  },
  { name: "sign-in", path: "/sign-in" },
  { name: "verify-email", path: "/verify-email?email=olivia%40harlowfinch.example" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "reset-password-invalid", path: "/reset-password" },
  { name: "reset-password", path: "/reset-password?token=sample" },
  { name: "accept-invitation-invalid", path: "/accept-invitation/unknown" },
  { name: "not-found", path: "/this-page-does-not-exist" },
  { name: "maintenance", path: "/maintenance" },
  { name: "styleguide", path: "/styleguide" },
  { name: "app-home", path: "/app", auth: true },
  { name: "app-settings-profile", path: "/app/settings/profile", auth: true },
  { name: "app-settings-workspace", path: "/app/settings/workspace", auth: true },
  { name: "app-settings-members", path: "/app/settings/members", auth: true },
  { name: "app-settings-billing", path: "/app/settings/billing", auth: true },
  { name: "app-usage", path: "/app/usage", auth: true },
  { name: "app-forbidden", path: "/admin", auth: "member" },
  {
    name: "app-account-menu",
    path: "/app",
    auth: true,
    fullPage: false,
    prepare: (page) => page.getByTestId("user-menu").click(),
  },
  {
    name: "app-mobile-menu",
    path: "/app",
    auth: true,
    only: ["360"],
    fullPage: false,
    prepare: (page) => page.getByTestId("app-menu").click(),
  },
  {
    name: "landing-mobile-menu",
    path: "/",
    only: ["360"],
    fullPage: false,
    prepare: (page) => page.getByRole("button", { name: "Open menu" }).click(),
  },
];

const wanted = process.argv.slice(2);
const selected = wanted.length ? pages.filter((page) => wanted.includes(page.name)) : pages;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const problems = [];

async function signIn(context, who) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in`);
  await page.getByLabel("Email").fill(who === "member" ? "teammate@example.com" : DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app/);
  await page.close();
}

for (const viewport of viewports) {
  const contexts = {};
  const contextFor = async (auth) => {
    const key = auth === true ? "owner" : auth || "anonymous";
    if (!contexts[key]) {
      contexts[key] = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      if (auth) await signIn(contexts[key], key);
    }
    return contexts[key];
  };

  for (const entry of selected) {
    if (entry.only && !entry.only.includes(viewport.name)) continue;
    const context = await contextFor(entry.auth);
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}${entry.path}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      if (entry.prepare) await entry.prepare(page);
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${entry.name} @ ${viewport.name}: horizontal overflow of ${overflow}px`);
      const fullPage = entry.fullPage ?? true;
      await page.screenshot({ path: resolve(OUT_DIR, `${entry.name}-${viewport.name}.png`), fullPage });
      console.log(`ok  ${entry.name}-${viewport.name}.png${overflow > 0 ? `  (overflow ${overflow}px)` : ""}`);
    } catch (error) {
      problems.push(`${entry.name} @ ${viewport.name}: ${error.message.split("\n")[0]}`);
      console.log(`ERR ${entry.name} @ ${viewport.name}: ${error.message.split("\n")[0]}`);
    } finally {
      await page.close();
    }
  }
  for (const context of Object.values(contexts)) await context.close();
}

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nAll captures written to ${OUT_DIR}`);
