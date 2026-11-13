// Production: a real cited bid check on a real public tender pack (free plan), end to end.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { readdirSync, writeFileSync } from 'node:fs';
const base = 'https://bidfolio.co.uk';
const dir = process.argv[2] || '/home/user/spikes/bid-pack/packs/ryde-data-audit/files';
const files = readdirSync(dir).map(f => dir + '/' + f);
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: '/home/user/.secrets/qa-state.json', acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('response', r => { if (r.status() >= 400 && !r.url().includes('_rsc')) errs.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(base, '').slice(0, 100)); });
const shot = (n) => page.screenshot({ path: `/home/user/qa/prod/check-${n}.png`, fullPage: true });
const t0 = Date.now(); const el = () => Math.round((Date.now() - t0) / 1000) + 's';
await page.goto(base + '/app/bids/new', { waitUntil: 'networkidle' });
console.log('usage card:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').match(/(Free plan[^.]*\.[^.]*\.)/)?.[1] || '(not found)');
await page.getByTestId('file-input').setInputFiles(files);
console.log(el(), 'files chosen:', files.length);
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(2000);
  const list = (await page.getByTestId('file-list').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const enabled = await page.getByTestId('start-check').isEnabled().catch(() => false);
  if (i % 5 === 0) console.log(el(), 'file list:', list.slice(0, 260), '| start enabled:', enabled);
  if (enabled) break;
}
await shot('1-uploaded');
console.log(el(), 'start reason:', (await page.getByTestId('start-reason').innerText().catch(() => '')).trim());
await page.getByTestId('start-check').click();
await page.waitForURL(/\/app\/bids\/[^/]+/, { timeout: 60000 }).catch(() => {});
console.log(el(), 'bid url:', page.url().replace(base, ''));
const bidUrl = page.url();
await page.waitForTimeout(4000);
await shot('2-processing');
let done = false, lastStage = '';
for (let i = 0; i < 90 && !done; i++) {
  await page.waitForTimeout(8000);
  const text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const stage = (text.match(/stage \d of \d/i) || [''])[0] + ' ' + (text.match(/(Reading files|Finding requirements|Listing questions|Checking against your company)[^.]{0,40}/g) || []).slice(-1);
  if (stage !== lastStage) { console.log(el(), 'stage:', stage.trim() || text.slice(0, 120)); lastStage = stage; }
  if (/Verdict|Pass-or-fail requirements/i.test(text) && !/Building the check/i.test(text)) done = true;
  if (/could not|failed|went wrong|try again/i.test(text) && !/Building the check/i.test(text)) { console.log(el(), 'FAILURE TEXT:', text.slice(0, 400)); break; }
  if (i % 8 === 7) await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
}
console.log(el(), 'done:', done);
await page.goto(bidUrl, { waitUntil: 'networkidle' });
await shot('3-brief');
const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('brief head:', text.slice(0, 700));
const counts = await page.evaluate(() => ({ chips: document.querySelectorAll('[data-slot="reference-chip"], [data-testid*="citation"], .bid-ref').length, quotes: document.querySelectorAll('blockquote, q, [data-testid*="requirement"]').length }));
console.log('citation-like elements:', JSON.stringify(counts));
const bidId = bidUrl.split('/app/bids/')[1]?.split(/[/?#]/)[0];
if (bidId) {
  const r = await ctx.request.get(`${base}/api/bids/${bidId}/export/brief`);
  const buf = await r.body().catch(() => Buffer.alloc(0));
  console.log('word export:', r.status(), r.headers()['content-type'], buf.length, 'bytes');
  if (r.ok()) writeFileSync('/home/user/qa/prod/check-export.docx', buf);
  writeFileSync('/home/user/qa/prod/last-bid-id.txt', bidId);
}
console.log('errors:', JSON.stringify([...new Set(errs)].slice(0, 8)));
await ctx.storageState({ path: '/home/user/.secrets/qa-state.json' });
await b.close();
