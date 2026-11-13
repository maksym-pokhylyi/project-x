import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const base = 'https://bidfolio.co.uk';
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
for (const [w, h] of [[1280, 720], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const start of ['/', '/#questions', '/#how']) {
    await page.goto(base + start, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const before = await page.evaluate(() => Math.round(window.scrollY));
    if (w < 600) { await page.getByRole('button', { name: /menu/i }).first().click(); await page.waitForTimeout(400); }
    const link = w < 600 ? page.getByRole('dialog').getByRole('link', { name: 'Pricing', exact: true }) : page.locator('header').getByRole('link', { name: 'Pricing', exact: true });
    await link.first().click();
    await page.waitForURL(/\/pricing$/, { timeout: 20000 });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => Math.round(window.scrollY));
    console.log(`${w}px  ${start.padEnd(12)} scrolled ${String(before).padStart(5)} -> /pricing scrollY=${after}  ${after === 0 ? 'PASS' : 'FAIL'}`);
  }
  // A section link from another page still lands on its section, under the header.
  await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
  await page.goto(base + '/#questions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const top = await page.evaluate(() => Math.round(document.getElementById('questions')?.getBoundingClientRect().top ?? -1));
  console.log(`${w}px  /#questions: section top at ${top}px from the top of the screen ${top >= 40 && top <= 160 ? 'PASS' : 'CHECK'}`);
  await ctx.close();
}
await b.close();
