// node tools/ask.mjs "ask one" "ask two" ...: shows what Void answers (the card text, who answered, any page error), with outside services blocked.
// For finding out why a probe missed. It only prints; nothing is written.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.join(here, '..', 'void-live-deploy');
const asks = process.argv.slice(2);
if (!asks.length) { console.log('usage: node tools/ask.mjs "ask" ["ask" ...]'); process.exit(2); }
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
const exe = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
await page.route(/127\.0\.0\.1:\d+\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
await page.goto('http://127.0.0.1:' + server.address().port + '/'); await page.waitForTimeout(600);
for (const a of asks) {
  errs.length = 0; const before = await page.evaluate(() => document.body.innerText);
  await page.fill('#input', a); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  const said = await page.$eval('#whisper', (e) => e.textContent).catch(() => '');
  const last = (await page.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } })).filter((x) => String(x.ask).trim() === a.trim()).pop();
  const after = await page.evaluate(() => document.body.innerText);
  const shown = after.startsWith(before) ? after.slice(before.length) : after.slice(-400);
  console.log('> ' + a + '\n  by: ' + (last ? last.note || '(no note)' : '(nothing logged)') + (said ? '\n  said: ' + said.trim().slice(0, 200) : '') + '\n  shows: ' + shown.replace(/\s*\n\s*/g, ' / ').trim().slice(0, 300) + (errs.length ? '\n  ERROR: ' + errs.join(' | ') : ''));
  await page.keyboard.press('Escape').catch(() => {});
}
await browser.close(); server.close();
