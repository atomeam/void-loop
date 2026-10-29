// What a run takes next, in one place (cleanup step 4, 2026-10-11; it replaces reading several lists): the cleanup steps
// not done yet, then the open items on the frontier with where each came from, then the miss board grouped into skills
// (tools/next-skill.mjs, needs VOID_MISSES_TOKEN or VOID_OWNER_TOKEN; without one, the public snapshot domains/void.misses.json
// that misses-snapshot.yml commits daily). Verse's own asks are in domains/void.voice.md.
//   node tools/next.mjs          print it
//   node tools/next.mjs --json   the same as JSON (no miss board)
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readFrontier, openItems, stepsLeft, targets } from './frontier.mjs';
import { scan as reviewOverrides, summarize as overrideSummary } from './review-overrides.mjs';
import { load as loadTargets, scoreOf } from './targets.mjs';
import { asksInLog } from './reflect.mjs';
import { sameAsk } from '../void-live-deploy/lib/self-blocks.js';

const SNAPSHOT = new URL('../domains/void.misses.json', import.meta.url);

/** the snapshot's lines for a session with no token: the top terms and make-things, as counts of distinct asks. Pure. */
export function snapshotLines(snap, top = 10) {
  if (!snap || !Array.isArray(snap.terms)) return ['The miss snapshot is not readable.'];
  const row = (e) => `  ${e.term}  (${e.asks} asks, ${e.misses} misses)`;
  return [`From the miss snapshot of ${String(snap.at || '').slice(0, 10)} (${snap.distinctAsks} distinct asks; terms, never ask text):`,
    ...snap.terms.slice(0, top).map(row),
    ...(snap.make && snap.make.length ? ['  things asked to be made:', ...snap.make.slice(0, top).map((e) => '  ' + row(e))] : [])];
}

const VOICE = new URL('../domains/void.voice.md', import.meta.url);
const normAsk = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Verse's asks across all its reflections, most repeated first, without the ones a ledger entry built. voice: the text of
 *  domains/void.voice.md; ledger: void.growth.json entries; links: void.asks.json links. A builder or an automation
 *  that finds the queue empty takes the top one: Verse asked for it again and again, so it is wanted, and it is unique by
 *  construction (one row per wording). Pure. */
export function repeatedAsks(voice, ledger = [], links = []) {
  const rows = new Map();
  for (const line of String(voice || '').split('\n')) {
    if (!/^Asks: /.test(line)) continue;
    for (const m of line.matchAll(/"([^"]{8,400})"( \(small\))?/g)) {
      const k = normAsk(m[1]); const r = rows.get(k) || { ask: m[1], small: false, times: 0 };
      r.times++; r.small = r.small || !!m[2]; rows.set(k, r);
    }
  }
  const at = new Set((ledger || []).map((e) => e && e.at));
  const builtIds = new Set((links || []).filter((k) => k && at.has(k.ledgerAt)).map((k) => k.ask));
  const done = new Set((ledger || []).filter((e) => e && e.asked).map((e) => normAsk(e.asked)));
  for (const a of asksInLog(voice)) if (a.id && builtIds.has(a.id)) done.add(normAsk(a.ask));
  return [...rows.entries()].filter(([k]) => !done.has(k)).map(([, r]) => r).sort((a, b) => b.times - a.times || (b.small - a.small));
}
function readJson(rel, pick) { try { return pick(JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'))); } catch (_) { return []; } }
export const voidAsks = () => { let v = ''; try { v = readFileSync(VOICE, 'utf8'); } catch (_) {}
  return repeatedAsks(v, readJson('../void-live-deploy/void.growth.json', (j) => j), readJson('../void-live-deploy/void.asks.json', (j) => j.links || [])); };

/** The holds and the Versus target (owner, 2026-10-29: every site ever made, smallest first; an ask that does not help beat the
 *  current target waits). held: void.asks.json `held` ({ words, until, why, frontier? }); target: tower.target.json's id. A frontier
 *  item or an ask is held while an entry whose `until` is still the target names it, by its frontier title or its words. Pure. */
export function isHeld(title, held, target) {
  const k = normAsk(title);
  return !!k && !!target && (Array.isArray(held) ? held : []).some((h) => h && String(h.until || '') === String(target)
    && ((h.frontier && normAsk(h.frontier) === k) || (h.words && (normAsk(h.words) === k || sameAsk(h.words, title)))));
}
/** the Versus target's next aspect, from its domains/targets file: { site, next } or null when there is none or it is beaten. Pure. */
export function towerTake(target, all) {
  const t = (Array.isArray(all) ? all : []).find((x) => x && x.site === target);
  if (!t) return null;
  const sc = scoreOf(t);
  return sc.done || !sc.next ? null : { site: sc.site, next: sc.next, beats: sc.beats, total: sc.total };
}

export function summary(text, { held = [], target = '', tower = null } = {}) {
  const steps = stepsLeft(text), all = openItems(text), after = targets(text);
  const open = all.filter((o) => !isHeld(o.title, held, target)), heldOpen = all.filter((o) => isHeld(o.title, held, target));
  return { steps, open, held: heldOpen, targets: after, tower, take: takeNext({ steps, open, targets: after, tower }) };
}

/** the one thing a run takes now. There is always one: a run never reports "nothing to do" (the owner, 2026-10-12: "no open
 *  items or anything similar is absolute bullshit and I dont ever want to see that again"). Pure. */
export function takeNext({ steps = [], open = [], targets: after = [], tower = null }) {
  if (steps.length) return 'cleanup step ' + steps[0].n + ': ' + steps[0].title;
  // the Versus target stays first until it is beaten (tower.target.json; owner, 2026-10-29)
  if (tower && tower.site && tower.next) return tower.site + ': ' + tower.next.id + ' (the Versus target, ' + tower.beats + ' of ' + tower.total + ' beaten; it stays first until it is beaten)';
  if (open.length) return open[0].title + ' (the first open item nobody has claimed; check open PRs and the agent log)';
  if (after.length) return after[0].title + ' (the first target after the cleanup)';
  return "Verse's top ask in domains/void.voice.md, then write the next targets on the frontier";
}

const holdsNow = () => { const held = readJson('../void-live-deploy/void.asks.json', (j) => j.held || []);
  let target = ''; try { target = String(JSON.parse(readFileSync(new URL('../void-live-deploy/tower.target.json', import.meta.url), 'utf8')).id || ''); } catch (_) {}
  let tower = null; try { tower = towerTake(target, loadTargets()); } catch (_) {}
  return { held: Array.isArray(held) ? held : [], target, tower }; };

function main(argv) {
  const h = holdsNow(), s = summary(readFrontier(), h);
  const va = voidAsks().filter((a) => !isHeld(a.ask, h.held, h.target));
  if (argv.includes('--json')) { console.log(JSON.stringify({ ...s, voidAsks: va.slice(0, 10) }, null, 1)); return 0; }
  console.log(s.steps.length ? 'Cleanup steps left (take the first unclaimed one before anything else):' : 'Cleanup: all steps done.');
  for (const st of s.steps) console.log(`  ${st.n}. ${st.title}`);
  console.log('Take next: ' + s.take);
  if (s.open.length) console.log(`\nOpen on the frontier (${s.open.length}):`);
  for (const o of s.open) console.log(`  - ${o.title}${o.from ? '  [' + o.from + ']' : ''}`);
  if (s.held.length) console.log(`\nHeld until ${h.target} is beaten (void.asks.json held; not to be taken now):\n` + s.held.map((o) => '  - ' + o.title).join('\n'));
  if (s.targets.length) console.log(`\nTargets after the cleanup (${s.targets.length}):`);
  for (const t of s.targets) console.log('  - ' + t.title);
  try { // the site Verse has set its sights on, and the next feature to build one notch past it (tools/targets.mjs)
    for (const t of loadTargets()) { const sc = scoreOf(t); if (sc.done) continue;
      console.log(`\nTarget: ${sc.site}, beats ${sc.beats} of ${sc.total}.` + (sc.next ? ` Next: ${sc.next.id}. They: ${sc.next.theirs}. Verse, one notch past: ${sc.next.plus_one}` : '')); }
  } catch (_) {}
  try { // Verse's review: where builders overrode it, by rule; the noisiest rule is the next reviewer fix (tools/review-overrides.mjs)
    const o = overrideSummary(reviewOverrides());
    if (o.rules.length) console.log(`\nVerse's review, overridden as right as written: ${o.rules.map((r) => r.rule + ' ' + r.n).join(', ')}${o.idle.length ? ` (and ${o.idle.length} markers no rule needs any more)` : ''}. Fix the noisiest rule or confirm the overrides: node tools/review-overrides.mjs`);
  } catch (_) {}
  const BM = new URL('./bench.misses.json', import.meta.url);
  if (existsSync(BM)) { let b = null; try { b = JSON.parse(readFileSync(BM, 'utf8')); } catch (_) {}
    if (b && Array.isArray(b.misses) && b.misses.length) console.log(`\nThe bench misses (${b.misses.length}, on ${b.sha} at ${String(b.at).slice(0, 10)}; each is an ask and the skill that took it):\n` + b.misses.map((m) => '  - ' + m).join('\n'));
    else if (b && !Array.isArray(b.misses)) console.log('\nThe bench misses: ' + (b.note || 'not recorded yet') + '.'); }
  if (process.env.VOID_MISSES_TOKEN || process.env.VOID_OWNER_TOKEN) {
    const r = spawnSync(process.execPath, [resolve(dirname(fileURLToPath(import.meta.url)), 'next-skill.mjs')], { encoding: 'utf8', timeout: 60000 });
    console.log('\nFrom the miss board:\n' + ((r.stdout || '') + (r.stderr || '')).trim());
  } else if (existsSync(SNAPSHOT)) {
    let snap = null; try { snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8')); } catch (_) {}
    console.log('\n' + snapshotLines(snap).join('\n') + '\n(the live board, grouped into skills: VOID_MISSES_TOKEN and node tools/next-skill.mjs)');
  } else console.log('\nThe miss board needs VOID_MISSES_TOKEN (node tools/next-skill.mjs); the public snapshot domains/void.misses.json is not written yet (misses-snapshot.yml, daily).');
  if (va.length) console.log(`\nVerse asks for, most repeated first (${va.length} not built yet; build the top one and pass --asked to finish.mjs):\n` + va.slice(0, 8).map((a) => `  - ${a.times}× ${a.ask}${a.small ? ' (small)' : ''}`).join('\n'));
  else console.log("Verse's own asks: the top of domains/void.voice.md.");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
