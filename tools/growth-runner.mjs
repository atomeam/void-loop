// Apply a proposed change to a copy and record the result.
//   node tools/growth-runner.mjs --demo
// --commit is refused here: committing uses GH_TOKEN from the environment in the workflow, and this command never prints it.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { propose, applyCopy, planChecks, advance, ship } from '../void-live-deploy/lib/growth-runner.js';

/** write the change under dir and return the paths that landed. */
export function applyDir(dir, files) {
  const root = resolve(dir);
  const landed = [];
  for (const f of files || []) {
    const dest = resolve(root, f.path);
    if (dest !== root && !dest.startsWith(root + '/')) throw new Error('path left the copy');
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, f.text);
    landed.push(dest);
  }
  return landed;
}

/** the demo: a one-line change on a throwaway copy, then the same checks the record names. */
export function demo() {
  const proposed = propose({ files: [{ path: 'notes/hello.txt', text: 'hello from the copy\n' }] }, '2026-11-21T00:00:00Z');
  if (!proposed.ok) return proposed;
  const dir = mkdtempSync(join(tmpdir(), 'verse-runner-'));
  try {
    writeFileSync(join(dir, 'notes.txt'), 'base');
    applyDir(dir, proposed.record.files);
    const got = readFileSync(join(dir, 'notes/hello.txt'), 'utf8');
    const copy = applyCopy({ 'notes.txt': 'base' }, proposed.record.files);
    const pass = got === 'hello from the copy\n' && copy['notes/hello.txt'] === got;
    const tested = advance(proposed.record, { pass, checks: planChecks(proposed.record.files), at: '2026-11-21T00:00:00Z', why: pass ? '' : 'the copy did not match' });
    const done = pass ? ship(tested) : { ok: false, record: tested };
    return { ok: pass, record: done.record || tested, push: done.push || null, dir: 'removed' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv.includes('--commit')) {
    console.error('growth-runner: committing is the workflow, with the token already in the environment. This command does not print it.');
    process.exit(2);
  }
  const out = demo();
  console.log(JSON.stringify({ ok: out.ok, state: out.record && out.record.state, id: out.record && out.record.id, checks: out.record && out.record.checks }));
  process.exit(out.ok ? 0 : 1);
}
