// Convergence step 3, first half (lists run 22, 2026-11-12): the one-line `json` reply that 25 endpoints each wrote out is one copy in
// lib/http.js, in its two forms (json: only the headers given; jsonNoStore: no-store first, extra headers win). The old copies are kept
// verbatim here and compared on the same inputs; no endpoint may grow the exact copy back.
// Run: node --test tools/http-helpers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { json, jsonNoStore } from '../void-live-deploy/lib/http.js';

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
