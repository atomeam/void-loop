// Talking back to V01D (lib/voice.js "Talking back", functions/api/voice-reply.js): the owner replies to a reflection, V01D
// answers in its own words and keeps a line, and every later reflection is given the conversation; public answers get only
// the lines V01D kept, never the owner's words. Run: node --test tools/voice-reply.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cleanReply, replyPrompt, parseReply, replyFacts, keptFacts, REPLY_MAX } from '../void-live-deploy/lib/voice.js';
import { selfFacts } from '../void-live-deploy/lib/self-context.js';
import * as route from '../void-live-deploy/functions/api/voice-reply.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT); CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => db.prepare(sql).run(...a),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const DAILY = { at: '2026-10-15T23:21:00.000Z', kind: 'daily', thoughts: 'My Out in the world family has 0 proven skills.', better: 'Prioritize the WebMCP origin trial.', asks: [{ ask: 'Implement the confidence float', small: true }] };
const BUILD = { at: '2026-10-15T20:08:00.000Z', kind: 'build', shipped: 'Verse values anything from a photo', thoughts: 'A big leap.' };
const req = (method, body, auth = TOKEN) => new Request('https://a-to-mind.com/api/voice-reply', { method, headers: { ...(auth ? { authorization: 'Bearer ' + auth } : {}), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const envWith = (run) => { const DB = d1(); DB.raw.prepare("INSERT INTO void_kv (k, v) VALUES ('voice', ?)").run(JSON.stringify([DAILY, BUILD])); return { DB, READ_TOKEN: TOKEN, ...(run ? { AI: { run } } : {}) }; };

test('talking back: the owner\'s words are cleaned, and Verse\'s answer is read back without rewording', () => {
  assert.equal(cleanReply('  you were   wrong\nabout rides '), 'you were wrong about rides');
  assert.equal(cleanReply(' '), ''); assert.equal(cleanReply('x'.repeat(2000)).length, REPLY_MAX);
  assert.doesNotMatch(cleanReply('my key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789'), /abcdefghijklmnop/, 'a secret is never kept');
  assert.deepEqual(parseReply('{"answer":"I had it wrong: rides is live now.","correction":true,"remember":"rides answers from a live router"}'), { answer: 'I had it wrong: rides is live now.', correction: true, remember: 'rides answers from a live router', ask: '', misroute: false, wanted: '' });
  assert.deepEqual(parseReply('Sure. {"answer":"Heard.","correction":false}'), { answer: 'Heard.', correction: false, remember: '', ask: '', misroute: false, wanted: '' });
  assert.deepEqual(parseReply('Plain words back.'), { answer: 'Plain words back.', correction: false, remember: '', ask: '', misroute: false, wanted: '' });
  assert.equal(parseReply('{"answer":""}'), null); assert.equal(parseReply(''), null); assert.equal(parseReply('{"broken'), null);
});

test('talking back: the question carries what Verse said, the conversation so far, oldest first, and the new words', () => {
  const q = replyPrompt(DAILY, [{ text: 'second', answer: 'B' }, { text: 'first', answer: 'A' }], 'third');
  assert.match(q, /your daily reflection, 2026-10-15 23:21 UTC/); assert.match(q, /0 proven skills/); assert.match(q, /Your asks: Implement the confidence float/);
  assert.ok(q.indexOf('"first"') < q.indexOf('"second"'), 'the thread reads oldest first'); assert.match(q, /Your owner replies now: "third"$/);
  assert.match(replyPrompt(BUILD, [], 'hi'), /after a build: "Verse values anything from a photo"/);
});

test('talking back: later reflections get the owner\'s words with corrections marked; public answers get only what Verse kept', () => {
  const replies = [{ at: '2026-10-16T05:00:00Z', text: 'rides is live now, check the finding', correction: true, remember: 'rides has one live finding' }, { at: '2026-10-16T04:00:00Z', text: 'nice work', remember: '' }];
  const f = replyFacts(replies);
  assert.match(f, /a correction outranks anything I said before/); assert.match(f, /2026-10-16 \(a correction\): "rides is live now, check the finding" I keep: rides has one live finding/); assert.match(f, /"nice work"/);
  assert.equal(replyFacts([]), ''); assert.equal(replyFacts(null), '');
  assert.equal(keptFacts(replies), 'What I keep in mind from talking with my owner (newest first): rides has one live finding');
  const pub = selfFacts({ replies });
  assert.match(pub, /rides has one live finding/); assert.doesNotMatch(pub, /check the finding|nice work/, 'the owner\'s own words never reach a public answer');
});

test('talking back: the route is owner only, answers in Verse\'s words, keeps the thread, and keeps the reply even when the model is busy', async () => {
  const asked = [];
  const env = envWith(async (model, input) => { asked.push(input.messages[1].content); return { response: '{"answer":"You are right, I had rides wrong.","correction":true,"remember":"rides is live","ask":"Show the live rides finding on the rides card"}' }; });
  assert.equal((await route.onRequestPost({ request: req('POST', { text: 'hi' }, ''), env })).status, 401);
  assert.equal((await route.onRequestGet({ request: req('GET', null, 'wrong-token-wrong-token-wrong'), env })).status, 401);
  assert.equal((await route.onRequestPost({ request: req('POST', { text: ' ' }), env })).status, 400);
  assert.equal((await route.onRequestPost({ request: req('POST', { text: 'hi', to: '2020-01-01T00:00:00Z' }), env })).status, 400, 'a reflection that does not exist');
  const r1 = await (await route.onRequestPost({ request: req('POST', { text: 'rides is live now' }), env })).json();
  assert.equal(r1.to, DAILY.at, 'no `to` means the newest reflection');
  const q = env.DB.raw.prepare('SELECT ask, target, state, note FROM void_queue').all();
  assert.equal(q.length, 1); assert.equal(q[0].ask, 'Show the live rides finding on the rides card'); assert.equal(q[0].target, 'voice:show-the-live-rides-finding-on-the-rides'); assert.match(q[0].note, /owner replied to it .* Credit Void\./);
  assert.ok(r1.queued, 'what the conversation made Verse want built went to the builders'); assert.equal(r1.answer, 'You are right, I had rides wrong.'); assert.equal(r1.correction, true); assert.equal(r1.remember, 'rides is live');
  const r2 = await (await route.onRequestPost({ request: req('POST', { text: 'and the finding has an artifact', to: DAILY.at }), env })).json();
  assert.match(asked[1], /The conversation so far:\nOwner: "rides is live now"\nYou: "You are right, I had rides wrong\."/, 'Verse sees the thread it is in');
  const busy = envWith(async () => { throw new Error('3040: capacity'); }); busy.DB = env.DB;
  const r3 = await (await route.onRequestPost({ request: req('POST', { text: 'still there?' }), env: busy })).json();
  assert.equal(r3.answer, null, 'never an answer made up for Verse'); assert.equal(r3.text, 'still there?');
  const list = (await (await route.onRequestGet({ request: req('GET'), env })).json()).replies;
  assert.deepEqual(list.map((x) => x.text), ['still there?', 'and the finding has an artifact', 'rides is live now'], 'kept newest first');
  assert.ok(r2.at >= r1.at); assert.equal(r2.queued, undefined, 'one voice job open at a time');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_queue').get().n, 1);
});

test('talking back about any card: the reply carries the ask, the card\'s title and what it said; the thread is per ask', async () => {
  const asked = [];
  const env = envWith(async (m, input) => { asked.push(input.messages[1].content); return { response: '{"answer":"I was wrong: Oslo is one hour ahead of London, not two.","correction":true,"remember":"check the date when I give a time difference","ask":""}' }; });
  const about = { ask: 'time difference between london and oslo', title: 'London and Oslo', said: 'Oslo is 2 hours ahead of London.' };
  const r = await (await route.onRequestPost({ request: req('POST', { about, text: 'It is one hour, not two.' }), env })).json();
  assert.match(asked[0], /^What you showed when you were asked "time difference between london and oslo" \(the card "London and Oslo"\):\nOslo is 2 hours ahead of London\./);
  assert.equal(r.to, null); assert.deepEqual(r.about, { ask: about.ask, title: about.title }, 'what the card said is not stored, only the ask and title'); assert.equal(r.correction, true);
  await route.onRequestPost({ request: req('POST', { about, text: 'And in summer?' }), env });
  assert.match(asked[1], /The conversation so far:\nOwner: "It is one hour, not two\."/, 'the same card\'s thread');
  await route.onRequestPost({ request: req('POST', { about: { ...about, ask: 'weather in oslo' }, text: 'fine' }), env });
  assert.doesNotMatch(asked[2], /conversation so far/, 'another card starts its own thread');
  const facts = replyFacts((await (await route.onRequestGet({ request: req('GET'), env })).json()).replies);
  assert.match(facts, /\(a correction\) about my answer to "time difference between london and oslo": "It is one hour, not two\."/);
  assert.equal((await route.onRequestPost({ request: req('POST', { about: { ask: '' }, text: 'hi' }), env })).status, 200, 'an empty about is a reply to the newest reflection');
});

test('a misrouted card (owner, 2026-10-16): the false match and the correction become a route: job for the skill that answered', async () => {
  // the misfire: a quoted conversation about V01D's memory went to the automation-fix card as if it were a broken webhook
  const asked = [];
  const env = envWith(async (m, input) => { asked.push(input.messages[1].content); return { response: JSON.stringify({ answer: 'You are right: that was a quote about my memory, not a broken automation. My automation-fix skill grabbed it because it saw "webhook".', correction: true, remember: 'a quoted conversation is not a broken automation', misroute: true, wanted: 'answer' }) }; });
  const about = { ask: 'he said your memory resets like a zapier webhook that never fires', title: 'Your automation, fixed', said: 'Likely cause: the webhook trigger is not receiving events.', routed: { skill: 'automation-fix', via: 'void.fix' } };
  const text = 'I am quoting a conversation about your memory, not fixing a webhook.';
  const r = await (await route.onRequestPost({ request: req('POST', { about, text }), env })).json();
  assert.match(asked[0], /answered by your automation-fix skill:\nLikely cause/);
  assert.deepEqual(r.about.routed, { skill: 'automation-fix' }); assert.equal(r.misroute.skill, 'automation-fix'); assert.equal(r.misroute.wanted, 'answer'); assert.ok(r.misroute.queued);
  const q = env.DB.raw.prepare("SELECT ask, target, note FROM void_queue WHERE target LIKE 'route:%'").all();
  assert.equal(q.length, 1); assert.equal(q[0].ask, 'stop answering "he said your memory resets like a zapier webhook that never fires"');
  assert.match(q[0].note, /\(wrong skill:automation-fix\) \(wanted answer\): "I am quoting a conversation about your memory, not fixing a webhook\."/);
  assert.match(q[0].target, /^route:automation-fix-/); // tools/propose-fix.mjs reads this note as a 'narrow' job (tools/propose-fix.test.mjs)
  await route.onRequestPost({ request: req('POST', { about, text: 'again' }), env });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM void_queue WHERE target LIKE 'route:%'").get().n, 1, 'one open job per skill and ask');
  // not a misroute when V01D says so, or when nothing says which skill answered
  const calm = envWith(async () => ({ response: '{"answer":"Fair.","misroute":false}' }));
  assert.equal((await (await route.onRequestPost({ request: req('POST', { about, text: 'shorter please' }), env: calm })).json()).misroute, undefined);
  const noRoute = envWith(async () => ({ response: '{"answer":"Fair.","misroute":true,"wanted":"answer"}' }));
  assert.equal((await (await route.onRequestPost({ request: req('POST', { about: { ...about, routed: { skill: 'Bad Name!' } }, text: 'x y' }), env: noRoute })).json()).misroute, undefined);
  assert.equal(parseReply('{"answer":"a","misroute":true,"wanted":"skill:Evil One"}').wanted, '', 'only a skill name or answer');
});
