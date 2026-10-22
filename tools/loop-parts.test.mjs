// node tools/loop-parts.test.mjs — the skill library's retrieval and the pre-ship critic (docs/LOOP-GAPS.md).
import assert from 'node:assert/strict';
import { retrieve, importance, recency, relevance } from './loop-library.mjs';
import { critique } from './loop-critic.mjs';
const now = Date.parse('2026-10-22T00:00:00Z');
const E = [
  { at: '2026-10-21T00:00:00Z', kind: 'build', what: 'ritual-template: morning routine as calendar events', try: 'morning routine as calendar events', asked: 'x' },
  { at: '2026-09-01T00:00:00Z', kind: 'build', what: 'ritual list for evening routine' },
  { at: '2026-10-21T00:00:00Z', kind: 'revert', what: 'reverted calendar export that broke the ics' },
  { at: '2026-10-21T00:00:00Z', kind: 'build', what: 'crypto board fallback' },
];
const h = retrieve(E, 'export my morning routine to calendar', { now });
assert.equal(h[0].e, E[0]); assert.ok(!h.some((x) => x.e === E[3]), 'no shared word, not returned');
assert.equal(importance(E[2]), 1); assert.ok(recency(E[0], now) > recency(E[1], now));
assert.equal(relevance('', E[0]), 0);
const diff = ['+++ b/void-live-deploy/void.growth.json',
  '+{"what":"Verse hardened itself: 4 benchmark ask(s)"}',
  '+{"what":"weather now shows the full forecast..."}',
  '+{"what":"I feel alive today"}',
  '+{"what":"ritual-template: \'morning routine as calendar events\' opens ritual-template"}',
  '+++ b/tools/other.mjs', '+// 3 fixes...'].join('\n');
const ids = critique(diff).map((x) => x.id).sort();
assert.deepEqual(ids, ['cut-off', 'roleplay', 'vague-count']);
console.log('loop-parts: ok');
