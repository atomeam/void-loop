// Verse Rally: the quick card game every Verse answer card can play in (owner, 2026-10-22: "make the answer cards playable", "super fun and easy
// to learn"). Pure: no DOM, no clock, no network. The UI is skills/rally.js; the deck kept on this device is lib/card-deck.js.
// A card's numbers come from the answer it was made from, never invented (cardFrom): its type from the answer's own words, its power from how much
// the answer says, how many sources stand behind it and its rarity, its one ability from a fact about the text (sources, figures, a list, length).
// Rules, all of them:
//   Best of three rounds. Each round both sides take turns putting one card from hand into their row, or passing. Once you pass you are out of
//   that round. When both have passed, the bigger row wins the round. Hands carry over, so a card held back is a card for the next round.
//   Type wheel: Sky > Land > Life > Word > Number > Sky. A card played onto a row where the rival's latest card is a type it beats gets +3 (Edge).
//   No mana, no dice in play: the only luck is the shuffle at the start.
import { rng, seedOf } from './game-kit.js';

export const TYPES = ['sky', 'land', 'life', 'word', 'number'];
export const TYPE_NAME = { sky: 'Sky', land: 'Land', life: 'Life', word: 'Word', number: 'Number' };
export const beats = (a, b) => { const i = TYPES.indexOf(a); return i >= 0 && TYPES[(i + 1) % 5] === b; };
export const EDGE = 3, HAND = 8, DRAW_BETWEEN = 2, ROUNDS_TO_WIN = 2;
export const ABILITIES = {
  backed: 'Backed: +1 for each other Backed card in your row (it cites sources)',
  tally: 'Tally: when played, your weakest other card in the row gets +2 (its answer is full of figures)',
  rally: 'Rally: when played, every other card of its type in your row gets +1 (its answer is a list)',
  deep: 'Deep: stays in your row for the next round at half power (a long, thorough answer)',
  spark: 'Spark: +3 if it is the first card of the round (it answered a direct question)',
  swift: 'Swift: +2 if Verse has already passed this round (a short, quick answer)',
};
const WORDS = {
  sky: /\b(sky|star|stars|sun|moon|planet|planets|space|orbit|weather|rain|snow|wind|cloud|storm|light|galaxy|comet|eclipse|aurora|meteor|temperature|forecast|nasa)\b/g,
  land: /\b(city|cities|country|countries|map|mountain|river|island|ocean|sea|lake|capital|border|region|state|town|street|continent|coast|desert|forest|km|miles?)\b/g,
  life: /\b(food|recipe|cook|eat|animal|animals|plant|plants|body|health|cell|species|dog|cat|bird|fish|tree|blood|sleep|disease|medicine|pancakes?|flour|egg|eggs|life|born|died)\b/g,
  number: /\b(\d[\d,.]*%?|percent|sum|total|price|cost|rate|convert|equals|calculat\w*|math|number|average|dollars?|\$)\b/g,
  word: /\b(word|words|language|translate|book|novel|poem|wrote|written|author|play|history|name|meaning|story|song|film|spanish|french|english)\b/g,
};
const count = (re, s) => (String(s).match(re) || []).length;
const RAR = { mythic: 3, rare: 2, uncommon: 1, common: 0 };
/** a playable card from a kept answer { t, k, b, src (count), rarity }. Deterministic: the same answer is always the same card. Pure. */
export function cardFrom(a = {}) {
  const t = String(a.t || '').trim(), b = String(a.b || ''), text = (t + ' ' + t + ' ' + b).toLowerCase(), src = Math.max(0, Math.min(8, +a.src || 0));
  let type = 'word', best = 0; for (const ty of TYPES) { const n = count(WORDS[ty], text) * (ty === 'number' ? 0.4 : 1); if (n > best + 1e-9) { best = n; type = ty; } }
  const words = b.split(/\s+/).filter(Boolean).length, rarity = RAR[String(a.rarity || '').toLowerCase()] != null ? String(a.rarity).toLowerCase() : src >= 3 ? 'uncommon' : 'common';
  const power = Math.max(1, Math.min(10, 2 + Math.min(4, Math.floor(Math.log2(words / 20 + 1))) + Math.min(2, src) + RAR[rarity]));
  const figures = count(/\d[\d,.]*/g, b), listed = b.split('\n').filter((l) => /^\s*(?:[-*•·]|\d+[.)])\s+\S/.test(l)).length;
  const ability = src >= 2 ? 'backed' : figures >= 4 ? 'tally' : listed >= 3 ? 'rally' : words >= 250 ? 'deep' : /\?$|^(?:who|what|when|where|why|how|which|is|are|does|do|can)\b/i.test(t) ? 'spark' : words > 0 && words < 40 ? 'swift' : '';
  return { id: 'c' + seedOf(t + '|' + b.slice(0, 400)).toString(36), name: t.slice(0, 80) || 'Answer', type, power, rarity, ability, words, src };
}

const shuffle = (list, r) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** a new match. you/verse: card lists (any length >= 1). seed: number. Pure. */
export function newMatch(you, verse, seed = 1, level = 2) {
  const r = rng(seed), dy = shuffle(you, r), dv = shuffle(verse, r);
  return { seed, level, round: 1, wins: { you: 0, verse: 0 }, turn: 'you', passed: { you: false, verse: false },
    hand: { you: dy.slice(0, HAND), verse: dv.slice(0, HAND) }, deck: { you: dy.slice(HAND), verse: dv.slice(HAND) },
    row: { you: [], verse: [] }, log: [], over: null, firstThisRound: true };
}
const other = (s) => (s === 'you' ? 'verse' : 'you');
export const score = (row) => row.reduce((n, c) => n + c.now, 0);
const clone = (s) => JSON.parse(JSON.stringify(s));
export function legal(s, side) { if (s.over || s.turn !== side || s.passed[side]) return []; return [...s.hand[side].map((c) => ({ type: 'play', id: c.id })), { type: 'pass' }]; }
/** the power a card would land with right now (Edge and its ability), for the UI's preview. Pure. */
export function landing(s, side, card) {
  const foe = s.row[other(side)], last = foe[foe.length - 1]; let n = card.power, why = [];
  if (last && beats(card.type, last.type)) { n += EDGE; why.push('Edge +' + EDGE + ' over ' + TYPE_NAME[last.type]); }
  if (card.ability === 'spark' && s.firstThisRound) { n += 3; why.push('Spark +3'); }
  if (card.ability === 'swift' && s.passed[other(side)]) { n += 2; why.push('Swift +2'); }
  return { n, why };
}
/** apply one action by whoever's turn it is. Pure; throws on an illegal action. */
export function apply(s0, act) {
  const s = clone(s0), me = s.turn, foe = other(me);
  if (s.over) throw new Error('the match is over');
  if (act.type === 'pass') { s.passed[me] = true; s.log.push((me === 'you' ? 'You pass' : 'Verse passes') + ' at ' + score(s.row[me])); }
  else {
    const i = s.hand[me].findIndex((c) => c.id === act.id); if (i < 0 || s.passed[me]) throw new Error('that card is not in hand');
    const [c] = s.hand[me].splice(i, 1), l = landing(s, me, c), row = s.row[me];
    const placed = { ...c, now: l.n }; row.push(placed); s.firstThisRound = false;
    if (c.ability === 'tally') { const w = row.filter((x) => x !== placed).sort((a, b) => a.now - b.now)[0]; if (w) { w.now += 2; l.why.push('Tally +2 to ' + w.name); } }
    if (c.ability === 'rally') { let k = 0; for (const x of row) if (x !== placed && x.type === c.type) { x.now += 1; k++; } if (k) l.why.push('Rally +1 to ' + k); }
    for (const x of row) x.backedBonus = 0;
    const backed = row.filter((x) => x.ability === 'backed'); for (const x of backed) { const want = backed.length - 1; x.now += want - (x.lastBacked || 0); x.lastBacked = want; }
    s.log.push((me === 'you' ? 'You play ' : 'Verse plays ') + c.name + ' (' + l.n + (l.why.length ? ': ' + l.why.join(', ') : '') + ')');
  }
  if (s.passed.you && s.passed.verse) return endRound(s);
  s.turn = s.passed[foe] ? me : foe;
  return s;
}
function endRound(s) {
  const a = score(s.row.you), b = score(s.row.verse), w = a > b ? 'you' : b > a ? 'verse' : 'both';
  if (w === 'both') { s.wins.you++; s.wins.verse++; } else s.wins[w]++;
  s.log.push('Round ' + s.round + ': ' + a + ' to ' + b + (w === 'both' ? ', a tie, a point each' : w === 'you' ? ', yours' : ', Verse’s'));
  const done = s.wins.you >= ROUNDS_TO_WIN || s.wins.verse >= ROUNDS_TO_WIN || s.round >= 3;
  if (done) { s.over = { winner: s.wins.you > s.wins.verse ? 'you' : s.wins.verse > s.wins.you ? 'verse' : 'draw' }; return s; }
  s.round++;
  for (const side of ['you', 'verse']) {
    s.row[side] = s.row[side].filter((c) => c.ability === 'deep' && !c.stayed).map((c) => ({ ...c, now: Math.ceil(c.now / 2), stayed: true }));
    s.hand[side].push(...s.deck[side].splice(0, DRAW_BETWEEN)); s.passed[side] = false;
  }
  s.firstThisRound = true; s.turn = w === 'you' ? 'verse' : 'you'; // the round's loser opens the next one
  return s;
}

// Verse's side. Level 1 plays its first card or passes; 2 plays to get just ahead and passes when ahead; 3 also saves cards when a round is lost
// anyway; 4 ("Master") searches every line of the round with both hands open: it sees your hand, and the card says so.
export const LEVELS = { 1: 'Easy', 2: 'Fair', 3: 'Sharp', 4: 'Master (sees your hand)' };
const value = (s) => (s.over ? (s.over.winner === 'verse' ? 1000 : s.over.winner === 'you' ? -1000 : 0) : (s.wins.verse - s.wins.you) * 100 + (s.hand.verse.length - s.hand.you.length) * 12 + score(s.row.verse) - score(s.row.you));
function search(s, depth, roundAtStart) {
  if (s.over || depth === 0 || s.round !== roundAtStart) return { v: value(s) };
  const side = s.turn, moves = legal(s, side); if (!moves.length) return { v: value(s) };
  let best = null;
  for (const m of moves) { const v = search(apply(s, m), depth - 1, roundAtStart).v; if (!best || (side === 'verse' ? v > best.v : v < best.v)) best = { v, m }; }
  return best;
}
export function verseMove(s) {
  const moves = legal(s, 'verse'); if (!moves.length) return null;
  const mine = score(s.row.verse), yours = score(s.row.you), hand = s.hand.verse.slice().sort((a, b) => a.power - b.power);
  const lv = s.level || 2;
  if (lv <= 1) return hand.length && (mine <= yours || s.hand.verse.length > 6) ? { type: 'play', id: s.hand.verse[0].id } : { type: 'pass' };
  if (lv >= 4) return search(s, Math.min(6, 2 + Math.floor(12 / Math.max(2, s.hand.verse.length + s.hand.you.length)) * 2), s.round).m || { type: 'pass' };
  if (mine > yours && (s.passed.you || lv === 2)) return { type: 'pass' };
  const gap = yours - mine, mustWin = lv >= 3 && s.wins.you >= 1;
  if (lv >= 3 && !mustWin && gap > 8 && s.wins.verse === 0 && !s.passed.you) return { type: 'pass' }; // a lost cause: keep the cards
  const land = hand.map((c) => ({ c, n: landing(s, 'verse', c).n }));
  const enough = land.filter((x) => mine + x.n > yours).sort((a, b) => a.n - b.n)[0];
  if (enough) return { type: 'play', id: enough.c.id };
  const top = land.sort((a, b) => b.n - a.n)[0]; return top ? { type: 'play', id: top.c.id } : { type: 'pass' };
}
/** the daily challenge's seed: the same for everyone on a UTC day. Pure. */
export const dailySeed = (isoDay) => seedOf('verse-rally-' + String(isoDay).slice(0, 10));
