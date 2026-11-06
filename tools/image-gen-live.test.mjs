// tools/image-gen-live.mjs: the record of one live check of the /image/ painter and its "Change it", on made-up responses, plus the edit copy
// made by the runner's image tool (a real ImageMagick or ffmpeg call when one is installed; skipped, and said so, when neither is).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { recordOf, ledgerWhat, nextOccasion, checkOnce, artifactName, answerOf, answerProblem, pageOf, scriptOf, pageProblem, bytesOf, shrinkWith, ASK, CHANGE, SITE } from './image-gen-live.mjs';
import { SAYS, fitsEdit } from '../void-live-deploy/lib/image-gen.js';
import { entryProblem } from './grow.mjs';

const AT = '2026-11-06T04:23:10.000Z';
const REF = 'a'.repeat(64), REF2 = 'b'.repeat(64), REF3 = 'c'.repeat(64);
// a PNG header of a given size, padded (enough for imageSizeOf; the live check never decodes it itself)
const png = (w, h, fill = 0) => { const b = Buffer.alloc(9000, fill); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(b); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const url = (b) => 'data:image/png;base64,' + b.toString('base64');
const PAGE = pageOf(200, '<main><button id="make"></button><div id="pics"></div></main><script type="module" src="/image/app.js"></script><meta name="verse-handoff" content="x">');
test('image-gen-live: the page counts as wired for hand-off by its tag or by the hand-off module it loads (/image/ has the module)', () => {
  assert.equal(pageOf(200, '<link rel="modulepreload" href="/lib/image-handoff.js">').handoff, true);
  assert.equal(pageOf(200, '<meta name="verse-handoff" content="in: text; out: image">').handoff, true);
  assert.equal(pageOf(200, '<main id="make"></main>').handoff, false);
});
const SCRIPT = scriptOf(200, "const smallOf = (src) => 1; async function changeIt(p) { body: JSON.stringify({ act: 'change' }) }");
const art = (extra = {}, fill = 1) => answerOf(200, { state: 'art', img: url(png(1024, 1024, fill)), seed: 4242, style: 'none', shape: 'square', painter: 'workers-ai', w: 1024, h: 1024, ref: REF, ...extra });
const COPY = { ok: true, tool: 'convert', type: 'image/jpeg', w: 504, h: 504, bytes: 41000 };

test('image-gen-live: a paint, a real change and a cached repeat pass and are ok, keep no picture bytes, and the ledger line is a valid finding', () => {
  const paint = art(), change = art({ ref: REF2, change: CHANGE }, 2), again = art({ ref: REF2, change: CHANGE, cached: true }, 2);
  const rec = recordOf({ left: 158, page: PAGE, script: SCRIPT, paint, copy: COPY, change, again, ms: 31234.6, at: AT, occasion: 1 });
  assert.equal(rec.checksPass, true, rec.error); assert.equal(rec.ok, true); assert.equal(rec.skill, 'image-gen'); assert.equal(rec.attempt, 'live');
  assert.equal(rec.ms, 31235); assert.equal(rec.left, 158); assert.deepEqual(rec.request, [SITE + '/api/image', SITE + '/image/', SITE + '/image/app.js']);
  assert.deepEqual(rec.again, { state: 'art', cached: true, same: true });
  assert.equal(rec.paint.img.w, 1024); assert.match(rec.paint.img.sha256, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(rec), /base64|iVBOR/, 'the artifact keeps no picture bytes');
  assert.equal(artifactName(rec), '2026-11-06T0423.json');
  const what = ledgerWhat(rec);
  assert.match(what, /for the first time/); assert.match(what, /changed with one typed line/); assert.match(what, /findings\/image-gen\/2026-11-06T0423\.json/);
  assert.equal(entryProblem({ at: '2026-11-06T04:23:10Z', by: 'image-gen-live', kind: 'finding', what, ref: 'https://github.com/atomeam/void-loop/blob/main/findings/image-gen/2026-11-06T0423.json' }), null);
  assert.match(ledgerWhat({ ...rec, occasion: 3 }), /occasion 3/);
});

test('image-gen-live: a resting painter or a resting change in the route\'s own words passes but is not ok; other words are a problem', () => {
  const rest = (why) => answerOf(200, { state: 'resting', why, say: SAYS[why][0] });
  const r1 = recordOf({ page: PAGE, script: SCRIPT, paint: rest('cap'), at: AT });
  assert.equal(r1.checksPass, true); assert.equal(r1.ok, false); assert.match(ledgerWhat(r1), /painter is resting \(cap\)/);
  const r2 = recordOf({ page: PAGE, script: SCRIPT, paint: art(), copy: COPY, change: rest('cap'), at: AT });
  assert.equal(r2.checksPass, true); assert.equal(r2.ok, false); assert.match(ledgerWhat(r2), /change is resting \(cap\)/);
  const r3 = recordOf({ page: PAGE, script: SCRIPT, paint: answerOf(200, { state: 'resting', why: 'cap', say: 'All good!' }), at: AT });
  assert.equal(r3.checksPass, false); assert.match(r3.error, /not the route's own/);
  const r4 = recordOf({ page: PAGE, script: SCRIPT, paint: art(), copy: COPY, change: rest('gone'), at: AT });
  assert.equal(r4.checksPass, false); assert.match(r4.error, /resting for gone/);
  const r5 = recordOf({ page: PAGE, script: SCRIPT, paint: art(), copy: { ok: false, why: 'no image tool on the runner (convert missing or failed)' }, at: AT });
  assert.equal(r5.checksPass, false); assert.equal(r5.ok, false); assert.match(r5.error, /^the edit copy: no image tool/);
});

test('image-gen-live: a change that is the same picture, not cached again, by another painter, or without the typed line is a problem', () => {
  const base = { page: PAGE, script: SCRIPT, paint: art(), copy: COPY, at: AT };
  const ch = art({ ref: REF2, change: CHANGE }, 2), again = art({ ref: REF2, change: CHANGE, cached: true }, 2);
  assert.match(recordOf({ ...base, change: art({ ref: REF2, change: CHANGE }, 1), again }).error, /same picture came back/);
  assert.match(recordOf({ ...base, change: ch, again: art({ ref: REF3, change: CHANGE }, 2) }).error, /did not come from the cache/);
  assert.match(recordOf({ ...base, change: ch, again: null }).error, /did not come from the cache/);
  assert.match(recordOf({ ...base, change: art({ ref: REF2, change: CHANGE, painter: 'pollinations' }, 2), again }).error, /not Workers AI/);
  assert.match(recordOf({ ...base, change: art({ ref: REF2 }, 2), again }).error, /does not name the typed line/);
  assert.match(recordOf({ ...base, change: art({ ref: REF2, change: CHANGE, w: 768 }, 2), again }).error, /768x1024, not 1024x1024/);
});

test('image-gen-live: answers and the page are checked against their contract', () => {
  assert.match(answerProblem(answerOf(200, { state: 'art', img: url(png(1024, 1024)), w: 1024, h: 1024 }), 'the paint'), /no 64-hex ref/);
  assert.match(answerProblem(answerOf(200, { state: 'art', img: 'https://x/y.png', ref: REF }), 'the paint'), /no jpeg or png/);
  assert.match(answerProblem(answerOf(403, { state: 'refused', why: 'origin' }), 'the paint'), /answered 403 refused \(origin\)/);
  assert.match(answerProblem(null, 'the paint'), /no answer/);
  assert.equal(bytesOf('data:image/webp;base64,AAAA'), null); assert.equal(bytesOf(url(png(4, 4))).type, 'image/png');
  assert.equal(pageProblem(PAGE, SCRIPT), '');
  assert.match(pageProblem(pageOf(200, '<div id="pics"></div>'), SCRIPT), /no make, app/);
  assert.match(pageProblem(PAGE, scriptOf(200, 'const smallOf = 1')), /no changeIt, sendsChange/);
  assert.match(pageProblem(pageOf(404, ''), SCRIPT), /answered 404/);
  assert.match(recordOf({ page: pageOf(500, ''), script: SCRIPT, paint: art(), at: AT }).error, /\/image\/ answered 500/);
});

test('image-gen-live: checkOnce paints, shrinks, changes and repeats, in that order, and sends only the fixed words', async () => {
  const seen = [];
  const fetchFn = async (u, o = {}) => {
    const body = o.body ? JSON.parse(o.body) : null; seen.push([o.method || 'GET', u.replace(SITE, ''), body && (body.act || body.prompt)]);
    const j = (x) => ({ status: 200, json: async () => x, text: async () => JSON.stringify(x) });
    if (u.endsWith('/image/')) return { status: 200, text: async () => '<button id="make"></button><div id="pics"></div><script type="module" src="/image/app.js"></script>' };
    if (u.endsWith('/image/app.js')) return { status: 200, text: async () => "const smallOf = 1; async function changeIt() { act: 'change' }" };
    if (!body) return j({ left: 160, perConnection: 24 });
    if (!body.act) { assert.deepEqual(body, ASK); return j({ state: 'art', img: url(png(1024, 1024, 1)), painter: 'workers-ai', w: 1024, h: 1024, ref: REF }); }
    assert.equal(body.ref, REF); assert.equal(body.change, CHANGE); assert.match(body.src, /^data:image\/jpeg;base64,/);
    return j({ state: 'art', img: url(png(1024, 1024, 2)), painter: 'workers-ai', w: 1024, h: 1024, ref: REF2, change: CHANGE, ...(seen.filter((s) => s[2] === 'change').length > 1 ? { cached: true } : {}) });
  };
  const shrink = (pic, size) => { assert.deepEqual(size, [1024, 1024]); assert.equal(pic.type, 'image/png'); return { ...COPY, src: 'data:image/jpeg;base64,/9j/AAAA' }; };
  const res = await checkOnce(fetchFn, shrink);
  assert.deepEqual(seen.map((s) => s[0] + ' ' + s[1] + (s[2] ? ' ' + s[2] : '')), ['GET /api/image', 'GET /image/', 'GET /image/app.js', 'POST /api/image ' + ASK.prompt, 'POST /api/image change', 'POST /api/image change']);
  const rec = recordOf({ ...res, at: AT });
  assert.equal(rec.ok, true, rec.error); assert.equal(rec.left, 160);
  const down = await checkOnce(async () => { throw Object.assign(new Error('x'), { cause: { code: 'ENOTFOUND' } }); }, shrink);
  assert.match(recordOf({ ...down, at: AT }).error, /unreachable: ENOTFOUND/); assert.equal(recordOf({ ...down, at: AT }).status, 0);
});

test('image-gen-live: the edit copy is the page\'s own size, a JPEG the route accepts (a real image tool, when the machine has one)', (t) => {
  const has = ['magick', 'convert', 'ffmpeg'].some((c) => !spawnSync(c, ['-version']).error);
  if (!has) { t.skip('no ImageMagick or ffmpeg on this machine'); return; }
  const dir = mkdtempSync(join(os.tmpdir(), 'igl-')), f = join(dir, 'in.png');
  const made = spawnSync('convert', ['-size', '1152x768', 'plasma:', f]);
  if (made.error || made.status !== 0) { const ff = spawnSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1152x768', '-frames:v', '1', '-y', f]); if (ff.status !== 0) { t.skip('could not make a test picture'); return; } }
  const pic = bytesOf('data:image/png;base64,' + readFileSync(f).toString('base64'));
  const copy = shrinkWith(pic, [1152, 768]);
  assert.equal(copy.ok, true, copy.why); assert.equal(copy.type, 'image/jpeg'); assert.equal(copy.w, 504); assert.equal(copy.h, 336);
  assert.ok(fitsEdit({ w: copy.w, h: copy.h }, [1152, 768])); assert.match(copy.src, /^data:image\/jpeg;base64,\/9j\//);
  const none = shrinkWith(pic, [1024, 1024], () => ({ error: new Error('ENOENT') }));
  assert.equal(none.ok, false); assert.match(none.why, /no image tool on the runner \(magick, convert, ffmpeg/);
  writeFileSync(join(dir, '2026-11-01T0423.json'), '{}'); assert.equal(nextOccasion(dir), 2); assert.equal(nextOccasion(join(dir, 'none')), 1);
});

test('image-gen-live: checkOnce against the real route (fake D1, fake Workers AI, fake edge cache) reads it as ok, so the two agree on the wire', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const route = await import('../void-live-deploy/functions/api/image.js');
  const { resetGuard } = await import('../void-live-deploy/lib/guard.js');
  const store = new Map(), prior = globalThis.caches;
  globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
  try {
    resetGuard(); route.resetReady();
    const db = new DatabaseSync(':memory:'), stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return { meta: {} }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
    let n = 0; const AI = { run: async () => ({ image: '/9j/' + String.fromCharCode(65 + n++).repeat(12000) }) };
    const env = { DB: { prepare: (sql) => stmt(sql) }, SALT: 'test-salt', AI }; // secret-scan: ok (a made-up salt for the test)
    const site = 'https://x';
    const fetchFn = async (u, o = {}) => {
      if (u.endsWith('/image/')) return { status: 200, text: async () => '<button id="make"></button><div id="pics"></div><script type="module" src="/image/app.js"></script>' };
      if (u.endsWith('/image/app.js')) return { status: 200, text: async () => "const smallOf = 1; async function changeIt() { act: 'change' }" };
      const request = new Request(u, { method: o.method || 'GET', headers: { ...(o.headers || {}), 'cf-connecting-ip': '203.0.113.7' }, ...(o.body ? { body: o.body } : {}) });
      return o.method === 'POST' ? route.onRequestPost({ request, env }, async () => new Response('no', { status: 502 })) : route.onRequestGet({ request, env });
    };
    const shrink = () => ({ ...COPY, type: 'image/png', src: url(png(504, 504)).replace(/=+$/, '') });
    const res = await checkOnce(fetchFn, shrink, site);
    const rec = recordOf({ ...res, at: AT });
    assert.equal(rec.checksPass, true, rec.error); assert.equal(rec.ok, true);
    assert.equal(rec.paint.painter, 'workers-ai'); assert.equal(rec.change.change, CHANGE); assert.deepEqual(rec.again, { state: 'art', cached: true, same: true });
    assert.equal(n, 2, 'the check costs two Workers AI pictures: the paint and the change; the repeat is free');
  } finally { globalThis.caches = prior; }
});
