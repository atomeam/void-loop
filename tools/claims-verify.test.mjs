// node --test tools/claims-verify.test.mjs: Verse never claims a build that doesn't answer (Adam, 2026-10-15). The showcase plays a
// ledger build only when its ask is on claims-verified.json; the rest count as in progress. Every ledger build's ask and every
// must-pass ask ("cat", "what's new", "tester log", ...) is on that list, i.e. answered with its own card, never the fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { whatsNew } from '../void-live-deploy/skills/showcase.js';
import { claimsOf, isFallthrough, MUST, CLEAN } from './claims-verify.mjs';

const E = [{ at: '2026-10-15T02:00:00Z', kind: 'grow', what: 'Tester log on the growth card', try: 'tester log' },
  { at: '2026-10-15T01:00:00Z', kind: 'grow', what: 'A thing that only finds Wikipedia', try: 'zebra facts deluxe' }];

test('an unverified build is never played as built; it counts as in progress', () => {
  const r = whatsNew(E, { verified: new Set(['tester log']) });
  assert.deepEqual(r.steps.map((s) => s.ask), ['tester log']);
  assert.deepEqual(r.waiting.map((p) => p.ask), ['zebra facts deluxe']);
  assert.equal(whatsNew(E, { verified: new Set() }).steps.length, 0, 'no proof, no claim');
});
test('the fallback notes count as fallthrough; a skill card does not', () => {
  for (const n of ['article', 'answer', 'short topic', 'article fallback', null, 'miss:cat']) assert.ok(isFallthrough(n), String(n));
  for (const n of ['skill:store', 'skill:growth', 'navigated']) assert.ok(!isFallthrough(n), n);
});
test('claims: must-pass asks first, then ledger tries, then skill examples, each once', () => {
  const c = claimsOf(E, [['store', ['what can i buy']], ['growth', ['tester log']]]);
  assert.ok(c.some((x) => x.ask === 'cat' && x.from === 'topic'));
  assert.equal(c.filter((x) => CLEAN(x.ask) === 'tester log').length, 1);
});
test('claims-verified.json holds every must-pass ask (rerun node tools/claims-verify.mjs)', () => {
  const ok = new Set(JSON.parse(fs.readFileSync(new URL('../void-live-deploy/claims-verified.json', import.meta.url), 'utf8')).ok);
  for (const a of MUST) assert.ok(ok.has(CLEAN(a)), a + ' falls through to the encyclopedia/fallback');
});
