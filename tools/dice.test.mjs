// node --test tools/dice.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dice from '../void-live-deploy/skills/dice.js';

test('dice takes roll asks and refuses look-alikes', () => {
  for (const a of ['roll a die', 'roll 2d6', 'roll d20', 'throw 3d8', 'roll 1d6 + 2', 'Roll a die'])
    assert.ok(dice.match(a.toLowerCase(), a), a);
  for (const a of ['what is a dice', 'dice games', 'how do dice work', 'buy dice', 'roll the dice of fate'])
    assert.ok(!dice.match(a.toLowerCase(), a), a);
});

test('a roll returns the skill name and shows a sum', () => {
  let html = '';
  const api = {
    esc: (t) => String(t),
    showPage: (fn) => fn({ set innerHTML(v) { html = v; } }),
  };
  const name = dice.run('roll 2d6', api);
  assert.equal(name, 'dice');
  assert.match(html, /2d6/);
  assert.match(html, /Source: browser Math.random/);
});
