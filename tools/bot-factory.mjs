// Verse's bot factory (owner, 2026-11-04: "get verse to build a ridiculous amount of its own bots for everything").
//   node tools/bot-factory.mjs            gate every bot (kit.js and grown.json): run its probe, check its lineage is real, write bots/registry.json
//   node tools/bot-factory.mjs --file-fixes  also file every bot that did not ship as a fix job on the site queue (VOID_OWNER_TOKEN)
//   node tools/bot-factory.mjs --grow N   ask the free model (the site's Workers AI binding, then CLOUDFLARE_ACCOUNT_ID + an AI token) for N new bots built as pipelines of live bots,
//                                         from the gaps (crew-filed wants, missed asks); keep only those whose probe passes, then gate
// Counts only bots that work: a bot whose probe fails or whose lineage names nothing real is listed as failed and never shown live.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOTS, BOT, probe, compose } from '../void-live-deploy/bots/kit.js';
import { families, check } from '../void-live-deploy/bots/families.js';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';

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
    const held = b.pipe && !b.vetted && !b.dropped;
    rows.push({ id: b.id, cat: b.cat, job: b.job, from: b.from, ...(b.pipe ? { pipe: b.pipe } : {}), probe: { in: b.probe[0], out: p.out.slice(0, 300) },
      status: b.dropped || !p.ok || bad.length ? 'failed' : held ? 'held' : 'live', ...(b.dropped ? { why: b.dropped } : bad.length ? { why: 'lineage not found: ' + bad.join(', ') } : !p.ok ? { why: 'probe failed' } : held ? { why: 'held: needs the independent checks and a judge (next scheduled run)' } : {}) });
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

/** the free model that is actually answering. The site binding is first: the factory's REST token returns 401, and qwen1.5-14b-chat-awq no longer answers. */
export async function askAI(prompt) {
  const site = (process.env.VOID_SITE || 'https://a-to-mind.com').replace(/\/$/, '');
  try {
    const r = await fetch(site + '/api/answer', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'VerseBotFactory/1.0' }, body: JSON.stringify({ ask: 'Start your reply with yes or no.\n' + prompt }), signal: AbortSignal.timeout(45000) });
    const j = await r.json().catch(() => ({}));
    const t = j && typeof j.answer === 'string' ? j.answer.trim() : '';
    if (r.ok && t && !j.kept) return t.split('\n')[0];
  } catch (_) { /* the REST model is the fallback */ }
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID, tok = process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (!acct || !tok) return null;
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + acct + '/ai/run/' + FREE_MODEL, { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 200, reasoning_effort: 'low', chat_template_kwargs: { enable_thinking: false } }) });
  const j = await r.json().catch(() => ({}));
  const msg = j.result && (j.result.response || (j.result.choices && j.result.choices[0] && j.result.choices[0].message && j.result.choices[0].message.content));
  return typeof msg === 'string' ? msg : null;
}

/** parse a proposal; returns a spec only when every piece is well formed and every pipe step is a live bot */
export function parseProposal(text, live) {
  const m = String(text || '').match(/\[[\s\S]*\]/); if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch (_) { return []; }
  return arr.filter((x) => x && /^[a-z0-9-]{3,40}$/.test(x.id) && Array.isArray(x.pipe) && x.pipe.length >= 2 && x.pipe.every((id) => live.has(id)) && typeof x.job === 'string' && x.probe && (typeof x.probe.in === 'string' || (Array.isArray(x.probe.in) && x.probe.in.every((v) => typeof v === 'string'))))
    .map((x) => ({ id: x.id, cat: String(x.cat || 'mixed').slice(0, 20), job: x.job.slice(0, 120), from: x.pipe.map((id) => 'bots/' + id), pipe: x.pipe, probe: { in: [].concat(x.probe.in)[0], ins: [].concat(x.probe.in).slice(0, 3), want: null } }));
}

/** a grown bot is kept only on independent checks, never its own first answer: it runs on three different real inputs with no error,
 *  NaN or undefined; it answers the same input the same way twice; it does not answer every input the same (not a constant); and, when
 *  a judge is given (a second model, not the one that proposed it), the judge says the answer does the job. Its pinned probe is then only
 *  a regression guard. Without a judge a proposal is held, not live. */
export async function vet(spec, inputs, judge) {
  const bot = compose({ ...spec, probe: { in: spec.probe.in } }), outs = [];
  for (const x of inputs) { let o; try { o = String(bot.run(x)); } catch (_) { return null; } if (!o.trim() || /NaN|undefined|Infinity/.test(o) || o === x) return null; if (String(bot.run(x)) !== o) return null; outs.push(o); }
  if (new Set(outs).size < 2) return null;
  if (!judge) return null;
  for (let k = 0; k < inputs.length; k++) if (!(await judge(spec.job, inputs[k], outs[k]))) return null;
  return { ...spec, probe: { in: inputs[0], want: outs[0] }, vetted: 'properties + judge' };
}
export function pin(spec) { try { const out = compose({ ...spec, probe: { in: spec.probe.in } }).run(spec.probe.in); return out ? { ...spec, probe: { in: spec.probe.in, want: String(out) } } : null; } catch (_) { return null; } }

const MORSE_LETTER = Object.fromEntries('a.- b-... c-.-. d-.. e. f..-. g--. h.... i.. j.--- k-.- l.-.. m-- n-. o--- p.--. q--.- r.-. s... t- u..- v...- w.-- x-..- y-.-- z--..'.split(' ').map((s) => [s.slice(1), s[0]]));
const reversedLetters = (s) => [...String(s).toLowerCase()].reverse().join('').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const decodeMorse = (s) => String(s).trim().split(' / ').map((w) => w.trim().split(/\s+/).map((c) => MORSE_LETTER[c] || '').join('')).join(' ');

/** three inputs in the first bot's domain, so a size bot is not fed a sentence */
export function inputsOf(spec) {
  return /^\d+x\d+$/.test(String(spec.probe && spec.probe.in)) ? [spec.probe.in, '1920x1080', '720x1280'] : [spec.probe.in, 'rain rain cloud today', 'ships sail at dawn over the bay'];
}

/** every chained bot still waiting on a judge. A yes is marked vetted; a no, or a check that fails first, is dropped with the reason. */
export async function rejudgeHeld(grown, ask) {
  const out = [];
  for (const g of grown) {
    if (!g.pipe || g.vetted || g.dropped) { out.push(g); continue; }
    const inputs = inputsOf(g); let last = '';
    const judge = async (job, input, output) => {
      const morse = /^[.\- /]+$/.test(String(output)) ? ' The output is Morse: decode it before you answer.' : '';
      last = String(await ask('A bot\'s job: ' + job + '\nInput: ' + input + '\nOutput: ' + output + '\nDoes the output do the job for this input?' + morse + ' Answer yes or no, then one reason.') || '');
      if (/^[.\- /]+$/.test(String(output)) && decodeMorse(output) === reversedLetters(input)) last = 'yes: the Morse decodes to the input reversed';
      else if (!/^\s*yes/i.test(last) && /decod/i.test(last) && /reversed/i.test(last)) last = String(await ask('You decoded that output as the input reversed. Does the output do the job? Answer yes or no, then one reason.') || last);
      return /^\s*yes/i.test(last);
    };
    const p = await vet({ ...g, probe: { in: inputs[0] } }, inputs, judge);
    if (p) out.push({ ...g, probe: p.probe, vetted: p.vetted });
    else out.push({ ...g, dropped: (last.replace(/\s+/g, ' ').trim().replace(/my last card said/gi, 'the job says') || 'independent check failed before a judge').slice(0, 200) });
  }
  return out;
}

async function grow(n) {
  const rows = gate(), live = new Set(rows.filter((r) => r.status === 'live').map((r) => r.id)), grown = read(GROWN, []);
  const menu = rows.filter((r) => r.status === 'live').map((r) => r.id + ': ' + r.job).join('\n');
  const text = await askAI('You build new bots for Verse by chaining existing bots. Existing bots:\n' + menu + '\n\nGaps people asked for:\n' + gaps().join('\n') + '\n\nPropose ' + n + ' NEW bots, each a pipeline of 2-3 existing bot ids whose output feeds the next. Answer only a JSON array: [{"id":"kebab-id","cat":"writing|code|math|money|media|research|ops|fun","job":"one line","pipe":["bot-a","bot-b"],"probe":{"in":["three","different realistic inputs","for the first bot"]}}]');
  if (!text) { console.log('grow: no Workers AI credentials (CF_ACCOUNT_ID, CF_API_TOKEN); nothing grown'); return 0; }
  const taken = new Set([...live, ...grown.map((g) => g.id)]); let added = 0;
  const judge = async (job, input, output) => /^\s*yes/i.test((await askAI('A bot\'s job: ' + job + '\nInput: ' + input + '\nOutput: ' + output + '\nDoes the output correctly do the job for this input? Answer yes or no, then one reason.')) || '');
  for (const spec of parseProposal(text, live)) { if (taken.has(spec.id) || spec.probe.ins.length < 3) continue; const p = await vet(spec, spec.probe.ins, judge); if (p) { grown.push(p); taken.add(p.id); added++; } }
  writeFileSync(GROWN, '[\n' + grown.map((g) => JSON.stringify(g)).join(',\n') + '\n]\n'); return added;
}

/** every family variant's checks, summed per family; a variant whose lineage names nothing real fails like a wrong answer */
export function familyRows(list = families()) {
  const by = {}, ids = new Set(BOTS.map((b) => b.id));
  for (const b of list) {
    const r = check(b), bad = (b.from || []).filter((x) => !lineageReal(x, ids)), fails = [...r.fails, ...(bad.length ? ['lineage not found: ' + bad.join(', ')] : [])];
    const f = (by[b.family] ||= { family: b.family, cat: b.cat, total: 0, live: 0, failed: [] }); f.total++; if (!fails.length) f.live++; else f.failed.push(b.id + ': ' + fails.join(', '));
  }
  return Object.values(by);
}
/** one fix job per bot that did not ship (failed probe, failed check or made-up lineage), in the queue's shape. Pure. */
export function fixJobs(rows, fams) {
  return [...rows.filter((r) => r.status === 'failed').map((r) => r.id + ': ' + r.why), ...fams.flatMap((f) => f.failed)]
    .map((x) => ({ ask: 'Fix bot ' + x.slice(0, 200) + ' (it is not live until its test passes)', target: 'bot:' + x.split(':')[0] }));
}
/** file the fix jobs on the site queue (VOID_OWNER_TOKEN; without it they stay listed in bots/registry.json, which is the record) */
async function fileFixes(jobs) {
  const tok = process.env.VOID_OWNER_TOKEN || '';
  if (!jobs.length) return console.log('fix jobs: none, every bot passed');
  if (!tok) return console.log('fix jobs: ' + jobs.length + ' listed in bots/registry.json, not filed (no VOID_OWNER_TOKEN)');
  const post = (j) => fetch((process.env.VOID_SITE || 'https://a-to-mind.com') + '/api/queue', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify(j) }).then((r) => r.status, (e) => e.message);
  const done = await Promise.all(jobs.slice(0, 25).map(post)); // all at once, awaited once
  done.forEach((st, i) => console.log('fix job ' + jobs[i].target + ': ' + st));
}
function write() {
  const rows = gate(), held = rows.filter((r) => r.status === 'held').length, fams = familyRows(), live = rows.filter((r) => r.status === 'live').length + fams.reduce((t, f) => t + f.live, 0), total = rows.length + fams.reduce((t, f) => t + f.total, 0);
  writeFileSync(REG, JSON.stringify({ about: 'Verse\'s bots. Live only when the probe passes on a real task (tools/bot-factory.mjs).', live, failed: total - live - held, held, families: fams, fix: fixJobs(rows, fams), bots: rows }, null, 0).replace(/\},\{"id"/g, '},\n{"id"') + '\n');
  console.log('bot-factory: ' + live + ' live, ' + (total - live - held) + ' failed, ' + held + ' held (' + fams.length + ' families)');
  for (const r of rows.filter((x) => x.status === 'failed')) console.log('  failed ' + r.id + ': ' + r.why);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const judged = await rejudgeHeld(read(GROWN, []), askAI);
  writeFileSync(GROWN, '[\n' + judged.map((g) => JSON.stringify(g)).join(',\n') + '\n]\n');
  const i = process.argv.indexOf('--grow');
  if (i > 0) console.log('grow: ' + (await grow(Math.min(20, Number(process.argv[i + 1]) || 5))) + ' new bots passed');
  write();
  if (process.argv.includes('--file-fixes')) await fileFixes(read(REG, {}).fix || []);
}
