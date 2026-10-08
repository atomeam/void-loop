import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/skills/battleship-rules.js';

test('each fleet is five ships on 17 cells, none overlapping, all on the board', () => {
  const s = B.create({ seed: 3 });
  for (const side of ['you', 'void']) {
    const cells = s.fleet[side].flatMap((sh) => sh.cells);
    assert.deepEqual(s.fleet[side].map((sh) => sh.cells.length), [5, 4, 3, 3, 2]);
    assert.equal(new Set(cells).size, 17); assert.ok(cells.every((c) => c >= 0 && c < 100));
  }
});

test('hidden state: what you can see of Void\'s fleet is only your shot results, and sunk ships; never where the rest are', () => {
  let s = B.create({ seed: 5 });
  const v = B.view(s, 'you');
  assert.deepEqual(v.target.shots, {}); assert.deepEqual(v.target.sunk, []); assert.equal(v.target.afloat.length, 5);
  assert.ok(!JSON.stringify(v.target).includes('"cells":[' + s.fleet.void[0].cells[0]), 'no unsunk Void cell is visible');
  assert.equal(v.own.ships.length, 5);
});

test('answers stay consistent with the hidden fleet: a miss is water, a hit is a ship, and the last hit on a ship sinks it', () => {
  let s = B.create({ seed: 9 });
  const ship = s.fleet.void.find((x) => x.name === 'Destroyer'), water = [...Array(100).keys()].find((c) => !s.fleet.void.some((x) => x.cells.includes(c)));
  let r = B.fire(s, ship.cells[0]); assert.equal(r.result, 'hit'); assert.equal(r.s.turn, 'you', 'a hit fires again');
  r = B.fire(r.s, ship.cells[1]); assert.equal(r.result, 'sunk'); assert.equal(r.sank, 'Destroyer');
  assert.deepEqual(B.view(r.s, 'you').target.sunk.map((x) => x.name), ['Destroyer']);
  const m = B.fire(r.s, water); assert.equal(m.result, 'miss'); assert.equal(m.s.turn, 'void');
  assert.equal(B.fire(m.s, water).result, null, 'not your turn, and that cell was already fired at');
});

test('Void fires from what it has been told, never your fleet, and says why: it hunts, then follows a hit along its line', () => {
  const seen = { shots: {}, sunk: [], afloat: [] };
  const hunt = B.chooseShot(seen, () => 0.5); assert.match(hunt.why, /hunts/);
  const follow = B.chooseShot({ shots: { 44: 'hit' }, sunk: [] }, () => 0); assert.ok([34, 54, 43, 45].includes(follow.cell)); assert.match(follow.why, /hit E5/);
  const line = B.chooseShot({ shots: { 44: 'hit', 45: 'hit' }, sunk: [] }, () => 0); assert.ok([43, 46].includes(line.cell)); assert.match(line.why, /line up from E5 to E6/);
  // the same told-so-far always gives the same choice, whatever your fleet is
  const a = B.create({ seed: 1 }), b = B.create({ seed: 2 });
  a.turn = b.turn = 'void'; b.rng = a.rng;
  assert.equal(B.voidFire(a).s.log.at(-1).text.split(':')[0], B.voidFire(b).s.log.at(-1).text.split(':')[0]);
});

test('a whole game ends with one fleet sunk; every Void shot has a reason', () => {
  let s = B.create({ seed: 11 });
  for (let k = 0; k < 400 && !s.over; k++) {
    if (s.turn === 'void') { s = B.voidFire(s).s; continue; }
    const c = [...Array(100).keys()].find((x) => !s.shots.you[x]); s = B.fire(s, c).s;
  }
  assert.ok(s.over);
  for (const l of s.log.filter((x) => x.who === 'Void' && /fired/.test(x.text))) assert.ok(l.why, l.text);
});
