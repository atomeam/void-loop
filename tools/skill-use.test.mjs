import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsed, markUsed, noteUsed, readUsed, usedWords, deadWeight, idleDays, USED_KEY } from '../void-live-deploy/lib/skill-use.js';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const store = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
test('a skill that answers is dated, on this device only (asked by Verse)', () => {
  const st = store();
  assert.equal(noteUsed(st, 'skill:weather', NOW), true);
  assert.deepEqual(JSON.parse(st.m[USED_KEY]), { weather: '2026-10-16' });
  assert.equal(noteUsed(st, 'timer', NOW + 1000), true);
  assert.deepEqual(readUsed(st), { weather: '2026-10-16', timer: '2026-10-16' });
  assert.equal(Object.values(st.m).join('').includes('http'), false, 'a day per skill, no words');
});
test('bad names and bad storage change nothing and never throw', () => {
  const m = {}; assert.equal(markUsed(m, 'Not A Skill', NOW), m); assert.equal(markUsed(m, '', NOW), m);
  assert.deepEqual(parseUsed('{"ok":"2026-10-01","BAD":"2026-10-01","x":"yesterday"}'), { ok: '2026-10-01' });
  assert.deepEqual(parseUsed('not json'), {}); assert.deepEqual(parseUsed('[1]'), {});
  assert.equal(noteUsed({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, 'weather', NOW), false);
  assert.deepEqual(readUsed({ getItem() { throw new Error('blocked'); } }), {});
});
test('last used reads in words, and dead weight is idle 30 days or never', () => {
  const used = { a: '2026-10-16', b: '2026-10-15', c: '2026-10-01', d: '2026-08-01' };
  assert.equal(usedWords(used, 'a', NOW), 'last used here today');
  assert.equal(usedWords(used, 'b', NOW), 'last used here yesterday');
  assert.equal(usedWords(used, 'c', NOW), 'last used here 2026-10-01 (15 days ago)');
  assert.equal(usedWords(used, 'd', NOW), 'last used here 2026-08-01 (76 days ago), dead weight on this device');
  assert.equal(usedWords(used, 'z', NOW), 'not used here yet');
  assert.deepEqual(deadWeight(['a', 'c', 'd', 'z'], used, NOW), { idle: ['d'], never: ['z'] });
  assert.equal(idleDays('nope', NOW), null);
});
