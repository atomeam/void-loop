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
//   node tools/fringe.mjs --learned   what the ledger has learned, for the next run to read first: recent findings, failure
//     modes and next experiments, and pairs of published families no run has combined yet
// The research notes (owner, 2026-10-13: the ledger becomes a research engine that compounds: "every run should leave Void
// with at least one durable asset"; optional, so the first 73 runs stand as written, append-only):
//   hypothesis        what the run set out to show
//   behavior          what a person can do with the draft, in one line: novelty is judged on it, not on the family's name
//                     (a behavior that says nearly what an earlier run's said is refused)
//   findings          what the run showed, each a line
//   failure_modes     [{ what, evidence }]: what failed and what shows it, so the next run does not repeat it
//   next_experiments  what to try next
//   combines          other families this run joins with its own (the combination map is read off these)
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
const words = (t) => [...new Set(String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, '')))];
export function sameBehavior(a, b) { const x = words(a), y = new Set(words(b)); if (x.length < 3 || y.size < 3) return false; return x.filter((w) => y.has(w)).length / Math.min(x.length, y.size) >= 0.7; }

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
  return { findings: pick('findings'), failures: pick('failure_modes'), next: pick('next_experiments'), behaviors: runs.filter((r) => r.behavior).map((r) => ({ run: r.run, family: r.family, x: r.behavior })), untried: ordered, noted: runs.filter((r) => r.hypothesis || r.behavior || r.findings).length };
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
    if ('combines' in r && (!Array.isArray(r.combines) || r.combines.some((f) => !FAMILIES.includes(f) || f === r.family))) bad.push(`${at}: combines must list other known families`);
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
export const NOTES = ['hypothesis', 'behavior', 'findings', 'failure_modes', 'next_experiments', 'combines'];
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--next') console.log(next().join('\n'));
  else if (arg === '--learned') {
    const L = learned(), line = (t) => '  - ' + t;
    const out = [`What the fringe ledger has learned (${L.noted} of ${load().length} runs carry research notes; read this before building):`];
    out.push('', 'Findings (recent runs):', ...(L.findings.length ? L.findings.map((f) => line(`run ${f.run} (${f.family}): ${f.x}`)) : [line('none recorded yet')]));
    out.push('', 'What failed, and the evidence (do not repeat these):', ...(L.failures.length ? L.failures.map((f) => line(`run ${f.run} (${f.family}): ${f.x.what} (${f.x.evidence})`)) : [line('none recorded yet')]));
    out.push('', 'Next experiments the runs suggested:', ...(L.next.length ? L.next.map((f) => line(`run ${f.run} (${f.family}): ${f.x}`)) : [line('none recorded yet')]));
    out.push('', 'Behaviors already built (a new run must do something else):', ...(L.behaviors.length ? L.behaviors.map((f) => line(`run ${f.run} (${f.family}): ${f.x}`)) : [line('none recorded yet')]));
    out.push('', `Published families never combined (${L.untried.length} pairs; a run may join its family with another and say so in combines):`, ...L.untried.slice(0, 12).map(([a, b]) => line(a + ' + ' + b)));
    console.log(out.join('\n'));
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
  }
  else {
    const runs = load(), bad = check(runs);
    if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
    console.log(`fringe ledger ok: ${runs.length} run(s); last: ${runs.length ? runs[runs.length - 1].family : 'none'}; next may pick ${next(runs).length} families`);
  }
}
