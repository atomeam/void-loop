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
