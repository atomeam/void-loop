// the shuffle skill (skills/shuffle.js): a list named as a list and written with spaces is its, a list with commas or "and"
// stays with the stage's own chance card (void.html chanceOf), every shuffle keeps every item, every order comes up, and run()
// shows the list on a page, escaped, with nothing fetched.
//   node --test tools/shuffle.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isShuffle, parseItems, shuffle, stageShuffles } from '../void-live-deploy/skills/shuffle.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['Shuffle these: A B C!', 'please shuffle the list x y', 'mix up these: 1 2 3']) assert.ok(isShuffle(a), a);
  for (const a of ['shuffle the deck', 'shuffle my playlist', 'shuffle these: one']) assert.ok(!isShuffle(a), a);
  assert.equal(skill.suite().ok, true);
});

test('the stage keeps the lists it already shuffles', () => {
  for (const a of ['shuffle red, green, blue', 'shuffle: tea and coffee', 'randomize the order of a, b, c']) {
    assert.ok(stageShuffles(a), a);
    assert.ok(!isShuffle(a), a);
  }
});

test('each ask is the list it names', () => {
  assert.deepEqual(parseItems('shuffle these: apple banana cherry'), ['apple', 'banana', 'cherry']);
  assert.deepEqual(parseItems('mix the list a b c d.'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(parseItems('shuffle the deck'), []);
});

test('every shuffle keeps every item and every order comes up', () => {
  const orders = new Set();
  for (let i = 0; i < 600; i++) { const s = shuffle(['a', 'b', 'c']); assert.deepEqual([...s].sort(), ['a', 'b', 'c']); orders.add(s.join('')); }
  assert.equal(orders.size, 6);
});

test('run shows the list through esc', async () => {
  const el = { innerHTML: '' }; const seen = [];
  const said = await skill.run('shuffle these: <b> x y', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s).replace(/</g, '&lt;'); } });
  assert.equal(said, 'shuffle');
  assert.ok(seen.includes('<b>'));
  assert.ok(!el.innerHTML.includes('<b>'));
  assert.equal((el.innerHTML.match(/<li>/g) || []).length, 3);
});
