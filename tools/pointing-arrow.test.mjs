// The pointing arrow, promoted from the lab. node --test tools/pointing-arrow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { selftest, plan, sitting } from '../void-live-deploy/skills/pointing-arrow.js';
import { splitBuilt } from '../void-live-deploy/lib/voice.js';

test('pointing arrow: the lab self-test passes, and the skill takes its own asks', () => {
  assert.equal(selftest(), true);
  assert.equal(skill.name, 'pointing-arrow');
  for (const ask of skill.examples) assert.equal(skill.match(ask, ask), true, ask);
  for (const ask of skill.nearMisses) assert.equal(skill.match(ask, ask), false, ask);
  const p = plan(40);
  assert.equal(p.filter((t) => t.valid).length, 32);
  assert.equal(sitting([{ valid: true, correct: true, ms: 300 }, { valid: false, correct: true, ms: 360 }]).cost, 60);
});

test('pointing arrow: the will want retires when the ledger names it built', () => {
  const title = 'make the lab\'s "The pointing arrow" a core skill of its own';
  const want = { kind: 'grow from the lab', title, i_want: 'I want to make the pointing arrow a core skill.' };
  const open = splitBuilt([want], [{ at: '2026-11-03T23:50:00Z', by: 'cursor', kind: 'grow', what: 'The pointing arrow is a core skill', asked: title }]);
  assert.equal(open.open.length, 0);
  assert.equal(open.got.length, 1);
  assert.match(open.got[0].what, /pointing arrow/);
});
