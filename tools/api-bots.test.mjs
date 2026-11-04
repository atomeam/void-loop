// Free API wrapper bots (bots/api-bots.js): each is checked against a real call kept by tools/api-bots.mjs, never its own first answer.
// A wrong reading, a refused call, a browser-blocked API or a key in the address fails the bot; the factory files it as a fix job.
// Run: node --test tools/api-bots.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APIS, apiBots, read, askAt, reachable } from '../void-live-deploy/bots/api-bots.js';
import { relayAddress, RELAYED, onRequestGet } from '../void-live-deploy/functions/api/apibot.js';
import KEPT from '../void-live-deploy/bots/api-fixtures.js';
import { check } from '../void-live-deploy/bots/families.js';
import { familyRows, fixJobs } from './bot-factory.mjs';
import { trim, corsOfHops } from './api-bots.mjs';

const blocked = (id) => !KEPT[id] || KEPT[id].status !== 200 || !reachable(APIS.find((a) => a.id === id), KEPT[id]);

test('every API bot with a good kept call passes all its checks; the rest fail and become fix jobs, never live', () => {
  const B = apiBots();
  assert.equal(new Set(B.map((b) => b.id)).size, B.length);
  assert.ok(B.length >= 60);
  const failed = B.filter((b) => !check(b).ok).map((b) => b.id), want = APIS.filter((a) => blocked(a.id)).map((a) => 'api-' + a.id);
  assert.deepEqual(failed, want, 'only APIs that refused or block browsers fail');
  assert.ok(B.length - failed.length >= 60, 'at least 60 live');
  const f = familyRows(B)[0], jobs = fixJobs([], [f]);
  assert.equal(f.live, B.length - failed.length);
  assert.deepEqual(jobs.map((j) => j.target), want.map((id) => 'bot:' + id));
  for (const j of jobs) assert.match(j.ask, /CORS|kept a real call/);
});

test('a wrong reading, a refused call, no CORS or a key in the address fails the bot', () => {
  const a = APIS.find((x) => x.id === 'zip-lookup'), k = KEPT['zip-lookup'];
  assert.equal(read(a, k.body, '33801'), 'Lakeland, Florida');
  const bot = (over, kept = k) => { const keep = KEPT['zip-lookup']; KEPT['zip-lookup'] = kept; try { const i = APIS.indexOf(a), was = APIS[i]; APIS[i] = { ...a, ...over }; try { return check(apiBots()[i]).fails; } finally { APIS[i] = was; } } finally { KEPT['zip-lookup'] = keep; } };
  assert.deepEqual(bot({}), []);
  assert.deepEqual(bot({ pick: (j) => j.places[0].state }), ['right answer from the real reply']);
  assert.deepEqual(bot({}, { ...k, status: 500 }), ['kept a real call']);
  assert.deepEqual(bot({}, { ...k, cors: null }), ['works from a-to-mind.com (CORS)']);
  assert.deepEqual(bot({ url: (q) => k.url + '?apikey=1' }), ['builds the same address', 'needs no key']);
});

test('Run calls the API live and reads it the same way as the check (fetch stubbed with the kept reply)', async () => {
  const keep = globalThis.fetch;
  try {
    for (const id of ['weather-now', 'math-eval', 'define-word']) {
      const k = KEPT[id], seen = [];
      globalThis.fetch = async (u) => { seen.push(u); return { ok: true, status: 200, json: async () => k.body, text: async () => k.body }; };
      const b = apiBots().find((x) => x.id === 'api-' + id);
      assert.equal(await b.run(b.sample), read(APIS.find((x) => x.id === id), k.body, b.sample)); assert.deepEqual(seen, [k.url]);
    }
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(apiBots()[0].run('1, 2'), /answered 429/);
  } finally { globalThis.fetch = keep; }
});

test('every API is credited for /credits/, with public-apis (MIT) where they were found; kept replies stay small', () => {
  const credits = JSON.parse(readFileSync(new URL('../void-live-deploy/bots/credits.json', import.meta.url), 'utf8'));
  for (const a of APIS) assert.ok(credits.some((c) => c.name === a.name && c.license === a.license && c.link === a.home), a.name);
  assert.ok(credits.some((c) => c.name === 'public-apis/public-apis' && c.license === 'MIT'));
  assert.ok(credits.some((c) => /CLDR/.test(c.name)), 'the language-pair credit is kept');
  assert.deepEqual(trim({ a: [1, 2, 3, 4], b: 'x'.repeat(700), c: { d: 1 } }, ['a', 'b']), { a: [1, 2, 3], b: 'x'.repeat(600) });
});

test('a redirect without CORS on every hop is kept as blocked (browsers refuse it), and no kept call is a moved address', () => {
  assert.equal(corsOfHops(['*']), '*');
  assert.equal(corsOfHops([null, '*']), null, 'a 301 without CORS, then a 200 with it, is blocked in a browser');
  assert.equal(corsOfHops(['*', 'https://a-to-mind.com']), 'https://a-to-mind.com');
  assert.equal(corsOfHops(['*', 'https://other.example']), 'https://other.example');
  for (const a of APIS) assert.ok(!KEPT[a.id] || !KEPT[a.id].moved || KEPT[a.id].cors === null, a.id + ' moved to ' + (KEPT[a.id] || {}).moved + ': point its address there');
});

test('an API without CORS (xkcd, Fruityvice) runs through Verse\'s relay, /api/apibot, and passes on its real kept call', async () => {
  for (const id of ['xkcd', 'fruit-nutrition']) {
    const a = APIS.find((x) => x.id === id), k = KEPT[id], b = apiBots().find((x) => x.id === 'api-' + id);
    assert.equal(k.cors, null, id + ' really sends no CORS header'); assert.equal(a.via, 'verse');
    assert.deepEqual(check(b).fails, [], id + ' passes every check');
    assert.equal(askAt(a, a.sample), '/api/apibot?id=' + id + '&q=' + encodeURIComponent(a.sample));
    assert.equal(relayAddress(id, a.sample), k.url, 'the relay asks the same address the kept call did');
    const keep = globalThis.fetch, seen = [];
    globalThis.fetch = async (u) => { seen.push(u); const res = await onRequestGet({ request: new Request('https://a-to-mind.com' + u), env: {}, fetchFn: async (x) => { seen.push(x); return new Response(JSON.stringify(k.body), { status: 200 }); } }); return res; };
    try { assert.equal(await b.run(a.sample), read(a, k.body, a.sample)); } finally { globalThis.fetch = keep; }
    assert.deepEqual(seen, [askAt(a, a.sample), k.url], 'browser asks the relay, the relay asks the API');
  }
});

test('the relay is not an open proxy: closed list, the API\'s own host only, failures never passed off as answers', async () => {
  assert.deepEqual(RELAYED.map((a) => a.id).sort(), ['fruit-nutrition', 'xkcd']);
  assert.equal(relayAddress('zip-lookup', '33801'), null, 'an API with CORS is not relayed');
  assert.equal(relayAddress('nope', 'x'), null);
  assert.equal(relayAddress('fruit-nutrition', '../../../evil'), 'https://www.fruityvice.com/api/fruit/..%2F..%2F..%2Fevil');
  for (const q of ['@evil.example/x', '//evil.example', 'banana#@evil.example']) assert.equal(new URL(relayAddress('fruit-nutrition', q)).host, 'www.fruityvice.com');
  const ask = (q, fetchFn) => onRequestGet({ request: new Request('https://a-to-mind.com/api/apibot?' + q), env: {}, fetchFn });
  let called = 0; const r404 = await ask('id=zip-lookup&q=33801', async () => { called++; return new Response('{}'); });
  assert.equal(r404.status, 404); assert.equal(called, 0, 'an unlisted id never reaches the network');
  assert.equal((await ask('id=xkcd&q=614', async () => new Response('', { status: 301, headers: { location: 'https://evil.example/' } }))).status, 502, 'a redirect is not followed');
  assert.equal((await ask('id=xkcd&q=614', async () => new Response('down', { status: 500 }))).status, 502);
  assert.equal((await ask('id=xkcd&q=614', async () => { throw new Error('timeout'); })).status, 504);
});
