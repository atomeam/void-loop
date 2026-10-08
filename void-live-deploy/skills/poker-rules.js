/**
 * poker-rules — heads-up Texas Hold'em, you against Void, in plain JS (no DOM, no three.js), shared by the card
 * (skills/poker.js), its 3D table and the tests. After Battleship on Adam's list (2026-10-08): incomplete information and
 * probability. Void never sees your cards: it estimates how often its hand wins by dealing out the hands you could hold
 * (and the board still to come) many times, and every bet, call, check or fold it makes says that estimate and why.
 * Play money only. Fixed-limit betting keeps every choice small and clear: bets are one big blind before the turn, two after.
 *
 *   create({ seed, stack }) -> state      deal(s) -> s (a new hand)      act(s, 'fold'|'check'|'call'|'bet'|'raise') -> s
 *   voidAct(s) -> s (Void's choice, with why)      view(s, side) -> what that side may see      evaluate(cards) -> rank
 * Cards are 0..51: rank = c % 13 (0 = two .. 12 = ace), suit = c / 13 | 0.
 */
export const RANKS = '23456789TJQKA', SUITS = '♠♥♦♣';
export const cardName = (c) => RANKS[c % 13] + SUITS[(c / 13) | 0];
const SB = 5, BB = 10, CAP = 4; // blinds, and at most four bets a round

function next(s) { let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const clone = (s) => JSON.parse(JSON.stringify(s));

// the best five of five to seven cards, as a comparable array: [category, ...tie-breakers]
// categories: 8 straight flush, 7 four of a kind, 6 full house, 5 flush, 4 straight, 3 three of a kind, 2 two pair, 1 pair, 0 high card
export const HANDS = ['high card', 'a pair', 'two pair', 'three of a kind', 'a straight', 'a flush', 'a full house', 'four of a kind', 'a straight flush'];
function straightTop(ranks) { const u = [...new Set(ranks)].sort((a, b) => b - a); if (u.includes(12)) u.push(-1); for (let i = 0; i + 4 < u.length; i++) if (u[i] - u[i + 4] === 4) return u[i]; return -2; }
export function evaluate(cards) {
  const ranks = cards.map((c) => c % 13), suits = cards.map((c) => (c / 13) | 0);
  for (let su = 0; su < 4; su++) {
    const fr = cards.filter((c, i) => suits[i] === su).map((c) => c % 13);
    if (fr.length >= 5) { const st = straightTop(fr); if (st > -2) return [8, st]; }
  }
  const count = {}; for (const r of ranks) count[r] = (count[r] || 0) + 1;
  const groups = Object.entries(count).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const desc = [...ranks].sort((a, b) => b - a);
  const kick = (skip, n) => desc.filter((r) => !skip.includes(r)).slice(0, n);
  if (groups[0][0] === 4) return [7, groups[0][1], ...kick([groups[0][1]], 1)];
  if (groups[0][0] === 3 && groups.length > 1 && groups[1][0] >= 2) return [6, groups[0][1], groups[1][1]];
  for (let su = 0; su < 4; su++) { const fr = cards.filter((c, i) => suits[i] === su).map((c) => c % 13).sort((a, b) => b - a); if (fr.length >= 5) return [5, ...fr.slice(0, 5)]; }
  const st = straightTop(ranks); if (st > -2) return [4, st];
  if (groups[0][0] === 3) return [3, groups[0][1], ...kick([groups[0][1]], 2)];
  if (groups[0][0] === 2 && groups[1] && groups[1][0] === 2) return [2, groups[0][1], groups[1][1], ...kick([groups[0][1], groups[1][1]], 1)];
  if (groups[0][0] === 2) return [1, groups[0][1], ...kick([groups[0][1]], 3)];
  return [0, ...desc.slice(0, 5)];
}
export const compare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d; } return 0; };

export function create({ seed = (Math.random() * 4294967296) >>> 0, stack = 500 } = {}) {
  const s = { rng: seed >>> 0, stacks: { you: stack, void: stack }, button: 'void', hand: 0, log: [], over: null };
  return deal(s);
}
const other = (p) => (p === 'you' ? 'void' : 'you');
const say = (s, who, text, extra = {}) => { s.log.push({ who: who === 'you' ? 'You' : who === 'void' ? 'Void' : '', text, ...extra }); if (s.log.length > 120) s.log.splice(0, s.log.length - 120); };

export function deal(s0) {
  const s = s0.cards ? clone(s0) : s0;
  if (s.stacks.you <= 0 || s.stacks.void <= 0) { s.over = s.stacks.you > 0 ? 'you' : 'void'; return s; }
  const deck = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(next(s) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  s.button = other(s.button); s.hand++;
  s.cards = { you: [deck[0], deck[2]], void: [deck[1], deck[3]] }; s.deck = deck.slice(4); s.board = []; s.street = 0;
  s.pot = 0; s.bet = { you: 0, void: 0 }; s.raises = 0; s.result = null; s.acted = { you: false, void: false };
  // heads-up: the button posts the small blind and acts first before the flop
  const sb = s.button, bb = other(sb);
  post(s, sb, SB); post(s, bb, BB); s.raises = 1;
  s.toAct = sb;
  say(s, null, 'Hand ' + s.hand + ': ' + (sb === 'you' ? 'you post' : 'Void posts') + ' the small blind ' + SB + ', ' + (bb === 'you' ? 'you post' : 'Void posts') + ' the big blind ' + BB);
  return s;
}
function post(s, p, n) { const k = Math.min(n, s.stacks[p]); s.stacks[p] -= k; s.bet[p] += k; s.pot += k; }
const size = (s) => (s.street >= 2 ? BB * 2 : BB);

export function legal(s) {
  if (s.result || s.over) return [];
  const p = s.toAct, owe = s.bet[other(p)] - s.bet[p];
  const out = owe > 0 ? ['fold', 'call'] : ['check'];
  if (s.raises < CAP && s.stacks[p] > owe) out.push(owe > 0 ? 'raise' : 'bet');
  return out;
}
export function act(s0, move, why = null) {
  if (!legal(s0).includes(move)) return s0;
  const s = clone(s0), p = s.toAct, q = other(p), owe = s.bet[q] - s.bet[p];
  const extra = why ? { why } : {};
  if (move === 'fold') { say(s, p, 'folds', extra); return win(s, q, null); }
  if (move === 'check') say(s, p, 'checks', extra);
  if (move === 'call') {
    post(s, p, owe); say(s, p, 'calls ' + Math.min(owe, s.bet[p]), extra);
    if (s.bet[p] < s.bet[q]) { const back = s.bet[q] - s.bet[p]; s.stacks[q] += back; s.pot -= back; s.bet[q] = s.bet[p]; } // all in for less: the rest goes back
  }
  if (move === 'bet' || move === 'raise') { post(s, p, owe + size(s)); s.raises++; say(s, p, (move === 'bet' ? 'bets ' : 'raises to ') + s.bet[p], extra); s.acted[q] = false; }
  s.acted[p] = true;
  const settled = s.bet.you === s.bet.void && s.acted.you && s.acted.void;
  if (settled || ((s.stacks.you === 0 || s.stacks.void === 0) && s.bet.you === s.bet.void)) return nextStreet(s);
  s.toAct = q;
  return s;
}
function nextStreet(s) {
  if (s.street === 3 || s.stacks.you === 0 || s.stacks.void === 0) {
    while (s.board.length < 5) s.board.push(s.deck.shift());
    return showdown(s);
  }
  s.street++; s.bet = { you: 0, void: 0 }; s.raises = 0; s.acted = { you: false, void: false };
  const n = s.street === 1 ? 3 : 1; for (let k = 0; k < n; k++) s.board.push(s.deck.shift());
  say(s, null, ['', 'The flop', 'The turn', 'The river'][s.street] + ': ' + s.board.map(cardName).join(' '));
  s.toAct = other(s.button); // after the flop the big blind acts first
  return s;
}
function showdown(s) {
  const y = evaluate([...s.cards.you, ...s.board]), v = evaluate([...s.cards.void, ...s.board]), c = compare(y, v);
  say(s, null, 'Showdown: you have ' + HANDS[y[0]] + ' (' + s.cards.you.map(cardName).join(' ') + '), Void has ' + HANDS[v[0]] + ' (' + s.cards.void.map(cardName).join(' ') + ')');
  return win(s, c > 0 ? 'you' : c < 0 ? 'void' : null, { you: HANDS[y[0]], void: HANDS[v[0]] });
}
function win(s, p, hands) {
  if (p) { s.stacks[p] += s.pot; say(s, p, 'wins ' + s.pot); } else { s.stacks.you += s.pot / 2; s.stacks.void += s.pot / 2; say(s, null, 'Split pot'); }
  s.result = { winner: p, pot: s.pot, hands, shown: !!hands }; s.pot = 0; s.toAct = null;
  if (s.stacks.you <= 0 || s.stacks.void <= 0) s.over = s.stacks.you > 0 ? 'you' : 'void';
  return s;
}

// What a side may see: its own cards, the board, the pot and stacks, and the other side's cards only after a showdown.
export function view(s, side) {
  return { mine: s.cards[side].slice(), theirs: s.result && s.result.shown ? s.cards[other(side)].slice() : null, board: s.board.slice(), pot: s.pot, bet: { ...s.bet }, stacks: { ...s.stacks }, toAct: s.toAct, street: s.street, result: s.result, over: s.over, legal: s.toAct === side ? legal(s) : [] };
}

// Void's estimate of how often its hand wins, from what it can see only: it deals out the hands you could hold and the
// cards still to come, many times. Your real cards are never read here.
export function equity(mine, board, trials = 600, rnd = Math.random) {
  const seen = new Set([...mine, ...board]), rest = [...Array(52).keys()].filter((c) => !seen.has(c));
  let score = 0;
  for (let t = 0; t < trials; t++) {
    const d = rest.slice(); for (let i = 0; i < 2 + 5 - board.length; i++) { const j = i + Math.floor(rnd() * (d.length - i)); [d[i], d[j]] = [d[j], d[i]]; }
    const opp = [d[0], d[1]], full = [...board, ...d.slice(2, 2 + 5 - board.length)];
    const c = compare(evaluate([...mine, ...full]), evaluate([...opp, ...full]));
    score += c > 0 ? 1 : c === 0 ? 0.5 : 0;
  }
  return score / trials;
}
export function voidAct(s0) {
  if (s0.toAct !== 'void' || s0.result || s0.over) return s0;
  const s = clone(s0), v = view(s, 'void'), moves = v.legal, owe = v.bet.you - v.bet.void;
  const eq = equity(v.mine, v.board, 600, () => next(s)), pct = Math.round(eq * 100);
  const odds = owe > 0 ? owe / (v.pot + owe) : 0, oddsPct = Math.round(odds * 100);
  let move, why;
  if (eq >= 0.68 && (moves.includes('raise') || moves.includes('bet'))) { move = moves.includes('raise') ? 'raise' : 'bet'; why = 'it expects to win about ' + pct + '% of the time against the hands you could hold, so it builds the pot'; }
  else if (owe === 0) {
    if (eq >= 0.55 && moves.includes('bet')) { move = 'bet'; why = 'about ' + pct + '% to win: ahead of the hands you could hold, so it bets'; }
    else { move = 'check'; why = 'about ' + pct + '% to win: not enough to bet, and checking costs nothing'; }
  } else if (eq >= odds + 0.04) { move = 'call'; why = 'about ' + pct + '% to win, and calling ' + owe + ' into ' + v.pot + ' needs only ' + oddsPct + '%'; }
  else { move = 'fold'; why = 'about ' + pct + '% to win, but calling ' + owe + ' into ' + v.pot + ' needs ' + oddsPct + '%'; }
  return act(s, move, why);
}
