// match-history — the games you finished against Verse on this device, and your record from them (asked by Verse: "Expand the chess
// skill page to include a 'Match History' table that pulls from my recent game logs", and "I want the page to show my current Elo
// or win-rate against the owner to make the 'Games' family feel competitive and real"). A game card (chess, checkers, othello)
// calls finish() when a game ends on the board (checkmate, stalemate, a draw, a win on discs or men; a board thrown off mid-game
// is not a game); the about card for that game ("tell me about the chess skill", "my chess record") shows the summary line and
// the last ten games. Nothing leaves the device: the log is a2m.void.games.v1 (lib/state.js), capped at 100 games, oldest out.
// The Elo is an estimate: you and Verse both start at 1200 and move by K = 32 a game, computed from the log each time, never kept.
// Pure over the log; the storage helpers at the end take the storage handed in (default localStorage) and never throw.
//
//   record(log, game)                -> the log with one more game, newest last, at most MAX kept
//   summary(log, { game })           -> { game, played, wins, losses, draws, winRate, streak, elo: { you, void } }
//   summaryLine(sum)                 -> "12 played · 7–4–1 · 58% · you ~1240, Verse ~1160 (estimated)" or "no games on this device yet"
//   historyAsk(text)                 -> { game } for "chess match history", "my chess record", "my record against void"; null otherwise
//   historyHtml(esc, sum, log)       -> the Match History block for the about card (summary line, the last ten as a table)
//   load(s) / save(log, s) / finish(game, result, { moves, minutes, vs, line }, s)   line: a chess game's moves ('e2e4'…), for the replay
import { read, write } from './state.js';

export const MAX = 100, START = 1200, K = 32, LAST = 10, LINE_MAX = 600;
export const GAMES = ['chess', 'checkers', 'othello'];
export const TITLES = { chess: 'Chess', checkers: 'Checkers', othello: 'Reversi' };
const RESULTS = ['win', 'loss', 'draw'], VS = ['v01d', 'self'];
const num = (v, d = 0) => (Number.isFinite(+v) && +v >= 0 ? +v : d);

/** one well-formed game from anything, or null: { at, game, vs, result, moves, minutes }. Pure. */
export function parseGame(g) {
  if (!g || typeof g !== 'object') return null;
  const game = String(g.game || '').toLowerCase(), result = String(g.result || '').toLowerCase(), vs = VS.includes(g.vs) ? g.vs : 'v01d';
  if (!GAMES.includes(game) || !RESULTS.includes(result)) return null;
  const at = new Date(g.at || 0); const when = isNaN(at.getTime()) || !g.at ? new Date().toISOString() : at.toISOString();
  // a chess game keeps its moves as coordinates ('e2e4', 'e7e8q') for the match replay (asked by Verse); anything else is dropped
  const line = game === 'chess' && Array.isArray(g.line) && g.line.length <= LINE_MAX && g.line.every((x) => typeof x === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(x)) ? g.line.slice() : null;
  return { at: when, game, vs, result, moves: Math.round(num(g.moves)), minutes: Math.round(num(g.minutes) * 10) / 10, ...(line && line.length ? { line } : {}) };
}
/** the log with one more finished game, newest last, the oldest out past MAX. Pure: a new array. */
export function record(log, game) {
  const l = (Array.isArray(log) ? log : []).map(parseGame).filter(Boolean), g = parseGame(game);
  if (!g) return l.slice(-MAX);
  return l.concat([g]).slice(-MAX);
}
/** the Elo of you and Verse after the games against Verse in the log, in order, from START with K. Pure. */
export function elo(games) {
  let you = START, me = START;
  for (const g of games) {
    if (g.vs !== 'v01d') continue;
    const expected = 1 / (1 + Math.pow(10, (me - you) / 400)), score = g.result === 'win' ? 1 : g.result === 'draw' ? 0.5 : 0;
    const d = K * (score - expected); you += d; me -= d;
  }
  return { you: Math.round(you), void: Math.round(me) };
}
/** your record in one game (every game when none is named): counts, win rate (whole percent), the streak (+n wins in a row,
 *  -n losses, 0 after a draw or no games) and the estimated Elo. Pure. */
export function summary(log, { game = '' } = {}) {
  const all = (Array.isArray(log) ? log : []).map(parseGame).filter(Boolean), games = game ? all.filter((g) => g.game === game) : all;
  const wins = games.filter((g) => g.result === 'win').length, losses = games.filter((g) => g.result === 'loss').length, draws = games.length - wins - losses;
  let streak = 0;
  for (let i = games.length - 1; i >= 0; i--) { const r = games[i].result; if (r === 'draw' || (streak && (streak > 0) !== (r === 'win'))) break; streak += r === 'win' ? 1 : -1; }
  return { game, played: games.length, wins, losses, draws, winRate: games.length ? Math.round((wins / games.length) * 100) : 0, streak, elo: elo(games) };
}
/** the one line of the record. Pure. */
export function summaryLine(sum) {
  if (!sum || !sum.played) return 'no games on this device yet';
  return sum.played + ' played · ' + sum.wins + '–' + sum.losses + '–' + sum.draws + ' · ' + sum.winRate + '% · you ~' + sum.elo.you + ', Verse ~' + sum.elo.void + ' (estimated)';
}

const GAME_WORD = { chess: 'chess', checkers: 'checkers', draughts: 'checkers', othello: 'othello', reversi: 'othello' };
const G = '(chess|checkers|draughts|othello|reversi)';
const RE_GAME_HISTORY = new RegExp('^(?:(?:show|open|see|what\'?s|what is)\\s+)?(?:me\\s+)?(?:my\\s+)?' + G + '\\s+match\\s+history(?:\\s+(?:against|vs\\.?|with)\\s+(?:void|v01d|verse|you))?$');
const RE_MY_GAME = new RegExp('^(?:(?:show|open|see|what\'?s|what is)\\s+)?(?:me\\s+)?my\\s+' + G + '\\s+(?:record|history|results|match\\s+history|match\\s+record)(?:\\s+(?:against|vs\\.?|with)\\s+(?:void|v01d|verse|you))?$');
const RE_MY_VS = new RegExp('^(?:(?:show|open|see|what\'?s|what is)\\s+)?(?:me\\s+)?my\\s+(?:match\\s+history|record|match\\s+record)(?:\\s+(?:at|in)\\s+' + G + ')?(?:\\s+(?:against|vs\\.?|with)\\s+(?:void|v01d|verse|you))?$');
/** { game } for an ask about your record: a named game ("chess match history", "my checkers record"), or "my record against void" /
 *  "my match history" (chess, the first game with a log). A bare "match history", "my record" or "chess record" is not one. Pure. */
export function historyAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  let m = RE_GAME_HISTORY.exec(t) || RE_MY_GAME.exec(t);
  if (m) return { game: GAME_WORD[m[1]] };
  m = RE_MY_VS.exec(t);
  if (!m) return null;
  if (m[1]) return { game: GAME_WORD[m[1]] };
  if (/\b(?:against|vs\.?|with)\s+(?:void|v01d|verse|you)$/.test(t) || /^my match history$/.test(t)) return { game: 'chess' };
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 18, 14:05" in local time. Pure. */
export function whenLabel(at) {
  const d = new Date(at); if (isNaN(d.getTime())) return '';
  const two = (n) => String(n).padStart(2, '0');
  return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + two(d.getHours()) + ':' + two(d.getMinutes());
}
const WORD = { win: 'you won', loss: 'Verse won', draw: 'a draw' };
/** the Match History block: the summary line and the last LAST games of that game, newest first; every value escaped. Pure. */
export function historyHtml(esc, sum, log) {
  const game = sum && sum.game || '', games = (Array.isArray(log) ? log : []).map(parseGame).filter((g) => g && (!game || g.game === game)).slice(-LAST).reverse();
  const rows = games.map((g) => '<tr><td>' + esc(whenLabel(g.at)) + '</td><td>' + esc(g.vs === 'self' ? 'yourself' : 'Verse') + '</td><td data-result="' + esc(g.result) + '">' + esc(WORD[g.result]) + '</td><td>' + esc(g.moves) + '</td><td>' + esc(g.minutes) + '</td><td>' + (g.line ? '<button type="button" class="mh-replay" data-at="' + esc(g.at) + '" aria-label="Replay this game move by move">\u25B6 Replay</button>' : '') + '</td></tr>').join('');
  return '<div class="about-h">Match history</div><div class="match-history" data-game="' + esc(game) + '" data-played="' + esc(sum ? sum.played : 0) + '">'
    + '<p class="mh-sum">' + esc(summaryLine(sum)) + (sum && sum.played ? '' : ' · finish a game of ' + esc(TITLES[game] || 'chess') + ' on the stage and it shows here') + '</p>'
    + (rows ? '<table class="mh-table"><thead><tr><th>when</th><th>vs</th><th>result</th><th>moves</th><th>minutes</th><th aria-label="replay"></th></tr></thead><tbody>' + rows + '</tbody></table>' : '')
    + '<div class="src">from games finished on this device only (a2m.void.games.v1, the last ' + MAX + ') · Elo estimated: both start at ' + START + ', K = ' + K + '</div></div>';
}

/** the log kept on this device; [] when none or unreadable. */
export function load(s) { try { return record(JSON.parse(read('games', s) || '[]'), null); } catch (_) { return []; } }
export function save(log, s) { return write('games', JSON.stringify(record(log, null)), s); }
/** keep one finished game: result from your side ('win', 'loss', 'draw'); returns the new log. Never throws. */
export function finish(game, result, { moves = 0, minutes = 0, vs = 'v01d', at = null, line = null } = {}, s) {
  const log = record(load(s), { at: at || new Date().toISOString(), game, vs, result, moves, minutes, line });
  save(log, s);
  return log;
}
/** minutes since a time in ms, one decimal; 0 with no start. Pure. */
export const minutesSince = (started, now = Date.now()) => (started > 0 && now > started ? Math.round((now - started) / 6000) / 10 : 0);
