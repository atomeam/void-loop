// Verse makes no KV writes (lists run 6, 2026-10-28; wishlist #2 "cut KV writes under 1k/day"). Cloudflare's free KV write limit is per
// account, and Verse's only KV binding (wrangler.toml) is read: rate limits and duplicate checks live in the edge cache (caches.default)
// since 2026-09-27. This fails the day functions/ or lib/ write to a KV binding again. Run: node --test tools/kv-writes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../void-live-deploy/', import.meta.url).pathname;
const toml = readFileSync(join(root, 'wrangler.toml'), 'utf8');
const kv = [...toml.matchAll(/\[\[kv_namespaces\]\][^\[]*?binding\s*=\s*"([A-Z0-9_]+)"/g)].map((m) => m[1]);
const files = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.m?js$/.test(f) ? [p] : []; });

test('the KV bindings are found', () => { assert.ok(kv.length >= 1, 'wrangler.toml lists a KV binding'); });
test('no code writes or deletes through a KV binding', () => {
  const bad = [];
  for (const f of [...files(join(root, 'functions')), ...files(join(root, 'lib'))]) {
    const src = readFileSync(f, 'utf8');
    for (const b of kv) if (new RegExp('\\b' + b + '\\s*\\)?\\s*\\.\\s*(?:put|delete)\\s*\\(').test(src)) bad.push(f.slice(root.length) + ' writes ' + b);
  }
  assert.deepEqual(bad, [], 'use caches.default (the edge cache) or D1 instead of a KV write');
});
