// The spotter (pit crew position 3, 2026-10-11): a check that fails on main and then goes green on a newer head with
// nothing taken back is written down here, and one that does it twice in a week becomes a job to make it robust. Never a
// skip, never a quarantine, never a retry that hides a failure (docs/RULES.md): the job is to fix the test or the code.
//   node tools/flakes.mjs record <sha> "<check>" ["<check>" ...]   append to tools/flakes.json (verify.yml does this when
//                                                                  tools/revert-target.mjs reports checks that healed)
//   node tools/flakes.mjs due                                      the checks due a job (twice or more in the last 7 days)
//   node tools/flakes.mjs queue [--dry]                            queue each as a flake:<check> job at /api/queue
//                                                                  (VOID_OWNER_TOKEN; the queue keeps one open job per target)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FLAKES = resolve(dirname(fileURLToPath(import.meta.url)), 'flakes.json');
export const DAYS = 7, TIMES = 2;
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

/** the target a check's job takes: flake:<slug>, at most 40 characters (the queue's limit). Pure. */
export const targetOf = (check) => ('flake:' + String(check).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).slice(0, 40).replace(/-+$/, '');

/** the entries with these checks added, one per check, never twice for the same check on the same commit. Pure. */
export function recorded(entries, sha, checks, at = new Date().toISOString()) {
  const seen = new Set(entries.map((e) => e.check + '|' + e.sha));
  const add = checks.map((c) => String(c).slice(0, 200)).filter((c) => c && !seen.has(c + '|' + sha) && seen.add(c + '|' + sha))
    .map((check) => ({ check, sha: String(sha).slice(0, 40), at: at.replace(/\.\d+Z$/, 'Z') }));
  return entries.concat(add);
}

/** checks seen healing TIMES or more within the last DAYS days: [{ check, times, shas, target }]. Pure. */
export function due(entries, now = new Date()) {
  const since = now.getTime() - DAYS * 864e5, by = new Map();
  for (const e of entries) {
    if (Date.parse(e.at) < since) continue;
    const g = by.get(e.check) || { check: e.check, times: 0, shas: [] };
    g.times++; g.shas.push(e.sha.slice(0, 7)); by.set(e.check, g);
  }
  return [...by.values()].filter((g) => g.times >= TIMES).map((g) => ({ ...g, target: targetOf(g.check) }));
}

/** the job's words: what to fix and what not to do. Pure. */
export const askOf = (g) => `make "${String(g.check).slice(0, 80)}" robust: fix the test or the code, never skip, quarantine or retry it. It failed on main and healed with no revert ${g.times}x in ${DAYS} days (${g.shas.join(', ')}; tools/flakes.json)`.slice(0, 200);

/** the file in its own style: one entry per line */
export const text = (entries) => (entries.length ? '[\n' + entries.map((e) => '  {' + Object.entries(e).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ') + '}').join(',\n') + '\n]\n' : '[]\n');
const read = () => (existsSync(FLAKES) ? JSON.parse(readFileSync(FLAKES, 'utf8')) : []);

async function queue(dry) {
  const jobs = due(read());
  if (!jobs.length) { console.log('no check has healed twice in ' + DAYS + ' days'); return 0; }
  const tok = process.env.VOID_OWNER_TOKEN;
  for (const g of jobs) {
    if (dry || !tok) { console.log((tok ? 'would queue ' : 'would queue (no VOID_OWNER_TOKEN here) ') + g.target + ': ' + askOf(g)); continue; }
    const res = await fetch(SITE + '/api/queue', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json', 'user-agent': 'a2m-flakes/1.0' }, body: JSON.stringify({ ask: askOf(g), target: g.target }) });
    console.log(res.ok ? 'queued ' + g.target : 'could not queue ' + g.target + ': HTTP ' + res.status);
  }
  return 0;
}

async function main(argv) {
  const [cmd, ...rest] = argv.slice(2);
  if (cmd === 'record') {
    const [sha, ...checks] = rest;
    if (!/^[0-9a-f]{7,40}$/.test(sha || '') || !checks.length) { console.error('usage: node tools/flakes.mjs record <sha> "<check>" ["<check>" ...]'); return 2; }
    const before = read(), after = recorded(before, sha, checks);
    if (after.length !== before.length) writeFileSync(FLAKES, text(after));
    console.log('flakes.json: +' + (after.length - before.length) + ' (' + after.length + ' in all)');
    return 0;
  }
  if (cmd === 'due') { for (const g of due(read())) console.log(g.target + '  ' + g.times + 'x  ' + g.shas.join(', ')); return 0; }
  if (cmd === 'queue') return queue(rest.includes('--dry'));
  console.error('usage: node tools/flakes.mjs record <sha> "<check>"... | due | queue [--dry]');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv));
