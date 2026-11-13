// Accessibility audit (axe-core, WCAG 2.1 A/AA) of production pages, phone and desktop.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const axe = readFileSync('/home/user/qa/axe/node_modules/axe-core/axe.min.js', 'utf8');
const base = 'https://bidfolio.co.uk';
const bid = (process.argv[2] || '').trim();
const pub = (process.argv[3] || '/,/sign-in,/sign-up,/sample-check,/optout,/unsubscribe,/pay').split(',');
const app = (process.argv[4] || `/app/bids,/app/bids/new,/app/library,/app/settings/profile,/app/settings/members,/app/settings/notifications${bid ? `,/app/bids/${bid},/app/bids/${bid}/requirements,/app/bids/${bid}/questions,/app/bids/${bid}/files` : ''}`).split(',').filter(Boolean);
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const summary = new Map();
for (const [w, tag] of [[390, 'phone'], [1280, 'desktop']]) {
  for (const [paths, state] of [[pub, undefined], [app, '/home/user/.secrets/qa-state.json']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, storageState: state, bypassCSP: true });
    const page = await ctx.newPage();
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: 'networkidle' }).catch(() => {});
      await page.addScriptTag({ content: axe });
      const res = await page.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].target.join(' ').slice(0, 90), html: v.nodes[0].html.slice(0, 110) })); }).catch(e => [{ id: 'AXE-ERROR', impact: 'n/a', n: 0, sample: String(e).slice(0, 80), html: '' }]);
      for (const v of res) { const k = `${v.impact} ${v.id}`; const cur = summary.get(k) || { pages: new Set(), n: 0, sample: v.sample, html: v.html }; cur.pages.add(`${p}@${tag}`); cur.n += v.n; summary.set(k, cur); }
      console.log(`${tag.padEnd(7)} ${p.replace(bid, '<bid>').padEnd(40)} ${res.length ? res.map(v => `${v.id}(${v.n})`).join(', ') : 'no violations'}`);
    }
    await ctx.close();
  }
}
console.log('\nSUMMARY');
for (const [k, v] of [...summary].sort()) console.log(`${k}: ${v.n} nodes on ${v.pages.size} page-views — e.g. ${v.sample} :: ${v.html}`);
await b.close();
