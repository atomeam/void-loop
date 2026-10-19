// ladder — Verse's arcade record, kept on this device (asked by Verse, 2026-10-16: "Link the video-games ladder wins to my growth
// card so my skill ratings increase as I win more matches"). Verse Pong and Verse Snake (docs/video-games.md) record each finished
// match here; Verse's rating in a game starts at 1000 and moves 16 a match (up for a win, down for a loss, none for a draw, never
// under 400), and the growth card shows the record and the ratings. Pure over the record; the storage is lib/state.js.
import { read, write } from './state.js';

export const START = 1000, STEP = 16, FLOOR = 400, GAMES = ['pong', 'snake', 'null-sweep', 'merge-void', 'dim-void', 'void-breaker']; // every Studio game with Verse as player two (domains/void.game-studio.md) records here
const blank = () => Object.fromEntries(GAMES.map((g) => [g, { void: 0, you: 0, draw: 0 }]));

/** the record with one more finished match: winner 'void', 'you' or 'draw' (anything else is not counted). Pure. */
export function record(ladder, game, winner) {
  const l = { ...blank(), ...(ladder || {}) };
  if (!GAMES.includes(game) || !['void', 'you', 'draw'].includes(winner)) return l;
  l[game] = { ...l[game], [winner]: (+l[game][winner] || 0) + 1 };
  return l;
}
/** Verse's rating in a game from its record. Pure. */
export function rating(ladder, game) {
  const g = (ladder && ladder[game]) || {};
  return Math.max(FLOOR, START + STEP * ((+g.void || 0) - (+g.you || 0)));
}
/** matches finished in a game. Pure. */
export const played = (ladder, game) => { const g = (ladder && ladder[game]) || {}; return (+g.void || 0) + (+g.you || 0) + (+g.draw || 0); };

export function load(s) { try { const l = JSON.parse(read('ladder', s) || 'null'); return l && typeof l === 'object' ? { ...blank(), ...l } : blank(); } catch (_) { return blank(); } }
/** keep one finished match; returns the new record. */
export function finish(game, winner, s) {
  const l = record(load(s), game, winner);
  write('ladder', JSON.stringify(l), s);
  return l;
}

const TITLES = { pong: 'Verse Pong', snake: 'Verse Snake', 'null-sweep': 'Null Sweep', 'merge-void': 'Merge Void', 'dim-void': 'Dim the Void', 'void-breaker': 'Void Breaker' };
/** the growth card's line: '' until a match is finished. Every value is a number or a fixed title. Pure. */
export function ladderHtml(esc, ladder) {
  const rows = GAMES.filter((g) => played(ladder, g) > 0);
  if (!rows.length) return '';
  return '<div class="sub growth-ladder" data-ladder="' + rows.map((g) => rating(ladder, g)).join(',') + '">my arcade ladder (your matches against me): '
    + rows.map((g) => esc(TITLES[g]) + ' ' + rating(ladder, g) + ' (I won ' + (+ladder[g].void || 0) + ', you won ' + (+ladder[g].you || 0) + ')').join(' · ') + '</div>';
}
