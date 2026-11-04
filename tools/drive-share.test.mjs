// drive-share: a skill built by calling the calculator and the unit converter. node --test tools/drive-share.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { shareOf, answerOf, builtWith } from '../void-live-deploy/skills/drive-share.js';
import { tipOf } from '../void-live-deploy/skills/tip.js';
import { builtWithOf, withLine } from '../void-live-deploy/lib/skill-compose.js';
import { readFileSync } from 'node:fs';

test('a drive split uses the calculator for the money and the converter for the miles', () => {
  const q = shareOf('split a 90 mile drive costing 36 dollars between 3 people');
  assert.equal(q.people, 3);
  assert.match(answerOf(q), /90 miles \(144\.841 km\) costing \$36, split 3 ways: 30 miles \(48\.28032 km\) and \$12 each/);
  const km = shareOf('share a 40 km trip that cost 24 dollars 4 ways');
  assert.match(answerOf(km), /40 km \(24\.85485 miles\) costing \$24, split 4 ways: 10 km \(6\.213712 miles\) and \$6 each/);
  assert.equal(shareOf('5 miles in km'), null);
  assert.equal(shareOf('what is 36 / 3'), null);
  assert.equal(shareOf('split 120 between 4 people'), null);
  assert.equal(shareOf('unit converter'), null);
  assert.equal(tipOf('split a 90 mile drive costing 36 dollars between 3 people'), null, 'a drive is not a bill split');
  assert.ok(tipOf('split 120 between 4 people'), 'a bill split stays with the tip skill');
});

test('the card says what it was built with, and the file records the same lineage', () => {
  assert.deepEqual(builtWith, ['calc', 'convert']);
  const src = readFileSync(new URL('../void-live-deploy/skills/drive-share.js', import.meta.url), 'utf8');
  assert.deepEqual(builtWithOf(src), ['calc', 'convert']);
  assert.equal(withLine(builtWith), 'Built with the calculator and the unit converter.');
  let html = '';
  const ret = skill.run('split a 90 mile drive costing 36 dollars between 3 people', { esc: (s) => String(s), showPage: (fn) => fn({ set innerHTML(v) { html = v; } }) });
  assert.equal(ret, 'drive-share');
  assert.match(html, /90 miles/);
  assert.match(html, /\$12 each/);
  assert.match(html, /Built with the calculator and the unit converter/);
});
