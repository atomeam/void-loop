// A person-like run of /chat/ at 390 px in two browser contexts (two people, two devices): Ana starts a group and copies the invite link, Ben opens
// it, they write, reply, send a picture, read receipts turn to ✓✓, the chat is renamed, search finds a message, Ben calls Ana and they are in a call
// (WebRTC on fake camera and microphone, no STUN needed on one machine), German on a German browser, the page opens offline after a visit, no
// sideways overflow, layout shift under 0.05, no console errors. The relay is functions/api/chat.js itself on a FAKE D1 (node:sqlite).
//   node tools/heavy.mjs node tools/chat-page.mjs <screenshot dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/chat.js';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });
const db = new DatabaseSync(':memory:');
const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
const env = { DB: { prepare: (sql) => stmt(sql) }, SALT: 'local-test' };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/chat') {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = new Request(base + req.url, { method: req.method, headers: { ...req.headers, 'cf-connecting-ip': '127.0.0.1' }, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const o = await (req.method === 'POST' ? route.onRequestPost : route.onRequestGet)({ request: r, env });
    res.writeHead(o.status, { 'content-type': 'application/json' }); return res.end(await o.text());
  }
  if (u.pathname.startsWith('/api/')) { res.writeHead(404); return res.end('{}'); }
  let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const errors = []; let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, permissions: ['clipboard-read', 'clipboard-write', 'camera', 'microphone'] }), p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && !/favicon|404|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Lunch crew' : undefined)); return { ctx, p }; };
const openPage = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const t0 = Date.now(); await p.goto(base + url, { waitUntil: 'load' }); const ms = Date.now() - t0; await p.waitForFunction(() => document.documentElement.dataset.chatReady === '1', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300); return ms; };
const sane = async (p, name, ms) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3) + ' (load ' + ms + ' ms)');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a[href],input:not(.pick),textarea')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !(e.tagName === 'A' && e.closest('footer,p,.txt')); }).map((e) => e.outerHTML.slice(0, 60)));
  ok(small.length === 0, name + ': every tap target is at least 24 px' + (small.length ? ' (' + small.join(' | ') + ')' : '')); };
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png') });
const text = (p) => p.evaluate(() => document.body.innerText);
const until = async (p, fn, arg, ms = 12000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);

const A = await mk(), B = await mk();
let ms = await openPage(A.p, '/chat/'); await sane(A.p, 'list', ms);
ok(/end to end encrypted/i.test(await text(A.p)) && /TURN/.test(await text(A.p)), 'the list says the chat is end to end encrypted and that calls may fail without TURN');
await A.p.fill('#c-name', 'Ana'); await A.p.dispatchEvent('#c-name', 'change'); await A.p.fill('#c-gname', 'Weekend plans'); await A.p.click('#c-new');
await until(A.p, () => !!document.getElementById('c-link'));
const link = await A.p.inputValue('#c-link'); ok(/\/chat\/#k=[A-Za-z0-9_-]{43}&n=Weekend/.test(link), 'a new group shows its invite link with the key after # (' + link.length + ' characters)');
await A.p.click('#c-copy'); ok((await A.p.evaluate(() => navigator.clipboard.readText())) === link, 'Copy link puts the invite on the clipboard');
ok(await A.p.evaluate(() => !location.hash), 'the key is not left in the address bar');
await A.p.fill('#c-text', 'Hi Ben! Lunch on Saturday? https://example.com/menu'); await A.p.press('#c-text', 'Enter');
await shot(A.p, 'chat-ana-390');

await B.p.addInitScript(() => localStorage.setItem('a2m.void.chat.v1', JSON.stringify({ me: { id: 'benBENbenBEN', name: 'Ben' }, chats: {} })));
ms = await openPage(B.p, link.replace(/^https?:\/\/[^/]+/, '')); await sane(B.p, 'chat (Ben)', ms);
ok(await until(B.p, () => /Lunch on Saturday/.test(document.body.innerText)), 'Ben opens the link and reads Ana\'s message');
ok(/Weekend plans/.test(await text(B.p)), 'the group\'s name came with the link');
ok(await B.p.locator('.msg a[href="https://example.com/menu"][rel*=noopener]').count() === 1, 'a link in a message is a link, opened with noopener');
const rows = db.prepare('SELECT c FROM void_chat').all(); ok(rows.length > 0 && rows.every((r) => !/Lunch|Ana|Weekend|Ben/.test(r.c)), 'the relay holds ' + rows.length + ' sealed rows and no words');
await B.p.click('.msg .rep'); await B.p.fill('#c-text', 'Yes! 12:30 at the café'); await B.p.click('#c-send');
ok(await until(A.p, () => /12:30 at the café/.test(document.body.innerText)), 'Ana gets Ben\'s reply');
ok(await A.p.locator('.msg .quote').count() >= 1, 'the reply shows the message it answers');
ok(await until(A.p, () => [...document.querySelectorAll('.msg.mine .tick')].some((t) => t.textContent === '✓✓' && /Ben/.test(t.title))), 'Ana\'s message turns ✓✓ "Read by Ben"');
// a picture: a 900x600 PNG made in the page
await B.p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#3b82f6'; g.fillRect(0, 0, 900, 600); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText('Café', 300, 330); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([blob], 'cafe.png', { type: 'image/png' })); const inp = document.getElementById('c-file'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); });
ok(await until(A.p, () => !!document.querySelector('.msg img[src^="data:image/jpeg"]')), 'Ben sends a picture; Ana sees it (sealed as a JPEG under the cap)');
const big = db.prepare('SELECT MAX(LENGTH(c)) AS n FROM void_chat').get().n; ok(big > 8000 && big <= 200000, 'the sealed picture is ' + big + ' characters, under the 200,000 cap');
await shot(A.p, 'chat-picture-390');
// rename, search
if (!(await A.p.$('#c-rename'))) await A.p.click('#c-invite'); await A.p.click('#c-rename');
ok(await until(B.p, () => /Lunch crew/.test(document.body.innerText)), 'Ana renames the chat and Ben sees the new name');
await A.p.click('#c-back'); await A.p.fill('#c-q', 'cafe'); ok(await until(A.p, () => /1 found/.test(document.body.innerText) && /12:30/.test(document.body.innerText), null, 3000), 'search across chats finds "café" from "cafe"');
await A.p.fill('#c-q', ''); await A.p.click('.chatrow'); await A.p.waitForTimeout(300);
// a call: Ben calls, Ana answers
await B.p.click('#c-call');
ok(await until(A.p, () => !!document.getElementById('c-answer'), null, 15000), 'Ana\'s screen rings when Ben calls');
await shot(A.p, 'chat-ringing-390');
await A.p.click('#c-answer');
ok(await until(A.p, () => /In a call/.test(document.body.innerText), null, 20000) && await until(B.p, () => /In a call/.test(document.body.innerText), null, 20000), 'both are in the call (peer to peer)');
await shot(B.p, 'chat-call-390');
await B.p.click('#c-hang'); ok(await until(A.p, () => !/In a call/.test(document.body.innerText), null, 10000), 'hanging up ends the call on both screens');
await A.ctx.close(); await B.ctx.close();
{ // German
  const { ctx, p } = await mk('de-DE'); await openPage(p, '/chat/'); const t = await text(p);
  ok(await p.evaluate(() => document.documentElement.lang) === 'de' && /Neuer Chat/.test(t) && /Ende-zu-Ende/.test(t) && !/New chat/.test(t), 'German browser: the page speaks German'); await shot(p, 'chat-de-390'); await ctx.close();
}
{ // offline
  const { ctx, p } = await mk(); await openPage(p, '/chat/'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1200); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(1500); const t = await text(p);
  ok(/Chat/.test(t) && /New chat|Your chats/.test(t), 'offline: /chat/ reloads with the network cut and still shows the chats'); await ctx.close();
}
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
