import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'https://project-x-ten-omega.vercel.app';
const email = `qa+${Date.now()}@bidfolio.co.uk`; const password = 'Qa-' + Math.random().toString(36).slice(2) + '-9Xy!';
const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
try {
  await page.goto(BASE + '/sign-up', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('sign-up page title:', await page.title());
  const labels = await page.locator('label').allInnerTexts(); console.log('labels:', labels);
  for (const [label, value] of [['name', 'QA Tester'], ['e-?mail', email], ['password', password]]) {
    const field = page.getByLabel(new RegExp(label, 'i')).first(); if (await field.count()) await field.fill(value);
  }
  await page.getByRole('button', { name: /sign up|create account|get started/i }).first().click();
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log('after submit url:', page.url());
  console.log('visible text sample:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400));
  await page.screenshot({ path: '/home/user/qa/prod-signup.png', fullPage: false });
  await page.goto(BASE + '/app', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('/app url:', page.url(), '| h1:', await page.locator('h1').first().innerText().catch(() => '(none)'));
  await page.screenshot({ path: '/home/user/qa/prod-app.png', fullPage: false });
} catch (e) { console.log('FAILED:', e.message.split('\n')[0]); await page.screenshot({ path: '/home/user/qa/prod-fail.png' }).catch(() => {}); }
console.log('errors:', errors.slice(0, 8));
await browser.close();
