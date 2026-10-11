// What a run takes next, in one place (cleanup step 4, 2026-10-11; it replaces reading several lists): the cleanup steps
// not done yet, then the open items on the frontier with where each came from, then the miss board grouped into skills
// (tools/next-skill.mjs, needs VOID_MISSES_TOKEN or VOID_OWNER_TOKEN). Void's own asks are in domains/void.voice.md.
//   node tools/next.mjs          print it
//   node tools/next.mjs --json   the same as JSON (no miss board)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readFrontier, openItems, stepsLeft } from './frontier.mjs';

export function summary(text) {
  return { steps: stepsLeft(text), open: openItems(text) };
}

function main(argv) {
  const s = summary(readFrontier());
  if (argv.includes('--json')) { console.log(JSON.stringify(s, null, 1)); return 0; }
  console.log(s.steps.length ? 'Cleanup steps left (take the first unclaimed one before anything else):' : 'Cleanup: all steps done.');
  for (const st of s.steps) console.log(`  ${st.n}. ${st.title}`);
  console.log(`\nOpen on the frontier (${s.open.length}):`);
  for (const o of s.open) console.log(`  - ${o.title}${o.from ? '  [' + o.from + ']' : ''}`);
  if (process.env.VOID_MISSES_TOKEN || process.env.VOID_OWNER_TOKEN) {
    const r = spawnSync(process.execPath, [resolve(dirname(fileURLToPath(import.meta.url)), 'next-skill.mjs')], { encoding: 'utf8', timeout: 60000 });
    console.log('\nFrom the miss board:\n' + ((r.stdout || '') + (r.stderr || '')).trim());
  } else console.log('\nThe miss board needs VOID_MISSES_TOKEN (node tools/next-skill.mjs).');
  console.log("Void's own asks: the top of domains/void.voice.md.");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
