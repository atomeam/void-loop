// The community milestone (void-live-deploy/lib/joins.js, lib/join-watch.js, functions/api/joins.js): who counts as a member, the
// stage card's rule (only a join newer than the one this device saw), and the growth card's line with markup in its values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { joinStats, milestoneFor, joinCardText, communityHtml, agoText, isMilestone, FRESH_MS } from '../void-live-deploy/lib/joins.js';
import { onRequestGet } from '../void-live-deploy/functions/api/joins.js';
import { cardEl } from '../void-live-deploy/lib/join-watch.js';
import { ensureStoreTables } from '../void-live-deploy/lib/store-db.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  const batch = async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; };
  return { prepare: (sql) => stmt(sql), batch, raw: db };
}
async function withTables() {
  const DB = d1();
  DB.raw.exec("CREATE TABLE void_accounts (user_id TEXT PRIMARY KEY, tier TEXT NOT NULL DEFAULT 'free', sale_id TEXT UNIQUE, subscription_id TEXT, updated TEXT NOT NULL)");
  await ensureStoreTables({ DB });
  return DB;
}
const account = (DB, user, tier, sale, at) => DB.raw.prepare('INSERT INTO void_accounts (user_id, tier, sale_id, updated) VALUES (?, ?, ?, ?)').run(user, tier, sale, at);
let n = 0;
const sale = (DB, saleId, at, raw = 'sale_id=' + saleId) => DB.raw.prepare("INSERT INTO void_sales (id, resource, sale_id, product, verified, raw, at) VALUES (?, 'sale', ?, 'v01d', 1, ?, ?)").run('s' + (++n), saleId, raw, at);

test('a member is a paid account; free accounts and test purchases do not count', async () => {
  const DB = await withTables();
  account(DB, 'u1', 'paid', 'S1', '2026-10-20T00:00:00Z'); sale(DB, 'S1', '2026-10-20T10:00:00Z');
  account(DB, 'u2', 'free', null, '2026-10-21T00:00:00Z');
  account(DB, 'u3', 'paid', 'S3', '2026-10-22T00:00:00Z'); sale(DB, 'S3', '2026-10-29T09:00:00Z', 'sale_id=S3&test=true');
  assert.deepEqual(await joinStats({ DB }), { count: 1, last: '2026-10-20T10:00:00.000Z' });
});

test('a sale sent twice is one member, and an account linked with no sale row uses its own time', async () => {
  const DB = await withTables();
  account(DB, 'u1', 'paid', 'S1', '2026-10-20T00:00:00Z'); sale(DB, 'S1', '2026-10-20T10:00:00Z'); sale(DB, 'S1', '2026-10-20T10:00:05Z');
  account(DB, 'u2', 'paid', null, '2026-10-25T08:00:00Z');
  assert.deepEqual(await joinStats({ DB }), { count: 2, last: '2026-10-25T08:00:00.000Z' });
});

test('no members is count 0 with no time; a missing table is a note, never a made-up count', async () => {
  assert.deepEqual(await joinStats({ DB: await withTables() }), { count: 0, last: null });
  const r = await joinStats({ DB: d1() });
  assert.equal(r.count, 0); assert.ok(r.note);
  assert.equal(communityHtml((s) => s, r), '', 'a read failure shows no line');
});

test('GET /api/joins answers the count and time only, cached a minute', async () => {
  const DB = await withTables();
  account(DB, 'secret-user', 'paid', 'S1', '2026-10-20T00:00:00Z'); sale(DB, 'S1', '2026-10-20T10:00:00Z', 'email=someone@example.com&sale_id=S1');
  const res = await onRequestGet({ env: { DB } });
  assert.equal(res.headers.get('cache-control'), 'public, max-age=60');
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { count: 1, last: '2026-10-20T10:00:00.000Z' });
  assert.ok(!/secret-user|example\.com|S1/.test(text), 'no id, email or sale leaves the server');
});

test('the stage shows a join only when it is newer than the one this device saw', () => {
  const now = Date.parse('2026-10-30T12:00:00Z'), stats = { count: 10, last: '2026-10-30T11:00:00Z' };
  assert.deepEqual(milestoneFor(stats, '', now), { count: 10, at: '2026-10-30T11:00:00.000Z', milestone: true });
  assert.equal(milestoneFor(stats, '2026-10-30T11:00:00.000Z', now), null, 'already seen');
  assert.ok(milestoneFor(stats, '2026-10-29T00:00:00Z', now), 'newer than the last seen');
  assert.equal(milestoneFor({ count: 3, last: '2026-10-20T00:00:00Z' }, '', now), null, 'an old join on a first visit is not news');
  assert.ok(milestoneFor({ count: 3, last: new Date(now - FRESH_MS + 60e3).toISOString() }, '', now), 'a join from the last day is');
  assert.equal(milestoneFor({ count: 0, last: null }, '', now), null);
  assert.equal(milestoneFor({ count: 2, last: '2027-01-01T00:00:00Z' }, '', now), null, 'a time in the future is not trusted');
  assert.equal(milestoneFor(null, '', now), null);
});

test('milestones are round numbers; the words say which', () => {
  assert.ok(isMilestone(1) && isMilestone(10) && isMilestone(100)); assert.ok(!isMilestone(7));
  assert.equal(joinCardText({ count: 1, milestone: true }).title, 'Verse has its first member');
  assert.equal(joinCardText({ count: 25, milestone: true }).line, 'A community milestone: 25 members on MultiVerse now.');
  assert.deepEqual(joinCardText({ count: 7, milestone: false }), { title: 'Someone joined Verse', line: 'MultiVerse now has 7 members.', link: 'Join MultiVerse' });
  assert.equal(joinCardText(null), null);
});

test('the growth line escapes its values and links to the members page', () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const now = Date.parse('2026-10-30T12:00:00Z');
  assert.equal(communityHtml(esc, { count: 0, last: null }, now), '<div class="sub growth-community">Community: no members yet. <a href="/members/">Join MultiVerse</a></div>');
  assert.equal(communityHtml(esc, { count: 2, last: '2026-10-27T12:00:00Z' }, now), '<div class="sub growth-community">Community: 2 members on MultiVerse, the newest 3 days ago. <a href="/members/">Join MultiVerse</a></div>');
  const evil = communityHtml(esc, { count: '<img src=x onerror=alert(1)>', last: 'x' }, now);
  assert.ok(!/<img/.test(evil), evil);
  assert.equal(agoText(0), 'today'); assert.equal(agoText(864e5 * 1.5), 'yesterday'); assert.equal(agoText(864e5 * 20), '2 weeks ago');
});

test('the stage card is built from text nodes, with the join link', () => {
  const made = [];
  const node = (tag) => { const el = { tag, children: [], style: {}, attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); } }; made.push(el); return el; };
  const el = cardEl({ createElement: node }, { count: 10, at: '2026-10-30T11:00:00Z', milestone: true });
  assert.equal(el.className, 'join-card'); assert.equal(el.attrs.role, 'status');
  const [title, line, link] = el.children;
  assert.equal(title.textContent, 'Verse has 10 members');
  assert.equal(line.textContent, ' A community milestone: 10 members on MultiVerse now. ');
  assert.equal(link.href, '/members/'); assert.equal(link.textContent, 'Join MultiVerse');
  assert.ok(made.every((m) => !('innerHTML' in m)), 'no markup is parsed');
});
