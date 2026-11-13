import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/home/user/.secrets/qa-state.json' });
const page = await ctx.newPage();
await page.goto((process.argv[2] || 'https://bidfolio.co.uk') + '/app/settings/profile', { waitUntil: 'networkidle' });
const tabs = await page.locator('nav[aria-label="Settings"] a').evaluateAll(els => els.map(e => { const s = getComputedStyle(e); return { text: e.textContent.trim(), current: e.getAttribute('aria-current'), border: s.borderBottomColor + ' ' + s.borderBottomWidth, cls: e.className.includes('aria-[current=page]:border-ink') }; }));
console.log(JSON.stringify(tabs, null, 0));
await page.locator('nav[aria-label="Settings"]').screenshot({ path: '/home/user/qa/prod/settings-nav.png' });
await b.close();
