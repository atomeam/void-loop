// Verse's boards: lib/boards.js (codes, text, tripcodes, the image checks, the proof of work) and the route functions/api/boards/[[path]].js with a
// FAKE D1 (node:sqlite), a FAKE R2 (a Map) and a FAKE Turnstile. The pictures here are made by hand, byte by byte. Run: node --test tools/boards.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as B from '../void-live-deploy/lib/boards.js';
import * as route from '../void-live-deploy/functions/api/boards/[[path]].js';
import { sharePage, onRequestGet as shareGet } from '../void-live-deploy/functions/boards/t/[[path]].js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const cat = (...xs) => { const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of xs) { out.set(x, i); i += x.length; } return out; };
const bytes = (...v) => Uint8Array.from(v.flat());
const str = (s) => [...s].map((c) => c.charCodeAt(0));
const be16 = (n) => [n >> 8, n & 255], be32 = (n) => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255], le32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
// a JPEG: SOI, APP0 JFIF, APP1 Exif (with "GPS" in it), a comment, SOF0 640x480, SOS and some data, EOI
const jpeg = (w, h, exif = true) => bytes([0xff, 0xd8], [0xff, 0xe0], be16(16), str('JFIF\0'), [1, 1, 0, 0, 1, 0, 1, 0, 0], exif ? [[0xff, 0xe1], be16(22), str('Exif\0\0GPS 51.5,-0.12'), [0xff, 0xfe], be16(9), str('my name')].flat() : [],
  [0xff, 0xc0], be16(17), [8], be16(h), be16(w), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], [0xff, 0xda], be16(12), [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0], [1, 2, 3, 4, 5], [0xff, 0xd9]);
export const JPEG_EXIF = jpeg(640, 480), JPEG_THUMB = jpeg(200, 150, false);
const chunk = (t, data) => cat(bytes(be32(data.length), str(t)), data, bytes([0, 0, 0, 0]));
export const PNG_TEXT = cat(bytes([0x89], str('PNG'), [0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', bytes(be32(32), be32(16), [8, 2, 0, 0, 0])), chunk('eXIf', bytes(str('MM\0*GPS'))), chunk('tEXt', bytes(str('Author\0me'))), chunk('IDAT', bytes([1, 2, 3])), chunk('IEND', bytes([])));
export const GIF_COMMENT = bytes(str('GIF89a'), [10, 0, 5, 0, 0x80, 0, 0], [0, 0, 0, 255, 255, 255], [0x21, 0xfe, 3], str('hey'), [0], [0x21, 0xff, 11], str('NETSCAPE2.0'), [3, 1, 0, 0, 0],
  [0x2c, 0, 0, 0, 0, 10, 0, 5, 0, 0], [2, 2, 0x4c, 0x01, 0], [0x3b]);
const riff = (...chunks) => { const body = cat(...chunks); return cat(bytes(str('RIFF'), le32(4 + body.length), str('WEBP')), body); };
const wchunk = (t, data) => cat(bytes(str(t), le32(data.length)), data, data.length & 1 ? bytes([0]) : bytes([]));
export const WEBP_EXIF = riff(wchunk('VP8X', bytes([0x08, 0, 0, 0], [99, 0, 0], [49, 0, 0])), wchunk('VP8 ', bytes([0, 0, 0, 0x9d, 0x01, 0x2a], [100, 0, 50, 0], [0, 0])), wchunk('EXIF', bytes(str('GPS!'))));

test('board codes: 1-10 of a-z and 0-9, never a reserved word, never one already made', () => {
  for (const ok of ['b', 'tech', 'g2', 'abcdefghij']) assert.equal(B.codeProblem(ok), '', ok);
  for (const no of ['', 'B', 'abcdefghijk', 'a-b', 'a b', '../x', 'é', null]) assert.match(B.codeProblem(no), /1 to 10/, String(no));
  for (const r of ['api', 'admin', 'rules', 'verse', 'void']) assert.match(B.codeProblem(r), /reserved/);
  assert.match(B.codeProblem('tech', new Set(['tech'])), /taken/);
});
test('text: control and direction characters out, CRLF to LF, at most two blank lines, cut by characters; names and tripcodes', async () => {
  assert.equal(B.cleanText('a\r\nb\u0000c‮\n\n\n\n\nd', 100), 'a\nbc\n\n\nd');
  assert.equal(B.cleanText('😀😀😀', 2), '😀😀'); assert.equal(B.cleanLine(' a\nb  c ', 10), 'a b c');
  assert.equal(B.cleanText('1\n2\n3', 100, 2), '1\n2');
  assert.deepEqual(B.parseName(''), { name: 'Anonymous', secret: '' }); assert.deepEqual(B.parseName('moot#hunter2'), { name: 'moot', secret: 'hunter2' }); assert.deepEqual(B.parseName('#x'), { name: 'Anonymous', secret: 'x' });
  const t1 = await B.tripcode('hunter2', 'k1'), t2 = await B.tripcode('hunter2', 'k1'), t3 = await B.tripcode('hunter2', 'k2'), t4 = await B.tripcode('hunter3', 'k1');
  assert.match(t1, /^![A-Za-z0-9._-]{10}$/); assert.equal(t1, t2, 'the same password, the same mark'); assert.notEqual(t1, t3, 'another server secret, another mark'); assert.notEqual(t1, t4);
  assert.ok(!t1.includes('hunter2')); assert.equal(await B.tripcode('', 'k1'), '');
  assert.equal(B.isSage('sage'), true); assert.equal(B.isSage('noko sage'), true); assert.equal(B.isSage('sages'), false); assert.equal(B.isSage(''), false);
});
test('render: everything escaped; greentext, >>quotes, >>>/board/ links, links and spoilers', () => {
  const h = B.render('<script>alert(1)</script>\n>be me\n>>12 yes\n>>>/tech/34 and >>>/b/\nsee https://example.com/a?b=1&c=2.\n[spoiler]it was him[/spoiler] [/spoiler]', { here: 'b' });
  assert.ok(!/<script/i.test(h)); assert.match(h, /&lt;script&gt;/);
  assert.match(h, /<span class="gt">&gt;be me<\/span>/);
  assert.match(h, /<a class="ql" data-q="12" href="\/boards\/\?b=b&amp;p=12#p12">&gt;&gt;12<\/a> yes/); assert.doesNotMatch(h, /class="gt">.*>>12/, 'a quote line is not greentext');
  assert.match(h, /href="\/boards\/\?b=tech&amp;p=34">&gt;&gt;&gt;\/tech\/34<\/a>/); assert.match(h, /href="\/boards\/\?b=b">&gt;&gt;&gt;\/b\/<\/a>/);
  assert.match(h, /<a href="https:\/\/example.com\/a\?b=1&amp;c=2" rel="nofollow ugc noopener noreferrer" target="_blank">[^<]+<\/a>\./, 'the full stop is not part of the link');
  assert.match(h, /<span class="sp">it was him<\/span> \[\/spoiler\]/, 'a closing tag with nothing open stays text');
  assert.equal(B.render('[spoiler]open'), '<span class="sp">open</span>', 'an open spoiler is closed');
  assert.match(B.render('"><img src=x onerror=alert(1)>'), /^&quot;&gt;&lt;img/);
  assert.match(B.render('javascript:alert(1) http://xy" onmouseover="y'), /href="http:\/\/xy"/, 'a quote mark ends a link');
  assert.deepEqual(B.quotesIn('>>1 >>2\n>>1 >>>3 >>>/b/4'), [1, 2]);
  assert.equal(B.excerpt('[spoiler]a[/spoiler]   b', 10), 'a b'); assert.equal(B.excerpt('abcdefghijkl', 5), 'abcde'); assert.equal(B.excerpt('one two three four', 12), 'one two');
  assert.equal(B.matches('cat HAT', { sub: 'The cat', body: 'in the hat' }), true); assert.equal(B.matches('dog', { body: 'cat' }), false); assert.equal(B.matches('', { body: 'x' }), false);
  assert.deepEqual(B.order([{ no: 1, bumped: 5, at: 1, replies: 9 }, { no: 2, bumped: 9, at: 2, replies: 1 }]).map((x) => x.no), [2, 1]);
  assert.deepEqual(B.order([{ no: 1, bumped: 5, at: 1, replies: 9 }, { no: 2, bumped: 9, at: 2, replies: 1 }], 'replies').map((x) => x.no), [1, 2]);
  assert.equal(B.pageOf(0), 1); assert.equal(B.pageOf(15), 2);
});
test('pictures: the type from the bytes, the size from the header, and the hidden data stripped (EXIF, GPS, XMP, comments, text)', () => {
  assert.equal(B.sniff(JPEG_EXIF), 'image/jpeg'); assert.equal(B.sniff(PNG_TEXT), 'image/png'); assert.equal(B.sniff(GIF_COMMENT), 'image/gif'); assert.equal(B.sniff(WEBP_EXIF), 'image/webp');
  assert.equal(B.sniff(new TextEncoder().encode('<html><script>alert(1)</script></html>')), null, 'a page named .jpg is not a picture');
  assert.deepEqual(B.dims(JPEG_EXIF), { w: 640, h: 480 }); assert.deepEqual(B.dims(PNG_TEXT), { w: 32, h: 16 }); assert.deepEqual(B.dims(GIF_COMMENT), { w: 10, h: 5 }); assert.deepEqual(B.dims(WEBP_EXIF), { w: 100, h: 50 });
  assert.deepEqual(B.metaIn(JPEG_EXIF).sort(), ['comment', 'exif']); assert.deepEqual(B.metaIn(PNG_TEXT).sort(), ['exif', 'text']); assert.deepEqual(B.metaIn(GIF_COMMENT), ['comment']); assert.deepEqual(B.metaIn(WEBP_EXIF), ['exif']);
  for (const [name, f] of Object.entries({ JPEG_EXIF, PNG_TEXT, GIF_COMMENT, WEBP_EXIF })) {
    const c = B.stripMeta(f); assert.ok(c, name); assert.deepEqual(B.metaIn(c), [], name + ': nothing hidden left'); assert.deepEqual(B.dims(c), B.dims(f), name + ': the same picture');
    assert.ok(!Buffer.from(c).toString('latin1').includes('GPS'), name + ': no GPS'); assert.equal(B.sniff(c), B.sniff(f));
  }
  const w = B.stripMeta(WEBP_EXIF); assert.equal(w[20] & 0x08, 0, 'the WebP header no longer says it has EXIF'); assert.equal(new DataView(w.buffer).getUint32(4, true), w.length - 8, 'the RIFF size is right');
  assert.ok(B.stripMeta(JPEG_EXIF).includes(0xe0), 'the JFIF header stays'); assert.ok(Buffer.from(B.stripMeta(GIF_COMMENT)).toString('latin1').includes('NETSCAPE2.0'), 'the loop count stays');
  const ok = B.checkImage(JPEG_EXIF); assert.equal(ok.ok, true); assert.equal(ok.ext, 'jpg'); assert.equal(ok.w, 640); assert.deepEqual(B.metaIn(ok.bytes), []);
  assert.match(B.checkImage(new Uint8Array(0)).why, /empty/); assert.match(B.checkImage(new TextEncoder().encode('GIF89a but really a page......')).why, /could not be read|only|pixels/);
  assert.match(B.checkImage(JPEG_EXIF, { max: 10 }).why, /over/); assert.match(B.checkImage(JPEG_EXIF, { px: 100 }).why, /pixels/); assert.match(B.checkImage(GIF_COMMENT, { thumb: true }).why, /thumbnail/);
  assert.match(B.checkImage(JPEG_EXIF.slice(0, 40)).why, /could not be read/, 'a cut file is refused');
});
test('proof of work: zero bits counted, the work found and checked', async () => {
  assert.equal(B.zeroBits(new Uint8Array([0, 0x0f, 0xff])), 12); assert.equal(B.zeroBits(new Uint8Array([0x80])), 0);
  const n = await B.doWork('abc', 10); assert.equal(await B.workOk('abc', String(n), 10), true); assert.equal(await B.workOk('abd', String(n), 10) && await B.workOk('abd', String(n + 1), 10) && false, false);
  assert.equal(await B.workOk('abc', 'x', 10), false);
});

// ---- the route ----
const store = new Map();
globalThis.caches = { default: { match: async (r) => (store.has(r.url) ? new Response(store.get(r.url)) : undefined), put: async (r, res) => { store.set(r.url, await res.text()); }, delete: async () => true } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...a) || null,
    all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
function r2() {
  const m = new Map();
  return { m, put: async (k, v, o = {}) => { m.set(k, { bytes: new Uint8Array(v instanceof ArrayBuffer ? v : v.buffer ? v : v), meta: o.httpMetadata || {} }); },
    get: async (k) => { const x = m.get(k); return x ? { body: x.bytes, httpMetadata: x.meta, arrayBuffer: async () => x.bytes.slice().buffer } : null; }, delete: async (k) => { m.delete(k); } };
}
const OWNER = 'test-owner-key'; // secret-scan: ok (a made-up key for the test)
const turnOk = async (url, init) => { assert.match(url, /challenges\.cloudflare\.com\/turnstile/); return Response.json({ success: init.body.get('response') === 'ok-token' }); };
function world(extra = {}) { store.clear(); resetGuard(); route.resetReady(); return { DB: d1(), FILMS: r2(), SALT: 'test-salt', READ_TOKEN: OWNER, TURNSTILE_SECRET: 'ts-secret', TURNSTILE_SITE_KEY: 'ts-site', ...extra }; } // secret-scan: ok (made-up values for the test)
let clock = Date.UTC(2026, 9, 25, 12);
const tick = (ms = 60e3) => (clock += ms);
const post = (env, data, { ip = '203.0.113.7', file = null, thumb = null, owner = false, fetchFn = turnOk } = {}) => {
  const headers = { 'cf-connecting-ip': ip, ...(owner ? { authorization: 'Bearer ' + OWNER } : {}) }; let body;
  if (file) { body = new FormData(); body.append('data', JSON.stringify(data)); body.append('file', new Blob([file]), 'IMG_0001.jpg'); if (thumb) body.append('thumb', new Blob([thumb]), 't.jpg'); }
  else { body = JSON.stringify(data); headers['content-type'] = 'application/json'; }
  return route.onRequestPost({ env, fetchFn, now: clock, request: new Request('https://x.test/api/boards', { method: 'POST', headers, body }) });
};
const get = async (env, qs, { owner = false, path = [] } = {}) => route.onRequestGet({ env, params: { path }, request: new Request('https://x.test/api/boards' + qs, { headers: owner ? { authorization: 'Bearer ' + OWNER } : {} }) });
const J = async (r) => ({ status: r.status, ...(await r.json()) });
const proof = { turnstile: 'ok-token' };

test('no starter boards; anyone makes one (bot check, code rules, 18+ said), the list sorts by activity', async () => {
  const env = world();
  assert.deepEqual((await J(await get(env, ''))).boards, [], 'blank until someone makes one');
  const cfg = await J(await get(env, '?config')); assert.equal(cfg.turnstile, 'ts-site'); assert.equal(cfg.pow, null);
  assert.equal((await J(await post(env, { do: 'board', code: 'tech', title: 'Technology', nsfw: false }))).status, 403, 'no bot check, no board');
  assert.equal((await J(await post(env, { do: 'board', code: 'tech', title: 'Technology', nsfw: false, proof: { turnstile: 'bad' } }))).status, 403);
  assert.match((await J(await post(env, { do: 'board', code: 'admin', title: 'x', nsfw: false, proof }))).say, /reserved/);
  assert.match((await J(await post(env, { do: 'board', code: 'Te ch', title: 'x', nsfw: false, proof }))).say, /1 to 10/);
  assert.match((await J(await post(env, { do: 'board', code: 'tech', title: 'Tech', proof }))).say, /18\+/, 'the maker says whether it is 18+');
  const made = await J(await post(env, { do: 'board', code: 'tech', title: 'Technology <b>', about: 'computers\nand phones', nsfw: false, proof }));
  assert.equal(made.status, 201); assert.deepEqual([made.board.code, made.board.title, made.board.about, made.board.nsfw, made.board.textOnly], ['tech', 'Technology <b>', 'computers and phones', false, false]);
  assert.match((await J(await post(env, { do: 'board', code: 'x', title: 'X', nsfw: true, proof }))).say, /ten minutes/, 'one board per ten minutes per address');
  assert.match((await J(await post(env, { do: 'board', code: 'tech', title: 'T', nsfw: false, proof }, { ip: '198.51.100.1' }))).say, /taken/);
  tick(); await post(env, { do: 'board', code: 'txt', title: 'Text only', nsfw: false, textOnly: true, proof }, { ip: '198.51.100.2' });
  tick(); await post(env, { do: 'board', code: 'adult', title: 'Adult', nsfw: true, proof }, { ip: '198.51.100.3' });
  assert.deepEqual((await J(await get(env, ''))).boards.map((b) => b.code), ['adult', 'txt', 'tech'], 'most recently active first');
  for (let i = 0; i < 2; i++) { tick(11 * 60e3); assert.equal((await post(env, { do: 'board', code: 'm' + i, title: 'M', nsfw: false, proof })).status, 201); }
  tick(11 * 60e3); assert.match((await J(await post(env, { do: 'board', code: 'm9', title: 'M', nsfw: false, proof }))).say, /three boards a day/);
});

test('threads and replies: an image board needs a picture to start, stored stripped under a random name; >>quotes, greentext, tripcode, sage, the address never shown', async () => {
  const env = world(); tick(); await post(env, { do: 'board', code: 'b', title: 'Random', nsfw: false, proof });
  assert.match((await J(await post(env, { do: 'post', b: 'b', body: 'no pic', proof }))).say, /starts with a picture/);
  assert.match((await J(await post(env, { do: 'post', b: 'b', body: 'x', proof }, { file: new TextEncoder().encode('<html>evil</html> and more bytes') }))).say, /only JPEG/);
  const op = await J(await post(env, { do: 'post', b: 'b', sub: 'First', body: '>be me\nhello', name: 'anon#secret', proof }, { file: JPEG_EXIF, thumb: JPEG_THUMB }));
  assert.equal(op.status, 201); assert.equal(op.no, 1); assert.equal(op.thread, 1); assert.match(op.trip, /^!/);
  const keys = [...env.FILMS.m.keys()]; assert.equal(keys.length, 2); assert.ok(keys.every((k) => /^boards\/[0-9a-f]{24}s?\.jpg$/.test(k)), keys.join());
  for (const k of keys) assert.deepEqual(B.metaIn(env.FILMS.m.get(k).bytes), [], 'kept with nothing hidden in it');
  tick(5e3); assert.match((await J(await post(env, { do: 'post', b: 'b', t: 1, body: 'too fast', proof }))).say, /15 seconds/);
  tick(20e3); const r1 = await J(await post(env, { do: 'post', b: 'b', t: 1, body: '>>1 agreed', proof }));
  assert.equal(r1.no, 2);
  let th = await J(await get(env, '?b=b&t=1')); const bumped = th.thread.bumped;
  assert.equal(th.posts.length, 2); assert.equal(th.thread.replies, 1); assert.equal(th.posts[0].trip, op.trip); assert.equal(th.posts[0].name, 'anon'); assert.equal(th.posts[0].body, '>be me\nhello');
  assert.match(th.thread.file.src, /^\/api\/boards\/i\/[0-9a-f]{24}\.jpg$/); assert.match(th.thread.file.thumb, /s\.jpg$/); assert.equal(th.thread.file.name, 'IMG_0001.jpg'); assert.equal(th.thread.file.w, 640);
  tick(20e3); await post(env, { do: 'post', b: 'b', t: 1, body: 'saged', options: 'sage', proof }, { ip: '198.51.100.9' });
  th = await J(await get(env, '?b=b&t=1')); assert.equal(th.thread.bumped, bumped, 'sage does not bump'); assert.equal(th.thread.replies, 2);
  const since = await J(await get(env, '?b=b&t=1&since=2')); assert.deepEqual(since.posts.map((p) => p.no), [3]); assert.equal(since.count, 3);
  const all = JSON.stringify([th, await J(await get(env, '?b=b')), await J(await get(env, '?q=agreed')), await J(await get(env, '?b=b&page=1'))]);
  assert.ok(!/"ip"|203\.0\.113|198\.51/.test(all), 'no address and no address hash in anything public');
  assert.deepEqual((await J(await get(env, '?b=b&p=3'))).thread, 1, '>>3 finds its thread');
  const page = await J(await get(env, '?b=b&page=1')); assert.equal(page.threads[0].last.length, 2);
  const s = await J(await get(env, '?q=AGREED')); assert.equal(s.results.length, 1); assert.equal(s.results[0].board, 'b');
  assert.equal((await J(await get(env, '?q=100%25'))).results.length, 0, 'LIKE wildcards are escaped');
  tick(20e3); assert.match((await J(await post(env, { do: 'post', b: 'b', body: 'second thread', proof }, { file: JPEG_EXIF }))).say, /3 minutes/);
  // a picture is served with its own type, never as a page, and only by a name of the right shape
  const name = th.thread.file.src.split('/').pop(), img = await get(env, '', { path: ['i', name] });
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg'); assert.equal(img.headers.get('x-content-type-options'), 'nosniff'); assert.match(img.headers.get('content-security-policy'), /sandbox/);
  for (const bad of ['../secret', 'x.jpg', name.replace('.jpg', '.html')]) assert.equal((await get(env, '', { path: ['i', bad] })).status, 404, bad);
});

test('text boards take no pictures; a locked board or thread takes no posts; the bump limit and the archive', async () => {
  const env = world(); tick(); await post(env, { do: 'board', code: 'txt', title: 'Text', nsfw: false, textOnly: true, proof });
  assert.match((await J(await post(env, { do: 'post', b: 'txt', body: 'x', proof }, { file: JPEG_EXIF }))).say, /text board/);
  assert.match((await J(await post(env, { do: 'post', b: 'txt', body: '', proof }))).say, /needs some words/);
  // 151 threads from 151 places: the oldest by bump goes to the archive, read only
  for (let i = 0; i < 151; i++) { tick(1000); assert.equal((await post(env, { do: 'post', b: 'txt', body: 'thread ' + i, proof }, { ip: '10.0.' + (i >> 8) + '.' + (i & 255) })).status, 201); }
  const cat = await J(await get(env, '?b=txt')); assert.equal(cat.threads.length, 150); assert.equal(cat.threads[0].no, 151); assert.equal(cat.threads[149].page, 10);
  const arc = await J(await get(env, '?b=txt&archive')); assert.deepEqual(arc.threads.map((t) => t.no), [1]);
  tick(); assert.match((await J(await post(env, { do: 'post', b: 'txt', t: 1, body: 'necro', proof }, { ip: '172.16.0.1' }))).say, /archive/);
  assert.equal((await J(await post(env, { do: 'mod', act: 'lock', b: 'txt', no: 2 }))).status, 403, 'not the owner');
  assert.equal((await J(await post(env, { do: 'mod', act: 'lock', b: 'txt', no: 2 }, { owner: true }))).ok, true);
  tick(); assert.match((await J(await post(env, { do: 'post', b: 'txt', t: 2, body: 'x', proof }, { ip: '172.16.0.2' }))).say, /locked/);
  await post(env, { do: 'mod', act: 'board-lock', b: 'txt' }, { owner: true });
  tick(); assert.match((await J(await post(env, { do: 'post', b: 'txt', t: 3, body: 'x', proof }, { ip: '172.16.0.3' }))).say, /locked/);
});

test('reports hide a post at three different addresses; the owner reviews, restores, deletes (the picture held, not public), bans; boards renamed and deleted', async () => {
  const env = world(); tick(); await post(env, { do: 'board', code: 'b', title: 'Random', nsfw: false, proof });
  await post(env, { do: 'post', b: 'b', body: 'op', proof }, { file: JPEG_EXIF, ip: '1.1.1.1' });
  tick(); await post(env, { do: 'post', b: 'b', t: 1, body: 'bad reply', proof }, { file: PNG_TEXT, ip: '2.2.2.2' });
  assert.match((await J(await post(env, { do: 'report', b: 'b', no: 2, why: 'because', proof }))).say, /say why/);
  for (const ip of ['3.3.3.3', '3.3.3.3', '4.4.4.4']) await post(env, { do: 'report', b: 'b', no: 2, why: 'spam or flooding', proof }, { ip });
  assert.equal((await J(await get(env, '?b=b&t=1'))).posts[1].hidden, undefined, 'two different people: still shown');
  const third = await J(await post(env, { do: 'report', b: 'b', no: 2, why: 'illegal content', proof }, { ip: '5.5.5.5' })); assert.equal(third.hidden, true);
  const pub = await J(await get(env, '?b=b&t=1')); assert.deepEqual(Object.keys(pub.posts[1]).sort(), ['at', 'hidden', 'no', 'thread'], 'hidden: nothing of it is sent');
  assert.equal((await get(env, '?review')).status, 403);
  const rev = await J(await get(env, '?review', { owner: true })); assert.equal(rev.posts[0].no, 2); assert.ok(rev.posts[0].why.some((w) => /illegal content \(1\)/.test(w)));
  assert.equal((await J(await get(env, '?b=b&t=1', { owner: true }))).posts[1].body, 'bad reply', 'the owner sees it');
  await post(env, { do: 'mod', act: 'restore', b: 'b', no: 2 }, { owner: true }); assert.equal((await J(await get(env, '?b=b&t=1'))).posts[1].body, 'bad reply');
  const pic = (await J(await get(env, '?b=b&t=1'))).posts[1].file.src.split('/').pop();
  assert.equal((await J(await post(env, { do: 'mod', act: 'delete', b: 'b', no: 2 }, { owner: true }))).ok, true);
  assert.equal((await J(await get(env, '?b=b&t=1'))).posts.length, 1); assert.equal((await J(await get(env, '?b=b&t=1'))).thread.replies, 0);
  assert.equal((await get(env, '', { path: ['i', pic] })).status, 404, 'out of public reach'); assert.ok(env.FILMS.m.has('boards-held/' + pic), 'held for a report');
  assert.equal((await J(await post(env, { do: 'mod', act: 'ban', b: 'b', no: 1, days: 2, why: 'test' }, { owner: true }))).ok, true);
  tick(); assert.equal((await J(await post(env, { do: 'post', b: 'b', t: 1, body: 'me again', proof }, { ip: '1.1.1.1' }))).kind, 'banned');
  assert.ok(!JSON.stringify(await J(await get(env, '?review', { owner: true }))).includes('1.1.1.1'));
  await post(env, { do: 'mod', act: 'board-rename', b: 'b', title: 'Random stuff', nsfw: true }, { owner: true });
  assert.deepEqual(['Random stuff', true].join(), [(await J(await get(env, '?b=b'))).board.title, (await J(await get(env, '?b=b'))).board.nsfw].join());
  await post(env, { do: 'mod', act: 'board-delete', b: 'b' }, { owner: true });
  assert.equal((await get(env, '?b=b')).status, 404); assert.equal([...env.FILMS.m.keys()].filter((k) => k.startsWith('boards/')).length, 0);
});

test('without Turnstile: a signed, unexpired proof of work, used once', async () => {
  const env = world({ TURNSTILE_SECRET: undefined, TURNSTILE_SITE_KEY: undefined }); tick();
  assert.equal((await J(await get(env, '?config'))).pow, B.POW_BITS);
  const c = await J(await get(env, '?challenge')), n = await B.doWork(c.c, c.bits);
  assert.equal((await J(await post(env, { do: 'board', code: 'a', title: 'A', nsfw: false, proof: { c: c.c, sig: c.sig, n: 1 } }))).say.includes('did not pass') || n === 1, true);
  assert.match((await J(await post(env, { do: 'board', code: 'a', title: 'A', nsfw: false, proof: { c: c.c, sig: '0'.repeat(64), n } }))).say, /not ours/);
  assert.equal((await post(env, { do: 'board', code: 'a', title: 'A', nsfw: false, proof: { c: c.c, sig: c.sig, n } })).status, 201);
  tick(11 * 60e3); const again = await J(await post(env, { do: 'board', code: 'a2', title: 'A', nsfw: false, proof: { c: c.c, sig: c.sig, n } }));
  assert.match(again.say, /used already|ran out of time/);
  assert.equal((await post({ DB: d1() }, { do: 'board' })).status, 503, 'no secret, no posting');
});

test('the share link previews the thread in words, never a posted picture; an 18+ board says only that', async () => {
  const p = sharePage('b', 3, { thread: 1, sub: 'Cats', body: 'look <here>', nsfw: 0 });
  assert.match(p, /<meta property="og:title" content="\/b\/ · Cats">/); assert.match(p, /url=\/boards\/\?b=b&amp;t=1#p3/); assert.match(p, /look &lt;here&gt;/); assert.match(p, /og:image" content="https:\/\/a-to-mind.com\/og.png"/);
  const x = sharePage('adult', 9, { thread: 9, sub: 'secret', body: 'words', nsfw: 1 }); assert.ok(!/secret|words/.test(x)); assert.match(x, /18\+/);
  const env = world(); tick(); await post(env, { do: 'board', code: 'b', title: 'R', nsfw: false, proof }); await post(env, { do: 'post', b: 'b', sub: 'Hello', body: 'there', proof }, { file: JPEG_EXIF });
  const r = await shareGet({ env, params: { path: ['b', '1'] }, request: new Request('https://a-to-mind.com/boards/t/b/1') }); assert.match(await r.text(), /\/b\/ · Hello/);
  assert.equal((await shareGet({ env, params: { path: ['B', 'x'] }, request: new Request('https://a-to-mind.com/boards/t/B/x') })).status, 404);
});

test('the page: registered as a tool, every chan part named on it, the rules and the takedown contact', async () => {
  const { TOOLS, RELATED, routeAsk } = await import('../void-live-deploy/lib/toolkit.js');
  const { PAGES } = await import('../void-live-deploy/lib/seo.js');
  assert.equal(TOOLS['/boards/'], 'Boards'); assert.ok(RELATED['/boards/']); assert.ok(PAGES.some((p) => p.path === '/boards/'));
  assert.equal(routeAsk('image boards'), '/boards/'); assert.equal(routeAsk('/tech/'), '/boards/?b=tech'); assert.equal(routeAsk('make a board'), '/boards/?new=1');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); assert.match(sw, /'\/boards\/'/);
  const html = fs.readFileSync(path.join(root, 'boards', 'index.html'), 'utf8'), page = html + fs.readFileSync(path.join(root, 'boards', 'app.js'), 'utf8');
  assert.doesNotMatch(html, /<script type="module"/, 'no module before load'); assert.match(html, /addEventListener\('load', \(\) => \{ import\('\/boards\/app\.js'\)/);
  for (const w of ['Catalog', 'Archive', 'Watch', 'Report', 'sage', 'Spoiler', 'tripcode', '18+', 'Make the first board', 'Search', '/boards/rules/', 'Share this page', 'Work-safe', 'index pages in bump order', B.CONTACT]) assert.ok(page.includes(w), w);
  const rules = fs.readFileSync(path.join(root, 'boards', 'rules', 'index.html'), 'utf8'); for (const r of B.RULES) assert.ok(rules.includes(r.slice(0, 40)), r.slice(0, 40)); assert.ok(rules.includes(B.CONTACT));
});

test('the stage card: the boards most active first, 18+ said, at most 8; its asks and not the owner\'s board', async () => {
  const { default: skill, boardLines } = await import('../void-live-deploy/skills/boards.js');
  for (const a of ['image boards', 'text boards', 'the chans', 'make a board', 'open the image boards']) assert.equal(skill.match(a.toLowerCase(), a), true, a);
  for (const a of ['show the board', 'chess board', 'board games']) assert.equal(skill.match(a, a), false, a);
  const lines = boardLines([{ code: 'a', title: 'A', last: 1 }, { code: 'x', title: 'X', nsfw: true, textOnly: true, last: 9 }]);
  assert.deepEqual(lines, [{ href: '/boards/?b=x', text: '/x/ · X (18+) · text' }, { href: '/boards/?b=a', text: '/a/ · A' }]);
  assert.equal(boardLines(Array.from({ length: 20 }, (_, i) => ({ code: 'b' + i, title: 'B', last: i }))).length, 8); assert.deepEqual(boardLines(null), []);
});

test('more than the chans: a delete password per post, poster IDs, an overboard, 1,000-post text threads, [code]', async () => {
  assert.equal(B.render('[code]a < b[/code] [/code]'), '<code class="cd">a &lt; b</code> [/code]'); assert.equal(B.render('[code]open'), '<code class="cd">open</code>');
  assert.deepEqual(B.limitsOf({ text_only: 1 }), { bump: 1000, replies: 1000, images: 0 }); assert.equal(B.limitsOf({ textOnly: false }).bump, 300);
  const env = world(); tick(); await post(env, { do: 'board', code: 'ids', title: 'IDs', nsfw: false, ids: true, proof }); tick(); await post(env, { do: 'board', code: 'nsf', title: 'N', nsfw: true, textOnly: true, proof }, { ip: '9.9.9.9' });
  assert.equal((await J(await get(env, '?b=ids'))).board.ids, true);
  await post(env, { do: 'post', b: 'ids', body: 'op', password: 'device-pass-1', proof }, { file: JPEG_EXIF, ip: '1.1.1.1' });
  tick(); await post(env, { do: 'post', b: 'ids', t: 1, body: 'me again', password: 'device-pass-1', proof }, { ip: '1.1.1.1' });
  tick(); await post(env, { do: 'post', b: 'ids', t: 1, body: 'someone else', proof }, { ip: '2.2.2.2' });
  const th = await J(await get(env, '?b=ids&t=1')), ids = th.posts.map((p) => p.id);
  assert.match(ids[0], /^[0-9a-f]{8}$/); assert.equal(ids[1], ids[0], 'one poster, one ID in the thread'); assert.notEqual(ids[2], ids[0]);
  assert.ok(!JSON.stringify(th).includes('delpass') && !JSON.stringify(th).includes('device-pass'), 'the password is never sent back');
  assert.equal((await J(await post(env, { do: 'delete-own', b: 'ids', no: 2, password: 'wrong-pass-0' }))).status, 403);
  assert.equal((await J(await post(env, { do: 'delete-own', b: 'ids', no: 3, password: 'device-pass-1' }))).status, 404, 'a post made without a password cannot be taken back');
  assert.equal((await J(await post(env, { do: 'delete-own', b: 'ids', no: 2, password: 'device-pass-1' }))).ok, true);
  assert.deepEqual((await J(await get(env, '?b=ids&t=1'))).posts.map((p) => p.no), [1, 3]);
  tick(); await post(env, { do: 'post', b: 'nsf', body: 'adult words', proof }, { ip: '3.3.3.3' });
  const ob = await J(await get(env, '?overboard')); assert.deepEqual(ob.threads.map((t) => [t.board, t.nsfw]), [['nsf', true], ['ids', false]]);
  assert.deepEqual((await J(await get(env, '?overboard&sfw=1'))).threads.map((t) => t.board), ['ids']);
});
