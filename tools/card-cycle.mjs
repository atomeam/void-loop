// The card cycle (owner, 2026-10-19: "since each card is minted Verse can constantly build on every card, so it can cycle through every single
// card and learn and improve and build based on what the card lacks and what the smartest thing to build is"). tools/lacks.mjs ranks the least
// proven skills, so the same weakest few came up every day and most cards never had a turn. The cycle walks every card of the book
// (skills/guide.json) in order from a kept cursor (tools/card-cycle.json), says what each card lacks from Verse's own records, and picks the one
// smartest thing to build for it. grow-self.yml takes the cycle's next cards beside the weakest ones and moves the cursor in its pull request.
//   node tools/card-cycle.mjs                  the next 5 cards: what each lacks and the smartest thing to build
//   node tools/card-cycle.mjs --n 10 --json    machine-readable        --all   every card that lacks something, worst first
//   node tools/card-cycle.mjs --advance [--n 5] move the cursor past the cards just shown (the workflow does this)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchedCount, tiersOf, THIN_LINE, MIN_EXAMPLES, PER_SKILL } from './lacks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CURSOR_FILE = resolve(root, 'tools/card-cycle.json');

// what to build, most useful first: a wrong answer beats a missing proof, a missing proof beats thin words
export const ACTIONS = [
  ['failing', 'fix', (c) => 'fix the asks the benchmark gets wrong: ' + c.failing.slice(0, 2).map((a) => '"' + a + '"').join(', ')],
  ['unbenched', 'bench', (c) => 'add its own example asks to the benchmark (it has none) and keep the ones that route to it'],
  ['experiment', 'test', (c) => 'write the first test that checks ' + c.name + ' does what its card says'],
  ['thin-bench', 'bench', (c) => 'add more benchmark asks (it has ' + c.benched + ')'],
  ['tested', 'test', (c) => 'add a browser check or a real ask so ' + c.name + ' moves past "tested"'],
  ['thin-line', 'words', (c) => 'rewrite the card\'s one line so it says what ' + c.name + ' does (' + c.lineLength + ' characters now)'],
  ['few-examples', 'words', (c) => 'give the card more example asks (' + c.examples + ' now)'],
  ['old-name', 'words', () => 'replace the old brand name on the card with Verse'],
];

/** what one card lacks, from Verse's own records: { name, kind, lacks: [key], failing, benched, ... }. Pure. */
export function audit(page, { benched = new Map(), tiers = new Map(), misses = new Map() } = {}) {
  const name = page.name, b = benched.get(name) || 0, tier = tiers.get(name) || page.tier || '';
  const line = String(page.line || '').trim(), examples = Array.isArray(page.examples) ? page.examples.length : 0;
  const failing = misses.get(name) || [], lacks = [];
  if (failing.length) lacks.push('failing');
  if (!b && examples) lacks.push('unbenched'); else if (b && b < PER_SKILL) lacks.push('thin-bench');
  if (tier === 'experiment') lacks.push('experiment'); else if (tier === 'tested') lacks.push('tested');
  if (line.length < THIN_LINE) lacks.push('thin-line');
  if (examples < MIN_EXAMPLES) lacks.push('few-examples');
  if (/\bV01[Dd]\b/.test(line + ' ' + (page.examples || []).join(' ') + ' ' + (page.title || ''))) lacks.push('old-name');
  return { name, kind: page.kind, title: page.title || name, tier, benched: b, examples, lineLength: line.length, failing, lacks };
}

/** the one smartest thing to build for an audited card: { kind, what }, or null when it lacks nothing. Pure. */
export function smartest(card) {
  for (const [key, kind, say] of ACTIONS) if (card.lacks.includes(key)) return { kind, what: say(card) };
  return null;
}

/** every card the cycle visits: the skill pages of the book, in the book's order. Pure. */
export const cardsOf = (guide) => (guide && Array.isArray(guide.pages) ? guide.pages : []).filter((p) => p && p.kind === 'skill' && typeof p.name === 'string');

/** the next n cards from the cursor that lack something (wrapping round the book), and where the cursor goes after them. Pure. */
export function next(cards, audits, cursor, n = 5) {
  const N = cards.length; if (!N) return { picks: [], cursor: 0 };
  let i = ((cursor | 0) % N + N) % N; const picks = [];
  for (let k = 0; k < N && picks.length < n; k++, i = (i + 1) % N) { const a = audits.get(cards[i].name); if (a && a.lacks.length) picks.push({ ...a, at: i, build: smartest(a) }); }
  return { picks, cursor: i };
}

/** the benchmark's misses by the skill that should have answered: Map(name -> [ask]). Pure. */
export function missesBySkill(file) {
  const out = new Map();
  for (const m of (file && Array.isArray(file.misses) ? file.misses : [])) { const x = /^(.*) -> skill:([a-z0-9-]+)$/.exec(String(m)); if (x) out.set(x[2], (out.get(x[2]) || []).concat(x[1])); }
  return out;
}

const readJson = (p, d) => { try { return JSON.parse(readFileSync(resolve(root, p), 'utf8')); } catch (_) { return d; } };
export function load() {
  const guide = readJson('void-live-deploy/skills/guide.json', {}), bench = readJson('tools/bench.json', []);
  const ctx = { benched: benchedCount(bench), tiers: tiersOf(readJson('void-live-deploy/skills/families.json', {})), misses: missesBySkill(readJson('tools/bench.misses.json', {})) };
  const cards = cardsOf(guide), audits = new Map(cards.map((c) => [c.name, audit(c, ctx)]));
  return { cards, audits, cursor: (readJson('tools/card-cycle.json', {}) || {}).cursor | 0 };
}

function main(argv) {
  const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
  const n = Math.max(1, parseInt(opt('--n', '5'), 10) || 5), { cards, audits, cursor } = load();
  const lacking = [...audits.values()].filter((a) => a.lacks.length);
  if (argv.includes('--all')) { for (const a of lacking.sort((x, y) => ACTIONS.findIndex(([k]) => x.lacks.includes(k)) - ACTIONS.findIndex(([k]) => y.lacks.includes(k)))) console.log(a.name.padEnd(22) + (smartest(a) || {}).what); return 0; }
  const r = next(cards, audits, cursor, n);
  if (argv.includes('--json')) { console.log(JSON.stringify({ cursor, next: r.cursor, of: cards.length, lacking: lacking.length, picks: r.picks }, null, 1)); }
  else {
    console.log('card cycle: ' + cards.length + ' cards, ' + lacking.length + ' lack something; at card ' + (cursor + 1));
    for (const p of r.picks) console.log('  ' + String(p.at + 1).padStart(3) + ' ' + p.title + ' (' + p.name + ') lacks: ' + p.lacks.join(', ') + '\n        build: ' + p.build.what);
  }
  if (argv.includes('--advance')) writeFileSync(CURSOR_FILE, JSON.stringify({ cursor: r.cursor, note: 'the card cycle\'s place in the book (tools/card-cycle.mjs); grow-self.yml moves it' }, null, 1) + '\n');
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
