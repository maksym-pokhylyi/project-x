// Full-page screenshots of a public page at several widths (development helper).
//
//   node scripts/bids/shot-public.mjs <url> <outPrefix> [widths=1440,390]
import { chromium } from "@playwright/test";

const [url, outPrefix, widthsArg] = process.argv.slice(2);
if (!url || !outPrefix) {
  console.error("usage: node scripts/bids/shot-public.mjs <url> <outPrefix> [widths]");
  process.exit(1);
}
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";
const browser = await chromium.launch();
const issues = [];
for (const width of (widthsArg ?? "1440,390").split(",").map(Number)) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(`[${width}] ${message.text().slice(0, 160)}`);
  });
  const response = await page.goto(url);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outPrefix}-${width}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) issues.push(`[${width}] horizontal overflow of ${overflow}px`);
  console.log(`${width}: HTTP ${response?.status()} height ${await page.evaluate(() => document.documentElement.scrollHeight)}px`);
}
await browser.close();
console.log(issues.length ? `issues:\n${issues.join("\n")}` : "no console errors, no horizontal overflow");
