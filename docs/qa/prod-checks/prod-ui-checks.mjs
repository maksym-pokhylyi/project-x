// Production checks for the owner-reported UI rules + the newly merged sections.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const base = process.argv[2] || 'https://bidfolio.co.uk';
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const out = [];
const ok = (name, pass, detail = '') => out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
for (const [w, tag] of [[1280, 'desktop'], [390, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, storageState: '/home/user/.secrets/qa-state.json', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  page.on('response', r => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url().slice(0, 90)); });
  const rowsEqual = async (label) => {
    const rows = await page.evaluate(() => {
      const res = [];
      for (const field of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, [data-slot=select-trigger]')) {
        if (!field.offsetParent) continue;
        const fr = field.getBoundingClientRect();
        let row = field.parentElement;
        for (let i = 0; i < 4 && row; i++, row = row.parentElement) {
          const btn = [...row.querySelectorAll('button, a[data-slot=button], a[data-slot=button-link]')].find(x => { const r = x.getBoundingClientRect(); return x.offsetParent && Math.abs((r.top + r.bottom) / 2 - (fr.top + fr.bottom) / 2) < 14 && r.left >= fr.right - 2 && r.height > 30; });
          if (btn) { const r = btn.getBoundingClientRect(); res.push({ field: (field.getAttribute('placeholder') || field.id || field.tagName).slice(0, 24), fh: Math.round(fr.height * 10) / 10, bh: Math.round(r.height * 10) / 10, dTop: Math.round((r.top - fr.top) * 10) / 10 }); break; }
        }
      }
      return res;
    });
    const bad = rows.filter(r => Math.abs(r.fh - r.bh) > 0.5 || Math.abs(r.dTop) > 0.5);
    ok(`${tag} ${label}: field and button share height and top edge (${rows.length} rows)`, bad.length === 0, bad.map(r => JSON.stringify(r)).join(' '));
  };
  const navCurrent = async (label, navName, expected) => {
    const items = await page.locator(`nav[aria-label="${navName}"] a`).evaluateAll(els => els.filter(e => e.offsetParent).map(e => ({ t: e.textContent.trim().slice(0, 20), cur: e.getAttribute('aria-current') === 'page', w: +getComputedStyle(e).fontWeight, c: getComputedStyle(e).color })));
    const cur = items.filter(i => i.cur);
    const distinct = cur.length === 1 && items.filter(i => !i.cur).every(i => i.w < cur[0].w || i.c !== cur[0].c);
    ok(`${tag} ${label}: one current item "${expected}", visibly different`, cur.length === 1 && cur[0].t.startsWith(expected) && distinct, JSON.stringify(items.map(i => i.t + (i.cur ? '*' : ''))));
  };
  const pointers = async (label) => {
    const off = await page.evaluate(() => [...document.querySelectorAll('a[href], button, [role=button], [role=tab], [role=menuitem], summary, select')].filter(e => e.offsetParent !== null && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && getComputedStyle(e).cursor !== 'pointer').map(e => e.tagName + ':' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 22)).slice(0, 6));
    ok(`${tag} ${label}: every clickable element shows the pointer`, off.length === 0, off.join(' | '));
  };
  // Radar home
  await page.goto(base + '/app', { waitUntil: 'networkidle' });
  if (w >= 768) await navCurrent('/app top bar', 'App', 'Radar');
  await pointers('/app');
  // QA workspace has a claimed company, so use the find page for the search row
  await page.goto(base + '/app/radar/find', { waitUntil: 'networkidle' });
  await rowsEqual('/app/radar/find');
  // Settings
  await page.goto(base + '/app/settings/members', { waitUntil: 'networkidle' });
  await navCurrent('settings tabs', 'Settings', 'Members');
  await rowsEqual('/app/settings/members');
  await pointers('/app/settings/members');
  await page.goto(base + '/app/settings/profile', { waitUntil: 'networkidle' });
  const uid = page.getByTestId('user-id');
  const idValue = await uid.locator('input').inputValue().catch(() => '');
  await uid.getByRole('button').click().catch(() => {});
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '(clipboard unavailable)');
  ok(`${tag} profile: User ID shown and copied`, idValue.length > 8 && clip === idValue, `value length ${idValue.length}, button says "${(await uid.getByRole('button').innerText().catch(() => '')).trim()}"`);
  await rowsEqual('/app/settings/profile');
  await page.goto(base + '/app/settings/workspace', { waitUntil: 'networkidle' });
  const wid = await page.getByTestId('workspace-id').locator('input').inputValue().catch(() => '');
  ok(`${tag} workspace: Workspace ID shown`, wid.length > 8);
  // New sections
  for (const [path, text] of [['/app/bids', /bid/i], ['/app/library', /Documents/i], ['/app/bids/new', /New bid check/i], ['/sample-check', /sample check/i]]) {
    const r = await page.goto(base + path, { waitUntil: 'networkidle' });
    const body = (await page.locator('main').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`${tag} ${path}: renders`, r && r.status() === 200 && text.test(body) && !overflow, `status ${r && r.status()}, overflow ${overflow}, "${body.slice(0, 70)}"`);
    await page.screenshot({ path: `/home/user/qa/prod/${path.replace(/\W+/g, '_')}-${tag}.png`, fullPage: true });
  }
  if (w >= 768) { await page.goto(base + '/app/bids', { waitUntil: 'networkidle' }); await navCurrent('/app/bids top bar', 'App', 'Bids'); }
  ok(`${tag}: no console or server errors`, errs.length === 0, errs.slice(0, 4).join(' | '));
  await ctx.close();
}
await b.close();
console.log(out.join('\n'));
