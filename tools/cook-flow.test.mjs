// cook-flow (lib/cook-flow.js, asked by Verse): a kitchen conversion or swap ends with one tap that starts a timer; a sum, a
// distance or a currency ask gets no chip. Run: node --test tools/cook-flow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cookNext, cookChip } from '../void-live-deploy/lib/cook-flow.js';

test('cook-flow: kitchen asks earn the timer chip, the rest do not', () => {
  for (const a of ['3 cups in ml', 'how many cups is 500g of flour', '250 g sugar in cups', '2 tbsp in ml', 'gas mark 4 in celsius', '350 f in gas mark',
    'medium rare steak temperature', 'what temperature to cook chicken', 'how many cups in a liter', '100 g in oz', 'substitute for buttermilk', '1 stick of butter in grams'])
    assert.ok(cookNext(a), a);
  for (const a of ['5 miles in km', '15% of 240', '100 dollars in euros', '70 f in c', 'what is 2 + 2', '10 lb in kg', 'how many days until christmas', '', 'set a 12 minute timer', '10 mb in kb', 'substitute teacher', 'replacement windows'])
    assert.equal(cookNext(a), null, a);
});

test('cook-flow: the chip runs the timer skill, 10 minutes first with 5 and 20 beside it', () => {
  const n = cookNext('3 cups in ml');
  assert.equal(n.ask, 'set a 10 minute timer');
  assert.deepEqual(n.others.map((o) => o.ask), ['set a 5 minute timer', 'set a 20 minute timer']);
  const h = cookChip('3 cups in ml');
  assert.ok(h.includes('data-ask="set a 10 minute timer"') && h.includes('data-ask="set a 20 minute timer"') && h.includes('class="cook-flow"'), h);
  assert.equal(cookChip('5 miles in km'), '');
  assert.ok(!cookChip('3 cups in ml', (s) => '<' + s).includes('data-ask="set'), 'the escaper given is the one used');
});

test('a card that states its own time offers that time first (2026-10-30: the boiled-egg card said 12 minutes and offered a 10 minute timer)', () => {
  const n = cookNext('how to boil an egg', 12);
  assert.equal(n.ask, 'set a 12 minute timer');
  assert.deepEqual(n.others.map((o) => o.ask), ['set a 10 minute timer', 'set a 5 minute timer']);
  assert.equal(cookNext('3 cups in ml').ask, 'set a 10 minute timer', 'with no time of its own the default stays');
  assert.equal(cookNext('3 cups in ml', 0).ask, 'set a 10 minute timer', 'a time out of range is not used');
  assert.ok(cookChip('how to boil an egg', null, 12).includes('data-ask="set a 12 minute timer"'));
});
