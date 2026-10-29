// lib/chess-replay.js + skills/chess-rules.js moveVerdict + lib/match-history.js line: the match replay (asked by Verse, 2026-10-18:
// "a 'match-replay' button on the chess history table that lets the user step through the moves with engine annotations")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/skills/chess-rules.js';
import { positions, replayHtml } from '../void-live-deploy/lib/chess-replay.js';
import { parseGame, historyHtml, summary } from '../void-live-deploy/lib/match-history.js';

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FOOL = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

test('the engine reads each move: a quiet opening move is fine, letting mate in one is a blunder, the mate is a mate', () => {
  const verdicts = []; let s = R.create();
  for (const m of FOOL) { verdicts.push(R.moveVerdict(s, m)); s = R.play(s, m); }
  assert.equal(verdicts[2].label, 'g4'); assert.equal(verdicts[2].verdict, 'blunder'); assert.equal(verdicts[2].allowsMate, true);
  assert.equal(verdicts[2].loss, 0, 'a mate is said as one, never as a thousand pawns');
  assert.equal(verdicts[3].label, 'Qh4#'); assert.equal(verdicts[3].verdict, 'mate');
  let t = R.create(); const opening = [];
  for (const m of ['e2e4', 'e7e5', 'g1f3', 'b8c6']) { opening.push(R.moveVerdict(t, m).verdict); t = R.play(t, m); }
  assert.ok(opening.every((v) => v === 'best' || v === 'good'), 'sound opening moves: ' + opening.join(','));
  // hanging the queen for nothing
  let h = R.create(); for (const m of ['e2e4', 'e7e5', 'g1f3']) h = R.play(h, m);
  const hang = R.moveVerdict(h, 'd8h4'); assert.equal(hang.verdict, 'blunder'); assert.ok(hang.loss > 500 && hang.best);
});

test('the replay rebuilds every position, stops at a move the rules refuse, and draws the board with the last move lit', () => {
  const pos = positions(R, FOOL);
  assert.equal(pos.length, 5); assert.equal(R.status(pos[4]), 'checkmate');
  assert.equal(positions(R, ['e2e4', 'e2e4', 'd7d5']).length, 2, 'an illegal move ends the line there');
  const start = replayHtml(esc, R, { line: FOOL, pos, i: 0, verdict: null });
  assert.equal((start.match(/class="cr-sq/g) || []).length, 64); assert.ok(!/cr-sq[^"]*lit/.test(start));
  assert.match(start, /0 \/ 4/); assert.match(start, /data-step="prev"[^>]*disabled/);
  const end = replayHtml(esc, R, { line: FOOL, pos, i: 4, verdict: R.moveVerdict(pos[3], FOOL[3]) });
  assert.match(end, /2… Qh4# · checkmate/); assert.equal((end.match(/cr-sq[^"]*lit/g) || []).length, 2); assert.match(end, /data-step="next"[^>]*disabled/);
  const g4 = replayHtml(esc, R, { line: FOOL, pos, i: 3, verdict: R.moveVerdict(pos[2], FOOL[2]) });
  assert.match(g4, /2\. g4 · blunder: it lets the other side mate at once/); assert.ok(!/pawns better/.test(g4));
});

test('the history keeps a chess game\'s line (and only a clean one) and offers Replay on it', () => {
  const g = parseGame({ at: '2026-10-18T09:30:00Z', game: 'chess', result: 'loss', moves: 2, minutes: 1, line: FOOL });
  assert.deepEqual(g.line, FOOL);
  assert.equal(parseGame({ at: '2026-10-18T09:30:00Z', game: 'chess', result: 'loss', line: ['e2e4', '<img src=x onerror=1>'] }).line, undefined);
  assert.equal(parseGame({ at: '2026-10-18T09:30:00Z', game: 'checkers', result: 'win', line: FOOL }).line, undefined, 'only chess keeps a line');
  const old = parseGame({ at: '2026-10-17T10:00:00Z', game: 'chess', result: 'win', moves: 30, minutes: 6 });
  const html = historyHtml(esc, summary([old, g], { game: 'chess' }), [old, g]);
  assert.equal((html.match(/class="mh-replay"/g) || []).length, 1, 'Replay only where the moves were kept');
  assert.match(html, /data-at="2026-10-18T09:30:00.000Z"/);
});
