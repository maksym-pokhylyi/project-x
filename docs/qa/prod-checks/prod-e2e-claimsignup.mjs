// Production journey of a new visitor: find the company -> claim page (which is also the sign-up) -> verify e-mail -> radar.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const base = 'https://bidfolio.co.uk';
const query = process.argv[2] || 'G. BAKER ROOFING';
const email = `delivered+qc${Date.now().toString(36)}@resend.dev`;
const password = 'Qa-' + randomBytes(12).toString('base64url');
const resend = (path) => JSON.parse(execFileSync('curl', ['-sS', '--max-time', '30', '-H', 'Authorization: Bearer proxy-injected', 'https://api.resend.com' + path], { encoding: 'utf8' }));
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
page.on('response', r => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url().slice(0, 80)); });
const shot = (n) => page.screenshot({ path: `/home/user/qa/look/claim-${n}.png`, fullPage: true });
const say = async (label) => console.log(`${label}: ${page.url().replace(base, '').slice(0, 90)} | h1="${(await page.locator('h1').first().textContent().catch(() => ''))?.trim().slice(0, 60)}"`);
await page.goto(`${base}/find?q=${encodeURIComponent(query)}`, { waitUntil: 'networkidle' });
await say('find');
await page.getByRole('link', { name: /This is my company/i }).first().click();
await page.waitForURL(/\/claim\//, { timeout: 30000 });
await page.waitForLoadState('networkidle');
await say('claim');
await shot('1-claim');
const form = page.getByTestId('claim-sign-up');
await form.getByLabel('Your name').fill('QA Claim Tester');
await form.getByLabel('Work email').fill(email);
await form.getByLabel('Password').fill(password);
// First without the tick: the form must stop and say why, keeping what was typed.
await form.getByRole('button', { name: 'Create account and claim' }).click();
await page.waitForTimeout(1200);
console.log('without the tick:', (await form.innerText()).replace(/\s+/g, ' ').match(/(Tick|confirm|authoris)[^.]*\./i)?.[0] ?? '(no message found)', '| e-mail kept:', (await form.getByLabel('Work email').inputValue()) === email);
await form.getByTestId('claim-authorised').click();
await form.getByRole('button', { name: 'Create account and claim' }).click();
await page.waitForURL(/verify-email/, { timeout: 30000 }).catch(() => {});
await say('after submit');
await shot('2-verify');
let link = null, mail = null;
for (let i = 0; i < 14 && !link; i++) {
  await page.waitForTimeout(5000);
  let list; try { list = resend('/emails?limit=20'); } catch { continue; }
  const hit = (list.data || []).find(m => (Array.isArray(m.to) ? m.to : [m.to]).some(t => String(t).toLowerCase() === email));
  if (!hit) continue;
  mail = resend('/emails/' + hit.id);
  const m = String(mail.html || mail.text || '').match(/https:\/\/[^"'\s<>]*verify[^"'\s<>]*/i);
  if (m) link = m[0].replace(/&amp;/g, '&');
}
if (!link) { console.log('NO VERIFICATION E-MAIL'); await b.close(); process.exit(1); }
console.log('e-mail:', JSON.stringify({ from: mail.from, subject: mail.subject, last_event: mail.last_event }));
await page.goto(link, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await say('after verify');
if (/\/claim\//.test(page.url())) {
  // Signed in now: the claim page asks for one confirmation.
  console.log('claim (signed in) text:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 220));
  const tick = page.getByTestId('claim-authorised');
  if (await tick.count()) await tick.click();
  await page.getByRole('button', { name: /Confirm and open my radar|Claim/i }).first().click();
  await page.waitForURL(/\/app/, { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await say('after confirm');
}
await shot('3-radar');
console.log('radar text:', (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 420));
console.log('errors:', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
writeFileSync('/home/user/.secrets/qa3-account.json', JSON.stringify({ base, email, password, created: new Date().toISOString(), claimed: query }), { mode: 0o600 });
await ctx.storageState({ path: '/home/user/.secrets/qa3-state.json' });
await b.close();
