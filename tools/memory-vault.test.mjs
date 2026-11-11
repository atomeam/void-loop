import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyVault, normalizeEntity, put, link, related, search, autoLink, stats, remove, loadVault, saveVault } from '../void-live-deploy/lib/memory-vault.js';

test('normalizeEntity: rejects invalid', () => {
  assert.equal(normalizeEntity(null), null);
  assert.equal(normalizeEntity({}), null);
  assert.equal(normalizeEntity({ id: 'x' }).kind, 'note');
});
test('put + stats', () => {
  let v = emptyVault();
  v = put(v, { id: 'a', kind: 'card', title: 'Hello', tags: ['foo', 'bar'] });
  v = put(v, { id: 'b', kind: 'skill', title: 'World', tags: ['bar'] });
  assert.equal(stats(v).entities, 2);
  assert.equal(stats(v).kinds.card, 1);
});
test('link + related', () => {
  let v = emptyVault();
  v = put(v, { id: 'a', title: 'A' });
  v = put(v, { id: 'b', title: 'B' });
  v = link(v, 'a', 'b', 'related');
  const r = related(v, 'a');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'b');
});
test('autoLink by shared tag', () => {
  let v = emptyVault();
  v = put(v, { id: 'a', title: 'A', tags: ['x'] });
  v = put(v, { id: 'b', title: 'B', tags: ['x'] });
  v = autoLink(v, 'a');
  assert.equal(related(v, 'a').length, 1);
});
test('search', () => {
  let v = emptyVault();
  v = put(v, { id: 'a', title: 'Hello world', body: 'foo', tags: [] });
  v = put(v, { id: 'b', title: 'Goodbye', body: 'bar', tags: [] });
  assert.equal(search(v, 'hello').length, 1);
  assert.equal(search(v, 'foo bar').length, 0);
  assert.equal(search(v, '').length, 2);
});
test('remove', () => {
  let v = emptyVault();
  v = put(v, { id: 'a', title: 'A' });
  v = put(v, { id: 'b', title: 'B' });
  v = link(v, 'a', 'b');
  v = remove(v, 'a');
  assert.equal(stats(v).entities, 1);
  assert.equal(stats(v).edges, 0);
});
test('loadVault/saveVault roundtrip', () => {
  const mem = {};
  const storage = { getItem: (k) => mem[k], setItem: (k, v) => { mem[k] = v; } };
  let v = emptyVault();
  v = put(v, { id: 'x', title: 'X' });
  assert.equal(saveVault(v, storage), true);
  const loaded = loadVault(storage);
  assert.equal(loaded.entities.x.title, 'X');
});