// The fringe-engine ledger: one family per hourly run, built as a draft (drafts/fringe/<family>.html).
// tools/fringe.json is the record: [{run, at, family, draft, sources:[{claim, source, confidence}], sha256, emit}].
// emit:true wires the draft into Void: `--publish` copies it to void-live-deploy/fringe/<family>.html minus the
// "draft · not published" label, and the check holds the live copy to exactly that.
// Rules (Adam, 2026-10-02; variety rule 47ca3de on a-to-mind.com master):
//   - one family per run, from FAMILIES; a family may not repeat within the last six runs
//   - sources stay hypotheses: each carries a confidence (confirmed | claim | open); a draft never states contact, healing,
//     remote viewing or extraterrestrial hardware as attested fact
//   - drafts are noindex and live under drafts/; one ships only through emit:true + --publish
//     (Adam, 2026-10-03: "why do you think we built them")
//   - the sha256 in the ledger must match the draft on disk, so a draft can't change silently after it was recorded
//   node tools/fringe.mjs          checks the ledger (exit 1 on any broken rule); CI runs this
//   node tools/fringe.mjs --next   prints the families the next run may pick
//   node tools/fringe.mjs --hash drafts/fringe/x.html   prints the sha256 to record
//   node tools/fringe.mjs --rehash drafts/fringe/x.html refreshes a recorded draft's sha256 after a review fix
//   node tools/fringe.mjs --publish  writes the live copy of every emit:true draft
//   node tools/fringe.mjs --record drafts/fringe/x.html sources.json   appends the next run (family from the file name,
//     run number, time, sha256, emit:false) in the ledger's own 2-space style, then checks the ledger. sources.json is the
//     sources array, or { sources, hypothesis, behavior, findings, failure_modes, next_experiments, combines } (the research notes)
//   node tools/fringe.mjs --input-tag <skill> "<ask>"   the near-miss tag for the input that set a novelty or failure off (asked by Void)
//   node tools/fringe.mjs --suggest-near routes.json   the router's near-miss rows (the owner's /api/routes) matched to the last runs' notes
//   node tools/fringe.mjs --learned   what the ledger has learned, for the next run to read first: recent findings, failure
//     modes and next experiments, what the core needs (Void's open asks, failing or unchecked skills, benchmark and people's
//     misses), and pairs of published families no run has combined yet
// The research notes (owner, 2026-10-13: the ledger becomes a research engine that compounds: "every run should leave Void
// with at least one durable asset"; optional, so the first 73 runs stand as written, append-only):
//   hypothesis        what the run set out to show
//   behavior          what a person can do with the draft, in one line: novelty is judged on it, not on the family's name
//                     (a behavior that says nearly what an earlier run's said is refused)
//   findings          what the run showed, each a line
//   failure_modes     [{ what, evidence }]: what failed and what shows it, so the next run does not repeat it
//   next_experiments  what to try next
//   combines          other families this run joins with its own (the combination map is read off these)
//   near              the miss-board target or router skill the run was built toward ("skill:weather", "probe:sky", "miss-board",
//                     "step:14"), one or a list; --learned shows them, and the "fringe to skill" card links the family to the skill
//                     (asked by Void, ask-20261013-1719-1: tag each novelty or failure with the input that triggered it)
//   lab               { label, sub, asks: [phrases] }: how a published draft is opened from the stage. --publish writes
//                     void-live-deploy/fringe/lab.json from these and skills/make.js reads it, so a draft that ships reaches
//                     people without anyone editing the lab list by hand (the fringe → core loop, owner's direction 2026-10-13)
//   --publish also writes void-live-deploy/fringe/ledger.json: each published family with its research notes, what it was built
//   toward and the core skills its notes name (ledgerOf), for the "fringe to skill" card (skills/fringe-to-skill.js; asked by Void,
//   ask-20261013-0026-2: "a dashboard that visualizes the relationship between a fringe experiment and its potential as a
//   permanent skill")
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FAMILIES = ['attention', 'interval-timing', 'sensory-substitution', 'private-incubation-log',
  'weak-signal-hypothesis-ledger', 'human-machine-co-agency', 'opt-in-gesture', 'miss-board', 'correlation-view',
  'anomalous-event-timeline', 'quiet-signal-filter', 'non-lexical-intent'];
const WINDOW = 6;
const CONFIDENCE = ['confirmed', 'claim', 'open'];
// Attested-fact phrasing for the subjects that must stay hypotheses. Labelled mentions ("CLAIM: … contact") are fine;
// these patterns catch the drafts asserting it.
const ATTESTED = [
  /\bwe now know\b/i,
  /\b(?:proven|confirmed|verified|established)\s+(?:alien|extraterrestrial|non-human|ET)\b/i,
  /\b(?:alien|extraterrestrial|non-human)\s+(?:contact|craft|hardware|technology)\s+(?:is|are|has been|have been)\s+(?:real|proven|confirmed|verified)\b/i,
  /\bremote viewing\s+(?:works|is real|is proven|has been proven)\b/i,
  /\b(?:heals|cures)\s+(?:you|any|all)\b/i,
];

const hash = (p) => createHash('sha256').update(readFileSync(resolve(root, p))).digest('hex');
// the live copy is named after the draft file, so a family's second draft (drafts/fringe/<family>-2.html) gets its own page
export const live = (r) => `void-live-deploy/fringe/${String(r.draft || '').split('/').pop() || r.family + '.html'}`;
export const published = (html) => html.replace(/ · draft · not published/g, '').replace(/ \(draft\)<\/title>/g, '</title>')
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base target="_blank">'); // shown in a frame: source links open a tab
const load = () => JSON.parse(readFileSync(resolve(root, 'tools/fringe.json'), 'utf8'));

// two behaviors are the same when 70% of the shorter one's content words are in the other (word stems, stop words left out)
const STOP = new Set('the a an and or of to for in on at by with from into that this it its is are be as can you your a person someone'.split(' '));
export const words = (t) => [...new Set(String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, '')))];
export function sameBehavior(a, b) { const x = words(a), y = new Set(words(b)); if (x.length < 3 || y.size < 3) return false; return x.filter((w) => y.has(w)).length / Math.min(x.length, y.size) >= 0.7; }

// What the core needs (owner, 2026-10-13: "if you want void to be truly self-sustaining, you need to focus on the feedback loops
// between the fringe experiments and the core"): the demand a run should build toward, read from the repo where the hourly run
// can see it. Void's own open asks (domains/void.voice.md), the skills failing on the benchmark or least checked
// (void-live-deploy/skills/families.json), the asks the benchmark got wrong (tools/bench.misses.json) and what people asked
// that Void could not answer (domains/void.misses.json, the public snapshot, when it is written). A source that is missing is
// left out. Pure apart from the reads.
export function demand(read = (p) => readFileSync(resolve(root, p), 'utf8'), n = 5) {
  const out = { asks: [], friction: [], bench: [], misses: [] };
  try {
    const m = /## Void's current asks\n\n([\s\S]*?)\n\n## /.exec(read('domains/void.voice.md'));
    if (m) out.asks = m[1].split('\n').map((l) => /^- (.+?)(?: \*\(small\)\*)? \((?:daily|after a build)/.exec(l)).filter(Boolean).map((x) => x[1]).slice(0, n);
  } catch (_) {}
  try {
    const all = (JSON.parse(read('void-live-deploy/skills/families.json')).families || []).flatMap((f) => f.skills || []);
    out.friction = all.filter((s) => s.failing && s.failing.length).map((s) => s.name + ': failing ' + s.failing.length + ' benchmark ask' + (s.failing.length > 1 ? 's' : ''))
      .concat(all.filter((s) => s.tier === 'experiment').map((s) => s.name + ': nothing checks it yet')).slice(0, n);
  } catch (_) {}
  try { const b = JSON.parse(read('tools/bench.misses.json')); out.bench = Array.isArray(b.misses) ? b.misses.slice(0, n) : []; } catch (_) {}
  try {
    const j = JSON.parse(read('domains/void.misses.json')), rows = Array.isArray(j) ? j : j.misses || j.top || [];
    out.misses = rows.map((r) => (typeof r === 'string' ? r : r && (r.ask || r.text))).filter(Boolean).slice(0, n);
  } catch (_) {}
  return out;
}

/** what the ledger has learned, for the next run to read first. Pure. */
export function learned(runs = load(), recent = WINDOW) {
  const last = runs.slice(-recent);
  const pick = (k) => last.flatMap((r) => (Array.isArray(r[k]) ? r[k].map((x) => ({ run: r.run, family: r.family, x })) : []));
  const pub = [...new Set(runs.filter((r) => r.emit === true).map((r) => r.family))].sort();
  const done = new Set(runs.flatMap((r) => (Array.isArray(r.combines) ? r.combines.map((f) => [r.family, f].sort().join('+')) : [])));
  const untried = [];
  for (let a = 0; a < pub.length; a++) for (let b = a + 1; b < pub.length; b++) if (!done.has(pub[a] + '+' + pub[b])) untried.push([pub[a], pub[b]]);
  // the pairs the next run can actually take first (one of its families in them), each family as evenly as possible
  const may = new Set(next(runs)), seen = {}, ordered = [];
  const pool = untried.slice().sort((p, q) => (may.has(q[0]) || may.has(q[1])) - (may.has(p[0]) || may.has(p[1])));
  while (pool.length) {
    let best = 0, score = Infinity;
    pool.forEach((pr, k) => { const sc = (seen[pr[0]] || 0) + (seen[pr[1]] || 0) + (may.has(pr[0]) || may.has(pr[1]) ? 0 : 100); if (sc < score) { score = sc; best = k; } });
    const [pr] = pool.splice(best, 1); ordered.push(pr); seen[pr[0]] = (seen[pr[0]] || 0) + 1; seen[pr[1]] = (seen[pr[1]] || 0) + 1;
  }
  const untagged = runs.filter((r) => (r.behavior || (r.failure_modes || []).length) && !nearOf(r).length && !(r.failure_modes || []).every((f) => f && f.input)).length;
  const near = runs.filter((r) => nearOf(r).length).map((r) => ({ run: r.run, family: r.family, x: nearOf(r).join(', ') }));
  return { untagged, near, findings: pick('findings'), failures: pick('failure_modes'), next: pick('next_experiments'), behaviors: runs.filter((r) => r.behavior).map((r) => ({ run: r.run, family: r.family, x: r.behavior })), untried: ordered, noted: runs.filter((r) => r.hypothesis || r.behavior || r.findings).length };
}

const labOk = (l) => !!l && typeof l.label === 'string' && l.label.trim() && l.label.length <= 40 && typeof l.sub === 'string' && l.sub.trim() && l.sub.length <= 160
  && Array.isArray(l.asks) && l.asks.length >= 1 && l.asks.length <= 6 && l.asks.every((a) => typeof a === 'string' && /^[a-z0-9' -]{3,60}$/.test(a));
export const LAB = 'void-live-deploy/fringe/lab.json';
/** the lab entries the published runs carry, newest run of each draft winning. Pure. */
export function labOf(runs = load()) {
  const byId = new Map();
  for (const r of runs) if (r && r.emit === true && r.lab && labOk(r.lab)) byId.set(live(r).split('/').pop().replace(/\.html$/, ''), { id: live(r).split('/').pop().replace(/\.html$/, ''), label: r.lab.label, sub: r.lab.sub, asks: r.lab.asks });
  return [...byId.values()];
}
/** published drafts nobody can open: not in skills/make.js's lab list and with no lab entry */
export function unreachable(runs = load(), makeSrc = readFileSync(resolve(root, 'void-live-deploy/skills/make.js'), 'utf8')) {
  const listed = new Set([...makeSrc.matchAll(/'(?:[^'\\]|\\.)*', '([a-z0-9-]+)', '/g)].map((m) => m[1])), lab = new Set(labOf(runs).map((x) => x.id));
  return [...new Set(runs.filter((r) => r && r.emit === true).map((r) => live(r).split('/').pop().replace(/\.html$/, '')))].filter((id) => !listed.has(id) && !lab.has(id));
}

const NEAR = /^[a-z0-9][a-z0-9:_.-]{0,79}$/;
/** what a run was built toward, as a list of targets (near: one string or a list; anything else is nothing). Pure. */
export function nearOf(r) {
  const xs = r && r.near !== undefined ? (Array.isArray(r.near) ? r.near : [r.near]) : [];
  return xs.every((x) => typeof x === 'string' && NEAR.test(x)) ? xs : [];
}
/** The input that set a novelty or failure off, as a tag a run puts in `near` (or on a failure_mode as `input`): near-miss:<skill>:<8 hex>,
 * the skill the router came closest to and a hash of the ask it came closest on (asked by Void: "Link the fringe ledger entries to the
 * 'near-miss' router data so that every novelty or failure is tagged with the specific input that triggered it"). The ask's words are
 * the person's and stay in the router's own log (/api/routes, owner only); the hash lets the owner find the very row. Pure. */
export function inputTag(skill, ask) {
  const n = String(ask || '').toLowerCase().replace(/\s+/g, ' ').trim(), s = String(skill || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  return s && n ? 'near-miss:' + s + ':' + createHash('sha256').update(n).digest('hex').slice(0, 8) : '';
}
/** The tags a run's research notes earn from the router's near-miss rows (readRoutes(...).close: { skill: [{ ask, count, score }] }): a row whose
 * ask shares at least two content words with the run's behavior, hypothesis, findings or a failure. [{ tag, skill, shared }], most shared first. Pure. */
export function suggestInputs(run, close) {
  const text = [run && run.behavior, run && run.hypothesis, ...((run && run.findings) || []), ...(((run && run.failure_modes) || []).map((f) => f && f.what))].filter(Boolean).join(' ');
  const w = new Set(words(text)), out = [];
  for (const [skill, rows] of Object.entries(close || {})) for (const r of rows || []) {
    const shared = words(r && r.ask).filter((x) => w.has(x)); if (shared.length < 2) continue;
    const tag = inputTag(skill, r.ask); if (tag && !out.some((o) => o.tag === tag)) out.push({ tag, skill, shared });
  }
  return out.sort((a, b) => b.shared.length - a.shared.length);
}
/** the core skill a target names: skill:weather -> weather, a bare skill name -> itself, else null. Pure. */
export const skillOfTarget = (t, skills) => { const m = /^skill:([a-z0-9-]+)$/.exec(String(t || '')); const n = m ? m[1] : String(t || ''); return skills.includes(n) ? n : null; };
/** the core skills a run's notes name: skills/<n>.js, skill:<n>, "<n> skill", "the <n> card", and its near targets. Pure. */
export function skillsNamed(r, skills) {
  const text = [r.hypothesis, r.behavior, ...(r.findings || []), ...(r.next_experiments || []), ...((r.failure_modes || []).map((f) => f && f.what))].filter(Boolean).join('\n');
  const esc = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = skills.filter((n) => new RegExp('skills/' + esc(n) + '\\.js|skill:' + esc(n) + '\\b|\\b' + esc(n) + ' skill\\b|\\bthe ' + esc(n) + ' card\\b', 'i').test(text));
  for (const t of nearOf(r)) { const n = skillOfTarget(t, skills); if (n && !out.includes(n)) out.push(n); }
  return out;
}
export const LEDGER = 'void-live-deploy/fringe/ledger.json';
/** the published families for the "fringe to skill" card: each with its live drafts, notes merged newest first, what it was built
 * toward and the core skills its notes name. tools: [{ id, label, sub }] from skills/make.js toolList(), to label each draft. Pure. */
export function ledgerOf(runs = load(), skills = [], tools = []) {
  const byId = new Map(tools.map((t) => [t.id, t])), fams = new Map();
  for (const r of runs.slice().reverse()) {
    if (!r || r.emit !== true) continue;
    const id = live(r).split('/').pop().replace(/\.html$/, ''), f = fams.get(r.family) || { family: r.family, runs: 0, drafts: [], hypothesis: '', behavior: '', findings: [], failures: [], next: [], combines: [], near: [], skills: [], noted: 0 };
    f.runs++;
    if (!f.drafts.some((d) => d.id === id)) f.drafts.push({ id, run: r.run, at: String(r.at || '').slice(0, 10), label: (r.lab && r.lab.label) || (byId.get(id) || {}).label || '', sub: (r.lab && r.lab.sub) || (byId.get(id) || {}).sub || '' });
    if (r.hypothesis || r.behavior || r.findings) f.noted++;
    if (!f.hypothesis && r.hypothesis) f.hypothesis = r.hypothesis;
    if (!f.behavior && r.behavior) f.behavior = r.behavior;
    const add = (k, xs) => { for (const x of xs || []) if (x && !f[k].some((y) => JSON.stringify(y) === JSON.stringify(x))) f[k].push(x); };
    add('findings', r.findings); add('failures', r.failure_modes); add('next', r.next_experiments); add('combines', r.combines); add('near', nearOf(r)); add('skills', skillsNamed(r, skills));
    fams.set(r.family, f);
  }
  return [...fams.values()];
}

export function check(runs = load()) {
  const bad = [];
  if (!Array.isArray(runs)) return ['tools/fringe.json must be an array of runs'];
  runs.forEach((r, i) => {
    const at = `run ${r && r.run != null ? r.run : i + 1}`;
    if (!r || typeof r !== 'object') { bad.push(`${at}: not an object`); return; }
    if (r.run !== i + 1) bad.push(`${at}: runs must be numbered 1, 2, 3… in order (expected ${i + 1})`);
    if (!FAMILIES.includes(r.family)) bad.push(`${at}: unknown family "${r.family}"`);
    const recent = runs.slice(Math.max(0, i - WINDOW), i).map((x) => x && x.family);
    if (recent.includes(r.family)) bad.push(`${at}: "${r.family}" repeats within the last ${WINDOW} runs`);
    if (typeof r.emit !== 'boolean') bad.push(`${at}: emit must be true or false`);
    if (typeof r.draft !== 'string' || !/^drafts\/fringe\/[a-z0-9-]+\.html$/.test(r.draft)) bad.push(`${at}: draft must be drafts/fringe/<name>.html`);
    else if (!existsSync(resolve(root, r.draft))) bad.push(`${at}: ${r.draft} is missing`);
    else {
      if (hash(r.draft) !== r.sha256) bad.push(`${at}: sha256 does not match ${r.draft} (re-record it if the change is intended)`);
      const html = readFileSync(resolve(root, r.draft), 'utf8');
      if (!/<meta\s+name="robots"\s+content="noindex/i.test(html)) bad.push(`${at}: ${r.draft} needs <meta name="robots" content="noindex, nofollow">`);
      const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
      for (const re of ATTESTED) if (re.test(text)) bad.push(`${at}: ${r.draft} states a hypothesis as fact (${re})`);
      const lp = resolve(root, live(r));
      if (r.emit === true && (!existsSync(lp) || readFileSync(lp, 'utf8') !== published(html))) bad.push(`${at}: ${live(r)} must equal the published draft (run --publish)`);
      if (r.emit === false && existsSync(lp)) bad.push(`${at}: ${live(r)} is live but emit is false`);
    }
    for (const k of ['hypothesis', 'behavior']) if (k in r && (typeof r[k] !== 'string' || !r[k].trim() || r[k].length > 400)) bad.push(`${at}: ${k} must be a line of text (400 characters at most)`);
    for (const k of ['findings', 'next_experiments']) if (k in r && (!Array.isArray(r[k]) || r[k].some((x) => typeof x !== 'string' || !x.trim()))) bad.push(`${at}: ${k} must be a list of lines`);
    if ('failure_modes' in r && (!Array.isArray(r.failure_modes) || r.failure_modes.some((x) => !x || typeof x.what !== 'string' || typeof x.evidence !== 'string' || !x.what.trim() || !x.evidence.trim()))) bad.push(`${at}: failure_modes must be a list of { what, evidence }`);
    if (Array.isArray(r.failure_modes) && r.failure_modes.some((x) => x && 'input' in x && !(typeof x.input === 'string' && NEAR.test(x.input)))) bad.push(`${at}: a failure_mode's input must be a tag like near-miss:weather:1a2b3c4d (node tools/fringe.mjs --input-tag <skill> "<ask>")`);
    if ('lab' in r && !labOk(r.lab)) bad.push(`${at}: lab must be { label (40 characters at most), sub (160 at most), asks: 1 to 6 lowercase phrases }`);
    if ('combines' in r && (!Array.isArray(r.combines) || r.combines.some((f) => !FAMILIES.includes(f) || f === r.family))) bad.push(`${at}: combines must list other known families`);
    if ('near' in r && !nearOf(r).length) bad.push(`${at}: near must name the miss-board target or router skill the run was built toward (like skill:weather or probe:sky), one or a list, 80 characters at most`);
    if (typeof r.behavior === 'string') { const twin = runs.slice(0, i).find((x) => x && typeof x.behavior === 'string' && sameBehavior(x.behavior, r.behavior)); if (twin) bad.push(`${at}: its behavior repeats run ${twin.run}'s ("${twin.behavior.slice(0, 80)}"): novelty is what a person can do, not the family's name`); }
    if (!Array.isArray(r.sources) || !r.sources.length) bad.push(`${at}: needs at least one source`);
    else r.sources.forEach((s, k) => {
      if (!s || !s.claim || !s.source) bad.push(`${at}: source ${k + 1} needs claim and source`);
      if (!s || !CONFIDENCE.includes(s.confidence)) bad.push(`${at}: source ${k + 1} confidence must be ${CONFIDENCE.join(' | ')}`);
    });
  });
  return bad;
}

/** the sources file: the sources array, or { sources, ...research notes } (only the notes the ledger knows are kept) */
export const NOTES = ['hypothesis', 'behavior', 'findings', 'failure_modes', 'next_experiments', 'combines', 'lab', 'near'];
export function notesOf(j) {
  if (Array.isArray(j)) return { sources: j };
  const out = { sources: j && j.sources };
  for (const k of NOTES) if (j && j[k] !== undefined) out[k] = j[k];
  return out;
}

export function next(runs = load()) {
  const recent = runs.slice(-WINDOW).map((r) => r.family);
  return FAMILIES.filter((f) => !recent.includes(f));
}

/** the ledger file's text: ledgerOf on the live skill names and the lab's tool list (skills/make.js) */
export async function ledgerJson(runs = load()) {
  let skills = []; try { skills = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8')); } catch (_) {}
  let tools = []; try { tools = (await import('../void-live-deploy/skills/make.js')).toolList(); } catch (_) {}
  return JSON.stringify({ note: 'The fringe ledger\'s published families for the "fringe to skill" card (tools/fringe.mjs --publish, from tools/fringe.json): each family\'s live drafts, its research notes newest first, what its runs were built toward (near) and the core skills its notes name.', families: ledgerOf(runs, skills, tools) }, null, 1) + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--next') console.log(next().join('\n'));
  else if (arg === '--learned') {
    const L = learned(), line = (t) => '  - ' + t;
    const out = [`What the fringe ledger has learned (${L.noted} of ${load().length} runs carry research notes; read this before building):`];
    out.push('', 'Findings (recent runs):', ...(L.findings.length ? L.findings.map((f) => line(`run ${f.run} (${f.family}): ${f.x}`)) : [line('none recorded yet')]));
    out.push('', 'What failed, and the evidence (do not repeat these):', ...(L.failures.length ? L.failures.map((f) => line(`run ${f.run} (${f.family}): ${f.x.what} (${f.x.evidence})`)) : [line('none recorded yet')]));
    out.push('', 'Next experiments the runs suggested:', ...(L.next.length ? L.next.map((f) => line(`run ${f.run} (${f.family}): ${f.x}`)) : [line('none recorded yet')]));
    out.push('', `Novelties and failures with no input tag: ${L.untagged} (tag the input that set one off: --input-tag <skill> "<ask>", or --suggest-near routes.json)`);
    out.push('', 'Built toward (the miss-board target or router skill each run served; say yours in near):', ...(L.near.length ? L.near.map((f) => line(`run ${f.run} (${f.family}): ${f.x}`)) : [line('none recorded yet')]));
    out.push('', 'Behaviors already built (a new run must do something else):', ...(L.behaviors.length ? L.behaviors.map((f) => line(`run ${f.run} (${f.family}): ${f.x}`)) : [line('none recorded yet')]));
    const D = demand(), dl = (xs) => (xs.length ? xs.map(line) : [line('none recorded yet')]);
    out.push('', 'What the core needs (build toward one of these when your family can serve it, and say which in findings):',
      '  Void\'s own open asks:', ...dl(D.asks).map((x) => '  ' + x),
      '  Skills failing or unchecked:', ...dl(D.friction).map((x) => '  ' + x),
      '  Benchmark asks Void got wrong:', ...dl(D.bench).map((x) => '  ' + x),
      '  What people asked that Void could not answer:', ...dl(D.misses).map((x) => '  ' + x));
    out.push('', `Published families never combined (${L.untried.length} pairs; a run may join its family with another and say so in combines):`, ...L.untried.slice(0, 12).map(([a, b]) => line(a + ' + ' + b)));
    console.log(out.join('\n'));
  }
  else if (arg === '--input-tag') { const t = inputTag(process.argv[3], process.argv.slice(4).join(' ')); if (!t) { console.error('usage: --input-tag <skill> "<the ask that triggered it>"'); process.exit(1); } console.log(t); }
  else if (arg === '--suggest-near') {
    // tools/fringe.mjs --suggest-near routes.json [--last N]: the router's near-miss rows (the owner's /api/routes, saved to a file) matched to the runs' notes
    const routes = JSON.parse(readFileSync(resolve(process.argv[3] || '', ''), 'utf8')), li = process.argv.indexOf('--last'), n = li > 0 ? +process.argv[li + 1] : 10;
    let any = false;
    for (const r of load().slice(-n)) for (const s of suggestInputs(r, routes.close)) { any = true; console.log('run ' + r.run + ' (' + r.family + '): near ' + JSON.stringify(s.tag) + '  (' + s.skill + '; shares ' + s.shared.join(', ') + ')'); }
    if (!any) console.log('no near-miss row shares two words with the last ' + n + ' runs');
  }
  else if (arg === '--hash') console.log(hash(process.argv[3]));
  else if (arg === '--record') {
    const draft = process.argv[3], runs = load();
    const family = draft.split('/').pop().replace(/\.html$/, '').replace(/-\d+$/, '');
    runs.push({ run: runs.length + 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), family, draft,
      ...notesOf(JSON.parse(readFileSync(resolve(root, process.argv[4]), 'utf8'))), sha256: hash(draft), emit: false });
    const bad = check(runs);
    if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
    writeFileSync(resolve(root, 'tools/fringe.json'), JSON.stringify(runs, null, 2) + '\n');
    console.log(`recorded run ${runs.length}: ${family}`);
  }
  else if (arg === '--rehash') {
    // a recorded draft fixed after review: refresh its sha256 (the run, its sources and emit stay as they were)
    const draft = process.argv[3], runs = load(), r = runs.filter((x) => x.draft === draft).pop();
    if (!r) { console.error('no run records ' + draft); process.exit(1); }
    const before = r.sha256; r.sha256 = hash(draft);
    writeFileSync(resolve(root, 'tools/fringe.json'), JSON.stringify(runs, null, 2) + '\n');
    console.log(before === r.sha256 ? 'run ' + r.run + ': unchanged' : 'run ' + r.run + ': sha256 refreshed for ' + draft);
  }
  else if (arg === '--publish') {
    mkdirSync(resolve(root, 'void-live-deploy/fringe'), { recursive: true });
    for (const r of load()) if (r.emit === true) { writeFileSync(resolve(root, live(r)), published(readFileSync(resolve(root, r.draft), 'utf8'))); console.log('published ' + live(r)); }
    writeFileSync(resolve(root, LAB), JSON.stringify(labOf(), null, 1) + '\n'); console.log('wrote ' + LAB + ' (' + labOf().length + ' from the ledger)');
    const led = await ledgerJson(); writeFileSync(resolve(root, LEDGER), led); console.log('wrote ' + LEDGER + ' (' + JSON.parse(led).families.length + ' published families)');
  }
  else {
    const runs = load(), bad = check(runs);
    for (const id of unreachable(runs)) bad.push(`${id} is published but nobody can open it: give its run a lab { label, sub, asks } and run --publish`);
    const want = JSON.stringify(labOf(runs), null, 1) + '\n', lp = resolve(root, LAB);
    if (labOf(runs).length ? !existsSync(lp) || readFileSync(lp, 'utf8') !== want : existsSync(lp) && readFileSync(lp, 'utf8') !== want) bad.push(`${LAB} is out of date (run --publish)`);
    const lj = resolve(root, LEDGER); if (runs.some((r) => r && r.emit === true) && (!existsSync(lj) || readFileSync(lj, 'utf8') !== await ledgerJson(runs))) bad.push(`${LEDGER} is out of date (run --publish)`);
    if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
    console.log(`fringe ledger ok: ${runs.length} run(s); last: ${runs.length ? runs[runs.length - 1].family : 'none'}; next may pick ${next(runs).length} families`);
  }
}
