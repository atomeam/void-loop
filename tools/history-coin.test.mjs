// Flip a real coin from history: the picker opens from the footer ask even when the old
// /flip/?q= redirect drops the query (as Cloudflare Pages does when the target already has ?mode=),
// and a named coin still shows a real photo when Commons is down.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { backupCoin } from '../void-live-deploy/lib/coins.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium',
  '/home/box/pw-paid/chromium-1243/chrome-linux64/chrome'].find((p) => p && fs.existsSync(p));
if (!exe) { console.log('skip history coin: no Chrome'); process.exit(0); }

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const DOT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// as Cloudflare Pages does: a path in this table whose target already has ? drops the incoming query
const DROP = new Map([['/flip', '/random/?mode=coin'], ['/flip/', '/random/?mode=coin'], ['/random/coin', '/random/?mode=coin'], ['/random/coin/', '/random/?mode=coin']]);

const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch (_) { res.writeHead(400); return res.end(); }
  const drop = DROP.get(url.pathname);
  if (drop) { res.writeHead(301, { location: drop }); return res.end(); }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: exe, headless: true });
let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(got))); if (!ok) bad++; };

async function open(page, pathAndQuery) {
  page.on('pageerror', (e) => {});
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.includes('commons.wikimedia.org/w/api.php')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    if (/wikimedia\.org|upload\.wikimedia/.test(u)) return route.fulfill({ status: 200, contentType: 'image/png', body: DOT });
    return route.continue();
  });
  await page.goto(base + pathAndQuery, { waitUntil: 'domcontentloaded', timeout: 20000 });
}

async function runAt(size, label) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();

  await open(page, '/random/?mode=coin&q=flip+a+famous+coin');
  await page.waitForSelector('.coin-pick, h2', { timeout: 12000 });
  const picker = await page.evaluate(() => ({
    title: (document.querySelector('h2') || {}).textContent || '',
    names: [...document.querySelectorAll('.coin-pick')].map((b) => b.textContent),
    href: (document.querySelector('footer a') || {}).getAttribute('href') || '',
  }));
  check(label + ': the famous-coin ask opens the history picker with real coins to tap',
    picker.title.includes('Pick a coin') && picker.names.includes('Lydian stater') && picker.names.includes('Morgan dollar'),
    picker);

  // a raw visit to the old footer address loses the query (the live redirect does); the footer click is rewritten first
  await open(page, '/flip/?q=flip+a+famous+coin');
  await page.waitForSelector('h2, .coin-word', { timeout: 12000 });
  const dropped = await page.evaluate(() => ({ url: location.pathname + location.search, title: (document.querySelector('h2') || {}).textContent || '' }));
  check(label + ': a raw /flip/?q= visit still loses the ask, as the live site does',
    dropped.url === '/random/?mode=coin' && !/Pick a coin/.test(dropped.title),
    dropped);

  await open(page, '/random/?mode=coin');
  await page.waitForSelector('footer a, h2', { timeout: 12000 });
  await Promise.all([
    page.waitForURL((u) => /mode=coin/.test(u.search) && /famous|real\+coin|history/.test(u.search + decodeURIComponent(u.search)), { timeout: 12000 }),
    page.locator('footer a', { hasText: 'Flip a real coin from history' }).click(),
  ]);
  await page.waitForSelector('.coin-pick, h2', { timeout: 12000 });
  const fromFooter = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: (document.querySelector('h2') || {}).textContent || '',
    n: document.querySelectorAll('.coin-pick').length,
  }));
  check(label + ': clicking "Flip a real coin from history" keeps the ask and opens the picker',
    /mode=coin/.test(fromFooter.url) && /q=/.test(fromFooter.url) && fromFooter.title.includes('Pick a coin') && fromFooter.n >= 16,
    fromFooter);

  await open(page, '/random/?mode=coin&q=flip+a+Lydian+stater');
  await page.waitForFunction(() => {
    const src = document.querySelector('.src');
    return src && /Wikimedia Commons/i.test(src.textContent || '');
  }, { timeout: 12000 }).catch(() => {});
  const flip = await page.evaluate(() => {
    const src = document.querySelector('.src');
    const links = [...document.querySelectorAll('.src a')].map((a) => ({ href: a.href, text: a.textContent }));
    const bg = [...document.querySelectorAll('.fc.h, .fc.t')].map((e) => e.getAttribute('style') || '');
    return { title: (document.querySelector('h2') || {}).textContent || '', src: (src && src.textContent) || '', links, bg, word: (document.querySelector('.coin-word') || {}).textContent || '' };
  });
  const hasPhoto = flip.bg.some((s) => /Special:FilePath|wikimedia/.test(s)) || flip.links.some((a) => /commons\.wikimedia\.org/.test(a.href));
  check(label + ': a Lydian stater flip shows a real historical coin, its picture and its Commons credit, even when the live catalog is down',
    /Lydian/i.test(flip.title + flip.src + flip.word) && /Wikimedia Commons/i.test(flip.src) && hasPhoto && flip.links.some((a) => a.href.includes('commons.wikimedia.org')),
    { flip, backupSrc: backupCoin('Lydian stater').heads.src });

  await ctx.close();
}

await runAt({ width: 1280, height: 800 }, 'desktop');
await runAt({ width: 390, height: 844 }, 'phone');

await browser.close();
server.close();
if (bad) process.exit(1);
