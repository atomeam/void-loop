// decide-cards, tested through the skill itself (the pure logic is tested in tools/tools-pack3.test.mjs): every example puts the card it names on
// the stage with the options it gave, and no near miss is taken. The Deciding family's second skill had real asks but no self-test of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { ask } from '../void-live-deploy/skills/decide-cards.js';

const stage = () => { const things = {}; let saved = 0, rendered = 0, sel = ''; return { things: () => things, stage: { clientWidth: 900, clientHeight: 700 }, select: (id) => { sel = id; }, save: () => { saved++; }, render: () => { rendered++; }, _: () => ({ things, saved, rendered, sel }) }; };

test('every example is taken and every near miss is left alone', () => {
  for (const ex of skill.examples) assert.ok(skill.match(ex.toLowerCase(), ex), 'example not taken: ' + ex);
  for (const nm of skill.nearMisses) assert.equal(skill.match(nm.toLowerCase(), nm), false, 'near miss taken: ' + nm);
});

test('each kind of card lands on the stage with what the ask gave it, saved and drawn once', () => {
  const cases = [
    ['rank pizza, tacos, sushi', 'dc-rank', (t) => assert.deepEqual(t.items, ['pizza', 'tacos', 'sushi'])],
    ['vote marks for pizza, tacos, sushi', 'dc-votes', (t) => assert.deepEqual(t.counts, [0, 0, 0])],
    ['eliminate until one: red, green, blue, pink', 'dc-knockout', (t) => { assert.equal(t.items.length, 4); assert.deepEqual(t.out, []); }],
    ['pairwise compare pizza, tacos, sushi', 'dc-pairwise', (t) => assert.deepEqual(t.wins, {})],
    ['weighted pros and cons for moving to Berlin', 'dc-proscons', (t) => { assert.equal(t.pros.length, 1); assert.equal(t.cons.length, 1); assert.equal(t.items, undefined); }],
    ['2x2 matrix for impact vs effort', 'dc-buckets', (t) => assert.ok(t.mode)],
    ['must should could for the launch', 'dc-buckets', (t) => assert.ok(t.mode)],
  ];
  for (const [a, kind, more] of cases) {
    const s = stage();
    assert.equal(ask(a.toLowerCase(), a, s), 'decide-cards', a);
    const { things, saved, rendered, sel } = s._(), list = Object.values(things);
    assert.equal(list.length, 1, a); assert.equal(list[0].kind, kind, a); assert.equal(sel, list[0].id, a);
    assert.equal(saved, 1); assert.equal(rendered, 1);
    more(list[0]);
  }
});

test('an ask that is not a decision card puts nothing on the stage', () => {
  const s = stage();
  assert.equal(ask('flip a coin', 'flip a coin', s), '');
  assert.equal(Object.keys(s._().things).length, 0);
});
