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
import { chance, familyScores } from './grow-lessons.mjs';
const mem = { skills: { a: { wins: 3, misses: 0 }, b: { wins: 0, misses: 3 }, c: { wins: 1, misses: 1 } } };
assert.equal(chance('a', mem), 0.8); assert.equal(chance('b', mem), 0.2); assert.equal(chance('zz', mem), 0.5);
const fs2 = familyScores(mem, (n) => (n === 'c' ? 'g' : 'f'));
assert.deepEqual(fs2.f, { wins: 3, misses: 3, chance: 0.5 }); assert.equal(fs2.g.chance, 0.5);
console.log('loop-ev: ok');
import { reach } from './lacks.mjs';
const T = { money: { weight: 0.5, patterns: ['store', 'tip'] }, parity: { weight: 0.25, patterns: ['calendar'] } };
assert.equal(reach('gift-store', T), 1.5); assert.equal(reach('calendar', T), 1.25); assert.equal(reach('stipend', T), 1); assert.equal(reach('x', {}), 1);
console.log('loop-reach: ok');
// revenue weight only boosts (owner, 2026-10-21): reach is never below 1, whatever the tags say
assert.equal(reach('gift-store', { bad: { weight: -5, patterns: ['store'] } }) >= 1, true);
console.log('loop-reach-boost: ok');
import { parityPicks, toFile } from './loop-study.mjs';
import { studiesAsMemories } from './loop-library.mjs';
const PT = { money: { weight: 0.5, patterns: ['store'] }, parity: { weight: 0.25, patterns: ['calendar', 'map'] } };
const pp = parityPicks([{ name: 'calendar' }, { name: 'gift-store' }, { name: 'map-card' }], PT).map((p) => p.name);
assert.deepEqual(pp, ['calendar', 'map-card']);
assert.deepEqual(toFile([{ name: 'calendar' }, { name: 'map' }], { calendar: 'https://x.example/', map: 'https://y.example/' }, ['map']), [{ skill: 'calendar', url: 'https://x.example/' }]);
const sm = studiesAsMemories([{ name: 'Study: how does it do calendar', summary: 'studied x: 3 scripts', updated: '2026-10-21T00:00:00Z' }]);
assert.equal(importance(sm[0]), 1); assert.ok(retrieve(sm, 'calendar invites', { now })[0]);
console.log('loop-study: ok');
import { refine } from './loop-refine.mjs';
import { retryable } from './grow-lessons.mjs';
assert.equal(refine('weather shows the forecast...').text, 'weather shows the forecast.');
const rr = refine('Verse hardened itself: 2 benchmark ask(s)', { asks: [{ ask: 'rain today', want: 'skill:weather' }, 'moon now'] });
assert.equal(rr.text, "Verse hardened itself: 'rain today' opens weather, 'moon now'"); assert.deepEqual(rr.left, []);
assert.deepEqual(refine('I feel alive').left, ['roleplay']);
const vm = { skills: { w: { wins: 3, misses: 1 }, z: { wins: 0, misses: 4 } }, variants: [{ ask: 'a', skill: 'w', at: '2' }, { ask: 'b', skill: 'z', at: '3' }] };
assert.deepEqual(retryable(vm).map((v) => v.ask), ['a']);
console.log('loop-refine: ok');
