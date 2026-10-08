import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../void-live-deploy/skills/monopoly-rules.js';

const fresh = (voids = 1) => M.create({ voids, seed: 42 });
const at = (name) => M.SPACES.findIndex((x) => x.n === name);

test('the board: 40 spaces, 22 streets in 8 sets, 4 stations, 2 utilities, classic prices', () => {
  assert.equal(M.SPACES.length, 40);
  assert.equal(M.SPACES.filter((x) => x.t === 'street').length, 22);
  assert.deepEqual(Object.keys(M.GROUP).map((g) => M.GROUP[g].length), [2, 3, 3, 3, 3, 3, 3, 2]);
  assert.equal(M.SPACES.filter((x) => x.t === 'station').length, 4);
  assert.equal(M.SPACES[39].p, 400); assert.equal(M.SPACES[M.GO_TO_JAIL].t, 'gotojail'); assert.equal(M.SPACES[M.JAIL].t, 'jail');
});

test('landing on an unowned property never buys it: the seat chooses, and declining leaves it unowned', () => {
  let s = M.roll(fresh(), [1, 2]); // to Cinder Lane (3)
  assert.equal(s.phase, 'buy'); assert.deepEqual(s.pending, { buy: 3 }); assert.equal(s.owner[3], undefined); assert.equal(s.players[0].money, 1500);
  const no = M.buy(s, false);
  assert.equal(no.owner[3], undefined); assert.equal(no.phase, 'end');
  const yes = M.buy(s, true);
  assert.equal(yes.owner[3], 0); assert.equal(yes.players[0].money, 1440);
});

test('rent is forced and logged as forced; a full set doubles bare rent; houses go up evenly', () => {
  let s = fresh(); s.owner[1] = 1; s.owner[3] = 1; // Void owns both browns
  assert.equal(M.rentFor(s, 3), 8);
  s = M.roll(s, [1, 2]);
  assert.equal(s.players[0].money, 1492); assert.equal(s.players[1].money, 1508);
  assert.ok(s.log.some((l) => /paid 8 rent to Void for Cinder Lane/.test(l.text) && l.forced));
  s.turn = 1; s.phase = 'end';
  assert.ok(M.canBuild(s, 1, 1)); s = M.build(s, 1);
  assert.equal(s.houses[1], 1); assert.ok(!M.canBuild(s, 1, 1), 'must build on Cinder Lane before a second house on Old Mill Row');
  assert.equal(M.rentFor(s, 1), 10);
});

test('stations and utilities: rent by how many the owner holds', () => {
  const s = fresh(); s.owner[5] = 1; s.owner[15] = 1; s.owner[12] = 1;
  assert.equal(M.rentFor(s, 5), 50); assert.equal(M.rentFor(s, 12, 8), 32);
  s.owner[28] = 1; assert.equal(M.rentFor(s, 12, 8), 80);
});

test('Go pays 200 when passed; Go to Jail sends you to Jail; three doubles send you to Jail', () => {
  let s = fresh(); s.players[0].pos = 38;
  s = M.roll(s, [2, 3]); // to 3, passing Go
  assert.equal(s.players[0].money, 1700);
  let j = fresh(); j.players[0].pos = 25; j = M.roll(j, [2, 3]);
  assert.equal(j.players[0].pos, M.JAIL); assert.equal(j.players[0].jail, 1); assert.equal(j.phase, 'end');
  let d = fresh(); d.doubles = 2; d = M.roll(d, [3, 3]);
  assert.equal(d.players[0].pos, M.JAIL); assert.ok(d.log.some((l) => /three doubles/.test(l.text)));
});

test('in Jail: doubles let you out with no extra roll; pay the fine to leave; the third miss pays the fine and moves', () => {
  let s = fresh(); s.players[0].pos = M.JAIL; s.players[0].jail = 1;
  const out = M.roll(s, [2, 2]); assert.equal(out.players[0].jail, 0); assert.equal(out.players[0].pos, 14); assert.equal(out.phase, 'buy');
  const stay = M.roll(s, [1, 2]); assert.equal(stay.players[0].jail, 2); assert.equal(stay.players[0].pos, M.JAIL);
  const paid = M.payJail(s); assert.equal(paid.players[0].jail, 0); assert.equal(paid.players[0].money, 1450);
  s.players[0].jail = 3; const third = M.roll(s, [1, 2]); assert.equal(third.players[0].money, 1450); assert.equal(third.players[0].pos, 13);
});

test('a seat that cannot pay sells houses at half, then goes out; you going out ends the game', () => {
  let s = fresh(); s.owner[37] = 1; s.owner[39] = 1; s.houses[37] = 5; s.players[0].money = 100; s.players[0].pos = 30; s.players[0].jail = 0;
  s.players[0].pos = 33; s = M.roll(s, [1, 3]); // lands on Skyline Drive with a hotel: 1500 rent
  assert.ok(s.players[0].out); assert.equal(s.phase, 'over'); assert.equal(s.winner, 1);
});

test('Void chooses like a player and says why: it buys within its reserve, declines below it, builds a set it owns', () => {
  let s = fresh(); s.turn = 1;
  const yes = M.voidWantsToBuy(s, 1, 39); assert.equal(yes.yes, true); assert.match(yes.why, /reserve/);
  s.players[1].money = 300; const no = M.voidWantsToBuy(s, 1, 39); assert.equal(no.yes, false); assert.match(no.why, /under its 150 reserve|cannot afford/);
  s.players[1].money = 1500; s.owner[1] = 1; const set = M.voidWantsToBuy(s, 1, 3); assert.equal(set.yes, true); assert.match(set.why, /completes the brown set/);
  // a whole Void turn: every choice in its log has a reason
  let g = fresh(); g.turn = 1; g = M.voidTurn(g);
  assert.notEqual(g.turn, 1, 'the turn passes back');
  for (const l of g.log.filter((x) => x.who === 'Void' && /bought|did not buy|built|chose/.test(x.text))) assert.ok(l.why, l.text);
});

test('a trade is an offer: Void accepts a fair price and declines a low one, and says why either way', () => {
  let s = fresh(); s.owner[39] = 1;
  const low = M.offer(s, { space: 39, cash: 450 }); assert.equal(low.accepted, false); assert.match(low.why, /under the 600/); assert.equal(low.s.owner[39], 1);
  const fair = M.offer(s, { space: 39, cash: 600 }); assert.equal(fair.accepted, true); assert.equal(fair.s.owner[39], 0); assert.equal(fair.s.players[0].money, 900);
  s.owner[37] = 1; const set = M.offer(s, { space: 39, cash: 1400 }); assert.equal(set.accepted, false); assert.match(set.why, /break up its own darkblue set/);
});

test('thousands of seeded moves: money only moves by the rules and never goes below zero', () => {
  let s = M.create({ voids: 2, seed: 7 });
  for (let k = 0; k < 4000 && s.phase !== 'over'; k++) {
    if (s.players[s.turn].seat === 'void') { s = M.voidTurn(s); continue; }
    if (s.players[0].jail && s.phase === 'roll') s = M.payJail(s);
    if (s.phase === 'roll') s = M.roll(s);
    else if (s.phase === 'buy') s = M.buy(s, M.voidWantsToBuy(s, 0, s.pending.buy).yes);
    else if (s.phase === 'end') s = M.endTurn(s);
    for (const p of s.players) assert.ok(p.money >= 0, 'money below zero');
  }
  assert.ok(s.moves > 20);
});
