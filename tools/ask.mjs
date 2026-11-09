// node tools/ask.mjs "ask one" "ask two" ...: shows what Verse answers (the card text, who answered, any page error), with outside services blocked.
// For finding out why a probe missed. It prints, and saves one screenshot per ask (ASK_SHOTS=<dir>, else the system temp folder) so whoever
// ships the change looks at what a person would see (owner, 2026-10-23: "checks the result of everything to see if it even does what you expect").
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { chromium } from 'playwright-core';
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
await page.goto('http://127.0.0.1:' + server.address().port + '/'); await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(600); // the skills are in before the first ask (a loaded machine outran the fixed wait)
for (const a of asks) {
  errs.length = 0; const before = await page.evaluate(() => document.body.innerText);
  await page.fill('#input', a); await page.keyboard.press('Enter'); await page.waitForTimeout(Number.isFinite(+process.env.ASK_WAIT) && process.env.ASK_WAIT ? +process.env.ASK_WAIT : 1500);
  // a busy machine (several builders share it) loads the skills slowly: wait up to 12 s more for the page to log the ask before reading it
  for (let i = 0; i < 24 && !(await page.evaluate((q) => { try { const v = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); return Array.isArray(v) && v.some((e) => e && e.ask === q); } catch (_) { return true; } }, a)); i++) await page.waitForTimeout(500);
  const said = await page.$eval('#whisper', (e) => e.textContent).catch(() => '');
  const last = (await page.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } })).filter((x) => String(x.ask).trim() === a.trim()).pop();
  const after = await page.evaluate(() => document.body.innerText);
  const shown = after.startsWith(before) ? after.slice(before.length) : after.slice(-400);
  // what the pictures say: the alt text and labels of what is on the stage and the open page (a picture's subject is not in innerText)
  const pics = await page.evaluate(() => [...document.querySelectorAll('#stage [alt], #stage [aria-label], #stage [data-subject], .vpage.on [alt]')].map((e) => e.getAttribute('alt') || e.getAttribute('aria-label') || e.getAttribute('data-subject')).filter(Boolean).slice(-8).join(' / ')).catch(() => '');
  const dir = process.env.ASK_SHOTS || os.tmpdir(), shot = path.join(dir, 'ask-' + a.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.png');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {} // ASK_SHOTS may name a folder that does not exist yet
  const looked = await page.screenshot({ path: shot }).then(() => shot).catch(() => '');
  console.log('> ' + a + '\n  by: ' + (last ? last.note || '(no note)' : '(nothing logged)') + (said ? '\n  said: ' + said.trim().slice(0, 200) : '') + '\n  shows: ' + shown.replace(/\s*\n\s*/g, ' / ').trim().slice(0, 300) + (pics ? '\n  pictures: ' + pics.slice(0, 200) : '') + (looked ? '\n  look: ' + looked : '') + (errs.length ? '\n  ERROR: ' + errs.join(' | ') : ''));
  await page.keyboard.press('Escape').catch(() => {});
}
await browser.close(); server.close();
