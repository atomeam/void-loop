import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../void-live-deploy/skills/fireworks-rules.js';

test('the deck is 50 cards (three 1s, two each of 2-4, one 5 per colour); five cards each to start', () => {
  const s = F.create({ seed: 1 });
  assert.equal(s.deck.length + 10, 50); assert.equal(s.hands.you.length, 5); assert.equal(s.hints, 8);
});

test('each seat sees the other hand but not its own: your own cards show only what hints told you', () => {
  const s = F.create({ seed: 2 }), v = F.view(s, 'you');
  assert.ok(v.own.every((c) => c.c === undefined && c.r === undefined && c.known.c === null && c.known.r === null));
  assert.ok(v.theirs.every((c) => typeof c.c === 'number' && typeof c.r === 'number'));
});

test('a hint is information, not a move: it marks the other hand and spends a token; seats play only their own cards', () => {
  let s = F.create({ seed: 3 });
  const c0 = s.hands.void[0];
  s = F.hint(s, { color: c0.c });
  assert.equal(s.hints, 7); assert.equal(s.turn, 'void');
  assert.equal(F.view(s, 'void').own[0].known.c, c0.c);
  assert.equal(s.hands.void.length, 5, 'nothing was played for Void');
  const youBefore = s.hands.you.map((c) => c.id).join();
  const r = F.play(s, 0); assert.equal(r.hands.you.map((c) => c.id).join(), youBefore, 'it is Void\'s turn: playing changes Void\'s hand, never yours');
  assert.ok(!r.hands.void.some((c) => c.id === c0.id), 'the card Void played left its hand');
});

test('playing: a card that fits extends its row; one that does not costs a mistake; three mistakes end the game', () => {
  let s = F.create({ seed: 4 }); s.hands.you[0] = { id: 999, c: 2, r: 0, known: { c: null, r: null } };
  s = F.play(s, 0); assert.equal(s.rows[2], 1); assert.equal(s.mistakes, 0);
  s.turn = 'you'; s.hands.you[0] = { id: 998, c: 2, r: 3, known: { c: null, r: null } };
  s = F.play(s, 0); assert.equal(s.mistakes, 1); assert.equal(s.rows[2], 1);
  s.mistakes = 2; s.turn = 'you'; s.hands.you[0] = { id: 997, c: 0, r: 4, known: { c: null, r: null } }; s = F.play(s, 0);
  assert.equal(s.over, 'boom');
});

test('Void acts from what it can see only, and says why: it points you to a card of yours that fits now', () => {
  let s = F.create({ seed: 5 }); s.turn = 'void'; s.hands.you[2] = { id: 500, c: 1, r: 0, known: { c: null, r: null } };
  s = F.voidAct(s);
  const l = s.log.at(-1); assert.match(l.text, /told you/); assert.match(l.why, /your card 3 is yellow 1 and fits now/);
  assert.equal(s.hands.you[2].known.r, 0);
});

test('a whole game together ends (perfect, the deck, or three mistakes), and every Void choice says why', () => {
  let s = F.create({ seed: 8 });
  for (let k = 0; k < 400 && !s.over; k++) {
    if (s.turn === 'void') { s = F.voidAct(s); continue; }
    const v = F.view(s, 'you'), sure = v.own.findIndex((c) => c.known.c != null && c.known.r != null && v.rows[c.known.c] === c.known.r);
    const one = v.own.findIndex((c) => c.known.r === 0 && c.known.c == null);
    s = sure >= 0 ? F.play(s, sure) : one >= 0 ? F.play(s, one) : s.hints < 8 ? F.discard(s, 0) : F.hint(s, { rank: s.hands.void[0].r });
  }
  assert.ok(s.over); assert.ok(F.score(s) >= 5, 'a cooperative game scores something: ' + F.score(s));
  for (const l of s.log.filter((x) => x.who === 'Void')) assert.ok(l.why, l.text);
});
