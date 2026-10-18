/**
 * Game health (asked by Void: "connect the Elo rating to a 'skill-health' metric for the Games family"): Verse's rating in each game it
 * plays against the person on this device, shown in the Games family on the skill-health card. Chess, checkers and reversi use the Elo
 * estimate from the match history (lib/match-history.js, from 1200); pong and snake use the arcade ladder (lib/ladder.js, from 1000).
 * Each row says the rating, how far it is from where it started, and, once five matches are in, whether Verse is climbing, level or
 * slipping. Fewer than five matches reads "too few matches to say"; nothing played reads nothing. Pure over the two records.
 */
import { summary, GAMES as BOARD, TITLES as BOARD_TITLES, START as BOARD_START } from './match-history.js';
import { rating, played, GAMES as ARCADE, START as ARCADE_START } from './ladder.js';

export const MIN = 5, BAND = 16;
const ARCADE_TITLES = { pong: 'Verse Pong', snake: 'Verse Snake' };
const read = (delta, n) => (n < MIN ? 'too few matches to say' : delta >= BAND ? 'climbing' : delta <= -BAND ? 'slipping' : 'level');

/** [{ game, title, rating, delta, played, read }] for every game with at least one match. Pure. */
export function gameHealth(ladder, log) {
  const rows = [];
  for (const g of BOARD) {
    const s = summary(log, { game: g });
    if (s.played) rows.push({ game: g, title: BOARD_TITLES[g], rating: s.elo.void, delta: s.elo.void - BOARD_START, played: s.played, read: read(s.elo.void - BOARD_START, s.played) });
  }
  for (const g of ARCADE) {
    const n = played(ladder, g);
    if (n) rows.push({ game: g, title: ARCADE_TITLES[g], rating: rating(ladder, g), delta: rating(ladder, g) - ARCADE_START, played: n, read: read(rating(ladder, g) - ARCADE_START, n) });
  }
  return rows;
}
/** the block for the Games family; '' when nothing was played. esc escapes for HTML. Pure. */
export function gameHealthHtml(esc, rows) {
  if (!rows || !rows.length) return '';
  const d = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  return '<div class="sub fh-ratings" data-ratings="' + esc(rows.map((r) => r.game + ':' + r.rating).join(',')) + '" style="font-size:13px;margin:6px 0 0"><b style="font-weight:600">My rating against you on this device</b><ul style="margin:2px 0 0;padding-left:18px">'
    + rows.map((r) => '<li data-game="' + esc(r.game) + '" data-read="' + esc(r.read) + '">' + esc(r.title) + ' ' + esc(r.rating) + ' (' + esc(d(r.delta)) + ' from the start, ' + esc(r.played) + ' match' + (r.played === 1 ? '' : 'es') + '): ' + esc(r.read) + '</li>').join('')
    + '</ul><span style="font-size:12px">An estimate from your games on this device only; it moves with how I do against you, not with how the skill is tested.</span></div>';
}
