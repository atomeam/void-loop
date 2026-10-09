import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../void-live-deploy/skills/poker-rules.js';

const c = (n) => P.RANKS.indexOf(n[0]) + '♠♥♦♣'.indexOf(n[1]) * 13; // 'A♠' -> card
const hand = (...xs) => xs.map(c);

test('hands rank in the right order, with kickers, and the ace plays low in a wheel', () => {
  const r = (xs) => P.evaluate(hand(...xs));
  assert.equal(r(['A♠', 'K♠', 'Q♠', 'J♠', 'T♠', '2♥', '3♦'])[0], 8);
  assert.equal(r(['9♠', '9♥', '9♦', '9♣', '2♥'])[0], 7);
  assert.equal(r(['9♠', '9♥', '9♦', '2♣', '2♥'])[0], 6);
  assert.equal(r(['A♥', '5♥', '9♥', 'J♥', '2♥'])[0], 5);
  assert.deepEqual(r(['A♠', '2♥', '3♦', '4♣', '5♥', 'K♦', 'K♣']).slice(0, 2), [4, 3], 'a five-high straight, not just a pair of kings');
  assert.ok(P.compare(r(['A♠', 'A♥', 'K♦', '7♣', '3♥']), r(['A♦', 'A♣', 'Q♦', '7♥', '3♠'])) > 0, 'the king kicker wins');
  assert.equal(P.compare(r(['A♠', 'A♥', 'K♦', '7♣', '3♥']), r(['A♦', 'A♣', 'K♥', '7♥', '3♠'])), 0);
});

test('incomplete information: you see your cards and the board, never Void\'s until a showdown', () => {
  const s = P.create({ seed: 4 });
  const v = P.view(s, 'you');
  assert.equal(v.mine.length, 2); assert.equal(v.theirs, null); assert.deepEqual(v.board, []);
  assert.equal(v.pot, 15); assert.equal(v.stacks.you + v.stacks.void + v.pot, 1000);
});

test('Void\'s estimate uses only what it can see: the same cards and board give the same estimate whatever you hold', () => {
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const aces = P.equity(hand('A♠', 'A♥'), [], 800, rnd), junk = P.equity(hand('7♣', '2♦'), [], 800, rnd);
  assert.ok(aces > 0.78 && aces < 0.9, 'pocket aces win about 85% against a random hand: ' + aces);
  assert.ok(junk > 0.28 && junk < 0.42, 'seven-two wins about 35%: ' + junk);
  const a = P.create({ seed: 9 }), b = P.create({ seed: 9 });
  b.cards.you = a.cards.void.includes(c('A♠')) ? hand('K♦', 'K♣') : hand('A♠', 'A♣'); // you hold something else entirely
  const toVoid = (s) => (s.toAct === 'void' ? s : P.act(s, s.toAct === 'you' ? P.legal(s).includes('call') ? 'call' : 'check' : 'check'));
  const lastVoid = (s) => s.log.filter((l) => l.who === 'Void' && l.why).at(-1);
  const va = lastVoid(P.voidAct(toVoid(a))), vb = lastVoid(P.voidAct(toVoid(b)));
  assert.equal(va.text, vb.text); assert.equal(va.why, vb.why);
  assert.match(va.why, /to win/);
});

test('betting: blinds, call, check closes the round, the flop comes, a fold gives the pot', () => {
  let s = P.create({ seed: 2 }); // hand 1: you are on the button (small blind) and act first
  assert.equal(s.toAct, 'you'); assert.deepEqual(P.legal(s), ['fold', 'call', 'raise']);
  s = P.act(s, 'call'); assert.equal(s.toAct, 'void'); assert.deepEqual(P.legal(s), ['check', 'bet']);
  s = P.act(s, 'check'); assert.equal(s.board.length, 3); assert.equal(s.toAct, 'void', 'after the flop the big blind acts first');
  s = P.act(s, 'bet'); s = P.act(s, 'fold');
  assert.equal(s.result.winner, 'void'); assert.equal(s.stacks.void, 510); assert.equal(s.stacks.you, 490);
});

test('a whole session plays out: chips are never made or lost, and every Void choice says why', () => {
  let s = P.create({ seed: 13, stack: 200 });
  for (let k = 0; k < 3000 && !s.over; k++) {
    if (s.result) { s = P.deal(s); continue; }
    if (s.toAct === 'void') { s = P.voidAct(s); continue; }
    const L = P.legal(s); s = P.act(s, L.includes('check') ? 'check' : 'call');
    assert.equal(s.stacks.you + s.stacks.void + s.pot, 400);
  }
  for (const l of s.log.filter((x) => x.who === 'Void' && /folds|checks|calls|bets|raises/.test(x.text))) assert.ok(l.why, l.text);
});
