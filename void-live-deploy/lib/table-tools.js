// The Game Box's table tools (owner, 2026-10-22: "dice, coins, random numbers, the magic 8-ball and cards should all live in the same box as the
// games"). Pure functions that take a random source, so tests can fix it and the page uses crypto (fair, unbiased). Every game in the box can use
// them: the Landlord's Game and VoidQuest roll with rollDice. The page's chance answers (void.html chanceOf) say the same things in words.
export function cryptoRnd(n) { // a fair whole number in [0, n)
  if (!(n >= 1)) return 0; const c = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto : null;
  if (!c) return Math.floor(Math.random() * n);
  const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; let x; do { c.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n;
}
const clampInt = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
/** dice of any count (1-100) and any number of sides (2-1000): { rolls, total, count, sides }. Pure given rnd. */
export function rollDice(count = 1, sides = 6, rnd = cryptoRnd) {
  const n = clampInt(count, 1, 100, 1), s = clampInt(sides, 2, 1000, 6), rolls = Array.from({ length: n }, () => rnd(s) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0), count: n, sides: s };
}
/** "2d6", "d20", "3 d10", "4" (count only), "" -> { count, sides }. Pure. */
export function diceSpec(text = '') {
  const t = String(text).toLowerCase().replace(/\s+/g, ''); const m = /^(\d{0,3})d(\d{1,4})$/.exec(t);
  if (m) return { count: clampInt(m[1] || 1, 1, 100, 1), sides: clampInt(m[2], 2, 1000, 6) };
  return /^\d{1,3}$/.test(t) ? { count: clampInt(t, 1, 100, 1), sides: 6 } : { count: 1, sides: 6 };
}
export const flipCoin = (rnd = cryptoRnd) => (rnd(2) ? 'Heads' : 'Tails');
/** a whole number from lo to hi inclusive (either order). Pure given rnd. */
export function pickNumber(lo = 1, hi = 100, rnd = cryptoRnd) { let a = clampInt(lo, -1e9, 1e9, 1), b = clampInt(hi, -1e9, 1e9, 100); if (a > b) [a, b] = [b, a]; return a + rnd(b - a + 1); }
// the answer orb: the twenty traditional 8-ball-style answers (10 yes, 5 maybe, 5 no); a random pick, never knowledge, and the box says so
export const ORB = ['It is certain', 'Without a doubt', 'Yes, definitely', 'You may rely on it', 'As I see it, yes', 'Most likely', 'Outlook good', 'Yes', 'Signs point to yes', 'It is decidedly so',
  'Reply hazy, try again', 'Ask again later', 'Better not tell you now', 'Cannot predict now', 'Concentrate and ask again',
  "Don't count on it", 'My reply is no', 'My sources say no', 'Outlook not so good', 'Very doubtful'];
export const orb = (rnd = cryptoRnd) => ORB[rnd(ORB.length)];
// a standard 52-card deck
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
export const newDeck = () => SUITS.flatMap((s) => RANKS.map((r) => r + s));
export function shuffle(list, rnd = cryptoRnd) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** draw n from the top: { drawn, left }. Pure. */
export function draw(deck, n = 1) { const k = clampInt(n, 0, deck.length, 1); return { drawn: deck.slice(0, k), left: deck.slice(k) }; }
// score keeper: [{ name, score }]
export function addPlayer(list, name) { const n = String(name || '').trim().slice(0, 30) || 'Player ' + (list.length + 1); return list.length >= 12 ? list : [...list, { name: n, score: 0 }]; }
export const bump = (list, i, by) => list.map((p, j) => (j === i ? { ...p, score: p.score + (Number.isFinite(+by) ? +by : 0) } : p));
export const leader = (list) => (list.length ? list.reduce((a, b) => (b.score > a.score ? b : a)) : null);
/** "1:30", "90", "2m", "1m30s" -> seconds (0 when unreadable), at most 24 hours. Pure. */
export function seconds(text) {
  const t = String(text || '').trim().toLowerCase(); let m = /^(\d{1,3}):(\d{2})$/.exec(t); if (m) return Math.min(86400, +m[1] * 60 + +m[2]);
  m = /^(?:(\d{1,3})\s*h)?\s*(?:(\d{1,4})\s*m(?:in)?)?\s*(?:(\d{1,5})\s*s(?:ec)?)?$/.exec(t); if (m && (m[1] || m[2] || m[3])) return Math.min(86400, (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0));
  return /^\d{1,5}$/.test(t) ? Math.min(86400, +t) : 0;
}
export const clock = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
