/**
 * fireworks-rules — a cooperative card game in the style of Hanabi, you and Void on the same side, in plain JS (no DOM).
 * After Poker on Adam's list (2026-10-08): shared agency. Together you build five firework rows (red, yellow, green, blue,
 * white), each from 1 up to 5, sharing 8 hint tokens and 3 mistakes. The twist that makes it about coordination: you can
 * see Void's cards but not your own, and Void can see yours but not its own. You learn your hand only from hints.
 * The seats stay separate: each seat plays or discards only its own cards; a hint is information, never a move made for
 * the other seat. Void's choices (and the hints it gives you) each say why, from what it can see.
 *
 *   create({ seed }) -> state      play(s, k) / discard(s, k) / hint(s, { color } | { rank }) -> s   (for the seat to act)
 *   voidAct(s) -> s      view(s, side) -> what that side may see      score(s) -> 0..25
 */
export const COLORS = ['red', 'yellow', 'green', 'blue', 'white'];
const COUNTS = [3, 2, 2, 2, 1]; // three 1s, two each of 2-4, one 5, per colour
export const HAND = 5, HINTS = 8, MISTAKES = 3;

function next(s) { let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const clone = (s) => JSON.parse(JSON.stringify(s));
const other = (p) => (p === 'you' ? 'void' : 'you');
const name = (c) => COLORS[c.c] + ' ' + (c.r + 1);

export function create({ seed = (Math.random() * 4294967296) >>> 0 } = {}) {
  const s = { rng: seed >>> 0, deck: [], hands: { you: [], void: [] }, rows: [0, 0, 0, 0, 0], discards: [], hints: HINTS, mistakes: 0, turn: 'you', last: null, log: [], over: null };
  let id = 0;
  COLORS.forEach((_, c) => COUNTS.forEach((n, r) => { for (let k = 0; k < n; k++) s.deck.push({ id: id++, c, r }); }));
  for (let i = s.deck.length - 1; i > 0; i--) { const j = Math.floor(next(s) * (i + 1)); [s.deck[i], s.deck[j]] = [s.deck[j], s.deck[i]]; }
  for (let k = 0; k < HAND; k++) for (const p of ['you', 'void']) s.hands[p].push({ ...s.deck.shift(), known: { c: null, r: null } });
  return s;
}
export const score = (s) => s.rows.reduce((a, b) => a + b, 0);
const playable = (s, card) => s.rows[card.c] === card.r;
const say = (s, p, text, why) => { s.log.push({ who: p === 'you' ? 'You' : 'Void', text, ...(why ? { why } : {}) }); if (s.log.length > 120) s.log.splice(0, s.log.length - 120); };

function draw(s, p) { if (s.deck.length) s.hands[p].push({ ...s.deck.shift(), known: { c: null, r: null } }); }
function endTurn(s) {
  if (score(s) === 25) s.over = 'perfect';
  else if (s.mistakes >= MISTAKES) s.over = 'boom';
  else if (s.last != null) { if (s.last === 0) s.over = 'deck'; else s.last--; }
  else if (!s.deck.length) s.last = 1; // the deck is out: each seat gets one more turn
  s.turn = other(s.turn);
  return s;
}
export function play(s0, k, why) {
  const s = clone(s0), p = s.turn, card = s.hands[p][k];
  if (s.over || !card) return s0;
  s.hands[p].splice(k, 1);
  if (playable(s, card)) { s.rows[card.c]++; say(s, p, 'played ' + name(card) + ': it fits', why); if (card.r === 4 && s.hints < HINTS) s.hints++; }
  else { s.mistakes++; s.discards.push(card); say(s, p, 'played ' + name(card) + ': it did not fit (mistake ' + s.mistakes + ' of ' + MISTAKES + ')', why); }
  draw(s, p); return endTurn(s);
}
export function discard(s0, k, why) {
  const s = clone(s0), p = s.turn, card = s.hands[p][k];
  if (s.over || !card || s.hints >= HINTS) return s0;
  s.hands[p].splice(k, 1); s.discards.push(card); s.hints++;
  say(s, p, 'discarded ' + name(card) + ' for a hint token', why); draw(s, p); return endTurn(s);
}
// a hint tells the other seat every card of one colour, or every card of one number, in its hand
export function hint(s0, h, why) {
  const s = clone(s0), p = s.turn, q = other(p), hand = s.hands[q];
  if (s.over || s.hints <= 0) return s0;
  const match = (c) => (h.color != null ? c.c === h.color : c.r === h.rank);
  const which = hand.map((c, i) => (match(c) ? i : -1)).filter((i) => i >= 0);
  if (!which.length) return s0; // a hint must point at at least one card
  for (const i of which) { if (h.color != null) hand[i].known.c = h.color; else hand[i].known.r = h.rank; }
  s.hints--;
  const what = h.color != null ? COLORS[h.color] : String(h.rank + 1) + 's';
  say(s, p, 'told ' + (q === 'you' ? 'you' : 'Void') + ': card' + (which.length > 1 ? 's ' : ' ') + which.map((i) => i + 1).join(', ') + (which.length > 1 ? ' are ' : ' is ') + what, why);
  return endTurn(s);
}

// What a side may see: the other hand in full, its own hand only as far as hints have told it, the rows, discards, tokens.
export function view(s, side) {
  return {
    own: s.hands[side].map((c) => ({ known: { ...c.known } })), theirs: s.hands[other(side)].map((c) => ({ c: c.c, r: c.r, known: { ...c.known } })),
    rows: s.rows.slice(), discards: s.discards.map((c) => ({ c: c.c, r: c.r })), hints: s.hints, mistakes: s.mistakes, deck: s.deck.length, turn: s.turn, over: s.over, score: score(s),
  };
}

// Void's turn, from view('void') only (it can't see its own cards): play a card hints have shown to fit; else tell you
// about a card of yours that fits now; else discard its oldest card it knows nothing about; else give any useful hint.
export function voidAct(s0) {
  if (s0.over || s0.turn !== 'void') return s0;
  const v = view(s0, 'void');
  // 1. a card of its own that is certain to fit
  const sure = v.own.findIndex((c) => c.known.c != null && c.known.r != null && v.rows[c.known.c] === c.known.r);
  if (sure >= 0) return play(s0, sure, 'your hints told it card ' + (sure + 1) + ' is ' + COLORS[v.own[sure].known.c] + ' ' + (v.own[sure].known.r + 1) + ', which fits now');
  const rankOnly = v.own.findIndex((c) => c.known.c == null && c.known.r != null && v.rows.every((n) => n === c.known.r || n > c.known.r) && v.rows.some((n) => n === c.known.r));
  if (rankOnly >= 0 && v.rows.filter((n) => n === v.own[rankOnly].known.r).length >= 3) return play(s0, rankOnly, 'card ' + (rankOnly + 1) + ' is a ' + (v.own[rankOnly].known.r + 1) + ' and most rows need one');
  // 2. tell you about a card of yours that fits now and you don't know yet
  if (v.hints > 0) {
    const k = v.theirs.findIndex((c) => v.rows[c.c] === c.r && (c.known.c == null || c.known.r == null));
    if (k >= 0) {
      const c = v.theirs[k], byRank = c.known.r == null && c.r === 0;
      const h = byRank || c.known.c != null ? { rank: c.r } : { color: c.c };
      return hint(s0, h, 'your card ' + (k + 1) + ' is ' + COLORS[c.c] + ' ' + (c.r + 1) + ' and fits now; this hint points you to it');
    }
  }
  // 3. make room: discard its oldest card it has been told nothing about
  if (v.hints < HINTS) {
    const old = v.own.findIndex((c) => c.known.c == null && c.known.r == null);
    if (old >= 0) return discard(s0, old, 'nothing is known about its card ' + (old + 1) + ', and a hint token is worth more right now');
  }
  // 4. any hint that tells you something new
  if (v.hints > 0) {
    for (const [k, c] of v.theirs.entries()) {
      if (c.known.r == null) return hint(s0, { rank: c.r }, 'it shares what it can see: your card ' + (k + 1) + ' is a ' + (c.r + 1));
      if (c.known.c == null) return hint(s0, { color: c.c }, 'it shares what it can see: your card ' + (k + 1) + ' is ' + COLORS[c.c]);
    }
  }
  return discard(s0, 0, 'no hint left to give and nothing it knows fits') !== s0 ? discard(s0, 0, 'no hint left to give and nothing it knows fits') : play(s0, 0, 'nothing else is possible');
}
