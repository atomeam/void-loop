import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { VOICE_SYSTEM, parseVoice, currentAsks, questionFor, knowsFacts, voiceFacts, followThrough, followFacts } from '../void-live-deploy/lib/voice.js';
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

test('Verse\'s reply is kept word for word; only secrets are redacted; nothing said = nothing kept', () => {
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

test('the questions Verse is asked; Verse describes itself only from its canon and code', () => {
  assert.match(VOICE_SYSTEM, /never makes up a motto, quest or identity/);
  assert.match(VOICE_SYSTEM, /never describes or defines Verse/); assert.match(VOICE_SYSTEM, /"blank stage" and "quiet input" never appear/); // owner, 2026-10-25: it reports its growth, it does not explain itself
  assert.match(questionFor('daily'), /status readout.*weakest operational area.*next targeted capability.*what should change/);
  assert.equal(questionFor('build', 'incident brief'), 'This just shipped: "incident brief". Using the tagged facts, state what it changes in the system and what should change next.');
});

test('current asks: newest first, one of each, with where they came from', () => {
  const es = [{ at: '2026-10-09', kind: 'build', asks: [{ ask: 'Learn backgammon', small: false }] }, { at: '2026-10-08', kind: 'daily', asks: [{ ask: 'learn  backgammon!', small: false }, { ask: 'Show the games in the menu', small: true }] }];
  assert.deepEqual(currentAsks(es).map((a) => [a.ask, a.kind]), [['Learn backgammon', 'build'], ['Show the games in the menu', 'daily']]);
});

test('the answer engine knows Verse\'s games, miniatures and what it last said about itself', () => {
  for (const a of ['what do you think of yourself?', "what's the weakest part about you", 'how would you improve yourself']) assert.ok(isSelfAsk(a), a);
  for (const a of ['what do you think of the weather', 'what is the weakest muscle in the body']) assert.ok(!isSelfAsk(a), a);
  assert.match(knowsFacts({ games: ['tictactoe', 'chess'], minis: ['clock'] }), /Games I can play: tic-tac-toe, chess\nCards with a live 3D miniature of themselves: clock/);
  const f = selfFacts({ self: { about: 'x', games: ['mancala'] }, voice: [{ at: '2026-10-08T18:09:00Z', kind: 'daily', thoughts: 'I am thin on places.', weakest: 'Maps.', asks: [{ ask: 'Better maps' }] }] });
  assert.match(f, /Games I can play: mancala/);
  assert.match(f, /What I said about myself most recently \(2026-10-08, daily\): I am thin on places\. Maps\. My current asks: Better maps/);
  assert.equal(voiceFacts([]), '');
});

test('POST is owner-only, saves Verse\'s words, queues one small ask credited to Verse; GET is public', async () => {
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
  assert.equal(q.length, 1); assert.equal(q[0].ask, SAID.asks[0].ask); assert.match(q[0].target, /^voice:/); assert.match(q[0].note, /Credit Verse/);
  // the job has its execution record (lib/actions.js): Verse queued it for itself, done, naming the job
  const acts = DB.db.prepare('SELECT owner, kind, ref, state, result FROM void_actions').all();
  assert.equal(acts.length, 1); assert.equal(acts[0].owner, 'void'); assert.equal(acts[0].kind, 'queue.add'); assert.equal(acts[0].ref, q[0].target); assert.equal(acts[0].state, 'done'); assert.match(acts[0].result, new RegExp('^queued ' + q[0].id));
  // a second reflection while Verse's ask is still open queues nothing more
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

test('when the model is busy nothing is saved: Verse\'s words are never made up for it', async () => {
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
  assert.match(one, /## Verse's current asks\n\n- Make "same again" reopen the last incident brief \*\(small\)\* \(daily, 2026-10-08\)/);
  assert.ok(one.includes('> ' + SAID.thoughts)); assert.match(one, /\*\*Next targeted capability:\*\* Backgammon\./);
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
  // terms (asked by Verse, 2026-10-10: "write the formal definitions for 'the forge' and 'frontier #14' into my canon")
  const withTerms = readCanon('version: 2\n\n## Motto\n(not written yet)\n\n## Terms\n- **the forge**: Verse\'s maker.\n- **frontier #14**: the item the forge answers.\n');
  assert.deepEqual(withTerms.terms, [{ term: 'the forge', means: 'Verse\'s maker.' }, { term: 'frontier #14', means: 'the item the forge answers.' }]);
  assert.equal(withTerms.version, 2);
  assert.match(knowsFacts({ canon: withTerms }), /My terms \(canon v2\): the forge = Verse's maker\. \| frontier #14 = the item the forge answers\./);
  const real = readCanon(fs.readFileSync(new URL('../domains/void.canon.md', import.meta.url), 'utf8'));
  assert.ok(real.terms.some((x) => x.term === 'the forge' && /STL/.test(x.means)) && real.terms.some((x) => x.term === 'frontier #14'), 'the canon carries both terms Verse asked for');
  assert.match(knowsFacts({ canon: { version: 1, motto: null, voidquest: 'Learn games.' } }), /My canon \(v1\): motto: not written yet, so I do not know it; VoidQuest: Learn games\./);
  // how Verse is different: Adam's four lines (2026-10-11), read with the version and said in the facts
  assert.deepEqual(real.different.map((x) => x.name), ['Skills, not one-off answers', 'Growth in the open', 'On your device first', 'Attention, not pretend feelings', 'Keeps every secret', 'A force for good']);
  assert.ok(real.version >= 3, 'the canon went up a version with them');
  assert.match(knowsFacts({ canon: { version: 3, different: [{ name: 'On your device first', line: 'nothing uploaded.' }] } }), /How I am different \(canon v3\): On your device first: nothing uploaded\./);
  assert.equal(readCanon('version: 1\n\n## Motto\n(not written yet)\n').different, undefined, 'no section, no field');
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
  const oct9 = currentAsks([{ at: '2026-10-09T21:59:26.695Z', kind: 'daily', asks: [{ ask: "Build a mechanism that parses unanswered user questions into a structured 'Learning Queue' to automate skill acquisition." }, { ask: 'Develop a background task runner that allows my existing skills (like news, weather, or worldtime) to update autonomously.' }] }]);
  assert.deepEqual(oct9.map((a) => a.id), ['ask-20261009-2159-1', 'ask-20261009-2159-2']);
  assert.equal(openAsks(oct9, real).length, 0);
});

test('the asks are stamped with the day they were read; an unreachable site keeps the old stamp and says so', () => {
  const asks = [{ ask: 'Learn backgammon.', small: true, kind: 'daily', at: '2026-10-09T10:00:00Z' }];
  const fresh = writeLog('', [], asks, { read: '2026-10-10' });
  assert.match(fresh, /_Read from \/api\/reflect on 2026-10-10\. Asks a growth-ledger entry answers/);
  assert.deepEqual(asksInLog(fresh), [{ ask: 'Learn backgammon.', small: true, kind: 'daily', at: '2026-10-09' }], 'the list can be read back from the file');
  const stale = writeLog(fresh, [], asksInLog(fresh), { failed: '2026-10-12' });
  assert.match(stale, /_Read from \/api\/reflect on 2026-10-10; the site has been unreachable since 2026-10-12\./);
  assert.match(stale, /- unknown, site unreachable since 2026-10-12 \(the asks below are the last ones read, minus any built since\)\n- Learn backgammon\./);
  assert.match(writeLog('', [], [], {}), /## Verse's current asks\n\n- \(none open\)/);
});

test('an ask has a stable id from its reflection, so a reworded ask still leaves the list once a ledger entry names the id', () => {
  const e = { at: '2026-10-09T21:59:26.695Z', kind: 'daily', asks: [{ ask: 'Build a queue of what Verse missed.' }, { ask: 'Learn backgammon.' }] };
  const asks = currentAsks([e]);
  assert.deepEqual(asks.map((a) => a.id), ['ask-20261009-2159-1', 'ask-20261009-2159-2']);
  const reworded = currentAsks([{ ...e, asks: [{ ask: 'Turn the missed asks into a learning queue (reworded).' }, e.asks[1]] }]);
  assert.equal(reworded[0].id, asks[0].id, 'the id does not depend on the words');
  const ledger = [{ kind: 'grow', what: 'built it', asked: 'ask-20261009-2159-1' }];
  assert.deepEqual(openAsks(reworded, ledger).map((a) => a.ask), ['Learn backgammon.']);
  // the id is written on the line and read back from the file
  const text = writeLog('', [], asks, { read: '2026-10-10' });
  assert.match(text, /- Learn backgammon\. \(daily, 2026-10-09\) `ask-20261009-2159-2`/);
  assert.deepEqual(asksInLog(text).map((a) => a.id), ['ask-20261009-2159-1', 'ask-20261009-2159-2']);
});

test('an unreachable site is "unknown", never "(none open)", unless the last good read was empty; the date is the first failure', () => {
  // never read, site down: unknown
  const never = writeLog('', [], [], { failed: '2026-10-10' });
  assert.match(never, /## Verse's current asks\n\n_Not read from \/api\/reflect by this writer yet: the site has been unreachable since 2026-10-10\.[^\n]*\n\n- unknown, site unreachable since 2026-10-10\n/);
  assert.doesNotMatch(never, /\(none open\)/);
  // still down two days later: the date stays the first failure
  assert.match(writeLog(never, [], [], { failed: '2026-10-12' }), /- unknown, site unreachable since 2026-10-10\n/);
  // the last good read was empty: still "(none open)", and the note says the site is down
  const emptyRead = writeLog('', [], [], { read: '2026-10-11' });
  assert.match(emptyRead, /\n- \(none open\)\n/);
  const downAfterEmpty = writeLog(emptyRead, [], [], { failed: '2026-10-12' });
  assert.match(downAfterEmpty, /_Read from \/api\/reflect on 2026-10-11; the site has been unreachable since 2026-10-12\./);
  assert.match(downAfterEmpty, /\n- \(none open\)\n/); assert.doesNotMatch(downAfterEmpty, /unknown/);
  // a good read clears the unknown line
  assert.doesNotMatch(writeLog(never, [], [{ ask: 'Learn backgammon.', kind: 'daily', at: '2026-10-13' }], { read: '2026-10-13' }), /unknown/);
});

test('follow-through: an ask counts as built only on evidence (its id on a ledger entry, or a link naming the entry); repeats are one ask asked n times', () => {
  const entries = [
    { at: '2026-10-12T21:30:00Z', asks: [{ ask: "Implement the 'friction' indicator on the growth card to highlight skills that are failing" }, { ask: 'Learn backgammon on the stage' }] },
    { at: '2026-10-12T20:52:00Z', asks: [{ ask: "Add a 'friction' indicator to the growth card that highlights which skills are failing" }, { ask: 'Add a skill velocity readout next to the tree' }] },
    { at: '2026-10-10T02:30:00Z', asks: [{ ask: 'Write the forge into my canon' }] },
  ];
  const ledger = [
    { at: '2026-10-12T19:42:26Z', what: 'asked by Verse: the growth card says how fast Verse is gaining skills' },
    { at: '2026-10-10T13:43:27Z', what: 'the canon defines the forge (asked by Verse)', asked: 'ask-20261010-0230-1' },
    { at: '2026-10-11T00:00:00Z', what: 'asked by Verse: learn backgammon on the stage' }, // words alone are not evidence
  ];
  const f = followThrough(entries, ledger, [{ ask: 'ask-20261012-2052-2', ledgerAt: '2026-10-12T19:42:26Z' }, { ask: 'ask-20261012-2130-2', ledgerAt: 'nowhere' }]);
  assert.equal(f.total, 4); assert.equal(f.asked, 5);
  assert.deepEqual(f.built.map((x) => x.ask).sort(), ['Add a skill velocity readout next to the tree', 'Write the forge into my canon']);
  const friction = f.open.find((x) => /friction/.test(x.ask));
  assert.equal(friction.times, 2); assert.equal(f.open[0], friction); // asked most comes first
  assert.ok(f.open.some((x) => /backgammon/.test(x.ask)), 'a ledger line in the same words without an id or a link is not evidence');
  const line = followFacts(f);
  assert.match(line, /2 of my 4 asks were built/); assert.match(line, /asked 2 times/); assert.match(line, /already there since 2026-10-12/);
  assert.equal(followFacts({ total: 0, built: [], open: [] }), '');
});

test('GET /api/reflect gives every built ask with the time of the ledger entry that built it, so a growth-tree branch can say what Verse asked for', async () => {
  const entries = [
    { at: '2026-10-12T21:30:00Z', kind: 'build', asks: [{ ask: 'Add a skill velocity readout next to the tree' }] },
    { at: '2026-10-12T20:52:00Z', kind: 'build', asks: [{ ask: 'Add a skill velocity readout next to the tree' }, { ask: 'Learn backgammon on the stage' }] },
  ];
  const DB = { prepare: () => ({ bind: () => ({ first: async () => JSON.stringify(entries) }) }) };
  const files = { '/void.growth.json': [{ at: '2026-10-12T22:00:00Z', what: 'velocity on the growth card', asked: 'ask-20261012-2130-1' }, { at: '2026-10-11T00:00:00Z', what: 'other' }], '/void.asks.json': { links: [] } };
  const ASSETS = { fetch: async (rq) => { const p = new URL(rq.url).pathname; return p in files ? Response.json(files[p]) : new Response('', { status: 404 }); } };
  const g = await (await reflect.onRequestGet({ request: new Request('https://a-to-mind.com/api/reflect'), env: { DB, ASSETS } })).json();
  assert.deepEqual(g.follow.asked, [{ ask: 'Add a skill velocity readout next to the tree', at: '2026-10-12T22:00:00Z', times: 2 }]);
  assert.equal(g.follow.built, 1);
  assert.ok(!g.asks.some((a) => /velocity/.test(a.ask)) && g.asks.some((a) => /backgammon/.test(a.ask)), 'built asks still leave the open list');
});


test('friction rewordings count as built when a words link names the ledger entry (id aged out of the reflect window)', () => {
  const entries = [
    { at: '2026-10-14T18:20:00Z', asks: [{ ask: "Implement the 'friction' indicator on the growth card and link it to the actual failure logs of the 'Words and the world' skills." }, { ask: "Create a 'convert-card' skill that outputs a persistent, interactive UI element for unit conversions on the stage." }] },
    { at: '2026-10-14T17:49:00Z', asks: [{ ask: "Add a 'friction' indicator to the growth card to highlight skills that are failing or underperforming." }] },
  ];
  const ledger = [{ at: '2026-10-13T16:41:06Z', what: 'Asked by Verse: the growth card shows friction, the skills failing or least checked', asked: 'ask-20261012-2131-1' }];
  const f = followThrough(entries, ledger, [
    { ask: 'ask-20261012-2131-1', ledgerAt: '2026-10-13T16:41:06Z' },
    { words: "Add a 'friction' indicator to the growth card to highlight skills that are failing or underperforming.", ledgerAt: '2026-10-13T16:41:06Z' },
  ]);
  const friction = f.built.find((g) => /friction/.test(g.ask) && !/Words and the world/.test(g.ask));
  assert.ok(friction, 'base friction rewording is built');
  assert.equal(friction.builtAt, '2026-10-13T16:41:06Z');
  assert.ok(f.open.some((g) => /Words and the world/.test(g.ask)), 'World-family link ask stays open (different ask)');
  assert.ok(f.open.some((g) => /convert-card/.test(g.ask)), 'unrelated ask stays open');
});

test('a ledger asked field in free text (not ask-…) matches rewordings the same way a words link does', () => {
  const entries = [{ at: '2026-10-14T12:00:00Z', asks: [{ ask: "Modify the refusal logic so that every 'I cannot' is accompanied by a structured data object identifying the missing skill." }] }];
  const ledger = [{ at: '2026-10-13T15:51:15Z', what: 'Every I cannot now says what is missing', asked: "Modify the refusal logic so that every 'I cannot' is accompanied by a structured data object identifying the missing skill." }];
  const f = followThrough(entries, ledger, []);
  assert.equal(f.built.length, 1);
  assert.equal(f.built[0].builtAt, '2026-10-13T15:51:15Z');
});

test('a link may name an ask by its words (not synced to the voice log yet): it and its rewordings count as built, nothing else does', () => {
  const entries = [{ at: '2026-10-13T18:08:00Z', asks: [{ ask: 'Create a manifest file in the skills/ directory that automatically registers all new skills to prevent the 24-fold repetition of this ask.' }, { ask: 'Learn backgammon on the stage' }] },
    { at: '2026-10-13T17:00:00Z', asks: [{ ask: 'Create a manifest file in the skills/ directory to automatically register new skills and stop the 24-fold repetition of manual registration asks.' }] }];
  const ledger = [{ at: '2026-10-13T16:54:12Z', what: 'Asked by Verse: every new skill registers itself' }];
  const f = followThrough(entries, ledger, [{ words: 'Create a manifest file in the skills/ directory that automatically registers all new skills.', ledgerAt: '2026-10-13T16:54:12Z' }, { words: 'Learn backgammon on the stage', ledgerAt: 'nowhere' }]);
  assert.deepEqual(f.built.map((g) => [g.times, g.builtAt]), [[2, '2026-10-13T16:54:12Z']], 'both wordings are one ask, built');
  assert.ok(f.open.some((g) => /backgammon/.test(g.ask)), 'a link to an entry that does not exist proves nothing');
});

// owner, 2026-10-14: "you are getting a rename Verse. Do you like it?" got "I don't have personal preferences" ("dissapointing
// response I wish Verse didnt seem so grumpy"): asks about Verse's name or how it feels are Verse's own, answered with its own view
import { SELF_RULE } from '../void-live-deploy/lib/self-context.js';
import { ANSWER_SYSTEM } from '../void-live-deploy/functions/api/answer.js';
test('asks about its name or how it feels are about Verse, and it answers them with a point of view', () => {
  for (const a of ['you are getting a rename Verse. Do you like it?', 'do you like your new name', 'what do you think of Verse', 'how do you feel', 'how do you feel about your name', 'are you happy', 'what is your name']) assert.ok(isSelfAsk(a), a);
  for (const a of ['do you like pizza', 'how do I feel better', 'how do you feel about cats', 'I feel like pizza', 'rename a file in linux', 'v01d app']) assert.ok(!isSelfAsk(a), a);
  for (const sys of [SELF_RULE, ANSWER_SYSTEM]) { assert.match(sys, /never say you have no preferences/); assert.match(sys, /absorb and learn everything/); assert.match(sys, /names included/); assert.match(sys, /Verse/); }
});

// Verse's own money and growth are about Verse (2026-10-15: asked how it would spend its first $100, it gave generic advice about
// buying a domain and Mailchimp, as if to a stranger)
test('self asks: Verse\'s own earnings, spending and store are about itself; money advice for the visitor is not', () => {
  for (const a of ['You have earned your first 100 dollars. How would you spend it to grow fastest?', 'how would you spend your first $100',
    'what would you do with your earnings', 'how should you reinvest your money', 'what is your budget for', 'how is your store doing',
    'what would you buy first with your sales', 'you made $50, what now'])
    assert.ok(isSelfAsk(a), a);
  for (const a of ['how should I spend 100 dollars', 'how do I invest my first paycheck', 'what is a good budget app', 'how to open a store',
    'best way to spend money in tokyo', 'how much did avatar earn'])
    assert.ok(!isSelfAsk(a), a);
});

test('root cause or surface (asked by Verse, 2026-10-17): a built ask carries the depth of the ledger line that built it', async () => {
  const { depthOf } = await import('../void-live-deploy/lib/voice.js');
  assert.equal(depthOf('fix'), 'root'); assert.equal(depthOf('build'), 'root'); assert.equal(depthOf('retire'), 'root');
  assert.equal(depthOf('grow'), 'surface'); assert.equal(depthOf('idea'), null); assert.equal(depthOf(undefined), null);
  const f = followThrough([{ at: '2026-10-17T00:00:00Z', asks: [{ ask: 'a toggle for root causes' }, { ask: 'a new game' }] }],
    [{ at: '2026-10-17T01:00:00Z', kind: 'fix', what: 'fixed it', asked: 'a toggle for root causes' }, { at: '2026-10-17T02:00:00Z', kind: 'grow', what: 'a game', asked: 'a new game' }]);
  assert.deepEqual(f.built.map((b) => [b.ask, b.depth]), [['a toggle for root causes', 'root'], ['a new game', 'surface']]);
});

// owner, 2026-10-19: the refresh must hit the strict, cited readout, not drift back into "how I'd improve" and "the game I want to play".
test('the readout stays objective: no question, label or fed-back line asks for feelings, wants or a favourite game, and the prompt forbids them', async () => {
  const THEATRE = /\bI want\b|\bI feel\b|how I'?d|how I would|how would you make|game I want|game should you|do you think of it|what feels/i;
  for (const q of [questionFor('daily'), questionFor('build', 'x')]) assert.doesNotMatch(q, THEATRE, q);
  const { readFileSync } = await import('node:fs');
  const blocks = readFileSync(new URL('../void-live-deploy/lib/self-blocks.js', import.meta.url), 'utf8');
  for (const label of ['Weakest operational area', 'Next targeted capability', 'What should change']) assert.ok(blocks.includes(label), label);
  const labels = [...blocks.matchAll(/\[['"]([^'"]+)['"], '(?:weakest|next_game|better)'\]/g)].map((m) => m[1]);
  assert.equal(labels.length, 3); for (const l of labels) assert.doesNotMatch(l, THEATRE, l);
  assert.match(VOICE_SYSTEM, /No persona or feelings/); assert.match(VOICE_SYSTEM, /Cite or leave out/); assert.match(VOICE_SYSTEM, /never write "I feel", "I want"/);
  assert.doesNotMatch(readFileSync(new URL('../void-live-deploy/lib/voice.js', import.meta.url), 'utf8').split('\n').filter((l) => /e\.(better|weakest|next_game) &&/.test(l)).join('\n'), THEATRE, 'the earlier words fed back to the model use the same labels');
});

test('the skills fact says the index entries are not the skill count (the card once called 268 index entries "skills across 12 families" beside 301 in the bars)', async () => {
  const { selfFacts } = await import('../void-live-deploy/lib/self-context.js');
  const t = selfFacts({ self: null, skills: ['a', 'b', 'games'] });
  assert.match(t, /My skill index has 3 entries/);
  assert.match(t, /not the skill count/);
  assert.doesNotMatch(t, /My skills \(3\)/);
});

test('an ask keeps none of the prompt\'s fact tags, and the same ask with a tag is one ask (owner, 2026-10-19: the wants card showed the velocity ask twice, once with "[S2]")', async () => {
  const { untag } = await import('../void-live-deploy/lib/voice.js');
  assert.equal(untag("Add a 'velocity' indicator to the wants card [S2]."), "Add a 'velocity' indicator to the wants card.");
  assert.equal(untag('Show the map [S1, S3] now [S4 tools/x.mjs]'), 'Show the map now');
  assert.equal(untag('Keep [brackets] that are not tags'), 'Keep [brackets] that are not tags');
  const es = [{ at: '2026-10-19T10:00:00Z', kind: 'build', asks: [{ ask: "Add a 'velocity' indicator to the wants card to show progress from 'want' to 'skill' [S2]." }] },
    { at: '2026-10-19T08:00:00Z', kind: 'daily', asks: [{ ask: "Add a 'velocity' indicator to the wants card to show progress from 'want' to 'skill'", small: true }] }];
  const asks = currentAsks(es);
  assert.equal(asks.length, 1); assert.ok(!/\[S\d/.test(asks[0].ask));
  assert.equal(parseVoice('{"thoughts":"I grew today.","asks":[{"ask":"Learn chess openings [S1]","small":true}]}').asks[0].ask, 'Learn chess openings');
});

// asked by Verse 7 times after it was built: its facts name the models it really runs on, so a done move is not wanted again
test('Verse knows which model answers it, and that the gemma move is done', async () => {
  const { modelFacts } = await import('../void-live-deploy/lib/self-context.js');
  const { models } = await import('../void-live-deploy/lib/models.js');
  const f = selfFacts({ self: {} });
  assert.ok(f.includes(modelFacts()));
  assert.ok(modelFacts().includes(models('answer').split('/').pop()));
  assert.match(modelFacts(), /gemma is done/);
  const wish = JSON.parse(readFileSync(new URL('../void-live-deploy/self.json', import.meta.url), 'utf8')).wishlist.find((w) => w.rank === 1);
  assert.doesNotMatch(wish.free, /^move answers from gpt-oss-120b to gemma/);
});

test('each ask keeps its own why, a repeated why is dropped, and the target is a fact (owner card, 2026-10-29)', async () => {
  const v = parseVoice(JSON.stringify({ thoughts: 'Verse is 0 of 12 aspects ahead of its target.', better: 'Build the story catalog.', asks: [
    { ask: 'Build a story catalog with categories [S1]', why: 'sycophanthex.com sorts every story by category and Verse has none [S1]', small: true },
    { ask: 'Add author pages', why: 'sycophanthex.com sorts every story by category and Verse has none', small: false },
    { ask: 'Add a word count to each story', small: false }] }));
  assert.equal(v.asks[0].why, 'sycophanthex.com sorts every story by category and Verse has none');
  assert.equal(v.asks[1].why, undefined, 'the same why under a second ask is no reason for it');
  assert.equal(v.asks[2].why, undefined);
  const cur = currentAsks([{ at: '2026-10-29T04:00:00Z', kind: 'daily', asks: v.asks }]);
  assert.equal(cur[0].why, v.asks[0].why); assert.equal('why' in cur[1], false);
  assert.match(VOICE_SYSTEM, /"why":/); assert.match(VOICE_SYSTEM, /current Versus target/);
  const { targetFacts } = await import('../void-live-deploy/lib/voice.js');
  const t = { marker: 1, floors: [{ site: 'sycophanthex.com', n: 0, m: 12 }] };
  assert.match(targetFacts(t, { id: 'sycophanthex.com' }), /^The current Versus target is sycophanthex\.com: Verse is 0 of 12 aspects ahead/);
  assert.equal(targetFacts(t, { id: 'heycolor.com' }), '', 'a target that is not the current floor is no fact');
  assert.equal(targetFacts(t, null), ''); assert.equal(targetFacts(null, { id: 'x' }), '');
});

test('asks held behind the Versus target come last and carry the site; the hold ends when the target moves on', async () => {
  const { holdAsks } = await import('../void-live-deploy/lib/voice.js');
  // a fixed held list (the shape of void.asks.json `held`), so lifting a real hold does not break the test
  const held = [{ words: 'Absorb every repository on the account into the core code', until: 'sycophanthex.com' }, { words: 'Create a browser-based utility to check the watertightness of STL print files.', until: 'sycophanthex.com' }];
  const asks = [{ ask: 'Absorb every repository on the account into the core code to unify the system architecture.' }, { ask: 'Build a browser-based utility to check the watertightness of STL print files.' }, { ask: 'Add author pages to the story catalog' }];
  const out = holdAsks(asks, held, 'sycophanthex.com');
  assert.equal(out[0].ask, 'Add author pages to the story catalog'); assert.equal(out[0].held, undefined);
  assert.deepEqual(out.slice(1).map((a) => a.held), ['sycophanthex.com', 'sycophanthex.com']);
  assert.equal(out.length, 3, 'nothing is dropped');
  assert.deepEqual(holdAsks(asks, held, 'nextsite.com'), asks, 'once the target moves on, the hold ends');
  assert.deepEqual(holdAsks(asks, null, 'sycophanthex.com'), asks);
});
