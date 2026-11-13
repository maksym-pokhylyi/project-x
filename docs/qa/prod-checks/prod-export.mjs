import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const base = 'https://bidfolio.co.uk'; const id = process.argv[2];
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/home/user/.secrets/qa-state.json' });
for (const kind of ['brief', 'requirements-docx', 'requirements-csv', 'answers']) {
  const r = await ctx.request.get(`${base}/api/bids/${id}/export/${kind}`);
  const buf = await r.body().catch(() => Buffer.alloc(0));
  console.log(kind, r.status(), (r.headers()['content-type'] || '').slice(0, 60), buf.length, 'bytes', r.status() >= 400 ? buf.toString().slice(0, 160) : (r.headers()['content-disposition'] || ''));
  if (r.ok()) writeFileSync(`/home/user/qa/prod/export-${kind}.${kind.includes('csv') ? 'csv' : 'docx'}`, buf);
}
const page = await ctx.newPage();
await page.goto(`${base}/app/bids/${id}`, { waitUntil: 'networkidle' });
console.log('bid page url:', page.url().replace(base, ''));
await page.screenshot({ path: '/home/user/qa/prod/check-3-brief.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.screenshot({ path: '/home/user/qa/prod/check-3-brief-phone.png', fullPage: true });
console.log('phone overflow:', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1));
await b.close();
