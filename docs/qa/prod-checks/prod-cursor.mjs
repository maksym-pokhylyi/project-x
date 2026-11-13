import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/home/user/.secrets/qa-state.json' });
const page = await ctx.newPage();
await page.goto('https://bidfolio.co.uk/app', { waitUntil: 'networkidle' });
await page.getByTestId('user-menu').first().click();
await page.waitForTimeout(600);
const items = await page.locator('[role="menuitem"]').evaluateAll(els => els.map(e => ({ text: e.textContent.trim().slice(0, 30), tag: e.tagName, cursor: getComputedStyle(e).cursor, h: Math.round(e.getBoundingClientRect().height) })));
console.log(JSON.stringify(items));
await page.screenshot({ path: '/home/user/qa/prod/user-menu.png' });
await page.keyboard.press('Escape');
// every visible interactive element on the page that does not show a pointer
const offenders = await page.evaluate(() => [...document.querySelectorAll('a[href], button, [role=button], [role=tab], [role=menuitem], summary, label[for], select')]
  .filter(e => e.offsetParent !== null && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && getComputedStyle(e).cursor !== 'pointer')
  .map(e => (e.tagName + ':' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 28) + ':' + getComputedStyle(e).cursor)).slice(0, 25));
console.log('non-pointer interactive on /app:', JSON.stringify(offenders));
await b.close();
