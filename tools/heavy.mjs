// One heavy browser job at a time on a machine (2026-10-10, owner): the benchmark reads answers on a timer and the suite waits
// on fixed asks, so two of them sharing a CPU miss on timing (a bench shared with a suite scored 1744 against a floor of 1985;
// alone it scored 2027). The lock is a folder in the temp dir (mkdir is atomic on every platform) holding the owner's pid and
// label; a lock whose process is gone is taken over. tools/test_void.mjs and tools/bench.mjs take it themselves, so running
// them plainly still queues; the wrapper is for anything else that opens a browser for minutes.
//   node tools/heavy.mjs <command> [args...]    run the command once no other heavy job holds the lock
//   VOID_HEAVY_WAIT_MS                          how long to wait for the lock (default 90 min), then fail loudly
//   VOID_HEAVY_OFF=1                            no lock (a machine that runs one thing at a time, or CI, where each job has its own runner)
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCK = join(tmpdir(), 'void-heavy.lock');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/** who holds the lock: { pid, label, since } or null */
export function holder(lock = LOCK) {
  try { return JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8')); } catch (_) { return existsSync(lock) ? { pid: 0, label: '(unreadable)', since: '' } : null; }
}

/**
 * Take the lock for this process; resolves to a release function. Waits while a living process holds it, takes over a lock
 * whose process is gone, and throws after waitMs.
 */
export async function acquire(label, { lock = LOCK, waitMs = Number(process.env.VOID_HEAVY_WAIT_MS) || 5400000, pollMs = 2000, log = (m) => console.error(m), isAlive = alive } = {}) {
  if (process.env.VOID_HEAVY_OFF) return () => {};
  const t0 = Date.now(); let said = 0;
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, label, since: new Date().toISOString() }));
      let released = false;
      const release = () => { if (released) return; released = true; try { rmSync(lock, { recursive: true, force: true }); } catch (_) {} };
      process.once('exit', release);
      return release;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const h = holder(lock);
      if (h && h.pid && !isAlive(h.pid)) { try { rmSync(lock, { recursive: true, force: true }); } catch (_) {} continue; }
      if (Date.now() - t0 > waitMs) throw new Error('heavy: still waiting after ' + Math.round(waitMs / 60000) + ' min for ' + (h ? h.label + ' (pid ' + h.pid + ')' : lock));
      if (Date.now() - said > 30000) { said = Date.now(); log('heavy: waiting for ' + (h ? h.label + ' (pid ' + h.pid + ', since ' + h.since + ')' : 'another job') + ' before ' + label); }
      await sleep(pollMs);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) { console.error('usage: node tools/heavy.mjs <command> [args...]'); process.exit(2); }
  const release = await acquire(cmd + ' ' + args.join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  release();
  process.exit(r.status === null ? 1 : r.status);
}
