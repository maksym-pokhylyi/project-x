// Converts design-session artboards (*.dc.html) into plain static HTML and screenshots them.
// The artboard's own script is evaluated only inside the Chromium page sandbox.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const root = '/home/user/project-x/docs/design/handoff';
const out = root + '/render';
const boards = JSON.parse(fs.readFileSync(root + '/canvas.json', 'utf8')).boards;
const only = process.argv.slice(2);
const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
const conv = await (await browser.newContext()).newPage();
await conv.goto('about:blank');
for (const [name, b] of Object.entries(boards)) {
  if (only.length && !only.some(o => name.startsWith(o))) continue;
  const file = root + '/' + name;
  if (!fs.existsSync(file)) { console.log('MISSING', name); continue; }
  const src = fs.readFileSync(file, 'utf8');
  const res = await conv.evaluate((src) => {
    const helmet = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || [,''])[1];
    let body = (src.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [,''])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
    const script = (src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/) || [,''])[1];
    let vals = {};
    try {
      const C = new Function('DCLogic', script + '\n;return Component;')(class { setState() {} });
      const c = new C(); vals = c.renderVals() || {};
    } catch (e) { vals = { __err: String(e) }; }
    const get = (k) => (k === 'true' ? true : k === 'false' ? false : vals[k]);
    let prev;
    do { prev = body; body = body.replace(/<sc-if value="\{\{ *([\w$]+) *\}\}"[^>]*>((?:(?!<sc-if)[\s\S])*?)<\/sc-if>/g, (m, k, inner) => (get(k) ? inner : '')); } while (body !== prev);
    body = body.replace(/ ([\w-]+)="\{\{ *([\w$]+) *\}\}"/g, (m, attr, k) => {
      const v = get(k);
      if (typeof v === 'function' || v === undefined || v === null || v === false) return '';
      if (v === true) return ' ' + attr;
      return ' ' + attr + '="' + String(v).replace(/"/g, '&quot;') + '"';
    });
    body = body.replace(/\{\{ *([\w$]+) *\}\}/g, (m, k) => { const v = get(k); return typeof v === 'function' || v == null ? '' : String(v); });
    return { helmet, body, err: vals.__err, left: (body.match(/\{\{|<sc-/g) || []).length };
  }, src);
  const title = (src.match(/<title>([^<]*)<\/title>/) || [,name])[1];
  const html = '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title>' + res.helmet + '</head><body>' + res.body + '</body></html>\n';
  const base = name.replace('.dc.html', '');
  fs.writeFileSync(out + '/' + base + '.html', html);
  const page = await (await browser.newContext({ viewport: { width: b.w, height: 900 }, deviceScaleFactor: 1 })).newPage();
  await page.goto('file://' + out + '/' + base + '.html', { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto', e.message.split('\n')[0]));
  await page.waitForTimeout(700);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: out + '/' + base + '.png', fullPage: true });
  console.log(name, b.w + 'x' + h, '(declared ' + b.h + ')', res.err ? 'ERR ' + res.err : '', res.left ? 'UNRESOLVED ' + res.left : '');
  await page.context().close();
}
await browser.close();
