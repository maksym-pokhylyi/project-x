// Takes screenshots of the bid desk screens for visual review at three widths.
//
//   node scripts/bids/screenshots.mjs <baseUrl> <email> <password> <outDir> [bidId]
//
// Development helper only (uses the preinstalled Playwright Chromium).
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [baseUrl, email, password, outDir, bidArg] = process.argv.slice(2);
if (!baseUrl || !email || !password || !outDir) {
  console.error("usage: node scripts/bids/screenshots.mjs <baseUrl> <email> <password> <outDir> [bidId]");
  process.exit(1);
}
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
for (const width of [1440, 1280, 768, 390]) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 800 : 900 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${width}] ${message.text().slice(0, 200)}`);
  });
  await page.goto(`${baseUrl}/sign-in`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app/);
  await page.goto(`${baseUrl}/app/bids`);
  await page.screenshot({ path: `${outDir}/bids-${width}.png`, fullPage: true });
  let bidId = bidArg;
  if (!bidId) {
    const href = await page.locator('[data-testid="bids-list"] a').first().getAttribute("href");
    bidId = href?.split("/").pop();
  }
  const shots = [
    ["brief", `/app/bids/${bidId}`],
    ["requirements", `/app/bids/${bidId}/requirements`],
    ["questions", `/app/bids/${bidId}/questions`],
    ["files", `/app/bids/${bidId}/files`],
    ["new", "/app/bids/new"],
    ["library", "/app/library"],
  ];
  for (const [name, url] of shots) {
    await page.goto(`${baseUrl}${url}`);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/${name}-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) errors.push(`[${width}] ${name}: horizontal overflow of ${overflow}px`);
  }
  // Citation popover and the answer editor.
  await page.goto(`${baseUrl}/app/bids/${bidId}/requirements`);
  const mark = page.locator('[data-testid="citation-mark"]').first();
  if (await mark.count()) {
    await mark.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/citation-${width}.png` });
    await page.keyboard.press("Escape");
  }
  await page.goto(`${baseUrl}/app/bids/${bidId}/questions`);
  const open = page.locator('[data-testid="question-card"] a').last();
  if (await open.count()) {
    await open.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/editor-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) errors.push(`[${width}] editor: horizontal overflow of ${overflow}px`);
  }
  await context.close();
}
await browser.close();
console.log(errors.length ? `issues:\n${errors.join("\n")}` : "no console errors, no horizontal overflow");
