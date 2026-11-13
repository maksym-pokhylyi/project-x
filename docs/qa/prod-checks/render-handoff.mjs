import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const dir = '/home/user/project-x/docs/design/handoff/render';
const boards = JSON.parse(fs.readFileSync('/home/user/project-x/docs/design/handoff/canvas.json', 'utf8')).boards;
const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
for (const [name, b] of Object.entries(boards)) {
  const page = await (await browser.newContext({ viewport: { width: b.w, height: 900 }, deviceScaleFactor: 1 })).newPage();
  await page.goto('file://' + dir + '/' + name.replace('.dc.html', '.html'), { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto', e.message.split('\n')[0]));
  await page.waitForTimeout(800);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: dir + '/' + name.replace('.dc.html', '.png'), fullPage: true });
  console.log(name, b.w + 'x' + h, '(declared h ' + b.h + ')');
  await page.close();
}
await browser.close();
