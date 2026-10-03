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
//   node tools/fringe.mjs --publish  writes the live copy of every emit:true draft
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
    if (!Array.isArray(r.sources) || !r.sources.length) bad.push(`${at}: needs at least one source`);
    else r.sources.forEach((s, k) => {
      if (!s || !s.claim || !s.source) bad.push(`${at}: source ${k + 1} needs claim and source`);
      if (!s || !CONFIDENCE.includes(s.confidence)) bad.push(`${at}: source ${k + 1} confidence must be ${CONFIDENCE.join(' | ')}`);
    });
  });
  return bad;
}

export function next(runs = load()) {
  const recent = runs.slice(-WINDOW).map((r) => r.family);
  return FAMILIES.filter((f) => !recent.includes(f));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--next') console.log(next().join('\n'));
  else if (arg === '--hash') console.log(hash(process.argv[3]));
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
