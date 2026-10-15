// Product gaps: a buy/hire ask with no matching product notes its topic (stems only, deduped by hash) and queues one
// store-gap job at GAP_MIN distinct asks. Uses a tiny in-memory D1 stand-in.
import assert from 'node:assert/strict';
import { gapTopic, recordGap, GAP_MIN } from '../void-live-deploy/lib/product-gap.js';
import { publicProduct } from '../void-live-deploy/lib/gumroad.js';

const catalog = [{ slug: 'void-code-review', name: 'Void Code Review Pro', description: 'An AI reviewer on every pull request.', price_cents: 1000, available: true }].map(publicProduct);
assert.equal(gapTopic('review my code', catalog), null); // a real match is a line, not a gap
assert.equal(gapTopic('what is a black hole', catalog), null); // not a buy ask
assert.equal(gapTopic('I am adding tests to check that it refuses harmful requests and offers something good instead. It should never just say no, and this goes into the core values for good.', catalog), null);
const t = gapTopic('can I hire you for a logo design', catalog);
assert.ok(t && /logo/.test(t) && /design/.test(t), t);
assert.equal(gapTopic('how much for logo design?', catalog), t, 'same topic from different wording');
assert.ok(!/hire|can|you/.test(t), 'topic keeps only content stems');

function fakeDB() {
  const asks = new Set(), gaps = new Map(), queue = [];
  const prep = (sql) => { const st = { sql, args: [], bind: (...a) => { st.args = a; return st; } }; return st; };
  const run = (st) => {
    const [a0, a1, a2] = st.args;
    if (/^CREATE/.test(st.sql)) return {};
    if (/INSERT OR IGNORE INTO void_gap_asks/.test(st.sql)) { asks.add(a0 + '|' + a1); return {}; }
    if (/INSERT INTO void_gaps/.test(st.sql)) { const n = [...asks].filter((k) => k.startsWith(a0 + '|')).length; const g = gaps.get(a0) || { asks: 0, queued: null }; g.asks = n; gaps.set(a0, g); return {}; }
    if (/SELECT asks, queued/.test(st.sql)) return { results: gaps.has(a0) ? [{ ...gaps.get(a0) }] : [] };
    if (/INSERT INTO void_queue/.test(st.sql)) { queue.push({ target: st.args[2], ask: st.args[1] }); return {}; }
    if (/UPDATE void_gaps SET queued/.test(st.sql)) { gaps.get(a1).queued = a0; return {}; }
    throw new Error('sql ' + st.sql);
  };
  let batches = 0;
  return { prepare: prep, batch: async (sts) => { batches++; return sts.map(run); }, queue, get batches() { return batches; } };
}
const DB = fakeDB(), env = { DB };
let r = await recordGap(env, 'can I hire you for a logo design', catalog);
assert.equal(r.asks, 1); assert.equal(r.queued, null);
r = await recordGap(env, 'can I hire you for a logo design', catalog); // the same ask again: deduped
assert.equal(r.asks, 1);
r = await recordGap(env, 'how much for logo design?', catalog);
assert.equal(r.asks, 2); assert.equal(DB.queue.length, 0);
r = await recordGap(env, 'do you sell logo design packages', catalog);
assert.equal(GAP_MIN, 3); assert.equal(r.asks, 3); assert.ok(r.queued);
assert.equal(DB.queue.length, 1); assert.equal(DB.queue[0].target, 'store-gap:' + t);
assert.ok(!/hire|how much|sell/.test(DB.queue[0].ask), 'queue holds the topic, never the visitor\'s words');
await recordGap(env, 'I want to buy a logo design service', catalog); // past the threshold: never queued twice
assert.equal(DB.queue.length, 1);
assert.ok(DB.batches <= 6, 'one batch per gap, plus one at the threshold');
assert.equal(await recordGap(env, 'review my code', catalog), null);
console.log('product-gap: ok (topic only, dedupe, threshold queues once)');
