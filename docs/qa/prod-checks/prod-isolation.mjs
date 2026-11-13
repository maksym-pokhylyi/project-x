// Production: a second workspace must not reach anything of the first one.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
const base = 'https://bidfolio.co.uk';
const bid = process.argv[2];
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const owner = await b.newContext({ storageState: '/home/user/.secrets/qa-state.json' });
const other = await b.newContext({ storageState: '/home/user/.secrets/qa2-state.json' });
const anon = await b.newContext();
// ids of the owner's files, taken from the owner's own coverage page
const op = await owner.newPage();
await op.goto(`${base}/app/bids/${bid}/files`, { waitUntil: 'networkidle' });
const fileLinks = await op.locator('a[href*="/api/bids/"]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('href')))].slice(0, 3));
console.log('owner sees file links:', fileLinks.length);
const paths = [`/app/bids/${bid}`, `/app/bids/${bid}/requirements`, `/app/bids/${bid}/questions`, `/app/bids/${bid}/files`, `/api/bids/${bid}/status`, `/api/bids/${bid}/export/brief`, `/api/bids/${bid}/export/requirements-csv`, ...fileLinks];
const out = [];
for (const [who, ctx] of [['owner', owner], ['other workspace', other], ['signed out', anon]]) {
  for (const p of paths) {
    const r = await ctx.request.get(base + p, { maxRedirects: 0 }).catch(e => ({ status: () => 'ERR ' + e.message.slice(0, 40), headers: () => ({}) }));
    out.push(`${who.padEnd(16)} ${String(r.status()).padEnd(4)} ${p.replace(bid, '<bid>').slice(0, 70)}${r.headers().location ? ' -> ' + r.headers().location.slice(0, 40) : ''}`);
  }
}
// writes: the other workspace tries to mutate the owner's bid through the API routes it can guess
for (const [method, p] of [['POST', `/api/bids/${bid}/upload`], ['POST', `/api/bids/upload-token`]]) {
  const r = await other.request.fetch(base + p, { method, data: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: `org/x/bids/${bid}/src/a.pdf`, callbackUrl: base, clientPayload: JSON.stringify({ bidId: bid, name: 'a.pdf', size: 10 }), multipart: false } }), headers: { 'content-type': 'application/json', origin: base } }).catch(e => ({ status: () => 'ERR', text: async () => e.message }));
  out.push(`other workspace  ${String(r.status()).padEnd(4)} ${method} ${p.replace(bid, '<bid>')}  ${(await r.text()).replace(/\s+/g, ' ').slice(0, 110)}`);
}
console.log(out.join('\n'));
await b.close();
