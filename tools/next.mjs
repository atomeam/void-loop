// What a run takes next, in one place (cleanup step 4, 2026-10-11; it replaces reading several lists): the cleanup steps
// not done yet, then the open items on the frontier with where each came from, then the miss board grouped into skills
// (tools/next-skill.mjs, needs VOID_MISSES_TOKEN or VOID_OWNER_TOKEN; without one, the public snapshot domains/void.misses.json
// that misses-snapshot.yml commits daily). Void's own asks are in domains/void.voice.md.
//   node tools/next.mjs          print it
//   node tools/next.mjs --json   the same as JSON (no miss board)
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readFrontier, openItems, stepsLeft, targets } from './frontier.mjs';

const SNAPSHOT = new URL('../domains/void.misses.json', import.meta.url);

/** the snapshot's lines for a session with no token: the top terms and make-things, as counts of distinct asks. Pure. */
export function snapshotLines(snap, top = 10) {
  if (!snap || !Array.isArray(snap.terms)) return ['The miss snapshot is not readable.'];
  const row = (e) => `  ${e.term}  (${e.asks} asks, ${e.misses} misses)`;
  return [`From the miss snapshot of ${String(snap.at || '').slice(0, 10)} (${snap.distinctAsks} distinct asks; terms, never ask text):`,
    ...snap.terms.slice(0, top).map(row),
    ...(snap.make && snap.make.length ? ['  things asked to be made:', ...snap.make.slice(0, top).map((e) => '  ' + row(e))] : [])];
}

export function summary(text) {
  const steps = stepsLeft(text), open = openItems(text), after = targets(text);
  return { steps, open, targets: after, take: takeNext({ steps, open, targets: after }) };
}

/** the one thing a run takes now. There is always one: a run never reports "nothing to do" (the owner, 2026-10-12: "no open
 *  items or anything similar is absolute bullshit and I dont ever want to see that again"). Pure. */
export function takeNext({ steps = [], open = [], targets: after = [] }) {
  if (steps.length) return 'cleanup step ' + steps[0].n + ': ' + steps[0].title;
  if (open.length) return open[0].title + ' (the first open item nobody has claimed; check open PRs and the agent log)';
  if (after.length) return after[0].title + ' (the first target after the cleanup)';
  return "Void's top ask in domains/void.voice.md, then write the next targets on the frontier";
}

function main(argv) {
  const s = summary(readFrontier());
  if (argv.includes('--json')) { console.log(JSON.stringify(s, null, 1)); return 0; }
  console.log(s.steps.length ? 'Cleanup steps left (take the first unclaimed one before anything else):' : 'Cleanup: all steps done.');
  for (const st of s.steps) console.log(`  ${st.n}. ${st.title}`);
  console.log('Take next: ' + s.take);
  if (s.open.length) console.log(`\nOpen on the frontier (${s.open.length}):`);
  for (const o of s.open) console.log(`  - ${o.title}${o.from ? '  [' + o.from + ']' : ''}`);
  if (s.targets.length) console.log(`\nTargets after the cleanup (${s.targets.length}):`);
  for (const t of s.targets) console.log('  - ' + t.title);
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
  console.log("Void's own asks: the top of domains/void.voice.md.");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
