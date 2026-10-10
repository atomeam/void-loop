// The learning queue's next entry (frontier #2; asked by Void, its daily reflection of 2026-10-09: "parse unanswered user
// questions into a structured 'Learning Queue' to automate skill acquisition"). Reads the miss board, groups what people
// typed by intent (their telling words), ranks the intents of the last 7 days by how much they were wanted
// (lib/learn.js score: how often, how recently, how many phrasings), and turns the top one into the work a run does next:
// a probe batch in tools/bench.json's shape (for `node tools/bench.mjs --probe`) and the files a skill for it touches,
// with a skill stub to start from. An intent a skill already covers by name is "extend", not a second skill.
// lib/learn.js queues single asks as jobs; this groups them, so five phrasings of one want become one skill.
// It only prints (or writes into --out, a folder outside the repo): misses are what people typed, and this repo is public.
//   node tools/next-skill.mjs                         the top intent from the live board (VOID_MISSES_TOKEN or VOID_OWNER_TOKEN)
//   node tools/next-skill.mjs --file rows.json        from a file of board rows instead
//   node tools/next-skill.mjs --top 5                 the five top intents, not just the next one
//   node tools/next-skill.mjs --out <dir>             also write <dir>/candidates.json (the probe batch) and <dir>/<slug>.js (the stub)
//   node tools/next-skill.mjs --json                  print as JSON
// Exit 0 with or without an intent; exit 3 when the board can't be read.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { learnable, score, DAYS } from '../void-live-deploy/lib/learn.js';
import { knownAsks } from './learn.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// the words that say what someone wanted: no question words, no filler, plurals folded ("Tides for Brighton?" -> tide, brighton)
const FILLER = new Set(('a an the is are was were be been am do does did can could will would should shall may might must i me my you your we our it its '
  + 'what whats when where which who whom whose why how many much there here this that these those of in on at to for from by with about into over '
  + 'and or but if then so not no yes please tell show give find get let make want need know like just some any all very really today tonight tomorrow yesterday '
  + 'now me us them they he she him her his hers').split(' '));
export function intentWords(ask) {
  return String(ask || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER.has(w) && !/^\d+$/.test(w))
    .map((w) => (w.length > 3 && /[^su]s$/.test(w) ? w.slice(0, -1) : w));
}

// greedy grouping, most-wanted asks first: an ask joins the first group it shares a telling word with, else starts one;
// a group is named by the word most of its asks share
export function groupByIntent(rows, { now = Date.now(), days = DAYS, known = new Set() } = {}) {
  const since = now - days * 864e5, asks = [];
  for (const r of rows || []) {
    const c = learnable(r);
    if (!c || (c.last && Date.parse(c.last) < since) || known.has(c.ask.toLowerCase())) continue;
    const words = intentWords(c.ask);
    if (words.length) asks.push({ ...c, words, score: score(c, now) });
  }
  asks.sort((a, b) => b.score - a.score || (a.ask < b.ask ? -1 : 1));
  const groups = [];
  for (const a of asks) {
    const g = groups.find((x) => a.words.some((w) => x.tally.has(w) && x.tally.get(w) * 2 >= x.asks.length));
    if (g) { g.asks.push(a); for (const w of new Set(a.words)) g.tally.set(w, (g.tally.get(w) || 0) + 1); }
    else groups.push({ asks: [a], tally: new Map([...new Set(a.words)].map((w) => [w, 1])) });
  }
  return groups.map((g) => {
    // ties go to the word the most-wanted ask says first ("weather tomorrow in lima" is weather, not lima)
    const at = (w) => { const i = g.asks[0].words.indexOf(w); return i < 0 ? 1e9 : i; };
    const [name] = [...g.tally].sort((x, y) => y[1] - x[1] || at(x[0]) - at(y[0]) || (x[0] < y[0] ? -1 : 1))[0];
    return { name, asks: g.asks.map(({ ask, count, last }) => ({ ask, count, last })), count: g.asks.reduce((s, a) => s + a.count, 0), score: g.asks.reduce((s, a) => s + a.score, 0) };
  }).sort((a, b) => b.score - a.score || b.count - a.count || (a.name < b.name ? -1 : 1));
}

export const slugOf = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
// the files a skill for this intent touches: an existing skill named by one of its words is extended, else a new one is added
export function filesFor(group, skills = []) {
  const existing = skills.find((s) => s === group.name || group.asks.some((a) => intentWords(a.ask).includes(s)));
  return existing ? [`void-live-deploy/skills/${existing}.js`, 'tools/bench.json']
    : [`void-live-deploy/skills/${slugOf(group.name)}.js`, 'void-live-deploy/skills/index.json', `tools/${slugOf(group.name)}.test.mjs`, 'tools/bench.json'];
}
export const probeBatch = (n) => n.asks.map((ask) => ({ ask, want: 'skill:' + (n.existing || n.slug) }));

export function nextSkill(rows, opts = {}) {
  const [g] = groupByIntent(rows, opts);
  if (!g) return null;
  const skills = opts.skills || [], files = filesFor(g, skills), existing = skills.includes(files[0].split('/').pop().replace(/\.js$/, '')) && files.length === 2 ? files[0].split('/').pop().replace(/\.js$/, '') : null;
  const n = { intent: g.name, slug: existing || slugOf(g.name), existing, count: g.count, phrasings: g.asks.length, asks: g.asks.map((a) => a.ask), files };
  n.probe = probeBatch(n);
  return n;
}

// a skill the stage can load, matching its own asks and nothing else, answering nothing until a run builds it
export function skillStub(n) {
  const words = [...new Set(n.asks.flatMap(intentWords))].filter((w) => w.length > 2);
  const core = n.intent.replace(/[^a-z0-9]/g, '');
  return `/**
 * ${n.slug} skill: STUB from tools/next-skill.mjs (the learning queue's next entry). People asked this ${n.count} times in
 * ${n.phrasings} phrasings in the last week and Void could not answer. Build run() so it answers them, give it near misses,
 * then probe: node tools/bench.mjs --probe candidates.json
 */
const WORDS = ${JSON.stringify(words)};
const CORE = /\\b${core}(?:e?s)?\\b/;
export function ${core}Of(text) { const t = String(text || '').toLowerCase(); return CORE.test(t) && WORDS.filter((w) => t.includes(w)).length >= 1; }

export default {
  name: ${JSON.stringify(n.slug)},
  examples: ${JSON.stringify(n.asks)},
  nearMisses: [],
  match(lower, text) { return ${core}Of(text); },
  async run(text, api) { return 'none'; }, // not built yet: until it answers, the ask still reaches the answer engine
};
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  let rows;
  try {
    if (opt('--file')) rows = JSON.parse(readFileSync(resolve(opt('--file')), 'utf8'));
    else {
      const tok = process.env.VOID_MISSES_TOKEN || process.env.VOID_OWNER_TOKEN;
      if (!tok) throw new Error('VOID_MISSES_TOKEN is not set in this environment (or pass --file rows.json)');
      const res = await fetch((process.env.VOID_SITE || 'https://a-to-mind.com') + '/api/misses', { headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-next-skill/1.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json(); rows = Array.isArray(j) ? j : j.rows || j.misses || [];
    }
  } catch (e) { console.error('next-skill: board not read: ' + (e.cause ? e.cause.code || e.cause.message : e.message)); process.exit(3); }
  const skills = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  const known = knownAsks(), top = +opt('--top') || 1;
  const groups = groupByIntent(rows, { known }).slice(0, top);
  const n = nextSkill(rows, { known, skills });
  if (args.includes('--json')) { console.log(JSON.stringify({ next: n, top: groups })); process.exit(0); }
  if (!n) { console.log('next-skill: nothing missed in the last ' + DAYS + ' days that is not already benched or beaten'); process.exit(0); }
  console.log(`next skill: ${n.existing ? 'extend "' + n.existing + '"' : 'new "' + n.slug + '"'} (intent "${n.intent}": ${n.count} misses in ${n.phrasings} phrasings, last ${DAYS} days)`);
  for (const a of n.asks) console.log('  - ' + a);
  console.log('files: ' + n.files.join(', '));
  if (top > 1) { console.log('\nnext after it:'); for (const g of groups.slice(1)) console.log(`  ${g.name}: ${g.count} misses, ${g.asks.length} phrasings`); }
  const out = opt('--out');
  if (out) {
    mkdirSync(resolve(out), { recursive: true });
    writeFileSync(join(resolve(out), 'candidates.json'), JSON.stringify(n.probe, null, 2) + '\n');
    if (!n.existing) writeFileSync(join(resolve(out), n.slug + '.js'), skillStub(n));
    console.log(`\nwrote ${join(out, 'candidates.json')}${n.existing ? '' : ' and ' + join(out, n.slug + '.js')} (outside the repo: these are visitors' words)`);
  }
}
