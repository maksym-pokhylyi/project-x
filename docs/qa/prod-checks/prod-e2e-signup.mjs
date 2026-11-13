// Production sign-up journey with a Resend simulator address; the verification e-mail is read back through the Resend API.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const base = process.argv[2] || 'https://bidfolio.co.uk';
const stamp = Date.now().toString(36);
const email = `delivered+qa${stamp}@resend.dev`;
const password = 'Qa-' + randomBytes(12).toString('base64url');
const resend = (path) => JSON.parse(execFileSync('curl', ['-sS', '--max-time', '30', '-H', 'Authorization: Bearer proxy-injected', 'https://api.resend.com' + path], { encoding: 'utf8' }));
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: `/home/user/qa/prod/e2e-${n}.png`, fullPage: true });
await page.goto(base + '/sign-up', { waitUntil: 'networkidle' });
await page.getByLabel(/name/i).first().fill('QA Tester');
await page.getByLabel(/e-?mail/i).first().fill(email);
await page.getByLabel(/password/i).first().fill(password);
await page.getByRole('button', { name: /create account/i }).click();
await page.waitForTimeout(4000);
await shot('1-after-signup');
console.log('after sign-up url:', page.url());
console.log('visible text:', (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300));
let link = null, mail = null;
for (let i = 0; i < 12 && !link; i++) {
  await page.waitForTimeout(5000);
  let list; try { list = resend('/emails?limit=20'); } catch (e) { console.log('list error', String(e).slice(0, 120)); continue; }
  const hit = (list.data || []).find(m => (Array.isArray(m.to) ? m.to : [m.to]).some(t => String(t).toLowerCase() === email));
  if (!hit) { if (i === 0) console.log('list keys', Object.keys(list), (list.data || []).length); continue; }
  mail = resend('/emails/' + hit.id);
  const m = String(mail.html || mail.text || '').match(/https:\/\/[^"'\s<>]*verify[^"'\s<>]*/i);
  if (m) link = m[0].replace(/&amp;/g, '&');
}
if (!mail) { console.log('NO E-MAIL FOUND for the test address'); await b.close(); process.exit(1); }
console.log('e-mail:', JSON.stringify({ from: mail.from, subject: mail.subject, last_event: mail.last_event, created_at: mail.created_at }));
console.log('verification link host/path:', link ? new URL(link).origin + new URL(link).pathname : 'NOT FOUND');
if (!link) { await b.close(); process.exit(1); }
await page.goto(link, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log('after verify url:', page.url());
await shot('2-after-verify');
if (!/\/app/.test(page.url())) { await page.goto(base + '/app', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); }
console.log('app url:', page.url());
await shot('3-app');
console.log('app text:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400));
mkdirSync('/home/user/.secrets', { recursive: true });
writeFileSync('/home/user/.secrets/qa-account.json', JSON.stringify({ base, email, password, created: new Date().toISOString() }), { mode: 0o600 });
await ctx.storageState({ path: '/home/user/.secrets/qa-state.json' });
await b.close();
