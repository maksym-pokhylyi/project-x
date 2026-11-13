// Horizontal overflow sweep on production: every listed page at 360 and 390 px, signed out and signed in.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const base = 'https://bidfolio.co.uk';
const pub = process.argv[2].split(','), app = (process.argv[3] || '').split(',').filter(Boolean);
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
let bad = 0, seen = 0;
for (const w of [360, 390]) {
  for (const [mode, paths] of [['anon', pub], ['auth', [...pub, ...app]]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, ...(mode === 'auth' ? { storageState: '/home/user/.secrets/qa-state.json' } : {}) });
    const page = await ctx.newPage();
    for (const p of paths) {
      const r = await page.goto(base + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
      seen++;
      if (!r || r.status() >= 400 || m.sw > m.vw + 1) { bad++; console.log(`${w} ${mode} ${p} -> status ${r ? r.status() : 'ERR'} scrollWidth ${m.sw} (viewport ${m.vw})`); }
    }
    await ctx.close();
  }
}
console.log(`${seen} page views, ${bad} with a problem`);
await b.close();
