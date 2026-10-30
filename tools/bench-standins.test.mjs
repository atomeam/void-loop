// The benchmark's stand-ins for Wikiquote and /api/markets (tools/bench-standins.mjs), 2026-10-30: with none, 17 quote, proverb
// and stock asks read "(none)" in tools/bench.misses.json. Each skill is run here against the stand-in, as the benchmark runs it,
// and must draw a card that answers.
//   node --test tools/bench-standins.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wikiquote, markets } from './bench-standins.mjs';
import quote from '../void-live-deploy/skills/quote.js';
import proverb from '../void-live-deploy/skills/proverb.js';
import stocks from '../void-live-deploy/skills/stocks.js';

async function run(skill, text) {
  const el = { innerHTML: '' }, real = globalThis.fetch;
  globalThis.fetch = async (u) => { const b = wikiquote(String(u)) || markets(String(u)); return b ? { ok: true, status: 200, json: async () => b } : { ok: false, status: 204, json: async () => { throw new Error('no body'); } }; };
  try {
    const got = await skill.run(text, { showPage: (f) => { f(el); return el; }, esc: (x) => String(x), _pageStill: () => true });
    return { got, html: el.innerHTML };
  } finally { globalThis.fetch = real; }
}

test('every quote ask the benchmark makes gets a quote with its author and source', async () => {
  for (const ask of ['random quote', 'tell me a quote', 'famous quotes', 'inspirational quote', 'give me a motivational quote', 'quote of the day', 'what is the quote of the day']) {
    assert.ok(quote.match(ask.toLowerCase(), ask), ask);
    const { got, html } = await run(quote, ask);
    assert.equal(got, 'quote', ask);
    assert.match(html, /Our doubts are traitors/, ask); assert.match(html, /William Shakespeare/, ask); assert.match(html, /Source: <a href="https:\/\/en\.wikiquote\.org\/wiki\//, ask);
  }
});

test('every proverb ask gets a proverb linked to its keyword', async () => {
  for (const ask of ['tell me a proverb', 'random proverb', 'give me a proverb', 'an old saying']) {
    assert.ok(proverb.match(ask.toLowerCase(), ask), ask);
    const { got, html } = await run(proverb, ask);
    assert.equal(got, 'proverb', ask);
    assert.match(html, /A cat may look at a king\./, ask); assert.match(html, /English proverbs: Cat/, ask);
  }
});

test('a stock ask gets a price card from the markets stand-in', async () => {
  for (const ask of ['apple stock price', 'what is tesla\'s stock price', 'how is the s&p 500 today']) {
    assert.ok(stocks.match(ask.toLowerCase(), ask), ask);
    const { got, html } = await run(stocks, ask);
    assert.equal(got, 'stocks', ask); assert.match(html, /201\.5/, ask); assert.match(html, /not advice/, ask);
  }
});

test('the stand-ins answer only their own addresses', () => {
  assert.equal(wikiquote('https://en.wikipedia.org/w/api.php?action=query'), null);
  assert.equal(wikiquote('https://evil.test/?u=https://en.wikiquote.org/w/api.php?x'), null);
  assert.equal(markets('http://127.0.0.1:8080/api/answer'), null);
  assert.equal(markets('http://127.0.0.1:8080/api/markets?s=AAPL&r=5d').sym, 'AAPL');
});
