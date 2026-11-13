import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const base = process.argv[2] || 'https://bidfolio.co.uk';
const pages = (process.argv[3] || '/,/sign-up,/pricing').split(',');
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
for (const [w, tag] of [[390, 'm'], [1280, 'd']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 });
  for (const p of pages) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    const r = await page.goto(base + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => null);
    await page.waitForTimeout(500);
    const name = (p === '/' ? 'home' : p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, ''));
    await page.screenshot({ path: `/home/user/qa/prod/${name}-${tag}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(tag, p, r ? r.status() : 'ERR', 'overflow:' + overflow, errs.length ? 'console errors: ' + errs.slice(0, 3).join(' | ') : '');
    await page.close();
  }
  await ctx.close();
}
await b.close();
