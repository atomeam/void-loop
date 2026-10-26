/**
 * wordguess: the rules of /games/word/ ("Hidden word", owner, 2026-10-26: the games lane; a word guess needs its own name and its own words). Guess a
 * five-letter word in six tries; each letter of a guess is marked g (right place), y (in the word elsewhere) or b (not in it), with repeated letters
 * counted the way a person would: a letter is marked y only as many times as the answer still holds it. Pure.
 *   mark(guess, answer) -> 'gybbb'   hardOk(guess, rows) -> '' | reason   dayIndex(date) -> number   keyStates(rows) -> { a: 'g' | 'y' | 'b' }
 *   shareLine(rows, n, won, hard) -> the squares, nothing of the word
 */
export function mark(guess, answer) {
  const g = String(guess).toLowerCase(), a = String(answer).toLowerCase(), out = Array(5).fill('b'), left = {};
  for (let i = 0; i < 5; i++) { if (g[i] === a[i]) out[i] = 'g'; else left[a[i]] = (left[a[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (out[i] !== 'g' && left[g[i]]) { out[i] = 'y'; left[g[i]]--; }
  return out.join('');
}
/** hard mode: every green letter stays in its place and every gold letter is used again. '' when the guess keeps to them. */
export function hardOk(guess, rows) {
  const g = String(guess).toLowerCase();
  for (const { word, marks } of rows) {
    for (let i = 0; i < 5; i++) if (marks[i] === 'g' && g[i] !== word[i]) return 'Letter ' + (i + 1) + ' must be ' + word[i].toUpperCase() + '.';
    const need = {}; for (let i = 0; i < 5; i++) if (marks[i] !== 'b') need[word[i]] = (need[word[i]] || 0) + 1;
    for (const [ch, n] of Object.entries(need)) if ((g.match(new RegExp(ch, 'g')) || []).length < n) return 'The guess must use ' + ch.toUpperCase() + '.';
  }
  return '';
}
/** the word of the day's number: days since 2026-01-01 in the visitor's own calendar. */
export const dayIndex = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5);
/** the keyboard's colours: the best mark each letter has had. */
export function keyStates(rows) { const out = {}, rank = { g: 3, y: 2, b: 1 }; for (const { word, marks } of rows) for (let i = 0; i < 5; i++) { const c = word[i], m = marks[i]; if (!out[c] || rank[m] > rank[out[c]]) out[c] = m; } return out; }
/** what Share copies: the game's number, the tries, and one row of squares per guess; never a letter. */
export function shareLine(rows, label, won, hard) {
  const sq = { g: '🟩', y: '🟨', b: '⬛' };
  return 'Hidden word ' + label + ' ' + (won ? rows.length : 'X') + '/6' + (hard ? '*' : '') + '\n' + rows.map((r) => [...r.marks].map((m) => sq[m]).join('')).join('\n') + '\nhttps://a-to-mind.com/games/word/';
}
/** whether a word is in a list kept as one string of five-letter words (binary search; the list is sorted). */
export function inList(word, packed) { const w = String(word).toLowerCase(); let lo = 0, hi = packed.length / 5 - 1; while (lo <= hi) { const mid = (lo + hi) >> 1, x = packed.slice(mid * 5, mid * 5 + 5); if (x === w) return true; if (x < w) lo = mid + 1; else hi = mid - 1; } return false; }
