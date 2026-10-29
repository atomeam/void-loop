// The Art Forge's page side (lib/card-forge.js): which cards are painted and which failed paints are tried again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { worthy, retryable, RETRY_S } from '../void-live-deploy/lib/card-forge.js';

const card = (o = {}) => ({ classList: { contains: () => false }, dataset: o.dataset || {}, _vcSubject: o.subject });
test('a loading card or a fragment of a word is never painted; a real subject is', () => {
  assert.equal(worthy(card({ subject: 'incident autopsy' }), { key: 'incident autopsy', typeLine: 'Answer — from Verse' }), true);
  assert.equal(worthy(card({ subject: 'looking' }), { key: 'looking', typeLine: 'Repository — looking' }), false, 'the repo card while it loads');
  assert.equal(worthy(card({ subject: 'rt' }), { key: 'rt', typeLine: 'Answer — from Verse' }), false, 'a two-letter fragment');
  assert.equal(worthy(card({ subject: 'void loop' }), { key: 'void-loop', typeLine: 'Repository — looking' }), false, 'any card whose type line says it is still looking');
  assert.equal(worthy(card({ subject: 'grand theft auto vi' }), { key: 'Until Grand Theft Auto VI', typeLine: 'Answer — from Verse', kindName: 'person' }), false, 'people are never painted');
});
test('a busy, rate-limited or failed paint is tried again a few times; the cap and the off switch are final', () => {
  for (const got of [null, { state: 'plate', why: 'busy' }, { state: 'plate', why: 'slow' }, { state: 'plate', why: 'http' }]) assert.equal(retryable(got), true, JSON.stringify(got));
  for (const got of [{ state: 'plate', why: 'cap' }, { state: 'plate', why: 'off' }, { state: 'plate', why: 'secret' }]) assert.equal(retryable(got), false, JSON.stringify(got));
  assert.deepEqual(RETRY_S, [25, 50, 100]); // under three minutes in all, and never more than three tries
});
