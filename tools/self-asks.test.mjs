// V01D's self-knowledge, device state and arcade ladder (asked by Void, 2026-10-16). node --test tools/self-asks.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { knowOf, sectionsOf } from '../void-live-deploy/skills/know.js';
import { STORES, summary, sessionToken, read, write } from '../void-live-deploy/lib/state.js';
import { stateOf, stateHtml } from '../void-live-deploy/skills/state.js';
import { record, rating, played, ladderHtml, finish, load } from '../void-live-deploy/lib/ladder.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

test('know: the asks and the unknowns', () => {
  assert.equal(knowOf('What is VoidQuest?'), 'voidquest'); assert.equal(knowOf('which games do you know'), 'games');
  assert.equal(knowOf('which miniatures do you have'), 'minis'); assert.equal(knowOf('show me your canon'), 'canon');
  for (const n of ['what is a motto', 'play voidquest', 'which games are popular']) assert.equal(knowOf(n), '', n);
  const self = { canon: { version: 6, motto: 'm', voidquest: '' }, games: ['connect4', 'chess'], minis: ['clock'] };
  const all = sectionsOf(self, 'canon');
  assert.match(all.find((s) => s.h === 'VoidQuest').p, /do not know it/); // never made up
  assert.deepEqual(all.find((s) => /games/.test(s.h)).links[0], ['Four in a Row', 'play connect4']);
  assert.equal(sectionsOf(null, 'motto')[0].p.includes('do not know'), true);
});
test('state: one list of keys, secrets never shown, the memory session reads from it', () => {
  const s = mem();
  assert.equal(sessionToken(s), ''); write('me', JSON.stringify({ token: 'member-t' }), s); assert.equal(sessionToken(s), 'member-t');
  write('owner', 'own-t', s); assert.equal(sessionToken(s), 'own-t'); // secret-scan: ok: made-up values
  const rows = summary(s), owner = rows.find((r) => r.name === 'owner');
  assert.ok(owner.kept && owner.secret && !JSON.stringify(rows).includes('own-t'));
  assert.equal(new Set(Object.values(STORES).map((d) => d.key)).size, Object.keys(STORES).length);
  assert.ok(stateOf('show my state') && stateOf('what do you keep on this device') && !stateOf('state machine') && !stateOf('what is the state of texas'));
  assert.ok(!stateHtml(esc, rows, 'owner').includes('own-t'));
  assert.equal(read('stage', s), null);
});
test('ladder: Verse moves 16 a match, never under 400, draws and nonsense do not move it', () => {
  let l = null;
  for (const w of ['void', 'void', 'you']) l = record(l, 'pong', w);
  assert.equal(rating(l, 'pong'), 1016); assert.equal(played(l, 'pong'), 3); assert.equal(rating(l, 'snake'), 1000);
  l = record(l, 'pong', 'draw'); l = record(l, 'pong', 'maybe'); l = record(l, 'chess', 'void'); assert.equal(rating(l, 'pong'), 1016); assert.equal(played(l, 'pong'), 4);
  let low = null; for (let i = 0; i < 60; i++) low = record(low, 'snake', 'you'); assert.equal(rating(low, 'snake'), 400);
  assert.equal(ladderHtml(esc, record(null, 'snake', 'draw')).includes('Void Snake 1000'), true);
  assert.equal(ladderHtml(esc, null), '');
  const s = mem(); finish('pong', 'void', s); finish('pong', 'void', s); assert.equal(rating(load(s), 'pong'), 1032);
});
