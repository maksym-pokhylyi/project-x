// Captures the transactional e-mails as a mail client would show them: at 640 px (the
// artboards' desk width) and 390 px, in light and in dark, into docs/design/screens/.
//
//   node scripts/design/emails.mjs                  all four
//   OUT_DIR=/tmp/shots node scripts/design/emails.mjs verify-email
//
// The HTML comes from scripts/design/render-emails.ts (the real templates with the
// artboards' sample data). No server is needed. Playwright is resolved from
// PLAYWRIGHT_MODULE (preinstalled copy on this machine) or from the project's own.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = resolve(root, process.env.OUT_DIR ?? "docs/design/screens");
const only = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "@playwright/test");

const source = mkdtempSync(join(tmpdir(), "bidfolio-emails-"));
execFileSync("pnpm", ["exec", "tsx", "scripts/design/render-emails.ts", source], { cwd: root, stdio: "inherit" });
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
let problems = 0;
for (const file of readdirSync(source).filter((name) => name.endsWith(".html"))) {
  const name = file.replace(/\.html$/, "");
  if (only.length > 0 && !only.includes(name)) continue;
  for (const width of [640, 390]) {
    for (const scheme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width, height: 700 }, colorScheme: scheme, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(join(source, file)).href);
      // The frame must never be wider than the window, and its text never smaller than 13 px.
      const report = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const small = [...document.querySelectorAll("p, a, td")].filter((element) => element.textContent?.trim() && parseFloat(getComputedStyle(element).fontSize) < 13).length;
        return { overflow, small };
      });
      if (report.overflow > 0 || report.small > 0) {
        problems += 1;
        console.log(`!! ${name} @${width} ${scheme}: overflow ${report.overflow}px, ${report.small} element(s) under 13 px`);
      }
      await page.screenshot({ path: join(OUT_DIR, `email-${name}-${width}${scheme === "dark" ? "-dark" : ""}.png`), fullPage: true });
      await page.close();
    }
  }
  console.log(`captured ${name}`);
}
await browser.close();
if (problems > 0) process.exit(1);
