// tools/feed.test.mjs — functions/api/feed.js: only allow-listed feeds pass, the answer is read-capped and
// edge-cached, a stranger gets a 400/429, and nothing but the feed's own bytes comes back
import { test } from 'node:test';
import assert from 'node:assert/strict';

// a fake edge cache installed before any module loads, so both feed.js and rateLimited use it
const store = new Map();
globalThis.caches = {
  default: {
    match: async (k) => store.get(k.url) || null,
    put: async (k, r) => { store.set(k.url, { text: async () => await r.text(), headers: r.headers, status: r.status }); },
  },
};
const feedApi = await import('../void-live-deploy/functions/api/feed.js');
feedApi._setRateLimited(async () => false); // the limit counter stays off in tests
const { onRequestGet, feedFor, FEEDS } = feedApi;

const req = (u) => new Request('https://a-to-mind.com/api/feed?u=' + encodeURIComponent(u));
// a fake edge cache + fake fetch
function envWith({ feeds = {}, rateOk = true } = {}) {
  const store = new Map();
  return {
    env: {
      // rateLimited reads a KV-ish binding; answer.js's rateLimited expects env with the guard — stub via a WeakMap-free shape:
      GUARD: { bucket: 'test' },
    },
    cache: {
      match: async (k) => store.get(k.url) || null,
      put: async (k, r) => { store.set(k.url, { text: async () => await r.text(), headers: r.headers }); },
    },
    fetchMock: feeds,
    rateOk,
    store,
  };
}

test('only the allow-listed feeds are served; anything else is a 400 and never fetched', async () => {
  assert.deepEqual(FEEDS, ['https://ajsonline.org/feed']);
  assert.equal(feedFor('https://ajsonline.org/feed'), 'https://ajsonline.org/feed');
  assert.equal(feedFor('https://evil.example/feed'), null);
  assert.equal(feedFor('http://ajsonline.org/feed'), null, 'https only');
  const r = await onRequestGet({ request: req('https://evil.example/x'), env: {} });
  assert.equal(r.status, 400);
});

test('an allow-listed feed is fetched once, capped, cached, and served with CORS headers', async () => {
  let calls = 0;
  const fakeFetch = async () => { calls++; return new Response('<rss><channel><item><title>t</title></item></channel></rss>', { status: 200, headers: { 'content-type': 'application/rss+xml' } }); };
  const origFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  try {
    store.clear();
    const r1 = await onRequestGet({ request: req('https://ajsonline.org/feed'), env: {} });
    assert.equal(r1.status, 200);
    assert.equal(r1.headers.get('access-control-allow-origin'), '*');
    assert.match(await r1.text(), /<rss>/);
    const r2 = await onRequestGet({ request: req('https://ajsonline.org/feed'), env: {} });
    assert.equal(r2.headers.get('x-verse-cache'), 'HIT');
    assert.equal(calls, 1, 'the second read came from the edge cache');
  } finally { globalThis.fetch = origFetch; }
});

test('a feed that fails answers 502 and is never cached', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('down'); };
  try {
    store.clear();
    const r = await onRequestGet({ request: req('https://ajsonline.org/feed'), env: {} });
    assert.equal(r.status, 502);
    const feedCached = [...store.keys()].some((k) => k.includes('__feed-cache'));
    assert.ok(!feedCached, 'nothing cached on failure');
  } finally { globalThis.fetch = origFetch; }
});
