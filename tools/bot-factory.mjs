// Verse's bot factory (owner, 2026-11-04: "get verse to build a ridiculous amount of its own bots for everything").
//   node tools/bot-factory.mjs            gate every bot (kit.js and grown.json): run its probe, check its lineage is real, write bots/registry.json
//   node tools/bot-factory.mjs --grow N   ask free Workers AI (CF_ACCOUNT_ID + CF_API_TOKEN) for N new bots built as pipelines of live bots,
//                                         from the gaps (crew-filed wants, missed asks); keep only those whose probe passes, then gate
// Counts only bots that work: a bot whose probe fails or whose lineage names nothing real is listed as failed and never shown live.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOTS, BOT, probe, compose } from '../void-live-deploy/bots/kit.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, 'void-live-deploy');
const GROWN = resolve(site, 'bots/grown.json'), REG = resolve(site, 'bots/registry.json');
const read = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (_) { return d; } };

/** is a lineage entry real: another bot, or a file or folder in the repo */
export function lineageReal(ref, ids) {
  if (ref.startsWith('bots/')) return ids.has(ref.slice(5));
  return [resolve(site, ref), resolve(root, ref), resolve(site, ref + '.json')].some((p) => existsSync(p));
}

/** gate every bot; grown bots compose kit bots, so they gate after */
export function gate(grown = read(GROWN, [])) {
  const all = [...BOTS, ...grown.filter((g) => g.pipe.every((id) => BOT(id))).map(compose)];
  const ids = new Set(all.map((b) => b.id)), rows = [];
  for (const b of all) {
    const p = probe(b), bad = b.from.filter((r) => !lineageReal(r, ids));
    rows.push({ id: b.id, cat: b.cat, job: b.job, from: b.from, ...(b.pipe ? { pipe: b.pipe } : {}), probe: { in: b.probe[0], out: p.out.slice(0, 300) },
      status: p.ok && !bad.length ? 'live' : 'failed', ...(bad.length ? { why: 'lineage not found: ' + bad.join(', ') } : !p.ok ? { why: 'probe failed' } : {}) });
  }
  return rows;
}

/** the gaps the factory builds for: crew-filed wants and missed asks on the site, plus a standing list */
export function gaps() {
  const out = ['turn a messy note into a clean tweet with hashtags', 'check a price per unit then add tax', 'make a slug from a headline', 'summarize then title-case', 'count errors in a log and say if the box is busy'];
  const asks = read(resolve(site, 'void.asks.json'), null);
  const list = Array.isArray(asks) ? asks : (asks && (asks.asks || asks.missed)) || [];
  for (const a of list.slice(0, 20)) { const t = typeof a === 'string' ? a : a && (a.ask || a.q || a.text); if (t) out.push(String(t).slice(0, 120)); }
  return out;
}

async function askAI(prompt) {
  const { CF_ACCOUNT_ID: acct, CF_API_TOKEN: tok } = process.env;
  if (!acct || !tok) return null;
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + acct + '/ai/run/@cf/meta/llama-3.1-8b-instruct', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 900 }) });
  const j = await r.json().catch(() => ({})); return (j.result && j.result.response) || null;
}

/** parse a proposal; returns a spec only when every piece is well formed and every pipe step is a live bot */
export function parseProposal(text, live) {
  const m = String(text || '').match(/\[[\s\S]*\]/); if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch (_) { return []; }
  return arr.filter((x) => x && /^[a-z0-9-]{3,40}$/.test(x.id) && Array.isArray(x.pipe) && x.pipe.length >= 2 && x.pipe.every((id) => live.has(id)) && typeof x.job === 'string' && x.probe && typeof x.probe.in === 'string')
    .map((x) => ({ id: x.id, cat: String(x.cat || 'mixed').slice(0, 20), job: x.job.slice(0, 120), from: x.pipe.map((id) => 'bots/' + id), pipe: x.pipe, probe: { in: x.probe.in, want: null } }));
}

/** a grown bot's probe: the pipeline must run, answer something non-empty and different from its input; the answer it gives is then pinned */
export function pin(spec) { try { const out = compose({ ...spec, probe: { in: spec.probe.in } }).run(spec.probe.in); if (!out || String(out) === spec.probe.in || /NaN|undefined/.test(out)) return null; return { ...spec, probe: { in: spec.probe.in, want: String(out) } }; } catch (_) { return null; } }

async function grow(n) {
  const rows = gate(), live = new Set(rows.filter((r) => r.status === 'live').map((r) => r.id)), grown = read(GROWN, []);
  const menu = rows.filter((r) => r.status === 'live').map((r) => r.id + ': ' + r.job).join('\n');
  const text = await askAI('You build new bots for Verse by chaining existing bots. Existing bots:\n' + menu + '\n\nGaps people asked for:\n' + gaps().join('\n') + '\n\nPropose ' + n + ' NEW bots, each a pipeline of 2-3 existing bot ids whose output feeds the next. Answer only a JSON array: [{"id":"kebab-id","cat":"writing|code|math|money|media|research|ops|fun","job":"one line","pipe":["bot-a","bot-b"],"probe":{"in":"a realistic input for the first bot"}}]');
  if (!text) { console.log('grow: no Workers AI credentials (CF_ACCOUNT_ID, CF_API_TOKEN); nothing grown'); return 0; }
  const taken = new Set([...live, ...grown.map((g) => g.id)]); let added = 0;
  for (const spec of parseProposal(text, live)) { if (taken.has(spec.id)) continue; const p = pin(spec); if (p) { grown.push(p); taken.add(p.id); added++; } }
  writeFileSync(GROWN, '[\n' + grown.map((g) => JSON.stringify(g)).join(',\n') + '\n]\n'); return added;
}

function write() {
  const rows = gate(), live = rows.filter((r) => r.status === 'live').length;
  writeFileSync(REG, JSON.stringify({ about: 'Verse\'s bots. Live only when the probe passes on a real task (tools/bot-factory.mjs).', live, failed: rows.length - live, bots: rows }, null, 0).replace(/\},\{"id"/g, '},\n{"id"') + '\n');
  console.log('bot-factory: ' + live + ' live, ' + (rows.length - live) + ' failed');
  for (const r of rows.filter((x) => x.status !== 'live')) console.log('  failed ' + r.id + ': ' + r.why);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--grow');
  if (i > 0) console.log('grow: ' + (await grow(Math.min(20, Number(process.argv[i + 1]) || 5))) + ' new bots passed');
  write();
}
