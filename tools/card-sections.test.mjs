// node --test tools/card-sections.test.mjs: where a very long answer is cut into accordion sections (lib/card-sections.js; owner, 2026-10-18)
import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionsOf, LONG_BODY } from '../void-live-deploy/lib/card-sections.js';

const para = (n, c = 'x') => ({ text: (c + ' ').repeat(n / 2) });
test('a short body stays whole', () => {
  assert.deepEqual(sectionsOf([{ heading: true, text: 'Intro' }, para(500)]), []);
  assert.deepEqual(sectionsOf([]), []); assert.deepEqual(sectionsOf(null), []);
});
test('a long body is cut at its own headings, each section keeping its heading as its title', () => {
  const blocks = [{ heading: true, text: 'Boot' }, para(1200), { heading: true, text: 'Network' }, para(1200), { heading: true, text: 'Disk errors' }, para(1200)];
  const s = sectionsOf(blocks);
  assert.deepEqual(s.map((x) => x.title), ['Boot', 'Network', 'Disk errors']);
  assert.deepEqual(s.map((x) => [x.from, x.to]), [[0, 1], [2, 3], [4, 5]]);
});
test('with no headings it cuts at block boundaries, never inside a block, and every block lands in exactly one section', () => {
  const blocks = Array.from({ length: 30 }, (_, i) => ({ text: 'line ' + i + ' ' + 'log '.repeat(100) }));
  const s = sectionsOf(blocks); assert.ok(s.length >= 3);
  assert.equal(s[0].from, 0); assert.equal(s.at(-1).to, 29);
  for (let i = 1; i < s.length; i++) assert.equal(s[i].from, s[i - 1].to + 1, 'no gap, no overlap');
  assert.ok(s.every((x) => x.title.length > 0 && x.title.length <= 71));
});
test('a tiny trailing section is folded into the one before it; a body that would give one section stays whole', () => {
  const s = sectionsOf([{ heading: true, text: 'A' }, para(3200), { heading: true, text: 'End' }, para(40)]);
  assert.deepEqual(s, [], 'the 40-character end folds into the first section, which leaves one');
  assert.deepEqual(sectionsOf([{ heading: true, text: 'Only' }, para(LONG_BODY + 100)]), [], 'one heading, one block: nothing to split');
});
