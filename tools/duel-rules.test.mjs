// The Verse card duel's rules (frontier #33): cost, income, summon, attack, answer, neutralised cards, the Root, the 12-turn tiebreak, no randomness, and an opponent that never breaks a rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../void-live-deploy/lib/duel-rules.js';

const sk = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
const j = (f) => JSON.parse(fs.readFileSync(path.join(sk, f), 'utf8'));
const you = (s) => s.cards.find((c) => c.side === 'you' && c.root), foe = (s) => s.cards.find((c) => c.side === 'void' && c.root);
const sum = (s, name, parent, slot, extra = {}) => D.apply(s, { type: 'summon', card: D.card({ name, ...extra }), parent, slot });

test('the fresh card is 1 / 1 / 0 and costs 1; the cost is ceil((Power + Resistance) / 4), at least 1', () => {
  const c = D.card(); assert.deepEqual([c.power, c.resistance, c.income], [1, 1, 0]); assert.equal(D.cost(c), 1);
  assert.equal(D.cost(D.card({ power: 0, resistance: 0 })), 1);
  assert.equal(D.cost(D.card({ power: 5, resistance: 8 })), 4); assert.equal(D.cost(D.card({ power: 4, resistance: 4 })), 2);
  assert.equal(D.cost(D.card({ power: 9, resistance: 9 })), 5); assert.equal(D.card({ arrows: 9 }).arrows, 3);
});

test('statsFor uses the earned stats of a real skill and falls back to a fresh card', () => {
  const fam = j('families.json'), deps = j('deps.json');
  const real = fam.families.flatMap((f) => f.skills).find((s) => s.success_rate != null);
  const c = D.statsFor(real.name, fam, deps); assert.equal(c.name, real.name); assert.equal(c.power, Math.round(real.success_rate * 9));
  const none = D.statsFor('a thing nobody asked yet', fam, deps); assert.deepEqual([none.power, none.resistance, none.income], [1, 1, 0]);
  assert.deepEqual(D.statsFor('x', null, null), D.card({ name: 'x' }));
});

test('a new duel: two Roots (5 / 8, two arrows), Treasury 6; Income is collected at the start of a turn', () => {
  const s = D.newState(); assert.deepEqual(s.treasury, { you: 6, void: 6 });
  assert.deepEqual([you(s).power, you(s).resistance, you(s).arrows], [5, 8, 2]);
  const c = D.collectIncome(s); assert.equal(c.treasury.you, 8); assert.equal(D.collectIncome(c), c); assert.equal(s.treasury.you, 6, 'the old state is untouched');
});

test('income is 2 plus the Income of your cards in play', () => {
  let s = D.collectIncome(D.newState()); s = sum(s, 'Bank', 'y1', 0, { income: 3 });
  assert.equal(D.incomeOf(s, 'you'), 5); s = D.apply(s, { type: 'pass' }); assert.equal(s.side, 'void');
  s = D.apply(s, { type: 'pass' }); assert.equal(s.side, 'you'); assert.equal(s.treasury.you, 8 - 1 + 2 + 5, 'the second turn: 8, minus the cost 1, plus the 2 banked by passing, plus Income 5');
});

test('summon goes onto an open arrow of your own card only, costs its price, brings its arrows', () => {
  const s = D.collectIncome(D.newState());
  assert.throws(() => D.apply(s, { type: 'summon', card: D.card(), parent: 'v2', slot: 0 }), /own cards/);
  assert.throws(() => D.apply(s, { type: 'summon', card: D.card(), parent: 'y1', slot: 2 }), /no such arrow/);
  const a = sum(s, 'A', 'y1', 0, { arrows: 2 }); assert.equal(a.treasury.you, 7);
  assert.throws(() => D.apply(a, { type: 'summon', card: D.card(), parent: 'y1', slot: 0 }), /taken/);
  const b = sum(a, 'B', a.cards.find((c) => c.name === 'A').id, 1); assert.equal(b.cards.length, 4);
  const poor = { ...s, treasury: { you: 1, void: 6 } }; assert.throws(() => D.apply(poor, { type: 'summon', card: D.card({ power: 9, resistance: 9 }), parent: 'y1', slot: 0 }), /not enough coins/);
  assert.ok(D.legalActions(s).every((x) => x.type !== 'summon' || s.cards.find((c) => c.id === x.parent).side === 'you'));
});

test('attack math: Power + support + pledge must beat Resistance + support + answer (a tie holds)', () => {
  let s = D.newState(); s.pool = { void: [] };
  s = D.collectIncome(s); s = sum(s, 'Ally', 'y1', 0, { power: 3, resistance: 1 }); // you: Ally 3, supported by Root (1)
  s = sum(s, 'Ally2', 'y1', 1, { power: 1, resistance: 1 });
  const ally = s.cards.find((c) => c.name === 'Ally'); assert.equal(D.support(s, ally), 1);
  // hand the move to a state where a weak target stands: a void card 2/2 under its Root (support 1) = 3
  const t = { ...s, side: 'you', actions: 2, cards: [...s.cards, { id: 'v9', side: 'void', name: 'T', power: 2, resistance: 2, income: 0, arrows: 0, parent: 'v2', slot: 0, root: false, neutralised: false }] };
  const fail = D.apply(t, { type: 'attack', from: ally.id, target: 'v9', pledge: 0, answer: 0 }); // 3 + 1 = 4 vs 2 + 1 = 3 wins
  assert.equal(fail.cards.find((c) => c.id === 'v9').neutralised, true);
  const hold = D.apply(t, { type: 'attack', from: ally.id, target: 'v9', pledge: 0, answer: 1 }); // 4 vs 4 ties: holds
  assert.equal(hold.cards.find((c) => c.id === 'v9').neutralised, false); assert.equal(hold.treasury.void, t.treasury.void - 1, 'the answer was paid');
  const pay = D.apply(t, { type: 'attack', from: ally.id, target: 'v9', pledge: 2, answer: 1 }); // 6 vs 4
  assert.equal(pay.cards.find((c) => c.id === 'v9').neutralised, true); assert.equal(pay.treasury.you, t.treasury.you - 2);
  assert.throws(() => D.apply(t, { type: 'attack', from: ally.id, target: 'v9', pledge: 99 }), /pledge/);
  assert.throws(() => D.apply(t, { type: 'attack', from: ally.id, target: 'y1', pledge: 0 }), /enemy/);
});

test('the defender answers by itself when no answer is given: the least that holds, only if it can pay', () => {
  let s = D.collectIncome(D.newState()); s = sum(s, 'Ally', 'y1', 0, { power: 9, resistance: 1 }); // attacker 9 + 1 support = 10 vs Root 8 (+0 support)
  const ally = s.cards.find((c) => c.name === 'Ally');
  assert.equal(D.defenderAnswer(s, { from: ally.id, target: 'v2', pledge: 0 }), 2);
  const held = D.apply(s, { type: 'attack', from: ally.id, target: 'v2', pledge: 0 }); assert.equal(held.cards.find((c) => c.id === 'v2').neutralised, false); assert.ok(held.log.some((l) => /fails against Root \(10\)/.test(l)), 'the answer of 2 made it a tie, which holds');
  assert.equal(D.defenderAnswer(s, { from: ally.id, target: 'v2', pledge: 7 }), 0, 'it cannot afford it, so it pays nothing');
});

test('a neutralised card gives no income, supports nobody, counts no Power and cannot attack', () => {
  let s = D.collectIncome(D.newState()); s = sum(s, 'Bank', 'y1', 0, { income: 3, power: 1, resistance: 1 });
  const bank = s.cards.find((c) => c.name === 'Bank'); assert.equal(D.incomeOf(s, 'you'), 5);
  s.cards = s.cards.map((c) => (c.id === bank.id ? { ...c, neutralised: true } : c));
  assert.equal(D.incomeOf(s, 'you'), 2); assert.equal(D.support(s, you(s)), 0); assert.equal(D.powerIn(s, 'you'), 5);
  assert.ok(D.openArrows(s, 'you').length >= 1, 'its arrows stay open');
  assert.throws(() => D.apply(s, { type: 'attack', from: bank.id, target: 'v2', pledge: 0 }), /neutralised/);
});

test('a neutralised Root loses the duel at once', () => {
  let s = D.collectIncome(D.newState()); s = sum(s, 'Giant', 'y1', 0, { power: 30, resistance: 1 });
  const g = s.cards.find((c) => c.name === 'Giant'); s = D.apply(s, { type: 'attack', from: g.id, target: 'v2', pledge: 0, answer: 0 });
  assert.deepEqual([s.over.winner, s.over.why], ['you', 'root']); assert.deepEqual(D.legalActions(s), []); assert.throws(() => D.apply(s, { type: 'pass' }), /over/);
});

test('after 12 turns the side with more total Power wins; level is a draw', () => {
  let s = D.newState(); s = sum(D.collectIncome(s), 'P', 'y1', 0, { power: 4, resistance: 1 });
  for (let i = 0; i < 12; i++) { assert.equal(s.over, null); s = D.apply(s, { type: 'pass' }); }
  assert.equal(s.turn, 12); assert.deepEqual([s.over.winner, s.over.why], ['you', 'power']);
  let e = D.newState(); for (let i = 0; i < 12; i++) e = D.apply(e, { type: 'pass' }); assert.equal(e.over.winner, 'draw');
});

test('no randomness: the same inputs give the same outputs', () => {
  const play = () => { let s = D.newState({ pool: { void: [{ name: 'Wall', power: 2, resistance: 6, arrows: 2 }, { name: 'Spark' }] } });
    for (let i = 0; i < 40 && !s.over; i++) { s = s.side === 'void' ? D.apply(s, D.opponentMove(s)) : D.apply(s, i % 3 ? { type: 'pass' } : sumTo(s)); } return JSON.stringify(s); };
  assert.equal(play(), play());
});
function sumTo(s) { const ar = D.openArrows(D.collectIncome(s), 'you')[0]; return ar ? { type: 'summon', card: D.card({ name: 'Mine', power: 2, resistance: 2 }), parent: ar.parent, slot: ar.slot } : { type: 'pass' }; }

test('the opponent never makes an illegal move over 200 simulated turns, and always has a move', () => {
  const pools = [{ void: [] }, { void: [{ name: 'Wall', power: 2, resistance: 6, arrows: 2 }, { name: 'Bank', income: 3, power: 1, resistance: 1, arrows: 1 }, { name: 'Giant', power: 9, resistance: 9, arrows: 3 }] }];
  let turns = 0;
  for (const pool of pools) for (const mine of ['pass', 'summon', 'attack']) {
    let s = D.newState({ pool });
    for (let g = 0; g < 40 && turns < 400; g++) {
      if (s.over) s = D.newState({ pool });
      let a;
      if (s.side === 'void') a = D.opponentMove(s);
      else { const legal = D.legalActions(s); a = legal.find((x) => x.type === mine) || { type: 'pass' }; if (mine === 'attack') a = legal.filter((x) => x.type === 'attack').pop() || a; }
      assert.ok(a, 'a move'); assert.equal(D.whyIllegal(s, a), null, JSON.stringify(a));
      assert.ok(D.legalActions(s).some((x) => x.type === a.type), 'its type is among the legal ones');
      s = D.apply(s, a); turns++;
      assert.ok(s.treasury.you >= 0 && s.treasury.void >= 0);
    }
  }
  assert.ok(turns >= 200, 'simulated ' + turns);
});
