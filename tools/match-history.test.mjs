// node --test tools/match-history.test.mjs: the match history on a game's about card (asked by Void: "Expand the chess skill page to
// include a 'Match History' table that pulls from my recent game logs", and an Elo or win rate against the owner so the Games family
// feels competitive and real). lib/match-history.js: the log caps at 100, the summary and the estimated Elo on a known sequence,
// an empty log, the asks that open it, the block's markup, and the storage helpers over a stand-in storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { record, summary, summaryLine, elo, historyAsk, historyHtml, whenLabel, load, save, finish, minutesSince, parseGame, MAX, START, K } from '../void-live-deploy/lib/match-history.js';
import { STORES } from '../void-live-deploy/lib/state.js';
import chess from '../void-live-deploy/skills/chess.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()] }; };
const g = (result, i = 0, extra = {}) => ({ at: new Date(Date.UTC(2026, 9, 18, 12, i)).toISOString(), game: 'chess', vs: 'v01d', result, moves: 30 + i, minutes: 5, ...extra });

test('the store is named once in lib/state.js and is not a secret', () => { assert.equal(STORES.games.key, 'a2m.void.games.v1'); assert.ok(!STORES.games.secret); });

test('record: appends newest last, takes only well-formed games, and keeps the last 100', () => {
  const one = record([], g('win'));
  assert.equal(one.length, 1); assert.equal(one[0].result, 'win'); assert.equal(one[0].game, 'chess'); assert.equal(one[0].vs, 'v01d'); assert.equal(one[0].moves, 30);
  assert.deepEqual(record(one, { game: 'poker', result: 'win' }), one, 'a game the log does not keep');
  assert.deepEqual(record(one, { game: 'chess', result: 'forfeit' }), one, 'a result that is not win, loss or draw');
  assert.deepEqual(record(one, null), one);
  assert.equal(record('nonsense', g('draw')).length, 1, 'a log that is not a list starts over');
  const bad = record([{ game: 'chess', result: 'win', moves: -4, minutes: 'x', vs: 'martians', at: 'never' }], null)[0];
  assert.equal(bad.moves, 0); assert.equal(bad.minutes, 0); assert.equal(bad.vs, 'v01d'); assert.ok(!isNaN(new Date(bad.at).getTime()), 'a bad time becomes now');
  let log = [];
  for (let i = 0; i < MAX + 7; i++) log = record(log, g(i % 2 ? 'win' : 'loss', i));
  assert.equal(log.length, MAX); assert.equal(log[0].moves, 30 + 7, 'the oldest seven went'); assert.equal(log[MAX - 1].moves, 30 + MAX + 6);
  const before = log.slice(); record(log, g('win')); assert.deepEqual(log, before, 'never mutates');
});

test('summary and Elo on a known sequence: win, win, loss from 1200 each at K = 32', () => {
  const log = [g('win', 0), g('win', 1), g('loss', 2)];
  const s = summary(log, { game: 'chess' });
  assert.equal(s.played, 3); assert.equal(s.wins, 2); assert.equal(s.losses, 1); assert.equal(s.draws, 0); assert.equal(s.winRate, 67);
  assert.equal(s.streak, -1, 'one loss in a row');
  // by hand: 1216/1184 after the first win, 1230.5/1169.5 after the second, 1211.8/1188.2 after the loss
  assert.deepEqual(s.elo, { you: 1212, void: 1188 });
  assert.deepEqual(elo([g('win')]), { you: START + K / 2, void: START - K / 2 });
  assert.deepEqual(elo([g('draw')]), { you: START, void: START }, 'a draw between equals moves nothing');
  assert.deepEqual(elo([g('win', 0, { vs: 'self' })]), { you: START, void: START }, 'a game against yourself rates nobody');
  assert.equal(summaryLine(s), '3 played · 2–1–0 · 67% · you ~1212, V01D ~1188 (estimated)');
  assert.equal(summary([g('win'), g('win'), g('win')]).streak, 3);
  assert.equal(summary([g('loss'), g('draw')]).streak, 0, 'a draw ends the streak');
  // the summary of one game leaves the others out; no game named counts them all
  const mixed = [g('win'), g('loss', 1, { game: 'othello' }), g('draw', 2, { game: 'checkers' })];
  assert.equal(summary(mixed, { game: 'chess' }).played, 1); assert.equal(summary(mixed, { game: 'othello' }).losses, 1); assert.equal(summary(mixed).played, 3);
});

test('an empty log: nothing played, Elo at the start, the line says so, the block says so', () => {
  const s = summary([], { game: 'chess' });
  assert.deepEqual(s, { game: 'chess', played: 0, wins: 0, losses: 0, draws: 0, winRate: 0, streak: 0, elo: { you: START, void: START } });
  assert.equal(summaryLine(s), 'no games on this device yet');
  assert.equal(summaryLine(null), 'no games on this device yet');
  const html = historyHtml(esc, s, []);
  assert.match(html, /class="match-history" data-game="chess" data-played="0"/); assert.match(html, /no games on this device yet · finish a game of Chess/); assert.ok(!/<table/.test(html));
});

test('the block: the summary line, the last ten newest first with when, vs, result, moves and minutes, every value escaped', () => {
  let log = [];
  for (let i = 0; i < 14; i++) log = record(log, g(i % 3 === 0 ? 'draw' : i % 2 ? 'win' : 'loss', i));
  const s = summary(log, { game: 'chess' }), html = historyHtml(esc, s, log);
  assert.match(html, /data-played="14"/);
  assert.equal((html.match(/<tr><td>/g) || []).length, 10, 'ten rows');
  assert.ok(html.indexOf('<td>' + (30 + 13) + '</td>') < html.indexOf('<td>' + (30 + 4) + '</td>'), 'newest first');
  assert.match(html, /<th>when<\/th><th>vs<\/th><th>result<\/th><th>moves<\/th><th>minutes<\/th>/);
  assert.match(html, /<td data-result="win">you won<\/td>/); assert.match(html, /<td data-result="loss">V01D won<\/td>/); assert.match(html, /<td data-result="draw">a draw<\/td>/);
  assert.match(html, /a2m\.void\.games\.v1/); assert.match(html, /Elo estimated: both start at 1200, K = 32/);
  const sneaky = historyHtml(esc, summary([{ ...g('win'), game: 'chess' }]), [{ ...g('win'), moves: '<img src=x onerror=1>' }]);
  assert.ok(!/<img/.test(sneaky), 'a bad number is 0, never markup');
  assert.equal(whenLabel('nope'), ''); assert.match(whenLabel(new Date(2026, 9, 18, 14, 5).toISOString()), /^Oct 18, 14:05$/);
});

test('historyAsk: the asks that open a game\'s record, and the ones that do not', () => {
  for (const [ask, game] of [['chess match history', 'chess'], ['my chess record', 'chess'], ['my record against void', 'chess'], ['My record against V01D?', 'chess'], ['my match history', 'chess'],
    ['show me my chess record', 'chess'], ["what's my chess record", 'chess'], ['my checkers record', 'checkers'], ['my draughts record', 'checkers'], ['othello match history', 'othello'], ['reversi match history', 'othello'],
    ['my record at othello', 'othello'], ['my chess results against you', 'chess'], ['my chess history', 'chess']]) assert.deepEqual(historyAsk(ask), { game }, ask);
  for (const ask of ['match history', 'my record', 'chess record', 'chess history', 'chess rules', 'how good are you at chess', 'play chess', 'world record', 'record a voice note', 'my results', 'my history', 'tell me about the chess skill', '']) assert.equal(historyAsk(ask), null, ask);
});

test('finish keeps one game on the device through lib/state.js; load reads it back; a broken store is an empty log', () => {
  const s = mem();
  assert.deepEqual(load(s), []);
  const log = finish('chess', 'win', { moves: 41, minutes: 12.34, at: '2026-10-18T12:00:00.000Z' }, s);
  assert.equal(log.length, 1); assert.equal(log[0].minutes, 12.3); assert.equal(log[0].moves, 41);
  assert.deepEqual(s.keys(), ['a2m.void.games.v1']);
  finish('othello', 'loss', { moves: 30, minutes: 3 }, s);
  assert.equal(load(s).length, 2); assert.equal(load(s)[1].game, 'othello');
  assert.equal(finish('poker', 'win', {}, s).length, 2, 'a game the log does not keep changes nothing');
  s.setItem('a2m.void.games.v1', '{not json'); assert.deepEqual(load(s), []);
  assert.ok(save([g('draw')], s)); assert.equal(load(s).length, 1);
  assert.equal(minutesSince(0), 0); assert.equal(minutesSince(1000, 1000 + 90000), 1.5); assert.equal(minutesSince(5000, 4000), 0);
  assert.equal(parseGame(null), null);
});

test('the chess skill says what it is, and its record on this device when it has one (the about card prefers it)', () => {
  assert.equal(typeof chess.about, 'string');
  assert.match(chess.about, /^A real wooden chess set on the stage, played against V01D/);
  assert.ok(!/record/.test(chess.about), 'no localStorage here: no record line');
});
