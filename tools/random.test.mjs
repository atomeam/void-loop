// the random skill (skills/random.js): bare dice notation ("d20", "2d6") is its, the asks the stage's own chance cards answer are
// not (tools/toolkit.test.mjs), each ask is read as the dice it names, every roll lands inside it, and run() shows the rolls on a
// page, escaped, with nothing fetched.
//   node --test tools/random.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isRandom, parseAsk, roll } from '../void-live-deploy/skills/random.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['D20!', '2 d6', 'd 12', 'please 4d10']) assert.ok(isRandom(a), a);
  for (const a of ['roll a die', 'roll a d20', 'roll 2 dice', 'give me a random number from -5 to 5', 'random fact', 'dice game', '3d model']) assert.ok(!isRandom(a), a);
  assert.equal(skill.suite().ok, true);
});

test('each ask is the range or the dice it names', () => {
  assert.deepEqual(parseAsk('roll a dice'), { min: 1, max: 6, n: 1, sides: 6 });
  assert.deepEqual(parseAsk('d20'), { min: 1, max: 20, n: 1, sides: 20 });
  assert.deepEqual(parseAsk('roll 2d6'), { min: 1, max: 6, n: 2, sides: 6 });
  assert.deepEqual(parseAsk('roll 3 dice'), { min: 1, max: 6, n: 3, sides: 6 });
  assert.deepEqual(parseAsk('pick a random number'), { min: 1, max: 100, n: 1, sides: 0 });
  assert.deepEqual(parseAsk('random number from 10 to 1'), { min: 1, max: 10, n: 1, sides: 0 });
  assert.deepEqual(parseAsk('random number between -5 and 5'), { min: -5, max: 5, n: 1, sides: 0 });
  assert.equal(parseAsk('99d6').n, 20);
  assert.deepEqual(parseAsk('2 d6'), { min: 1, max: 6, n: 2, sides: 6 });
  assert.deepEqual(parseAsk('d 12'), { min: 1, max: 12, n: 1, sides: 12 });
});

test('every roll lands in its range and every face comes up', () => {
  const faces = new Set();
  for (let i = 0; i < 600; i++) { const r = roll(1, 6); assert.ok(r >= 1 && r <= 6 && Number.isInteger(r), String(r)); faces.add(r); }
  assert.equal(faces.size, 6);
  for (let i = 0; i < 200; i++) { const r = roll(-5, 5); assert.ok(r >= -5 && r <= 5, String(r)); }
  assert.equal(roll(7, 7), 7);
});

test('run shows the rolls and the total through esc', async () => {
  const el = { innerHTML: '' }; const seen = [];
  const said = await skill.run('2d6', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
  assert.equal(said, 'random');
  const rolls = seen[0].split(', ').map(Number);
  assert.equal(rolls.length, 2);
  assert.ok(rolls.every((r) => r >= 1 && r <= 6));
  assert.ok(el.innerHTML.includes('total ' + (rolls[0] + rolls[1])) && el.innerHTML.includes('2d6'));
});
