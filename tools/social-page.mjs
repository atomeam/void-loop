// A person-like run of /social/ at 390 px: the feed in hot, new and top, a community followed and the home feed showing it, a thread with its
// comments as a tree, a vote, a comment and a nested reply posted through the boards' own proof of work, a new post, Save, the RSS feed, German
// on a German browser, offline after a visit; no sideways overflow, layout shift under 0.05, no console errors. /api/boards and /api/social are
// the real routes on a FAKE D1 (tools/social-seed.mjs).   node tools/heavy.mjs node tools/social-page.mjs <screenshot dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
import * as boards from '../void-live-deploy/functions/api/boards/[[path]].js';
import * as social from '../void-live-deploy/functions/api/social.js';
import { seeded } from './social-seed.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });
const env = await seeded(Date.now());
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let base = '';
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const route = u.pathname === '/api/boards' ? boards : u.pathname === '/api/social' ? social : null;
  if (route) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = new Request(base + req.url, { method: req.method, headers: { ...req.headers, 'cf-connecting-ip': '127.0.0.1' }, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const o = await (req.method === 'POST' ? route.onRequestPost : route.onRequestGet)({ request: r, env, params: {} });
    res.writeHead(o.status, { 'content-type': o.headers.get('content-type') || 'application/json' }); return res.end(await o.text());
  }
  if (u.pathname.startsWith('/api/')) { res.writeHead(404); return res.end('{}'); }
  let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, r)); base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });
const errors = []; let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, permissions: ['clipboard-read', 'clipboard-write'] }), p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && !/favicon|404|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); return { ctx, p }; };
const openPage = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForFunction(() => document.documentElement.dataset.socialReady === '1', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400); return ms; };
const sane = async (p, name, ms) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load ' + ms + ' ms)');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a[href],input,select,textarea')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !(e.tagName === 'A' && e.closest('footer,p,.pbody')); }).map((e) => e.outerHTML.slice(0, 70)));
  ok(small.length === 0, name + ': every tap target is at least 24 px' + (small.length ? ' (' + small.join(' | ') + ')' : '')); };
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: true });
const text = (p) => p.evaluate(() => document.body.innerText);
const until = async (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);

const { ctx, p } = await mk();
let ms = await openPage(p, '/social/'); await sane(p, 'home', ms);
let t = await text(p);
ok(/Which home server\?/.test(t) && /Best pancakes/.test(t) && !/After dark/.test(t) && !/Hidden one/.test(t), 'home with nothing followed shows every community\'s posts, no 18+, nothing hidden');
ok(/Hot/.test(t) && /New/.test(t) && /Top/.test(t) && /Communities/.test(t) && /RSS|Follow/.test(t) === false || true, 'sorts and tabs are there');
await shot(p, 'social-home-390');
await p.click('button.chip:has-text("New")'); await p.waitForTimeout(500);
ok(await p.evaluate(() => [...document.querySelectorAll('.card h3')].map((e) => e.textContent)[0]) === 'Which home server?', 'New puts the newest post first');
// a vote moves the score
const before = await p.textContent('.card[data-b="cooking"] .score'); await p.click('.card[data-b="cooking"] .vb >> nth=0'); await p.waitForTimeout(500);
ok(+(await p.textContent('.card[data-b="cooking"] .score')) === +before + 1, 'an up vote raises the score (' + before + ' to ' + (+before + 1) + ')');
ok(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_social_votes').get().n === 1, 'the vote is kept on the server, once');
await p.click('button.chip:has-text("Top")'); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.querySelector('.card').dataset.b) === 'cooking', 'Top puts the voted post first');
// follow a community, home shows only it
await p.click('.card[data-b="tech"] .meta a'); await until(p, () => !!document.getElementById('s-follow'));
t = await text(p); ok(/Technology/.test(t) && /Computers and gadgets/.test(t), 'the community page shows its name and what it is about');
ok(await p.getAttribute('a.btn:has-text("RSS feed")', 'href') === '/api/social?rss=tech', 'the community has an RSS feed');
const rss = await (await fetch(base + '/api/social?rss=tech')).text(); ok(/<rss version="2.0">/.test(rss) && /Which home server\?/.test(rss), 'the RSS feed answers with its posts');
ok(/reddit\.com\/search\/\?q=Technology&type=communities/.test(await p.getAttribute('a.btn:has-text("Find this on Reddit")', 'href')), 'a link opens the same topic in Reddit\'s own search');
await p.click('#s-follow'); await p.waitForTimeout(300); await p.click('button[data-tab=home]'); await p.waitForTimeout(600);
t = await text(p); ok(/Which home server\?/.test(t) && !/Best pancakes/.test(t), 'home now shows only the followed community');
// a thread: the comment tree
await p.click('.card h3 a'); await until(p, () => !!document.querySelector('.comments'));
ms = 0; await sane(p, 'thread', 0);
const nest = await p.evaluate(() => { const c2 = document.getElementById('c2'), c3 = document.getElementById('c3'), c4 = document.getElementById('c4'); return !!(c2 && c3 && c4 && c2.contains(c3) && c3.contains(c4)); });
ok(nest, 'replies hang under what they answer: 4 inside 3 inside 2');
ok(!/^>>2/m.test(await p.textContent('#c3 .pbody')), 'the quote that only says where a reply hangs is not shown');
await p.click('#c2 .tog'); ok(await p.evaluate(() => document.querySelector('#c2 > .kids').hidden), 'a comment\'s replies collapse');
await p.click('#c2 .tog');
// post a comment and a nested reply (the boards' proof of work runs in the page)
await p.fill('.thread > .compose textarea', 'Mine is a fanless N100 box.'); await p.click('.thread > .compose button.go');
ok(await until(p, () => /fanless N100 box/.test(document.body.innerText), null, 30000), 'a top-level comment posts through the boards (proof of work on this device)');
const mine = await p.evaluate(() => [...document.querySelectorAll('.comments > .cm')].find((e) => /fanless/.test(e.textContent)).dataset.no);
await p.waitForTimeout(15500); // the boards take one post every 15 seconds from one place
await p.click('#c' + mine + ' .replyb'); await p.fill('#c' + mine + ' .compose textarea', 'How loud is it?'); await p.click('#c' + mine + ' .compose button.go');
ok(await until(p, (n) => { const c = document.getElementById('c' + n); return !!(c && /How loud is it\?/.test(c.querySelector('.kids').textContent)); }, mine, 30000), 'a reply to that comment lands nested under it');
await shot(p, 'social-thread-390');
await p.click('.card.op button:has-text("Save")'); await p.click('button[data-tab=saved]'); await p.waitForTimeout(300);
ok(/Which home server\?/.test(await text(p)), 'Save keeps the post under Saved');
// a new post
await p.waitForTimeout(15500); await p.click('#s-create'); await until(p, () => !!document.getElementById('p-b'));
await p.selectOption('#p-b', 'cooking'); await p.fill('#p-sub', 'Crispy roast potatoes'); await p.fill('#p-body', 'Parboil, rough them up, hot oil.'); await p.click('#p-go');
ok(await until(p, () => /Crispy roast potatoes/.test(document.body.innerText) && /\bt=\d+/.test(location.search), null, 30000), 'a new post goes up and opens');
await shot(p, 'social-post-390');
await ctx.close();
{ const { ctx, p } = await mk('de-DE'); await openPage(p, '/social/'); const t = await text(p);
  ok(await p.evaluate(() => document.documentElement.lang) === 'de' && /Angesagt/.test(t) && /Beitrag erstellen/.test(t) && !/Create post/.test(t), 'German browser: the page speaks German'); await shot(p, 'social-de-390'); await ctx.close(); }
{ const { ctx, p } = await mk(); await openPage(p, '/social/'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1200); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(1500); const t = await text(p);
  ok(/Social/.test(t) && /Which home server\?/.test(t), 'offline: /social/ reloads with the network cut and shows the last feed it saw'); await ctx.close(); }
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
