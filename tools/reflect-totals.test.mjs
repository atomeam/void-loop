// /api/reflect's built count (owner, 2026-10-19: the self card said "24 of 71" and then "22 of 66": it counted only the 60 reflections kept online).
// The voice log's all-time totals (void.asks.json, written at deploy by tools/asks-link.mjs) run to `through`; asks first made after it are added from the window.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../void-live-deploy/functions/api/reflect.js';

const envOf = (entries, ledger, asks) => ({ DB: { prepare: () => ({ bind: () => ({ first: async () => JSON.stringify(entries) }) }) },
  ASSETS: { fetch: async (r) => new Response(JSON.stringify(new URL(r.url).pathname === '/void.growth.json' ? ledger : asks)) } });
const get = async (env) => (await (await onRequestGet({ request: new Request('http://x/api/reflect'), env })).json()).follow;

test('the all-time totals plus the asks made after the log, never a count that shrinks as old reflections fall out of the window', async () => {
  const entries = [
    { at: '2026-10-19T09:00:00Z', kind: 'build', thoughts: 'x', asks: [{ ask: 'Add a velocity indicator to the wants card to show progress', small: true }] },
    { at: '2026-10-18T09:00:00Z', kind: 'build', thoughts: 'y', asks: [{ ask: 'Build a decision matrix skill under the Deciding family please' }] },
  ];
  const ledger = [{ at: '2026-10-18T12:00:00Z', what: 'decision matrix built', asked: 'Build a decision matrix skill under the Deciding family please' }];
  const f = await get(envOf(entries, ledger, { links: [], totals: { asked: 224, built: 206, through: '2026-10-18T20:31:00Z' } }));
  assert.equal(f.total, 225); assert.equal(f.built, 206);
  const w = await get(envOf(entries, ledger, { links: [] })); // no totals yet: the window, as before
  assert.equal(w.total, 2); assert.equal(w.built, 1);
});

// asked by Verse (2026-10-29): the self card said "3 waiting" beside "What got built (237 of 244 asks)". An ask still open in the voice
// log (totals.open) and asked again online is one ask, not a new one; an old open ask built since moves to built; and waiting is every
// ask not built, so total = built + waiting on every card.
test('waiting is every ask not built: total minus built, with an ask asked again online counted once', async () => {
  const entries = [
    { at: '2026-10-29T14:31:00Z', kind: 'build', thoughts: 'x', asks: [{ ask: 'Create a browser-based utility to check the watertightness of STL print files.' }, { ask: 'Implement edge caching for answers in the worker' }] },
    { at: '2026-10-29T14:20:00Z', kind: 'build', thoughts: 'y', asks: [{ ask: 'Migrate answer generation from gpt-oss-120b to Gemma right away' }] },
  ];
  const ledger = [{ at: '2026-10-29T14:25:00Z', what: 'answers on Gemma', asked: 'Migrate answer generation from gpt-oss-120b to Gemma right away' }];
  const totals = { asked: 239, built: 236, through: '2026-10-28T22:29:00Z', open: [
    { ask: 'Create a utility to check the watertightness of STL print files in the browser', at: '2026-10-28T22:29:00Z', kind: 'daily', times: 6 },
    { ask: 'Absorb every repository on the account into the core code', at: '2026-10-28T22:29:00Z', kind: 'daily', times: 6 },
    { ask: 'Migrate answer generation from gpt-oss-120b to Gemma right away', at: '2026-10-28T22:21:00Z', kind: 'build', times: 2 },
  ] };
  const env = envOf(entries, ledger, { links: [], totals });
  const r = await (await onRequestGet({ request: new Request('http://x/api/reflect'), env })).json();
  // open: the STL ask (log + online, once), absorb (log only), edge caching (new online); Gemma built since the log
  assert.equal(r.follow.open, 3, JSON.stringify(r.asks.map((a) => a.ask)));
  assert.equal(r.asks.length, 3);
  assert.equal(r.follow.built, 237);
  assert.equal(r.follow.total, 240);
  assert.equal(r.follow.total - r.follow.built, r.follow.open, 'built and waiting add up to the total');
  assert.ok(r.asks.some((a) => /Absorb every repository/.test(a.ask)), 'an open ask from the log stays waiting even when it fell out of the window');
  assert.equal(r.asks.filter((a) => /STL/.test(a.ask)).length, 1, 'the STL ask is one ask');
  // the old way counted the STL ask twice (once in the log totals, once as new online): break the totals' open list and the sum no longer holds
  const old = await (await onRequestGet({ request: new Request('http://x/api/reflect'), env: envOf(entries, ledger, { links: [], totals: { ...totals, open: undefined } }) })).json();
  assert.notEqual(old.follow.total - old.follow.built, 3, 'without the open list the window double counts (this is what the card showed)');
});
