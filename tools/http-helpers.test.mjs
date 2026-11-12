// Convergence step 3, first half (lists run 22, 2026-11-12): the one-line `json` reply that 25 endpoints each wrote out is one copy in
// lib/http.js, in its two forms (json: only the headers given; jsonNoStore: no-store first, extra headers win). The old copies are kept
// verbatim here and compared on the same inputs; no endpoint may grow the exact copy back.
// Run: node --test tools/http-helpers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { json, jsonNoStore, jsonOkCached } from '../void-live-deploy/lib/http.js';

const oldJson = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
const oldNoStore = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const same = async (a, b) => {
  assert.equal(a.status, b.status);
  assert.deepEqual([...a.headers.entries()].sort(), [...b.headers.entries()].sort());
  assert.equal(await a.text(), await b.text());
};

test('both forms answer exactly as the old copies did', async () => {
  const cases = [[{ ok: true }], [{ error: 'no' }, 400], [{ a: [1, 2] }, 200, { 'cache-control': 'public, max-age=60' }], [null, 200, { 'x-robots-tag': 'noindex' }], ['text', 503, { 'retry-after': '5' }]];
  for (const c of cases) { await same(json(...c), oldJson(...c)); await same(jsonNoStore(...c), oldNoStore(...c)); }
  assert.equal(jsonNoStore({}).headers.get('cache-control'), 'no-store');
  assert.equal(jsonNoStore({}, 200, { 'cache-control': 'max-age=5' }).headers.get('cache-control'), 'max-age=5', 'an endpoint may set its own');
  assert.equal(json({}).headers.get('cache-control'), null);
});

const root = new URL('../void-live-deploy/functions/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const OLD = [
  'const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });',
  "const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });",
];

test('no endpoint keeps its own exact copy, and the 25 that had one import lib/http.js', () => {
  const files = walk(root);
  const users = files.filter((f) => /from '(\.\.\/)+lib\/http\.js'/.test(readFileSync(f, 'utf8')));
  for (const f of files) { const lines = readFileSync(f, 'utf8').split(/\r?\n/); for (const o of OLD) assert.ok(!lines.includes(o), f + ' still has its own json'); }
  assert.ok(users.length >= 25, users.length + ' endpoints import lib/http.js');
});

test('every endpoint that imports lib/http.js still loads', async () => {
  for (const f of walk(root).filter((f) => /lib\/http\.js/.test(readFileSync(f, 'utf8')))) await import(pathToFileURL(f).href);
});

// Step 3, second half (lists run 23, 2026-11-12): the 23 endpoints whose json had its own cache rule, extra header or argument order keep a
// wrapper with their old signature that calls lib/http.js. Each old form is kept verbatim here and compared with its wrapper.
const FORMS = [
  ['no-store, two arguments (blueprint, fanfic-hits, studio, claim, apibot, watchalong, film-views, report-run)', (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } }), (o, status = 200) => jsonNoStore(o, status)],
  ['no-store with optional extra (credits)', (body, status = 200, extra) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...(extra || {}) } }), (body, status = 200, extra) => jsonNoStore(body, status, extra || {})],
  ['no-store, noindex (unbidden, agent)', (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } }), (o, status = 200) => jsonNoStore(o, status, { 'x-robots-tag': 'noindex' })],
  ['no-store, noindex nofollow (team)', (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } }), (o, status = 200) => jsonNoStore(o, status, { 'x-robots-tag': 'noindex, nofollow' })],
  ['own cache argument (treasury, sponsors, markets)', (o, status = 200, cache = 'no-store') => Response.json(o, { status, headers: { 'cache-control': cache } }), (o, status = 200, cache = 'no-store') => jsonNoStore(o, status, { 'cache-control': cache })],
  ['status only (appraise, translate)', (body, status = 200) => Response.json(body, { status }), (body, status = 200) => json(body, status)],
  ['status first (share, share room, bench)', (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }), (status, body) => jsonNoStore(body, status)],
  ['public 60 s on a 200 (status)', (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store' } }), (o, status = 200) => jsonOkCached(o, status, 60)],
  ['public 60 s on a 200, noindex (crew)', (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store', 'x-robots-tag': 'noindex' } }), (o, status = 200) => jsonOkCached(o, status, 60, { 'x-robots-tag': 'noindex' })],
  ['public 300 s on a 200, extra (autopilot)', (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=300' : 'no-store', ...extra } }), (o, status = 200, extra = {}) => jsonOkCached(o, status, 300, extra)],
];

test('step 3 second half: every wrapper answers exactly as the old form it replaced', async () => {
  for (const [name, old, now] of FORMS) {
    const statusFirst = name.startsWith('status first');
    const cases = statusFirst ? [[200, { ok: true }], [401, { error: 'no' }], [503, { a: [1] }]]
      : [[{ ok: true }], [{ error: 'no' }, 400], [{ a: [1, 2] }, 200], [{ b: 1 }, 503, { 'cache-control': 'max-age=5', 'x-a': '1' }], [{ c: 2 }, 200, 'public, max-age=9']];
    for (const c of cases) {
      if (typeof c[2] === 'string' && !name.startsWith('own cache')) continue;
      if (typeof c[2] === 'object' && name.startsWith('own cache')) continue;
      await same(now(...c), old(...c));
    }
  }
});

const OLD2 = [
  "const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });",
  "const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } });",
  "const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });",
  "const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store' } });",
];

test('step 3 second half: no endpoint grows the replaced forms back, and at least 46 endpoints use lib/http.js', () => {
  const files = walk(root);
  for (const f of files) { const lines = readFileSync(f, 'utf8').split(/\r?\n/); for (const o of OLD2) assert.ok(!lines.includes(o), f + ' still has its own json'); }
  const users = files.filter((f) => /from '(\.\.\/)+lib\/http\.js'/.test(readFileSync(f, 'utf8')));
  assert.ok(users.length >= 46, users.length + ' endpoints import lib/http.js');
});

