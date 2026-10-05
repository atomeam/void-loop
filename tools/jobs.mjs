// Turns the miss board into a queued job list for builders, so skill acquisition doesn't wait on someone reading the board.
// Raw asks are what people typed, so the list lives in domains/void.jobs.json (git-ignored, like void.misses.md) and is only printed.
//   node tools/jobs.mjs                  add new misses (same filters as misses.mjs) as queued jobs, then print the queue
//   node tools/jobs.mjs --file rows.json read board rows from a file instead of the site
//   node tools/jobs.mjs claim            mark the top queued job 'building' and print it (a builder's first step)
//   node tools/jobs.mjs done <n> [note]  mark job n done (after it is in bench.json / grown.json)
// Exit 3 when the board can't be read and there is no queue yet.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fresh } from './misses.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'domains/void.jobs.json');

// what kind of job an ask is, so a builder knows where to start
export function kindOf(ask) {
  const a = ask.toLowerCase();
  if (/\b(probe|ping|test)\b/.test(a)) return 'probe';
  if (/\d/.test(a) && /\b(in|to|into|per|of|plus|minus|times|percent|%)\b/.test(a)) return 'calc';
  if (/^(what|who|when|where|why|how|which|is|are|does|do|can)\b/.test(a)) return 'question';
  return 'ask';
}

// merge fresh board rows into the queue: a repeat ask only raises its count, a finished one stays finished
export function merge(jobs, rows, now = new Date().toISOString().slice(0, 16)) {
  const out = jobs.map((j) => ({ ...j }));
  let id = out.reduce((m, j) => Math.max(m, j.id), 0);
  for (const r of rows) {
    const have = out.find((j) => j.ask.toLowerCase() === r.ask.toLowerCase());
    if (have) { have.count = Math.max(have.count, r.count); have.last = r.last || have.last; continue; }
    out.push({ id: ++id, ask: r.ask, kind: kindOf(r.ask), count: r.count, last: r.last, state: 'queued', queued: now });
  }
  return out;
}
export const order = (jobs) => jobs.filter((j) => j.state === 'queued').sort((a, b) => b.count - a.count || (b.last > a.last ? 1 : -1));

const load = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []);
const save = (jobs) => writeFileSync(file, JSON.stringify(jobs, null, 1) + '\n');
const show = (j) => console.log(`${String(j.id).padStart(3)}  ${j.state.padEnd(8)} x${j.count}  ${j.kind.padEnd(8)} ${j.ask}${j.note ? '   [' + j.note + ']' : ''}`);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--file');
  const [cmd, ...rest] = args.filter((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
  let jobs = load();
  if (cmd === 'claim') {
    const j = order(jobs)[0];
    if (!j) { console.log('no queued jobs'); process.exit(0); }
    j.state = 'building'; save(jobs); show(j);
  } else if (cmd === 'done') {
    const j = jobs.find((x) => x.id === Number(rest[0]));
    if (!j) { console.error('no job ' + rest[0]); process.exit(2); }
    j.state = 'done'; j.note = rest.slice(1).join(' ') || undefined; save(jobs); show(j);
  } else {
    const known = new Set(['tools/grown.json', 'tools/bench.json'].flatMap((f) => JSON.parse(readFileSync(resolve(root, f), 'utf8')).map((x) => String(x.ask).trim().toLowerCase())));
    try {
      let rows;
      if (at >= 0) rows = JSON.parse(readFileSync(resolve(args[at + 1]), 'utf8'));
      else {
        const tok = process.env.VOID_MISSES_TOKEN;
        if (!tok) throw new Error('VOID_MISSES_TOKEN is not set in this environment');
        const res = await fetch('https://a-to-mind.com/api/misses', { headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-jobs/1.0' } });
        if (!res.ok) throw new Error('GET /api/misses: HTTP ' + res.status);
        rows = await res.json();
      }
      jobs = merge(jobs, fresh(rows, { since: '', known }));
      save(jobs);
    } catch (e) {
      console.error('board not read: ' + e.message);
      if (!jobs.length) process.exit(3);
    }
    const q = order(jobs);
    if (!q.length) console.log('no queued jobs');
    q.forEach(show);
  }
}
