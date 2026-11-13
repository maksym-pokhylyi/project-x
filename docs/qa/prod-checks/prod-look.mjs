// Screenshots of production pages for a visual check, plus a contact sheet.
// usage: node prod-look.mjs <name> <auth|anon> <width> <path,path,...> [tileWidth] [maxTileHeight]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const [name, mode, widthArg, list, tileArg, maxArg] = process.argv.slice(2);
const width = Number(widthArg), tile = Number(tileArg || (width > 600 ? 640 : 300)), maxH = Number(maxArg || 1400);
const base = 'https://bidfolio.co.uk';
const dir = '/home/user/qa/look/';
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await b.newContext({ viewport: { width, height: width > 600 ? 800 : 844 }, deviceScaleFactor: 1, ...(mode === 'auth' ? { storageState: '/home/user/.secrets/qa-state.json' } : {}) });
const files = [];
for (const [i, p] of list.split(',').entries()) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  page.on('response', r => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url().slice(0, 80)); });
  const r = await page.goto(base + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(600);
  const file = `${dir}${name}-${i}.png`;
  await page.screenshot({ path: file, fullPage: true });
  const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 1, h: document.documentElement.scrollHeight, h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? null, y: window.scrollY }));
  console.log(`${width} ${p} -> ${r ? r.status() : 'ERR'} ${page.url().replace(base, '').slice(0, 70)} h1="${m.h1}" height=${m.h} overflow=${m.overflow}${errs.length ? ' ERRORS: ' + errs.slice(0, 3).join(' | ') : ''}`);
  files.push({ file, p });
  await page.close();
}
await ctx.close();
const sheet = await b.newPage({ viewport: { width: Math.min(files.length, width > 600 ? 2 : 4) * (tile + 12) + 12, height: 800 } });
const html = `<body style="margin:0;background:#888;font:12px sans-serif"><div style="display:flex;flex-wrap:wrap;gap:12px;padding:12px">${files.map(f => `<div style="width:${tile}px"><div style="color:#fff;height:16px;overflow:hidden">${f.p}</div><div style="max-height:${maxH}px;overflow:hidden"><img src="file://${f.file}" style="width:${tile}px;display:block"></div></div>`).join('')}</div></body>`;
writeFileSync(`${dir}${name}.html`, html);
await sheet.goto(`file://${dir}${name}.html`);
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: `${dir}${name}-sheet.png`, fullPage: true });
await b.close();
console.log('sheet:', `${dir}${name}-sheet.png`);
