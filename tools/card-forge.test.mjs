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
  assert.deepEqual(RETRY_S, [25, 50, 100, 200, 400]); // backoff to about 13 minutes in all, five tries at most (the art maker's three-a-minute limit)
});
test('a card titled only with its frame word ("Calculated") is never painted; the answer keeps Verse\'s plate', () => {
  for (const k of ['Calculated', 'Converted', 'Result', 'Answer']) assert.equal(worthy(card({ subject: k }), { key: k, typeLine: 'Answer \u2014 from Verse' }), false, k);
  assert.equal(worthy(card({ subject: 'calculator' }), { key: 'calculator', typeLine: 'Answer \u2014 from Verse' }), true);
});

test('a recipe card about pancakes paints as an answer even after data-skill lands; a skill\'s own card stays a skill', async () => {
  const { kindOf } = await import('../void-live-deploy/lib/card-forge.js');
  const el = { dataset: {}, _vcArtKey: 'pancake' }, c = { key: 'pancake' }; // the subject kept from the card's first ask (subjectFor)
  assert.equal(kindOf(el, c), 'answer');
  el.dataset.skill = 'recipe'; assert.equal(kindOf(el, c), 'answer', 'the same subject, the same kind: its old skill row is never asked for');
  assert.equal(kindOf({ dataset: { skill: 'recipe' } }, { key: 'recipe' }), 'skill');
  assert.equal(kindOf({ dataset: { skill: 'weather', artKind: 'weather', artSubject: 'Paris France rain' } }, {}), 'weather');
});

test('a busy paint is tried again: the retry counter exists (2026-11-19: a comment swallowed "const tries", so no retry ever ran)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../void-live-deploy/lib/card-forge.js', import.meta.url), 'utf8');
  assert.match(src, /^export const RETRY_S = \[[^\]]+\]; const tries = new Map\(\);/m, 'tries is declared, not inside a comment');
  const calls = []; let n = 0;
  globalThis.fetch = async (u, o) => { calls.push((o && o.method) || 'GET'); n++; return { ok: true, json: async () => (n === 1 ? { state: 'none', stale: true } : { state: 'plate', why: 'busy' }) }; };
  const realST = globalThis.setTimeout, timers = []; globalThis.setTimeout = (f, ms) => { timers.push(ms); return 0; };
  try {
    const F = await import('../void-live-deploy/lib/card-forge.js?retry');
    const art = { classList: { toggle() {} }, querySelector: () => null, querySelectorAll: () => [] };
    const el = { isConnected: true, dataset: {}, classList: { contains: () => false }, querySelector: (q) => (/vc-art/.test(q) ? art : null), querySelectorAll: () => [], children: [] };
    F.forge(el, { key: 'dragon', kindName: 'answer', typeLine: 'Answer' }, null);
    for (let i = 0; i < 20 && !timers.includes(25000); i++) await new Promise((ok) => realST(ok, 5));
    assert.deepEqual(calls.slice(0, 2), ['GET', 'POST']); assert.ok(timers.includes(25000), 'a retry is set after a busy paint: ' + timers);
  } finally { globalThis.setTimeout = realST; delete globalThis.fetch; }
});
