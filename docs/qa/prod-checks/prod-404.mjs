import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/home/user/.secrets/qa-state.json' });
const page = await ctx.newPage();
const seen = new Set();
page.on('response', r => { if (r.status() >= 400) seen.add(r.status() + ' ' + r.request().method() + ' ' + r.url().replace('https://bidfolio.co.uk', '').slice(0, 110) + '  (on ' + page.url().replace('https://bidfolio.co.uk', '') + ')'); });
for (const p of ['/app', '/app/radar/find', '/app/settings/members', '/app/settings/profile', '/app/settings/workspace', '/app/bids', '/app/library', '/app/bids/new', '/sample-check', '/', '/pricing']) {
  await page.goto('https://bidfolio.co.uk' + p, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(300);
}
console.log([...seen].join('\n') || 'no 4xx/5xx');
await b.close();
