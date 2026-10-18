// The small pieces tools/checks.mjs runs its checks with: a gate that lets only so many child processes run at once (the number may
// change while it runs), an async spawn with the old timeout and output rules, and the report helpers. Pure checks (no browser, no
// network, no heavy lock) go through the gate side by side; browser checks run one after another beside them (tools/heavy.mjs
// still decides who holds the browser).
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

/** how many pure checks may run at once: one per core up to 4, and one fewer while a browser check runs so it is not starved */
export function poolSize(browserRunning, cores = cpus().length) {
  const n = Math.max(1, Math.min(4, cores));
  return browserRunning ? Math.max(1, n - 1) : n;
}

/**
 * A gate: gate(fn) runs fn() once fewer than limit() calls are running, first come first served, and resolves to what fn returns
 * (a throw rejects). limit is read every time a slot frees, so it can change while jobs wait. gate.poke() asks it to look again
 * (after the limit rose), gate.running() says how many run now.
 */
export function makeGate(limit) {
  const waiting = []; let running = 0;
  const pump = () => { while (waiting.length && running < Math.max(1, limit())) { const w = waiting.shift(); running++; w.fn().then(w.res, w.rej).finally(() => { running--; pump(); }); } };
  const gate = (fn) => new Promise((res, rej) => { waiting.push({ fn: async () => fn(), res, rej }); pump(); });
  gate.poke = pump; gate.running = () => running;
  return gate;
}

/**
 * Run the tasks (functions returning a promise) through the gate and resolve to their results in the order of the tasks,
 * whatever order they finished in. A task that throws becomes { error } at its place; the others still run.
 */
export async function runOrdered(tasks, gate) {
  return Promise.all(tasks.map((t) => gate(t).catch((error) => ({ error }))));
}

/** the old synchronous run, async: node <args>, same cwd, same timeout; out is stdout then stderr, trimmed, split in lines, node's warning lines dropped */
export function runNode(args, { cwd, timeout = 1800000, env } = {}) { // 30 min: the full bench takes about 20 on a slow shared machine
  return new Promise((done) => {
    const c = spawn(process.execPath, args, { cwd, timeout, env: env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = '';
    c.stdout.on('data', (d) => { o += d; }); c.stderr.on('data', (d) => { e += d; });
    const end = (ok) => done({ ok, out: (o + e).trim().split('\n').filter((l) => !/ExperimentalWarning|trace-warnings/.test(l)) });
    c.on('error', (err) => { e += String(err); end(false); });
    c.on('close', (code) => end(code === 0));
  });
}

/** the n slowest of [{ name, ms }], slowest first */
export function slowest(timings, n = 5) { return [...timings].sort((a, b) => b.ms - a.ms).slice(0, n); }

/** "12.3s" or "2m05s" */
export function fmtMs(ms) { const s = ms / 1000; return s < 90 ? s.toFixed(1) + 's' : Math.floor(s / 60) + 'm' + String(Math.round(s % 60)).padStart(2, '0') + 's'; }
