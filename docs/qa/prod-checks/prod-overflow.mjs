import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const [path, mode, w] = [process.argv[2], process.argv[3] || 'anon', Number(process.argv[4] || 390)];
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width: w, height: 844 }, ...(mode === 'auth' ? { storageState: '/home/user/.secrets/qa-state.json' } : {}) });
const page = await ctx.newPage();
await page.goto('https://bidfolio.co.uk' + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const res = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      // skip elements clipped by a scrolling ancestor
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { clipped = true; break; } p = p.parentElement; }
      if (!clipped) out.push({ tag: el.tagName.toLowerCase(), slot: el.getAttribute('data-slot'), testid: el.getAttribute('data-testid'), cls: (el.className?.toString() || '').slice(0, 110), top: Math.round(r.top + window.scrollY), right: Math.round(r.right), width: Math.round(r.width), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50) });
    }
  }
  return { vw, scrollWidth: document.documentElement.scrollWidth, n: out.length, first: out.slice(0, 6) };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
