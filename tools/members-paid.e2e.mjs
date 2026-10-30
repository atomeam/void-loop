// The paid MultiVerse paths in a real browser, with a seeded test member (owner, 2026-10-30: the paid paths are checked on every PR,
// not by a person paying). /members/ is served from void-live-deploy and /api/members runs functions/api/members.js itself on an
// in-memory D1 (node:sqlite), so the page, the claim, the tier and the idea queue are the shipped code. Nothing reaches Gumroad or
// a-to-mind.com: the "sale" is a recorded Gumroad ping row, as /api/gumroad writes it, for the store's own seller and product.
//   1. Already joined: a signed-in free account sees the claim box, claims its receipt, and the page turns into the member view
//   2. After a reload the member view stays (the tier is read from the server, not from the page)
//   3. The idea box: on /members/?pilot (or once LIVE) a member sends an idea; it is queued for the coder and listed under their ideas
//   4. The MultiVerse mark: the member's stage (/) shows the mark that opens /members/; a free account's stage does not
//   5. A member's published page (/@name) shows the mark to every visitor; a free account's page does not
//   6. Built by @name: once Verse builds a member's idea, their published page lists it with a link to the change
// Run: node --test tools/members-paid.e2e.mjs   (Chromium from VOID_TEST_BROWSER, else Playwright's own)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright-core';
import { onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/members.js';
import { onRequestPost as passkeyPost } from '../void-live-deploy/functions/api/passkey.js';
import { onRequestGet as handleGet } from '../void-live-deploy/functions/[handle].js';
import { sessionId } from '../void-live-deploy/lib/void-me.js';
import { ensureStoreTables } from '../void-live-deploy/lib/store-db.js';
import { LIVE } from '../void-live-deploy/lib/members.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const ORIGIN = 'https://a-to-mind.test';
const TOKEN = 'e'.repeat(43), USER = 'e2e-test-member-0001', FREE_TOKEN = 'f'.repeat(43), FREE_USER = 'e2e-test-free-0001';
const SELLER = 'I1O8RSqkcoRWcew39cQx7A==', SALE = 'E2eTestSaleNotRealXXXX==', MAIL = 'e2e-member@example.com';
const IDEA = 'Add a star chart to the night sky page that shows which planets are up tonight.';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  let chain = Promise.resolve();
  const batch = (list) => (chain = chain.then(async () => { const out = []; db.exec('BEGIN'); try { for (const s of list) out.push(await s.run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return out; }, () => {}));
  return { prepare: (sql) => stmt(sql), batch, raw: db };
}

// the test member: a signed-in free account, and a verified sale with no Verse id on it (bought signed out), as the claim box expects
async function seed() {
  const DB = d1();
  await onRequestGet({ request: new Request(ORIGIN + '/api/members'), env: { DB } }); // makes the tables
  await ensureStoreTables({ DB });
  for (const [t, u] of [[TOKEN, USER], [FREE_TOKEN, FREE_USER]]) DB.raw.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(t), u, new Date().toISOString(), Date.now() + 864e5);
  const ping = new URLSearchParams({ sale_id: SALE, order_number: '900000001', seller_id: SELLER, email: MAIL, product_id: 'ITp6zMMOC7A2h-bsSejYSA==', product_permalink: 'https://moonbeam846.gumroad.com/l/yinmj', subscription_id: 'sub-e2e', test: 'true', resource_name: 'sale' }).toString();
  DB.raw.prepare("INSERT INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES (?, 'sale', ?, 'sub-e2e', 'yinmj', NULL, 1, 'verified, no Verse id: link by hand', ?, ?)").run('sale:' + SALE + ':t', SALE, ping, new Date().toISOString());
  return DB;
}

let browser, ctx, DB, ip = 0;
const calls = [];
before(async () => {
  DB = await seed();
  browser = await chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || undefined, args: ['--no-sandbox'] });
  ctx = await context(TOKEN, USER);
});
// a browser signed in as one account; every request is answered here (route)
async function context(token, user) {
  const c = await browser.newContext();
  await c.addInitScript(([t, u]) => { try { localStorage.setItem('a2m.void.me.v1', JSON.stringify({ token: t, userId: u })); } catch (_) {} }, [token, user]);
  await c.route('**/*', serve);
  return c;
}
async function serve(route) {
    const q = route.request(), u = new URL(q.url());
    if (u.origin !== ORIGIN) return route.fulfill({ status: 204, body: '' }); // nothing leaves the test
    if (u.pathname === '/api/members') {
      const init = { method: q.method(), headers: { ...(await q.allHeaders()), 'cf-connecting-ip': '10.9.0.' + (++ip) } };
      if (q.method() !== 'GET') init.body = q.postData() || '';
      const fn = q.method() === 'GET' ? onRequestGet : onRequestPost;
      const res = await fn({ request: new Request(u.href, init), env: { DB }, waitUntil() {} });
      const body = await res.text(); calls.push({ method: q.method(), status: res.status, body });
      return route.fulfill({ status: res.status, contentType: 'application/json', body });
    }
    if (u.pathname === '/api/passkey' && q.method() === 'POST') { // the stage reads the tier here (functions/api/passkey.js step 'tier')
      const res = await passkeyPost({ request: new Request(u.href, { method: 'POST', headers: { ...(await q.allHeaders()), 'cf-connecting-ip': '10.9.1.' + (++ip) }, body: q.postData() || '' }), env: { DB } });
      return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
    }
    if (u.pathname.startsWith('/@')) { // a published page (functions/[handle].js), built on the shipped homepage
      const ASSETS = { fetch: async () => new Response(fs.readFileSync(path.join(ROOT, 'index.html'))) };
      const res = await handleGet({ request: new Request(u.href), env: { DB, ASSETS }, params: { handle: decodeURIComponent(u.pathname.slice(1)) }, next: async () => new Response('', { status: 404 }) });
      return route.fulfill({ status: res.status, contentType: 'text/html', body: await res.text() });
    }
    if (u.pathname === '/api/catalog') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [{ slug: 'yinmj', price_cents: 4900, recurrence: 'monthly' }] }) });
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"ok":false}' });
    let f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT)) return route.fulfill({ status: 403, body: '' });
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
}
after(async () => { await browser?.close(); });

const view = (p) => p.evaluate(() => {
  const shown = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.getClientRects().length > 0; };
  return { claim: shown('claim'), buy: shown('buy'), lab: shown('lab'), soon: shown('soon'), how: document.getElementById('how').textContent, left: document.getElementById('left').textContent,
    ideas: [...document.querySelectorAll('#ideas li')].map((li) => li.textContent) };
});
// the page has read /api/members when the claim box or a member view has settled (one GET per load)
async function loaded(p, gets) { const t0 = Date.now(); while (calls.filter((c) => c.method === 'GET').length < gets && Date.now() - t0 < 10000) await p.waitForTimeout(50); await p.waitForTimeout(150); }

test('Already joined: a signed-in free account sees the claim box, claims its receipt, and the page becomes the member view', async () => {
  const p = await ctx.newPage();
  await p.goto(ORIGIN + '/members/'); await loaded(p, 1);
  let v = await view(p);
  assert.equal(v.claim, true, 'the claim box shows for a signed-in account that is not paid: ' + JSON.stringify(v));
  assert.equal(v.buy, true, 'the Join button shows before the claim');
  assert.match(v.how, /signed in/i);
  await p.fill('#order', SALE); await p.fill('#email', ' E2E-Member@Example.com ');
  await p.click('#claimgo');
  await p.waitForFunction(() => /Done\. MultiVerse is on/.test(document.getElementById('claimsay').textContent), null, { timeout: 10000 });
  await loaded(p, 2);
  v = await view(p);
  assert.equal(v.claim, false, 'the claim box goes once the Verse is paid');
  assert.equal(v.buy, false, 'no Join button for a member');
  assert.match(v.how, /You are a member/);
  assert.equal(v.soon, !LIVE, 'before go-live a member is told ideas open soon');
  assert.equal(v.lab, LIVE, 'after go-live the idea box opens');
  assert.equal(DB.raw.prepare('SELECT tier FROM void_accounts WHERE user_id = ?').get(USER).tier, 'paid', 'the server holds the tier');
  await p.close();
});

test('the page after a reload: the member view stays, read from the server', async () => {
  const p = await ctx.newPage(); const n = calls.filter((c) => c.method === 'GET').length;
  await p.goto(ORIGIN + '/members/'); await loaded(p, n + 1);
  await p.reload(); await loaded(p, n + 2);
  const v = await view(p);
  assert.deepEqual({ claim: v.claim, buy: v.buy, soon: v.soon, lab: v.lab }, { claim: false, buy: false, soon: !LIVE, lab: LIVE }, JSON.stringify(v));
  assert.match(v.how, /You are a member/);
  await p.close();
});

test('the idea box: a member sends an idea, it is queued for the coder and listed under their ideas', async () => {
  const p = await ctx.newPage(); const n = calls.filter((c) => c.method === 'GET').length;
  await p.goto(ORIGIN + '/members/?pilot'); await loaded(p, n + 1);
  let v = await view(p);
  assert.equal(v.lab, true, 'the idea box shows for a member on the pilot page: ' + JSON.stringify(v));
  const left = Number(v.left); assert.ok(left > 0, 'ideas left today');
  assert.equal(await p.isDisabled('#send'), false);
  await p.fill('#idea', IDEA); await p.click('#send');
  await p.waitForFunction(() => /^Sent\./.test(document.getElementById('say').textContent), null, { timeout: 10000 });
  await loaded(p, n + 2);
  v = await view(p);
  assert.ok(v.ideas.some((t) => t.includes('star chart')), 'the idea is listed under the member\'s ideas: ' + JSON.stringify(v.ideas));
  assert.equal(Number(v.left), left - 1, 'one fewer idea left today');
  assert.equal(await p.inputValue('#idea'), '', 'the box is cleared');
  const q = DB.raw.prepare('SELECT * FROM void_queue').all();
  assert.equal(q.length, 1, 'one job queued'); assert.match(JSON.stringify(q[0]), /member:/, 'a member: job for the coder');
  // an idea that takes away is turned down on the page with the server's sentence, and nothing more is queued
  await p.fill('#idea', 'Remove the fan fiction page, nobody reads it'); await p.click('#send');
  await p.waitForFunction(() => { const t = document.getElementById('say').textContent; return t && !/^Sending/.test(t) && !/^Sent\./.test(t); }, null, { timeout: 10000 });
  assert.match(await p.textContent('#say'), /add/i);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM void_queue').get().n, 1);
  await p.close();
});

test('the MultiVerse mark: the member\'s stage shows it and it opens /members/; a free account\'s stage does not', async () => {
  const mark = (p) => p.evaluate(() => { const a = document.getElementById('void-member'); return a ? { href: a.getAttribute('href'), text: a.textContent, shown: a.getClientRects().length > 0 } : null; });
  const p = await ctx.newPage();
  await p.goto(ORIGIN + '/'); await p.waitForSelector('#void-member', { timeout: 15000 });
  assert.deepEqual(await mark(p), { href: '/members/', text: 'MultiVerse', shown: true });
  await p.click('#void-member'); await p.waitForURL(ORIGIN + '/members/');
  await p.close();
  const free = await context(FREE_TOKEN, FREE_USER), f = await free.newPage();
  const asked = f.waitForRequest((r) => r.url().endsWith('/api/passkey') && /"tier"/.test(r.postData() || ''), { timeout: 15000 });
  await f.goto(ORIGIN + '/'); await asked; await f.waitForTimeout(800);
  assert.equal(await mark(f), null, 'no mark for a free account');
  await free.close();
});

test('the mark on a published page: a member\'s /@name shows it to every visitor; a free account\'s page does not', async () => {
  const data = JSON.stringify({ look: { bg: '#050505', glow: '#0b0b10', stars: 'off', fx: 'off' }, cards: [{ name: 'Hello', ask: '', text: 'A test page.' }] });
  DB.raw.prepare('CREATE TABLE IF NOT EXISTS void_pages (handle TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL, updated TEXT NOT NULL)').run();
  for (const [h, u] of [['e2e_member', USER], ['e2e_free', FREE_USER]]) DB.raw.prepare('INSERT OR REPLACE INTO void_pages (handle, user_id, data, updated) VALUES (?, ?, ?, ?)').run(h, u, data, new Date().toISOString());
  const free = await context(FREE_TOKEN, FREE_USER); // the visitor is a free account, so the mark is the page owner's, not the viewer's
  const p = await free.newPage();
  await p.goto(ORIGIN + '/@e2e_member'); await p.waitForSelector('#void-member', { timeout: 15000 });
  const m = await p.evaluate(() => { const a = document.getElementById('void-member'); return { href: a.getAttribute('href'), text: a.textContent, label: a.getAttribute('aria-label'), shown: a.getClientRects().length > 0, page: window.__VOID_PAGE__.member }; });
  assert.deepEqual(m, { href: '/members/', text: 'MultiVerse', label: 'Made with MultiVerse: see what members get', shown: true, page: true });
  await p.goto(ORIGIN + '/@e2e_free'); await p.waitForFunction(() => window.__VOID_PAGE__ && window.__VOID_PAGE__.handle === 'e2e_free'); await p.waitForTimeout(800);
  assert.deepEqual(await p.evaluate(() => [!!document.getElementById('void-member'), 'member' in window.__VOID_PAGE__]), [false, false], 'no mark on a free account\'s page');
  await free.close();
});

test('Built by @name: the member\'s page lists their idea once Verse built it, with a link to the change; a page with none has no such card', async () => {
  const job = DB.raw.prepare('SELECT job FROM void_member_ideas WHERE user_id = ?').get(USER).job; // the idea test 3 sent
  DB.raw.prepare("UPDATE void_queue SET state = 'done', note = ?, updated = ? WHERE id = ?").run('built in https://github.com/atomeam/void-loop/pull/4242', new Date().toISOString(), job);
  const free = await context(FREE_TOKEN, FREE_USER), p = await free.newPage();
  const card = () => p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => /^Built by @/.test(e.textContent)); if (!h) return null; const box = h.parentElement;
    return { name: h.textContent, items: [...box.querySelectorAll('li')].map((li) => li.textContent), links: [...box.querySelectorAll('a')].map((a) => a.getAttribute('href')), shown: h.getClientRects().length > 0 }; });
  await p.goto(ORIGIN + '/@e2e_member'); await p.waitForFunction(() => [...document.querySelectorAll('h2')].some((e) => /^Built by @/.test(e.textContent)), null, { timeout: 15000 });
  assert.deepEqual(await card(), { name: 'Built by @e2e_member', items: [IDEA + ' see the change'], links: ['https://github.com/atomeam/void-loop/pull/4242'], shown: true });
  await p.goto(ORIGIN + '/@e2e_free'); await p.waitForFunction(() => window.__VOID_PAGE__ && window.__VOID_PAGE__.handle === 'e2e_free'); await p.waitForTimeout(800);
  assert.equal(await card(), null, 'no Built by card on a page whose owner has no built ideas');
  await free.close();
});
