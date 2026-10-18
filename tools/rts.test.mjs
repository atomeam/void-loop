// Verse's world as an RTS (lib/rts.js, skills/rts.js, the villagers in skills/figures3d.js and skills/scripts.js). Run: node --test tools/rts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { yieldOf, canPay, pay, missing, stockLine, report, orderOf, BUILDS, fullStock } from '../void-live-deploy/lib/rts.js';
import { natureOf, advance, fallbackScript, KNOWN_REACTS, KNOWN_TAGS } from '../void-live-deploy/skills/scripts.js';
import { makeBrain, stepFigure } from '../void-live-deploy/skills/figures3d.js';
import { tagNodes, villagersOf, nodesOf } from '../void-live-deploy/skills/rts.js';
import { THINGS, thingOf } from '../void-live-deploy/skills/forge-rules.js';
import { WHAT } from '../void-live-deploy/lib/scene-advance.js';

test('what you summon is the resource: a tree is wood, a rock is stone, food things are food, a cat is scenery', () => {
  assert.deepEqual(yieldOf(natureOf('tree').tags), { res: 'wood', units: 8 });
  assert.deepEqual(yieldOf(natureOf('oak tree').tags), { res: 'wood', units: 8 });
  assert.deepEqual(yieldOf(natureOf('rock').tags), { res: 'stone', units: 6 });
  assert.deepEqual(yieldOf(natureOf('carrot').tags), { res: 'food', units: 2 });
  assert.deepEqual(yieldOf(natureOf('bone').tags), { res: 'food', units: 2 });
  assert.equal(yieldOf(natureOf('cat').tags), null);
  assert.equal(yieldOf(null), null);
  const v = natureOf('villager');
  assert.ok(v.tags.includes('villager') && v.tags.includes('person') && v.reactsTo.wood === 'gather' && v.reactsTo.stone === 'gather' && v.reactsTo.food === 'gather');
  assert.ok(KNOWN_REACTS.includes('gather') && ['tree', 'wood', 'rock', 'stone', 'villager', 'camp'].every((t) => KNOWN_TAGS.includes(t)));
  assert.ok(natureOf('camp').tags.includes('camp'));
});

test('builds cost what Age of Empires taught: pay when the stock covers it, say what is short when it does not', () => {
  assert.ok(canPay({ wood: 6 }, 'hut') && !canPay({ wood: 5 }, 'hut') && !canPay({}, 'hut') && !canPay({ wood: 99 }, 'castle'));
  assert.deepEqual(pay({ wood: 7, stone: 1 }, 'hut'), { wood: 1, stone: 1, food: 0 });
  assert.deepEqual(pay({ wood: 2 }, 'hut'), { wood: 2, stone: 0, food: 0 }, 'nothing is taken when it cannot pay');
  assert.equal(missing({ wood: 2 }, 'hut'), 'a hut needs 6 wood: 2 wood so far');
  assert.equal(missing({ wood: 4, stone: 1 }, 'tower'), 'a tower needs 8 stone and 4 wood: 1 stone so far');
  assert.equal(missing({ wood: 6 }, 'hut'), '');
  assert.equal(missing({}, 'castle'), 'nothing like that can be built yet');
  for (const k of Object.keys(BUILDS)) assert.ok(THINGS[k] && thingOf(k) === k, 'the forge has a recipe for a ' + k);
  assert.equal(thingOf('rock'), null, 'a rock is a node on the stage (a figure), not a forge model');
});

test('the resource bar and the report read plainly', () => {
  assert.equal(stockLine({ wood: 12, stone: 3, food: 4 }, 2), 'wood 12 · stone 3 · food 4 · 2 idle');
  assert.equal(stockLine(null), 'wood 0 · stone 0 · food 0');
  assert.deepEqual(fullStock({ wood: '3', junk: 9, stone: -2 }), { wood: 3, stone: 0, food: 0 });
  assert.equal(report({}, {}), 'the camp has nothing yet; no villagers yet: summon one, nothing to gather: add a tree or a rock.');
  assert.match(report({ wood: 7 }, { villagers: 2, nodes: 1, built: ['hut'] }), /^the camp has 7 wood; 2 villagers, 1 thing to gather from; built: hut; you can build a hut\.$/);
});

test('orders in plain words', () => {
  assert.deepEqual(orderOf('start a camp'), { act: 'camp' }); assert.deepEqual(orderOf('Set up a base here'), { act: 'camp' });
  assert.deepEqual(orderOf('gather wood'), { act: 'gather', res: 'wood' }); assert.deepEqual(orderOf('everyone, collect stone'), { act: 'gather', res: 'stone' });
  assert.deepEqual(orderOf('chop some logs'), { act: 'gather', res: 'wood' }); assert.deepEqual(orderOf('villagers gather berries'), { act: 'gather', res: 'food' });
  assert.deepEqual(orderOf('build a hut'), { act: 'build', key: 'hut' }); assert.deepEqual(orderOf('construct a cabin by the camp'), { act: 'build', key: 'hut' }); assert.deepEqual(orderOf('put up a wall'), { act: 'build', key: 'wall' }); assert.deepEqual(orderOf('build a watchtower'), { act: 'build', key: 'tower' });
  assert.equal(orderOf('make a hut'), null, '"make" is the forge\'s word: it prints a model, the camp builds');
  assert.deepEqual(orderOf('how are we doing?'), { act: 'report' }); assert.deepEqual(orderOf('show me the resources'), { act: 'report' }); assert.deepEqual(orderOf('camp status'), { act: 'report' });
  for (const t of ['build a website', 'make a 3d house', 'how are you doing', 'campfire', 'gather my notes', 'a tree', 'summon a villager', '']) assert.equal(orderOf(t), null, t);
});

test('a summoned tree on the scene gets its loads; villagers and nodes are told apart', () => {
  const things = { a: { id: 'a', kind: 'figure', kindOf: 'tree', title: 'tree' }, b: { id: 'b', kind: 'figure', kindOf: 'villager', title: 'villager' }, c: { id: 'c', kind: 'figure', kindOf: 'cat', title: 'cat' }, d: { id: 'd', kind: 'sticky', text: 'milk' } };
  assert.equal(tagNodes(things), 1);
  assert.deepEqual(things.a.res, { kind: 'wood', left: 8 }); assert.equal(things.b.res, undefined); assert.equal(things.c.res, undefined);
  assert.equal(tagNodes(things), 0, 'tagged once');
  assert.deepEqual(villagersOf(things).map((t) => t.id), ['b']); assert.deepEqual(nodesOf(things).map((t) => t.id), ['a']);
  things.a.res.left = 0; assert.deepEqual(nodesOf(things), [], 'an emptied node is no longer one to gather from');
});

test('offline brain: a villager walks to the tree, takes a load, carries it to the camp and delivers; the emptied tree is gone', () => {
  const v = makeBrain({ id: 'v', x: 100, y: 300, body: 'person', script: fallbackScript('person', 'villager') }, () => 0.5);
  const tree = makeBrain({ id: 't', x: 400, y: 300, body: 'place', script: fallbackScript('place', 'tree'), res: { kind: 'wood', left: 1 } }, () => 0.5);
  assert.equal(tree.left, 1); assert.equal(tree.res, 'wood'); assert.equal(v.carry, null);
  const delivered = [];
  const world = { bounds: { l: 0, t: 0, r: 1200, b: 700 }, rects: [], cursor: null, still: false, others: [v, tree], camp: { x: 100, y: 300, id: 'camp1' }, onDeliver: (f, res) => delivered.push(res) };
  let gathered = false;
  for (let i = 0; i < 1200 && !delivered.length; i++) { stepFigure(v, 0.05, world, () => 0.5); if (v.carry) gathered = true; }
  assert.ok(gathered, 'the villager took a load'); assert.equal(tree.left, 0); assert.ok(tree.eaten && tree.chasedOff, 'an emptied tree leaves the stage');
  assert.deepEqual(delivered, ['wood']); assert.equal(v.carry, null); assert.equal(v.delivered, 1);
});

test('while you were away: a villager fills the camp from a tree, the note says so, and the record words are allowed', () => {
  const things = [
    { id: 'v', kindOf: 'villager', x: 100, y: 300, seed: 1 },
    { id: 't', kindOf: 'tree', x: 500, y: 300, seed: 2, res: { kind: 'wood', left: 3 } },
    { id: 'c', kind: 'camp', x: 100, y: 300, stock: { wood: 1 } },
  ];
  const r = advance(things, 36e5, { bounds: { w: 1200, h: 700 } });
  const camp = r.things.find((t) => t.id === 'c'), tree = r.things.find((t) => t.id === 't'), v = r.things.find((t) => t.id === 'v');
  assert.equal(camp.stock.wood, 4, 'three loads in an hour on top of the one it had');
  assert.equal(tree.gone, true); assert.equal(tree.res.left, 0); assert.ok(!v.carry);
  assert.equal(r.changes.filter((c) => c.what === 'gathered').length, 3);
  assert.equal(r.note, 'While you were away (1 hour): the villagers gathered 3 wood.');
  assert.ok(WHAT.includes('gathered') && WHAT.includes('built'));
  // with no camp nothing is gathered: there is nowhere to carry it
  const r2 = advance(things.filter((t) => t.id !== 'c'), 36e5, { bounds: { w: 1200, h: 700 } });
  assert.equal(r2.changes.length, 0); assert.equal(r2.things.find((t) => t.id === 't').res.left, 3);
});
