/**
 * chess-play: a chess game as /chess/ keeps it (owner, 2026-10-26: the games floor, Lichess). The rules are skills/chess-rules.js (every rule, the
 * move labels); this adds what a game page needs around them: a game from a start position and its moves, SAN read and written, PGN in and out
 * (headers, comments and side lines read and dropped), FEN checked with a reason, the link that carries a game, the clock, the result in words, and
 * a rating kept on this device against Verse's levels. Pure (the clock takes the time it is given).
 *   newGame(fen?) -> g      push(g, 'e2e4' | 'Nf3') -> g | null      positionAt(g, ply) -> rules position      sanList(g)
 *   toPGN(g, headers) / fromPGN(text) -> g      checkFEN(fen) -> '' | reason      linkOf(g) / gameFromLink(search) -> g
 *   clock: makeClock(ms, inc) / pressClock(c, side, now) / clockLeft(c, side, now)      eloAfter(r, opp, score, k)
 */
import { START, fromFEN, toFEN, legalMoves, apply, status, moveLabel, sqName, inCheck } from '../skills/chess-rules.js';
export { START };
const strip = (s) => String(s).replace(/[+#!?]+$/g, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O').replace(/=?([QRBN])$/i, (m, p) => '=' + p.toUpperCase());
const uciOf = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');
/** the legal move a SAN ('Nf3', 'exd5', 'O-O', 'e8=Q+') or coordinate ('e2e4', 'e7e8q') names in a position, or null. Pure. */
export function findMove(pos, text) {
  const t = String(text || '').trim(); if (!t) return null; const ms = legalMoves(pos);
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(t)) { const u = t.toLowerCase(); return ms.find((m) => uciOf(m) === u) || (u.length === 4 ? ms.find((m) => uciOf(m) === u + 'q') : null) || null; }
  const want = strip(t), exact = ms.find((m) => strip(moveLabel(pos, m)) === want); if (exact) return exact;
  // a SAN written with more (or less) than it needs, 'Ngf3' or 'Rd1' where two rooks reach d1: the piece, the square and any hint must point at one move
  const sm = want.match(/^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=([QRBN]))?$/); if (!sm) return null;
  const hits = ms.filter((m) => (sm[1] || 'P') === m.piece.toUpperCase() && sqName(m.to) === sm[4] && (!sm[2] || sqName(m.from)[0] === sm[2]) && (!sm[3] || sqName(m.from)[1] === sm[3]) && (m.promo ? m.promo.toUpperCase() === (sm[5] || 'Q') : !sm[5]));
  return hits.length === 1 ? hits[0] : null;
}
/** a game from a start position (START by default). */
export function newGame(fen = START) { const p = fromFEN(fen); return { start: toFEN(p), moves: [], pos: [p] }; }
/** the game with one more move (SAN or coordinates), or null when it is not legal there. Mutates and returns g. */
export function push(g, text) {
  const p = g.pos[g.pos.length - 1]; if (/mate$|^stalemate$/.test(status(p))) return null;
  const m = typeof text === 'object' && text ? legalMoves(p).find((x) => x.from === text.from && x.to === text.to && (x.promo || null) === (text.promo || null)) : findMove(p, text);
  if (!m) return null; const san = moveLabel(p, m), n = apply(p, m); n.last = m;
  g.moves.push({ uci: uciOf(m), san, from: m.from, to: m.to }); g.pos.push(n); return g;
}
export const positionAt = (g, ply = g.moves.length) => g.pos[Math.max(0, Math.min(ply, g.moves.length))];
/** the game cut back to `ply` moves (a takeback). Mutates and returns g. */
export function cut(g, ply) { g.moves.length = Math.max(0, ply); g.pos.length = g.moves.length + 1; return g; }
export const sanList = (g) => g.moves.map((m) => m.san);
const firstMove = (g) => { const p = g.pos[0]; return { n: p.full, black: p.turn === 'b' }; };
/** the moves numbered as a person writes them: "1. e4 e5 2. Nf3". Pure. */
export function movetext(g) {
  const { n, black } = firstMove(g), out = []; let num = n;
  g.moves.forEach((m, i) => { const isBlack = (i + (black ? 1 : 0)) % 2 === 1; if (!isBlack) out.push(num + '. ' + m.san); else { out.push((i === 0 ? num + '... ' : '') + m.san); num++; } });
  return out.join(' ');
}
/** the result of the position the game stands at: '1-0', '0-1', '1/2-1/2' or '*'. Pure. */
export function resultOf(g) { const p = positionAt(g), st = status(p); if (st === 'checkmate') return p.turn === 'w' ? '0-1' : '1-0'; if (/^draw|stalemate/.test(st)) return '1/2-1/2'; return '*'; }
const RESULT_WORDS = { checkmate: 'Checkmate', stalemate: 'Stalemate: a draw', 'draw-50': 'Draw by the fifty-move rule', 'draw-material': 'Draw: neither side can mate', 'draw-repetition': 'Draw by threefold repetition' };
/** the game's state in words for the status line, or '' while it goes on quietly. Pure. */
export function stateWords(g) { const p = positionAt(g), st = status(p); if (st === 'checkmate') return 'Checkmate. ' + (p.turn === 'w' ? 'Black' : 'White') + ' wins.'; if (st === 'check') return 'Check.'; return RESULT_WORDS[st] ? RESULT_WORDS[st] + '.' : ''; }
/** the game as PGN, with the Seven Tag Roster and the start position when it is not the usual one. Pure. */
export function toPGN(g, headers = {}) {
  const h = { Event: 'Casual game', Site: 'https://a-to-mind.com/chess/', Date: '????.??.??', Round: '-', White: 'White', Black: 'Black', Result: resultOf(g), ...headers };
  if (g.start !== START) { h.SetUp = '1'; h.FEN = g.start; }
  const head = Object.entries(h).map(([k, v]) => '[' + k + ' "' + String(v).replace(/["\\]/g, '') + '"]').join('\n');
  const body = (movetext(g) + ' ' + h.Result).trim(), lines = []; let line = '';
  for (const w of body.split(' ')) { if ((line + ' ' + w).trim().length > 79) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  if (line) lines.push(line);
  return head + '\n\n' + lines.join('\n') + '\n';
}
/** a game from PGN text (or a bare move list): { game, headers, error } with error '' when every move was read. Comments, NAGs and side lines are dropped. Pure. */
export function fromPGN(text) {
  const t = String(text || ''), headers = {};
  for (const m of t.matchAll(/^\s*\[(\w+)\s+"([^"]*)"\s*\]\s*$/gm)) headers[m[1]] = m[2];
  let body = t.replace(/^\s*\[[^\]]*\]\s*$/gm, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  let prev; do { prev = body; body = body.replace(/\([^()]*\)/g, ' '); } while (body !== prev);
  body = body.replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ');
  if (headers.FEN && checkFEN(fullFEN(headers.FEN))) return { game: newGame(), headers, error: 'The FEN in the headers is not a position: ' + checkFEN(fullFEN(headers.FEN)) };
  let game; try { game = newGame(headers.FEN ? fullFEN(headers.FEN) : START); } catch (_) { return { game: newGame(), headers, error: 'The FEN in the headers is not a position.' }; }
  for (const tok of body.split(/\s+/).filter(Boolean)) { if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue; if (!push(game, tok)) return { game, headers, error: 'Move ' + (game.moves.length + 1) + ' (' + tok + ') is not legal there; the game is read up to it.' }; }
  return { game, headers, error: '' };
}
/** '' when a FEN is a position the page can play from, else the reason in words. Pure. */
export function checkFEN(fen) {
  const parts = String(fen || '').trim().split(/\s+/);
  if (parts.length < 2) return 'A FEN needs at least the pieces and whose move it is.';
  const rows = parts[0].split('/'); if (rows.length !== 8) return 'A FEN has 8 rows separated by /.';
  for (const r of rows) { let n = 0; for (const c of r) { if (/[1-8]/.test(c)) n += +c; else if (/[pnbrqkPNBRQK]/.test(c)) n++; else return 'Unknown piece letter "' + c + '".'; } if (n !== 8) return 'Each row must fill 8 squares.'; }
  if (!/^[wb]$/.test(parts[1])) return 'The side to move is w or b.';
  const count = (ch) => (parts[0].match(new RegExp(ch, 'g')) || []).length;
  if (count('K') !== 1 || count('k') !== 1) return 'Each side needs exactly one king.';
  if (/[pP]/.test(rows[0] + rows[7])) return 'No pawn can stand on the first or last row.';
  let p; try { p = fromFEN(parts.length >= 4 ? fen : parts[0] + ' ' + parts[1] + ' - - 0 1'); } catch (_) { return 'That is not a position.'; }
  if (inCheck(p, p.turn === 'w' ? 'b' : 'w')) return 'The side not to move is in check: that cannot happen.';
  return '';
}
/** a FEN with the counters filled in when they were left out. Pure. */
export const fullFEN = (fen) => { const p = String(fen).trim().split(/\s+/); return [p[0], p[1] || 'w', p[2] || '-', p[3] || '-', p[4] || '0', p[5] || '1'].join(' '); };
/** the query string that carries a game: its moves in coordinates (m=e2e4.e7e5), the start when it is not the usual one, and the extra settings. Pure. */
export function linkOf(g, extra = {}) {
  const q = new URLSearchParams(); if (g.start !== START) q.set('fen', g.start); if (g.moves.length) q.set('m', g.moves.map((m) => m.uci).join('.'));
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString(); return s ? '?' + s : '';
}
/** the game a link carries ({ game, error }): ?fen= and ?m= (or ?pgn=, a whole PGN). Pure. */
export function gameFromLink(search) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  if (q.get('pgn')) return fromPGN(q.get('pgn'));
  const fen = q.get('fen') ? fullFEN(q.get('fen').replace(/_/g, ' ')) : START, why = q.get('fen') ? checkFEN(fen) : '';
  if (why) return { game: newGame(), error: why };
  const game = newGame(fen);
  for (const u of (q.get('m') || '').split(/[.\s,]+/).filter(Boolean)) if (!push(game, u)) return { game, error: 'The link\'s move ' + u + ' is not legal there; the game is read up to it.' };
  return { game, error: '' };
}
/** a Lichess analysis link for a position (lichess.org/analysis/standard/<FEN>): Verse can send a position there, never a person's account. Pure. */
export const lichessAnalysis = (fen) => 'https://lichess.org/analysis/standard/' + String(fen).trim().replace(/ /g, '_');
// ---- the clock: each side's time left, the side running, the increment added after a move; the time is passed in, never read here ----
export function makeClock(ms, inc = 0) { return { left: { w: ms, b: ms }, inc, running: null, since: 0, flag: null }; }
export const clockLeft = (c, side, now) => Math.max(0, c.left[side] - (c.running === side ? now - c.since : 0));
/** the side that moved presses its clock: its time is charged, the increment added, the other side's clock starts. Mutates c. */
export function pressClock(c, side, now) {
  if (c.flag) return c;
  if (c.running === side) { c.left[side] = clockLeft(c, side, now); if (c.left[side] <= 0) { c.flag = side; c.running = null; return c; } c.left[side] += c.inc; }
  c.running = side === 'w' ? 'b' : 'w'; c.since = now; return c;
}
export function stopClock(c, now) { if (c.running) { c.left[c.running] = clockLeft(c, c.running, now); c.running = null; } return c; }
/** whether a side's time has run out (and marks it). Mutates c. */
export function flagged(c, now) { if (c.flag) return c.flag; if (c.running && clockLeft(c, c.running, now) <= 0) { c.left[c.running] = 0; c.flag = c.running; c.running = null; } return c.flag; }
export const clockText = (ms) => { const s = Math.ceil(ms / 1000); if (ms < 10000) return (Math.max(0, ms) / 1000).toFixed(1); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
export const TIME_CONTROLS = Object.freeze([['none', 0, 0, 'No clock'], ['1+0', 60, 0, 'Bullet 1+0'], ['3+2', 180, 2, 'Blitz 3+2'], ['5+0', 300, 0, 'Blitz 5+0'], ['10+0', 600, 0, 'Rapid 10+0'], ['15+10', 900, 10, 'Rapid 15+10'], ['30+0', 1800, 0, 'Classical 30+0']]);
/** a rating after one game (Elo with factor k): score 1 a win, 0.5 a draw, 0 a loss. Pure. */
export const eloAfter = (r, opp, score, k = 32) => Math.round(r + k * (score - 1 / (1 + 10 ** ((opp - r) / 400))));
/** a puzzle's answer checked: whether a move played is right ({ ok, done, reply }) given the solution line (coordinates, the player's moves first). A
 *  different move that mates at once is right too. Pure. */
export function checkPuzzleMove(pos, line, step, moveUci) {
  const want = line[step]; if (!want) return { ok: false, done: true };
  let ok = moveUci === want;
  if (!ok) { const m = legalMoves(pos).find((x) => uciOf(x) === moveUci); if (m && status(apply(pos, m)) === 'checkmate') ok = true; }
  if (ok && status(apply(pos, legalMoves(pos).find((x) => uciOf(x) === moveUci))) === 'checkmate') return { ok: true, done: true, reply: null };
  return { ok, done: ok && step + 2 >= line.length, reply: ok ? line[step + 1] || null : null };
}
