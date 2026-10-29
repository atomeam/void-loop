// Bounded pit crew: turn Verse's small reversible asks into queued build jobs without spending.
//
//   node tools/pit-crew.mjs              dry-run: print eligible asks, write domains/void.pit-crew.json
//   node tools/pit-crew.mjs --queue      POST each eligible ask to /api/queue (needs VOID_MISSES_TOKEN)
//
// Rules (owner money rule stays intact):
//   - only asks marked (small) in domains/void.voice.md current asks
//   - skip money, price, secret, owner-key, WebRTC, paid-model wording
//   - max MAX_PER_RUN jobs per invocation
//   - never calls the bridge or any gated spend tool
//   - --queue is the only network write; default is dry-run
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVoiceAsks, builtAskIds } from './better.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'domains', 'void.pit-crew.json');
const MAX_PER_RUN = 3;
const BLOCK = /\b(price|priced|pricing|money|spend|payment|secret|token|password|owner key|webrtc|paid model|gumroad|stripe|discount|coupon)\b/i;

export function isAutoEligible(ask) {
  if (!ask || !ask.small || !ask.id) return false;
  if (BLOCK.test(ask.ask)) return false;
  if (ask.ask.length < 12) return false;
  return true;
}

export function selectCrew(asks, built, { max = MAX_PER_RUN } = {}) {
  const builtSet = built instanceof Set ? built : new Set(built || []);
  return (asks || []).filter((a) => isAutoEligible(a) && !builtSet.has(a.id)).slice(0, max);
}

export function targetFor(ask) {
  return ('voice:' + String(ask.id || 'ask').replace(/[^a-z0-9-]/gi, '').slice(0, 40)).toLowerCase();
}

export async function enqueue(items, { token, fetchImpl = fetch, api = 'https://a-to-mind.com/api/queue' } = {}) {
  const results = [];
  if (!token) return items.map((a) => ({ id: a.id, ok: false, error: 'no token' }));
  for (const a of items) {
    try {
      const res = await fetchImpl(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({
          target: targetFor(a),
          note: 'pit-crew auto: ' + a.ask.slice(0, 200) + ' [asked by Verse ' + a.id + ']',
        }),
      });
      const text = await res.text();
      results.push({ id: a.id, ok: res.ok, status: res.status, body: text.slice(0, 200) });
    } catch (e) {
      results.push({ id: a.id, ok: false, error: String((e && e.message) || e) });
    }
  }
  return results;
}

export function run({ queue = false, token = process.env.VOID_MISSES_TOKEN || '', fetchImpl } = {}) {
  const voice = readFileSync(resolve(root, 'domains/void.voice.md'), 'utf8');
  let ledger = [];
  try { ledger = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/void.growth.json'), 'utf8')); } catch (_) {}
  const asks = parseVoiceAsks(voice);
  const built = builtAskIds(ledger);
  const selected = selectCrew(asks, built);
  const record = {
    at: new Date().toISOString(),
    mode: queue ? 'queue' : 'dry-run',
    max_per_run: MAX_PER_RUN,
    selected: selected.map((a) => ({ id: a.id, ask: a.ask, target: targetFor(a) })),
    note: 'Small reversible Verse asks only. No spend. Owner confirm still required for bridge delivery.',
  };
  return { record, selected, queue, token, fetchImpl };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const doQueue = process.argv.includes('--queue');
  const { record, selected, token, fetchImpl } = run({ queue: doQueue });
  if (doQueue) {
    const results = await enqueue(selected, { token, fetchImpl });
    record.results = results;
    console.log(`pit-crew queue: ${results.filter((r) => r.ok).length}/${results.length} accepted`);
    for (const r of results) console.log('  ', r.id, r.ok ? 'ok' : (r.error || r.status));
  } else {
    console.log(`pit-crew dry-run: ${selected.length} eligible (max ${MAX_PER_RUN})`);
    for (const a of selected) console.log('  ', a.id, a.ask.slice(0, 80));
  }
  writeFileSync(OUT, JSON.stringify(record, null, 2) + '\n');
  console.log('wrote', OUT);
}
