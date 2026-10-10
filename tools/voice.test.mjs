import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { VOICE_SYSTEM, parseVoice, currentAsks, questionFor, knowsFacts, voiceFacts } from '../void-live-deploy/lib/voice.js';
import { isSelfAsk, selfFacts } from '../void-live-deploy/lib/self-context.js';
import * as reflect from '../void-live-deploy/functions/api/reflect.js';
import { writeLog, entryBlock, openAsks, asksInLog } from './reflect.mjs';
import { readFileSync } from 'node:fs';

const OWNER = 'owner-test-key-123456';
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT)');
  db.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const st = (sql, a = []) => ({ bind: (...b) => st(sql, b), first: async (c) => { const r = db.prepare(sql).get(...a) ?? null; return c ? (r ? r[c] : null) : r; }, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a) });
  return { db, prepare: (sql) => st(sql) };
}
const SAID = { thoughts: 'The incident brief is useful, but it forgets the brief the moment you close it.', better: 'Keep the last brief so "same again" brings it back.', asks: [{ ask: 'Make "same again" reopen the last incident brief', small: true }, { ask: 'Learn backgammon', small: false }], striking: true };
const ai = (reply, calls = []) => ({ run: async (m, o) => { calls.push(o); if (reply instanceof Error) throw reply; return { response: typeof reply === 'string' ? reply : JSON.stringify(reply) }; } });
const post = (env, body, key = OWNER) => reflect.onRequestPost({ request: new Request('https://a-to-mind.com/api/reflect', { method: 'POST', headers: key ? { authorization: 'Bearer ' + key } : {}, body: JSON.stringify(body) }), env });
const AGO = (d) => new Date(Date.now() - d * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
const LEDGER = [{ at: AGO(30), by: 'claude', kind: 'grow', what: 'Chess, a month ago' }, { at: AGO(2), by: 'claude', kind: 'grow', what: 'Backgammon, the board game: you can play it now' }, { at: AGO(1), by: 'claude', kind: 'fix', what: 'the timer no longer stops at 59 s' }];
const ASSETS = { fetch: async (rq) => { const p = new URL(rq.url).pathname; return p === '/self.json' ? Response.json({ about: 'A blank stage.', shipped: [], open: [], games: ['chess', 'mancala'], minis: ['clock'] }) : p === '/void.growth.json' ? Response.json(LEDGER) : Response.json(['tip', 'chess']); } };

test('Void\'s reply is kept word for word; only secrets are redacted; nothing said = nothing kept', () => {
  const v = parseVoice('Sure! ' + JSON.stringify({ ...SAID, thoughts: SAID.thoughts + ' key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789' }));
  assert.ok(v.thoughts.startsWith(SAID.thoughts));
  assert.ok(!/sk-ant-api03-abcdef/.test(v.thoughts), v.thoughts);
  assert.equal(v.better, SAID.better);
  assert.deepEqual(v.asks, SAID.asks);
  assert.equal(v.striking, true);
  assert.equal(parseVoice(''), null);
  assert.equal(parseVoice('{"thoughts":""}'), null);
  assert.equal(parseVoice('I think I am too quiet about what I can do, people never find the games.').thoughts.slice(0, 13), 'I think I am ');
  assert.equal(parseVoice(JSON.stringify({ thoughts: 'ok then', asks: 'not a list', striking: 'yes' })).striking, false);
});

test('the questions Void is asked; Void describes itself only from its canon and code', () => {
  assert.match(VOICE_SYSTEM, /never make up a motto, quest or identity/);
  assert.match(questionFor('daily'), /go next.*weakest.*game/);
  assert.equal(questionFor('build', 'incident brief'), 'This just shipped: "incident brief". What do you think of it, and how would you make it better?');
});

test('current asks: newest first, one of each, with where they came from', () => {
  const es = [{ at: '2026-10-09', kind: 'build', asks: [{ ask: 'Learn backgammon', small: false }] }, { at: '2026-10-08', kind: 'daily', asks: [{ ask: 'learn  backgammon!', small: false }, { ask: 'Show the games in the menu', small: true }] }];
  assert.deepEqual(currentAsks(es).map((a) => [a.ask, a.kind]), [['Learn backgammon', 'build'], ['Show the games in the menu', 'daily']]);
});

test('the answer engine knows Void\'s games, miniatures and what it last said about itself', () => {
  for (const a of ['what do you think of yourself?', "what's the weakest part about you", 'how would you improve yourself']) assert.ok(isSelfAsk(a), a);
  for (const a of ['what do you think of the weather', 'what is the weakest muscle in the body']) assert.ok(!isSelfAsk(a), a);
  assert.match(knowsFacts({ games: ['tictactoe', 'chess'], minis: ['clock'] }), /Games I can play: tic-tac-toe, chess\nCards with a live 3D miniature of themselves: clock/);
  const f = selfFacts({ self: { about: 'x', games: ['mancala'] }, voice: [{ at: '2026-10-08T18:09:00Z', kind: 'daily', thoughts: 'I am thin on places.', weakest: 'Maps.', asks: [{ ask: 'Better maps' }] }] });
  assert.match(f, /Games I can play: mancala/);
  assert.match(f, /What I said about myself most recently \(2026-10-08, daily\): I am thin on places\. Maps\. My current asks: Better maps/);
  assert.equal(voiceFacts([]), '');
});

test('POST is owner-only, saves Void\'s words, queues one small ask credited to Void; GET is public', async () => {
  const DB = d1(), calls = [];
  const env = { DB, AI: ai(SAID, calls), READ_TOKEN: OWNER, ASSETS };
  assert.equal((await post(env, { kind: 'daily' }, 'wrong')).status, 401);
  assert.equal((await post(env, { kind: 'whatever' })).status, 400);
  assert.equal((await post(env, { kind: 'build' })).status, 400);
  const r = await post(env, { kind: 'build', shipped: 'incident brief' });
  assert.equal(r.status, 200);
  const e = await r.json();
  assert.equal(e.thoughts, SAID.thoughts); assert.equal(e.shipped, 'incident brief'); assert.ok(e.queued);
  assert.match(calls[0].messages[1].content, /Games I can play: chess, mancala/);
  assert.match(calls[0].messages[1].content, /This just shipped: "incident brief"/);
  assert.doesNotMatch(calls[0].messages[1].content, /last 7 days/, 'a build reflection is about what shipped, not the week');
  const q = DB.db.prepare('SELECT * FROM void_queue').all();
  assert.equal(q.length, 1); assert.equal(q[0].ask, SAID.asks[0].ask); assert.match(q[0].target, /^voice:/); assert.match(q[0].note, /Credit Void/);
  // the job has its execution record (lib/actions.js): Void queued it for itself, done, naming the job
  const acts = DB.db.prepare('SELECT owner, kind, ref, state, result FROM void_actions').all();
  assert.equal(acts.length, 1); assert.equal(acts[0].owner, 'void'); assert.equal(acts[0].kind, 'queue.add'); assert.equal(acts[0].ref, q[0].target); assert.equal(acts[0].state, 'done'); assert.match(acts[0].result, new RegExp('^queued ' + q[0].id));
  // a second reflection while Void's ask is still open queues nothing more
  const e2 = await (await post(env, { kind: 'daily' })).json();
  // the daily reflection reads its own last week from the growth ledger, in the growth card's words
  const daily = calls[calls.length - 1].messages[1].content;
  assert.match(daily, /What changed in me in the last 7 days \(my growth ledger\): Since \d{4}-\d\d-\d\d \(the last 7 days\) I changed 2 things: 1 new thing I can do, 1 thing I fixed\. New thing I can do: Backgammon, the board game\. Thing I fixed: the timer no longer stops at 59 s\./);
  assert.doesNotMatch(daily, /Chess, a month ago/);
  assert.equal(e2.queued, null); assert.equal(DB.db.prepare('SELECT COUNT(*) n FROM void_queue').get().n, 1);
  assert.match(calls[1].messages[1].content, /What I said about myself most recently/);
  const g = await (await reflect.onRequestGet({ env: { DB } })).json();
  assert.equal(g.entries.length, 2); assert.equal(g.entries[0].kind, 'daily'); assert.equal(g.asks[0].ask, SAID.asks[0].ask);
});

test('when the model is busy nothing is saved: Void\'s words are never made up for it', async () => {
  const DB = d1();
  const r = await post({ DB, AI: ai(new Error('429 busy')), READ_TOKEN: OWNER, ASSETS }, { kind: 'daily' });
  assert.equal(r.status, 503);
  assert.equal(DB.db.prepare('SELECT COUNT(*) n FROM void_kv WHERE k = ?').get('voice').n, 0);
  const g = await (await reflect.onRequestGet({ env: { DB } })).json();
  assert.deepEqual(g, { entries: [], asks: [] });
});

test('the log keeps every block as written, adds new ones oldest first, and the asks on top', () => {
  const a = { at: '2026-10-08T18:09:00.000Z', kind: 'daily', question: questionFor('daily'), ...SAID, weakest: 'Maps.', next_game: 'Backgammon.' };
  const b = { at: '2026-10-08T20:00:00.000Z', kind: 'build', shipped: 'x', question: questionFor('build', 'x'), thoughts: 'Fine.', asks: [] };
  const one = writeLog('', [a], currentAsks([a]));
  assert.match(one, /## Void's current asks\n\n- Make "same again" reopen the last incident brief \*\(small\)\* \(daily, 2026-10-08\)/);
  assert.ok(one.includes('> ' + SAID.thoughts)); assert.match(one, /\*\*Next game:\*\* Backgammon\./);
  const edited = one.replace('> ' + SAID.thoughts, '> ' + SAID.thoughts + ' (kept)');
  const two = writeLog(edited, [b, a], currentAsks([b, a]));
  assert.ok(two.includes(SAID.thoughts + ' (kept)'), 'an existing block is never rewritten');
  assert.ok(two.indexOf('voice:' + a.at) < two.indexOf('voice:' + b.at));
  assert.equal(writeLog(two, [b, a], currentAsks([b, a])), two);
  assert.match(entryBlock(b), /after a build/);
});

test('the canon: Adam\'s motto and VoidQuest are read with their version; "(not written yet)" stays unknown', async () => {
  const { readCanon } = await import('./self-context.mjs');
  assert.deepEqual(readCanon('version: 3\n\n## Motto\nOne win at a time.\n\n## VoidQuest\nLearn every game, one at a time.\n'), { version: 3, motto: 'One win at a time.', voidquest: 'Learn every game, one at a time.' });
  assert.deepEqual(readCanon('version: 1\n\n## Motto\n(not written yet)\n\n## VoidQuest\n(not written yet)\n'), { version: 1, motto: null, voidquest: null });
  assert.match(knowsFacts({ canon: { version: 1, motto: null, voidquest: 'Learn games.' } }), /My canon \(v1\): motto: not written yet, so I do not know it; VoidQuest: Learn games\./);
});

test('weekFacts: the week in the growth card\'s words, nothing for a ledger that cannot be read', async () => {
  const { weekFacts } = await import('../void-live-deploy/lib/voice.js');
  assert.equal(weekFacts(null), ''); assert.equal(weekFacts([]), ''); assert.equal(weekFacts({}), '');
  assert.match(weekFacts(LEDGER), /^What changed in me in the last 7 days \(my growth ledger\): Since .* I changed 2 things/);
});

test('the current asks leave out every ask a growth-ledger entry answers (its asked field), word for word', () => {
  const asks = [{ ask: 'Build a Learning Queue.', small: true, kind: 'daily', at: '2026-10-09' }, { ask: 'Learn backgammon.', small: false, kind: 'daily', at: '2026-10-09' }];
  const ledger = [{ kind: 'grow', what: 'x', asked: 'build a learning queue' }, { kind: 'grow', what: 'unrelated, no asked field' }];
  assert.deepEqual(openAsks(asks, ledger).map((a) => a.ask), ['Learn backgammon.']);
  assert.deepEqual(openAsks(asks, []).length, 2);
  // the real ledger answers both asks of 2026-10-09 (lib/learn.js and skills/live.js)
  const real = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  const oct9 = [{ ask: "Build a mechanism that parses unanswered user questions into a structured 'Learning Queue' to automate skill acquisition." }, { ask: 'Develop a background task runner that allows my existing skills (like news, weather, or worldtime) to update autonomously.' }];
  assert.equal(openAsks(oct9, real).length, 0);
});

test('the asks are stamped with the day they were read; an unreachable site keeps the old stamp and says so', () => {
  const asks = [{ ask: 'Learn backgammon.', small: true, kind: 'daily', at: '2026-10-09T10:00:00Z' }];
  const fresh = writeLog('', [], asks, { read: '2026-10-10' });
  assert.match(fresh, /_Read from \/api\/reflect on 2026-10-10\. Asks a growth-ledger entry answers/);
  assert.deepEqual(asksInLog(fresh), [{ ask: 'Learn backgammon.', small: true, kind: 'daily', at: '2026-10-09' }], 'the list can be read back from the file');
  const stale = writeLog(fresh, [], asksInLog(fresh), { failed: '2026-10-12' });
  assert.match(stale, /_Read from \/api\/reflect on 2026-10-10; the site could not be reached on 2026-10-12, so this may be out of date\./);
  assert.match(writeLog('', [], [], {}), /## Void's current asks\n\n- \(none open\)/);
});
