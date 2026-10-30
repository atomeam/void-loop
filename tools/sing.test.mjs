// Verse sings (lib/sing.js, functions/api/sing.js, modal/verse_sing.py): the caption and Verse's own voice, the lyrics clean-up, the switch,
// the member gate, the daily limits, and the call to Modal with its key, all with a fake Modal. Run: node --test tools/sing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/sing.js';
import { askOf, captionOf, secondsOf, lyricsOf, lyricsMessages, singOn, VOICE, SING_PER_MEMBER, SECONDS_MAX, SECONDS_MIN, LYRICS_MAX } from '../void-live-deploy/lib/sing.js';
import { sessionId } from '../void-live-deploy/lib/void-me.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  const batch = async (list) => { const out = []; for (const x of list) out.push(await x.run()); return out; };
  return { prepare: (sql) => stmt(sql), batch, raw: db };
}
const TOKEN = 'b'.repeat(43), USER = 'user-for-sing-test';
const URL_ = 'https://atomeam--verse-sing.modal.run', KEY = 'k'.repeat(64);
async function signIn(DB, tier) {
  await onRequestGet({ request: new Request('https://a-to-mind.com/api/sing'), env: { DB } }); // makes the tables
  DB.raw.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(TOKEN), USER, new Date().toISOString(), Date.now() + 864e5);
  if (tier) DB.raw.prepare('INSERT INTO void_accounts (user_id, tier, updated) VALUES (?, ?, ?)').run(USER, tier, new Date().toISOString());
}
let ip = 0;
const req = (body, auth = true) => new Request('https://a-to-mind.com/api/sing', { method: 'POST', headers: { 'cf-connecting-ip': '10.0.0.' + (++ip), 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + TOKEN } : {}) }, body: JSON.stringify(body) });
const MP3 = new Uint8Array(4000).fill(7);
function fakeModal() {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } }); };
  return { calls, fetchFn };
}
const LYRICS = 'Title: Night Glass\n[Verse 1]\n1. the tide pulls slow\nbeneath the glass\nwhere lanterns go\nand shadows pass\nChorus:\nsing me under\n(whispered)\nsing me home';

test('the caption is the ask without "make me a", then Verse\'s own voice, every time', () => {
  assert.equal(askOf('Please make me a haunting folk song about the sea!'), 'haunting folk song about the sea');
  const c = captionOf('make me a synthwave song about neon rain');
  assert.ok(c.startsWith('synthwave song about neon rain, '));
  assert.ok(c.endsWith(VOICE), 'one voice, so it is one singer');
  assert.equal(captionOf('make me a'), '', 'nothing to sing about');
  assert.equal(captionOf(null), '');
});

test('song length is held between the limits', () => {
  assert.equal(secondsOf(5), SECONDS_MIN);
  assert.equal(secondsOf(9999), SECONDS_MAX);
  assert.equal(secondsOf('abc'), 60);
  assert.equal(secondsOf(45.4), 45);
});

test('lyrics: headings become ACE-Step tags, titles, numbers and stage directions go, too few lines is null', () => {
  assert.equal(lyricsOf(LYRICS), '[verse]\nthe tide pulls slow\nbeneath the glass\nwhere lanterns go\nand shadows pass\n[chorus]\nsing me under\nsing me home');
  assert.equal(lyricsOf('[Hook]\na\nb\nc'), null);
  assert.equal(lyricsOf('[Pre-Chorus]\na\nb\nc\nd'), '[pre-chorus]\na\nb\nc\nd');
  const long = lyricsOf(Array.from({ length: 200 }, (_, i) => 'line number ' + i + ' ' + 'la '.repeat(30)).join('\n'));
  assert.ok(long.length <= LYRICS_MAX && !long.endsWith(' '));
  const m = lyricsMessages('make me a sad waltz');
  assert.equal(m[1].content, 'The song: sad waltz');
  assert.match(m[0].content, /never copy or quote an existing song/);
});

test('singing is on only with a Modal web address and a long key', () => {
  assert.equal(singOn({}), false);
  assert.equal(singOn({ VERSE_SING_URL: URL_, VERSE_SING_KEY: 'short' }), false);
  assert.equal(singOn({ VERSE_SING_URL: 'https://evil.example.com', VERSE_SING_KEY: KEY }), false);
  assert.equal(singOn({ VERSE_SING_URL: URL_, VERSE_SING_KEY: KEY }), true);
});

test('switched off: GET says off and POST refuses without asking anyone', async () => {
  const DB = d1(); await signIn(DB, 'paid');
  const g = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/sing', { headers: { authorization: 'Bearer ' + TOKEN } }), env: { DB } })).json();
  assert.deepEqual([g.on, g.signedIn, g.member], [false, true, true]);
  const { calls, fetchFn } = fakeModal();
  const r = await onRequestPost({ request: req({ ask: 'make me a song' }), env: { DB }, fetchFn });
  assert.equal(r.status, 503); assert.equal(calls.length, 0);
});

test('only the owner and members sing: signed out 401, free 402 with the way to join', async () => {
  const env = { VERSE_SING_URL: URL_, VERSE_SING_KEY: KEY };
  const { calls, fetchFn } = fakeModal();
  const DB = d1(); await signIn(DB, null);
  assert.equal((await onRequestPost({ request: req({ ask: 'make me a song about rain' }, false), env: { ...env, DB }, fetchFn })).status, 401);
  const free = await onRequestPost({ request: req({ ask: 'make me a song about rain' }), env: { ...env, DB }, fetchFn });
  assert.equal(free.status, 402); assert.match((await free.json()).buy, /^https:\/\//);
  assert.equal(calls.length, 0, 'Modal is never asked for a visitor who may not sing');
});

test('a member sings: Modal gets the caption, the given words and the key in a header; the song and its words come back', async () => {
  const env = { VERSE_SING_URL: URL_, VERSE_SING_KEY: KEY };
  const DB = d1(); await signIn(DB, 'paid');
  const { calls, fetchFn } = fakeModal();
  const r = await onRequestPost({ request: req({ ask: 'make me a haunting lullaby', lyrics: LYRICS, seconds: 40 }), env: { ...env, DB }, fetchFn });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/mpeg');
  assert.equal((await r.arrayBuffer()).byteLength, MP3.length);
  assert.equal(decodeURIComponent(r.headers.get('x-verse-lyrics')), lyricsOf(LYRICS));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, URL_);
  assert.equal(calls[0].init.headers['x-verse-key'], KEY);
  assert.deepEqual(calls[0].body, { caption: captionOf('make me a haunting lullaby'), lyrics: lyricsOf(LYRICS), seconds: 40 });
  assert.ok(!JSON.stringify(calls[0].body).includes(KEY) && !JSON.stringify(calls[0].body).includes(USER), 'the key rides in the header only, and nothing about who asked');
});

test('without words, the free model writes them; with no model, it is an instrumental', async () => {
  const DB = d1(); await signIn(DB, 'paid');
  const { calls, fetchFn } = fakeModal();
  const AI = { run: async () => ({ response: '[verse]\nmoon on the water\nsilver and slow\n[chorus]\nhold me forever\nnever let go' }) };
  await onRequestPost({ request: req({ ask: 'make me a dream pop song' }), env: { VERSE_SING_URL: URL_, VERSE_SING_KEY: KEY, DB, AI }, fetchFn });
  assert.equal(calls[0].body.lyrics, '[verse]\nmoon on the water\nsilver and slow\n[chorus]\nhold me forever\nnever let go');
  await onRequestPost({ request: req({ ask: 'make me a jazz song' }), env: { VERSE_SING_URL: URL_, VERSE_SING_KEY: KEY, DB }, fetchFn });
  assert.equal(calls[1].body.lyrics, '[Instrumental]');
});

test('limits: a member sings SING_PER_MEMBER songs a day, then a sentence; words that are not lyrics are refused before any limit is spent', async () => {
  const DB = d1(); await signIn(DB, 'paid');
  const env = { VERSE_SING_URL: URL_, VERSE_SING_KEY: KEY, DB };
  const { calls, fetchFn } = fakeModal();
  assert.equal((await onRequestPost({ request: req({ ask: 'make me a song', lyrics: 'just one line' }), env, fetchFn })).status, 400);
  assert.equal((await onRequestPost({ request: req({ ask: 'make me a' }), env, fetchFn })).status, 400);
  for (let i = 0; i < SING_PER_MEMBER; i++) assert.equal((await onRequestPost({ request: req({ ask: 'make me a song number ' + i }), env, fetchFn })).status, 200);
  const over = await onRequestPost({ request: req({ ask: 'make me one more song' }), env, fetchFn });
  assert.equal(over.status, 429); assert.match((await over.json()).error, /songs today/);
  assert.equal(calls.length, SING_PER_MEMBER);
  const g = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/sing', { headers: { authorization: 'Bearer ' + TOKEN } }), env })).json();
  assert.deepEqual([g.on, g.member, g.left], [true, true, 0]);
});

test('Modal failing or answering with something that is not audio is a 503 and a shortfall, never a broken song', async () => {
  const DB = d1(); await signIn(DB, 'paid');
  const env = { VERSE_SING_URL: URL_, VERSE_SING_KEY: KEY, DB };
  for (const answer of [new Response('boom', { status: 500 }), new Response('<html>', { headers: { 'content-type': 'text/html' } }), new Response(new Uint8Array(10), { headers: { 'content-type': 'audio/mpeg' } })]) {
    const r = await onRequestPost({ request: req({ ask: 'make me a song ' + ip }), env, fetchFn: async () => answer });
    assert.equal(r.status, 503); assert.match((await r.json()).error, /could not sing/);
  }
  assert.ok(DB.raw.prepare("SELECT SUM(n) AS n FROM void_shortfalls WHERE place = 'sing'").get().n >= 3);
});

test('the Modal app: keyed endpoint, one GPU at most, scales down, the example credited, the workflow never echoes the key', () => {
  const py = readFileSync(new URL('../modal/verse_sing.py', import.meta.url), 'utf8');
  assert.match(py, /hmac\.compare_digest/);
  assert.match(py, /max_containers=1/);
  assert.match(py, /scaledown_window=60/);
  assert.match(py, /modal-examples.*MIT/s);
  assert.match(py, /ACE-Step-1\.5.*MIT/s);
  const wf = readFileSync(new URL('../.github/workflows/modal-sing.yml', import.meta.url), 'utf8');
  assert.match(wf, /::add-mask::\$key/);
  assert.match(wf, /--from-json/, 'the key is never on a command line');
  assert.doesNotMatch(wf, /echo "\$key"|echo \$key/);
  assert.match(wf, /MODAL_TOKEN_ID/); assert.match(wf, /MODAL_TOKEN_SECRET/);
});
