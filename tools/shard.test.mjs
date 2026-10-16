import test from 'node:test';
import assert from 'node:assert/strict';
import { hashLabel, parseShard, inShard } from './shard.mjs';
import fs from 'node:fs';

test('"i/n" parses, anything else means no sharding', () => {
  assert.deepEqual(parseShard('1/2'), { i: 1, n: 2 });
  assert.deepEqual(parseShard(' 3 / 4 '), { i: 3, n: 4 });
  for (const bad of ['', '0/2', '3/2', '2', '1/0', 'a/b', '1/65', undefined, null]) assert.equal(parseShard(bad), null, String(bad));
});
test('a heading lands in exactly one shard, the same one every time, and every shard gets some', () => {
  const labels = [...fs.readFileSync(new URL('./test_void.mjs', import.meta.url), 'utf8').matchAll(/^  if \(want\(("(?:[^"\\]|\\.)*")\)\)/gm)].map((m) => JSON.parse(m[1]));
  assert.ok(labels.length > 100, 'the suite has its sections');
  for (const n of [2, 3]) {
    const counts = Array.from({ length: n }, () => 0);
    for (const l of labels) { const hits = []; for (let i = 1; i <= n; i++) if (inShard(l, { i, n })) hits.push(i); assert.equal(hits.length, 1, l); counts[hits[0] - 1]++; }
    for (const c of counts) assert.ok(c > labels.length / (n * 3), 'a shard is not nearly empty: ' + counts.join('/'));
  }
  assert.equal(hashLabel('core: the shared page, the asks typed one after another'), hashLabel('core: the shared page, the asks typed one after another'));
  assert.ok(inShard('anything', null));
});
