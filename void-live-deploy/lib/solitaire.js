/**
 * solitaire: Klondike for /games/solitaire/ (owner, 2026-10-26: the games lane, a page per site). The rules are the public card game's; the words and
 * the look are Verse's. A deal comes from its number, so a deal can be played again or shared. Pure (the deal number is the only chance).
 *   deal(n, draw) -> state   draw(s)   moves(s) -> [move]   move(s, m) -> s | null   auto(s) -> s (one card home, or null)   won(s)   canFinish(s)
 * A card is { s: 0..3 (spades, hearts, diamonds, clubs), r: 1..13, up }. Piles: stock, waste, found[4], tab[7]. A move: { from: 'waste' | 'tab3' |
 * 'found1', n (cards from the top, tableau only), to: 'tab5' | 'found0' }. Scores as most Klondike games score: +5 a card to the tableau from the
 * waste, +10 a card home, +5 a card turned up, -15 a card back from home, -100 a pass through the stock in draw one.
 */
export const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const red = (c) => c.s === 1 || c.s === 2;
const rngOf = (seed) => { let x = (seed >>> 0) || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
export function deal(n = 1, drawN = 1) {
  const r = rngOf(n * 2654435761), cards = [];
  for (let s = 0; s < 4; s++) for (let k = 1; k <= 13; k++) cards.push({ s, r: k, up: false });
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  const tab = []; for (let i = 0; i < 7; i++) { tab.push(cards.splice(0, i + 1)); tab[i][i].up = true; }
  return { n, drawN, stock: cards, waste: [], found: [[], [], [], []], tab, score: 0, moves: 0, passes: 0 };
}
const pile = (s, name) => (name === 'waste' ? s.waste : name.startsWith('tab') ? s.tab[+name.slice(3)] : s.found[+name.slice(5)]);
export const clone = (s) => JSON.parse(JSON.stringify(s));
/** turn cards from the stock (or the waste back over when the stock is empty). Mutates s. */
export function draw(s) {
  if (s.stock.length) { for (let i = 0; i < s.drawN && s.stock.length; i++) { const c = s.stock.pop(); c.up = true; s.waste.push(c); } }
  else if (s.waste.length) { s.stock = s.waste.reverse().map((c) => ({ ...c, up: false })); s.waste = []; s.passes++; if (s.drawN === 1) s.score = Math.max(0, s.score - 100); }
  else return null;
  s.moves++; return s;
}
const onFound = (c, f) => c && (f.length ? f[f.length - 1].s === c.s && f[f.length - 1].r === c.r - 1 : c.r === 1);
const onTab = (c, t) => c && (t.length ? (t[t.length - 1].up && red(t[t.length - 1]) !== red(c) && t[t.length - 1].r === c.r + 1) : c.r === 13);
/** whether a move is allowed. */
export function legal(s, m) {
  const src = pile(s, m.from), n = m.n || 1; if (!src || src.length < n) return false;
  const cards = src.slice(src.length - n); if (!cards.every((c) => c.up)) return false;
  if (m.from === m.to) return false;
  for (let i = 1; i < cards.length; i++) if (red(cards[i]) === red(cards[i - 1]) || cards[i].r !== cards[i - 1].r - 1) return false;
  if (m.to.startsWith('found')) return n === 1 && onFound(cards[0], pile(s, m.to));
  if (m.from === 'waste' && n !== 1) return false;
  return onTab(cards[0], pile(s, m.to));
}
/** play a move: the cards go, the card left under them turns up, the score follows. Returns s, or null when the move is not allowed. Mutates s. */
export function move(s, m) {
  if (!legal(s, m)) return null; const src = pile(s, m.from), n = m.n || 1, cards = src.splice(src.length - n, n); pile(s, m.to).push(...cards);
  if (m.to.startsWith('found')) s.score += 10; else if (m.from === 'waste') s.score += 5; else if (m.from.startsWith('found')) s.score = Math.max(0, s.score - 15);
  if (src.length && !src[src.length - 1].up && m.from.startsWith('tab')) { src[src.length - 1].up = true; s.score += 5; }
  s.moves++; return s;
}
/** every allowed move, the useful ones first (home, then a move that turns a card up, then the rest), the stock not included. */
export function moves(s) {
  const out = [], froms = ['waste', ...s.tab.map((_, i) => 'tab' + i)];
  for (const from of froms) { const p = pile(s, from); if (!p.length) continue; for (let f = 0; f < 4; f++) { const m = { from, n: 1, to: 'found' + f }; if (legal(s, m)) out.push({ ...m, why: 'home' }); } }
  s.tab.forEach((t, i) => { const firstUp = t.findIndex((c) => c.up); if (firstUp < 0) return; for (let k = firstUp; k < t.length; k++) for (let j = 0; j < 7; j++) { if (j === i) continue; const m = { from: 'tab' + i, n: t.length - k, to: 'tab' + j }; if (!legal(s, m)) continue; if (k === 0 && t[k].r === 13) continue; out.push({ ...m, why: k > 0 && !t[k - 1].up ? 'turns a card up' : k === 0 ? 'empties a column' : 'move' }); } });
  for (let j = 0; j < 7; j++) { const m = { from: 'waste', n: 1, to: 'tab' + j }; if (legal(s, m)) out.push({ ...m, why: 'from the waste' }); }
  const rank = { home: 0, 'turns a card up': 1, 'from the waste': 2, 'empties a column': 3, move: 4 };
  return out.sort((a, b) => rank[a.why] - rank[b.why]);
}
/** the best place for a card picked up (home first, else a column), as a move, or null. */
export function bestFor(s, from, n = 1) {
  if (n === 1) for (let f = 0; f < 4; f++) { const m = { from, n, to: 'found' + f }; if (legal(s, m)) return m; }
  for (let j = 0; j < 7; j++) { const m = { from, n, to: 'tab' + j }; if (legal(s, m) && !(pile(s, 'tab' + j).length === 0 && pile(s, from).length === n && from.startsWith('tab'))) return m; }
  return null;
}
/** a hint: a useful move, else "turn the stock", else null (nothing left to try). A move between columns that only shuffles is not offered. */
export function hint(s) { const m = moves(s).find((x) => x.why !== 'move' && x.why !== 'empties a column'); if (m) return m; if (s.stock.length || s.waste.length) return { draw: true }; return moves(s)[0] || null; }
export const won = (s) => s.found.every((f) => f.length === 13);
/** every card turned up with the stock and waste empty: the rest can be played home without a choice. */
export const canFinish = (s) => !s.stock.length && !s.waste.length && s.tab.every((t) => t.every((c) => c.up));
/** one card home if any can go (auto-finish steps by this). Mutates s; null when none can. */
export function auto(s) { for (const from of ['waste', ...s.tab.map((_, i) => 'tab' + i)]) for (let f = 0; f < 4; f++) { const m = { from, n: 1, to: 'found' + f }; if (legal(s, m)) return move(s, m); } return null; }
export const cardName = (c) => RANKS[c.r] + SUITS[c.s];
