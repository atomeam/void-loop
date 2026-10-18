// functions/api/films.js + tools/film-post.mjs: Void's films are on the site for anyone to watch; reviews are for the owner and members
// (owner, 2026-10-14: "just put void films right onto the sight , with only paid access").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as api from '../void-live-deploy/functions/api/films.js';
import { guard } from '../void-live-deploy/lib/guard.js';
import { ensureTables, sessionId } from '../void-live-deploy/lib/void-me.js';
import { post, parseWords } from './film-post.mjs';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}
// an R2 bucket in memory: put / head / get (with range) / list, the calls films.js makes
function r2() {
  const m = new Map(); let tick = 0;
  const obj = (k, v) => ({ key: k, size: v.bytes.byteLength, uploaded: v.at });
  return { m,
    put: async (k, body) => { const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body); m.set(k, { bytes, at: new Date(Date.UTC(2026, 9, 14) + 1000 * ++tick) }); },
    head: async (k) => (m.has(k) ? obj(k, m.get(k)) : null),
    get: async (k, o = {}) => { const v = m.get(k); if (!v) return null; const b = o.range ? v.bytes.slice(o.range.offset, o.range.offset + o.range.length) : v.bytes;
      return { ...obj(k, v), body: b, text: async () => new TextDecoder().decode(b) }; },
    list: async ({ prefix }) => ({ objects: [...m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => obj(k, v)) }) };
}
const OWNER = 'owner-token-for-tests-1234567890';
async function world() {
  const env = { DB: d1(), READ_TOKEN: OWNER, SALT: 's', FILMS: r2() };
  await ensureTables(env);
  const sess = async (tok, user, tier) => {
    env.DB.raw.prepare("INSERT INTO void_accounts (user_id, tier, updated) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier").run(user, tier, new Date().toISOString());
    env.DB.raw.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(tok), user, new Date().toISOString(), Date.now() + 864e5);
  };
  return { env, sess };
}
// the site as record.yml meets it: POSTs land on the route through its guard-free handlers
const site = (env) => async (url, init) => {
  const request = new Request(url, init);
  return init.method === 'POST' ? api.onRequestPost({ request, env }) : api.onRequestGet({ request, env });
};
const get = (env, auth, path = '/api/films', extra = {}) => api.onRequestGet({ request: new Request('https://x.test' + path, { headers: { ...(auth ? { authorization: 'Bearer ' + auth } : {}), ...extra } }), env });
const FILM = new Uint8Array(5000).map((_, i) => i % 251);

test('the owner posts a film; anyone lists it and plays it from a signed link with Range (the films are the ads); reviews and the owner flag only with sign-in', async () => {
  const { env, sess } = await world();
  const words = parseWords('TITLE\nOdd moments | an AI built this itself #Shorts\n\nDESCRIPTION\nLog each odd moment.\n\nTAGS\nVoid, AI\n');
  assert.deepEqual(words, { title: 'Odd moments | an AI built this itself #Shorts', description: 'Log each odd moment.', tags: 'Void, AI' });
  assert.deepEqual(parseWords(JSON.stringify({ title: 't', description: 'd', tags: ['a', 'b'] })), { title: 't', description: 'd', tags: 'a, b' });
  const r = await post({ mp4: FILM, words, id: '20261014-odd-moments-r6', site: 'https://x.test', token: OWNER, fetchImpl: site(env) });
  assert.equal(r.bytes, 5000);
  await assert.rejects(post({ mp4: FILM, words, id: 'x-y-z', site: 'https://x.test', token: 'wrong', fetchImpl: site(env) }), /403/);

  const PAID = 'p'.repeat(43), FREE = 'f'.repeat(43);
  await sess(PAID, 'u-paid', 'paid'); await sess(FREE, 'u-free', 'free');
  // anyone watches (owner, 2026-10-15: "anyone should be able to at least watch the films those are our ads")
  const open = await (await get(env, null)).json();
  assert.equal(open.films.length, 1, 'a stranger watches'); assert.equal(open.member, false); assert.equal(open.owner, false); assert.ok(open.buy);
  assert.equal(open.films[0].reviews, null, 'a stranger sees no reviews');
  const free = await (await get(env, FREE)).json();
  assert.equal(free.films.length, 1, 'a free account watches'); assert.equal(free.member, false);
  const list = await (await get(env, PAID)).json();
  assert.equal(list.owner, false); assert.equal(list.member, true); assert.equal(list.films.length, 1);
  const f = list.films[0];
  assert.equal(f.title, words.title); assert.equal(f.bytes, 5000);
  assert.match(f.src, /^\/api\/films\?id=20261014-odd-moments-r6&exp=\d+&sig=[\w-]+$/);
  assert.equal((await (await get(env, OWNER)).json()).owner, true, 'the owner is told so (the page shows the YouTube steps)');

  const whole = await get(env, null, f.src);
  assert.equal(whole.status, 200); assert.equal(whole.headers.get('content-type'), 'video/mp4');
  assert.deepEqual(new Uint8Array(await whole.arrayBuffer()), FILM);
  const part = await get(env, null, f.src, { range: 'bytes=100-199' });
  assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), 'bytes 100-199/5000');
  assert.deepEqual(new Uint8Array(await part.arrayBuffer()), FILM.slice(100, 200));
  assert.equal((await get(env, null, f.src, { range: 'bytes=9000-' })).status, 416);
  // a link with its signature changed, its film changed or its time run out plays nothing
  assert.equal((await get(env, null, f.src.replace(/sig=./, 'sig=A'))).status, 403);
  assert.equal((await get(env, null, f.src.replace('odd-moments', 'odd-momentz'))).status, 403);
  const old = await api.sign(env, '20261014-odd-moments-r6', 1000000000);
  assert.equal((await get(env, null, '/api/films?id=20261014-odd-moments-r6&exp=1000000000&sig=' + old)).status, 403);
  // only the owner writes, and a paying member is no owner
  assert.equal((await api.onRequestPost({ request: new Request('https://x.test/api/films?id=abc', { method: 'POST', headers: { authorization: 'Bearer ' + PAID, 'content-type': 'video/mp4' }, body: FILM }), env })).status, 403);
});

test('the guard refuses a stranger\'s upload before reading its body, and lets the owner\'s 2 MB film through', async () => {
  const { env } = await world();
  let read = 0;
  const big = () => new ReadableStream({ pull(c) { read++; c.enqueue(new Uint8Array(1 << 20)); if (read >= 2) c.close(); } }, { highWaterMark: 0 });
  const call = (auth) => guard({ request: new Request('https://x.test/api/films?id=abc-film', { method: 'POST', body: big(), duplex: 'half', headers: { 'content-type': 'video/mp4', ...(auth ? { authorization: 'Bearer ' + auth } : {}) } }), env,
    next: (req) => api.onRequestPost({ request: req, env }) });
  const no = await call('vr1.' + 'A'.repeat(43));
  assert.equal(no.status, 403); assert.equal(read, 0, 'not one chunk of a stranger\'s film was read');
  const yes = await call(OWNER);
  assert.equal(yes.status, 200); assert.equal((await yes.json()).bytes, 2 << 20);
});

test('without the bucket bound the route says so instead of breaking', async () => {
  const { env } = await world(); delete env.FILMS;
  assert.equal((await get(env, OWNER)).status, 503);
});

// reviews (owner, 2026-10-14: "film review could be for owner and paying members as contributer reviewrs")
import * as rev from '../void-live-deploy/functions/api/film-review.js';
test('members and the owner review a film; a member sees the totals and their own, the owner reads every note; nobody else can', async () => {
  const { env, sess } = await world();
  await env.FILMS.put('films/20261014-odd-r6.mp4', FILM);
  const A = 'a'.repeat(43), B = 'b'.repeat(43), FREE = 'f'.repeat(43);
  await sess(A, 'u-a', 'paid'); await sess(B, 'u-b', 'paid'); await sess(FREE, 'u-free', 'free');
  const review = (auth, body) => rev.onRequestPost({ request: new Request('https://x.test/api/film-review', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: JSON.stringify(body) }), env });
  assert.equal((await review(null, { id: '20261014-odd-r6', verdict: 'post' })).status, 401);
  assert.equal((await review(FREE, { id: '20261014-odd-r6', verdict: 'post' })).status, 401);
  assert.equal((await review(A, { id: '20261014-odd-r6', verdict: 'love' })).status, 400, 'only post, fix or skip');
  assert.equal((await review(A, { id: '20261014-nope-r1', verdict: 'post' })).status, 404, 'only a film that exists');
  assert.equal((await review(A, { id: '20261014-odd-r6', verdict: 'fix', note: 'Cut the first 3 seconds. My key vr1.' + 'Z'.repeat(43) })).status, 200);
  assert.equal((await review(A, { id: '20261014-odd-r6', verdict: 'post', note: 'Cut the first 3 seconds, then post.' })).status, 200, 'a reviewer changes their mind: one review each');
  assert.equal((await review(B, { id: '20261014-odd-r6', verdict: 'skip', note: 'Boring middle. vr1.' + 'Z'.repeat(43) })).status, 200);
  assert.equal((await review(OWNER, { id: '20261014-odd-r6', verdict: 'post' })).status, 200);
  const asA = (await (await get(env, A)).json()).films[0].reviews;
  assert.deepEqual(asA.counts, { post: 2, fix: 0, skip: 1 });
  assert.equal(asA.mine.verdict, 'post'); assert.equal(asA.mine.note, 'Cut the first 3 seconds, then post.');
  assert.equal(asA.notes, undefined, 'a member does not read the others\' notes');
  const asOwner = (await (await get(env, OWNER)).json()).films[0].reviews;
  assert.deepEqual(asOwner.notes.map((n) => [n.by, n.verdict, n.note]).sort(), [['member', 'post', 'Cut the first 3 seconds, then post.'], ['member', 'skip', 'Boring middle. [redacted key]']]);
  assert.ok(!JSON.stringify(asOwner).includes('u-a'), 'the owner sees "member", not who');
  const kept = env.DB.raw.prepare('SELECT note FROM void_film_reviews').all().map((r) => r.note).join(' ');
  assert.ok(!kept.includes('Z'.repeat(43)), 'a key typed into a note is never kept');
});

// the films as data (asked by Void, 2026-10-15: "extract structured JSON from any Verse FILM")
test('film metadata: the asks it takes, and each film as { id, day, experiment, title, tags, source, watch }', async () => {
  const { wantsFilmMeta, filmMeta } = await import('../void-live-deploy/skills/films.js');
  for (const a of ['film metadata', 'films as json', 'show me the films json', 'export the films', 'v01d films metadata', 'film data']) assert.ok(wantsFilmMeta(a), a);
  for (const a of ['films', 'metadata', 'json', 'export data', 'best films of 2025', 'film a timer']) assert.ok(!wantsFilmMeta(a), a);
  const m = filmMeta({ id: '20261014-anomalous-event-timeline-4-r6', at: '2026-10-14T16:33:31Z', title: 'T', tags: 'Void, AI', description: 'Try it.\n\nHow it is built: https://github.com/atomeam/void-loop/blob/main/void-live-deploy/fringe/anomalous-event-timeline-4.html\n\nmore' });
  assert.deepEqual(m, { id: '20261014-anomalous-event-timeline-4-r6', day: '2026-10-14', experiment: 'anomalous-event-timeline-4', title: 'T', tags: ['Void', 'AI'],
    source: 'https://github.com/atomeam/void-loop/blob/main/void-live-deploy/fringe/anomalous-event-timeline-4.html', watch: 'https://a-to-mind.com/films/' });
  assert.equal(filmMeta({ id: '20261015-miss-board-4-r9', title: 'x', tags: '', description: '' }).source, 'https://github.com/atomeam/void-loop/blob/main/void-live-deploy/fringe/miss-board-4.html', 'an older film without the line still links its experiment');
});
