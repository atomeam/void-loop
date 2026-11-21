// Verse's own build step, off the GitHub Actions queue. A proposed change is applied to a copy, the named checks
// run, and only a pass is marked ready to commit. GitHub stays the source of truth: the commit uses the token
// already in the environment, and this file never reads or prints that token.
import { safePath } from './automations.js';

export const STATES = Object.freeze(['proposed', 'tested', 'shipped', 'rolled']);

function idOf(files) {
  let h = 2166136261;
  for (const f of files) for (const c of f.path + '\n' + f.text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return 'g' + (h >>> 0).toString(36);
}

/** a change becomes a proposed record, or { ok: false }. Paths stay inside the tree. Pure. */
export function propose(change, at = '') {
  const files = [];
  for (const f of (change && change.files) || []) {
    if (!f || !safePath(f.path)) return { ok: false, why: 'a file path is not allowed' };
    const text = String(f.text == null ? '' : f.text);
    if (text.length > 20000) return { ok: false, why: 'a file is over 20,000 characters' };
    files.push({ path: f.path, text });
  }
  if (!files.length) return { ok: false, why: 'name at least one file' };
  return { ok: true, record: { id: idOf(files), state: 'proposed', at, files, checks: [], note: 'GitHub stays the source of truth.' } };
}

/** the copy after the change. The base is not mutated. Pure. */
export function applyCopy(base, files) {
  const out = { ...(base || {}) };
  for (const f of files || []) out[f.path] = f.text;
  return out;
}

/** checks to run. A test file in the change is run; otherwise the runner's own test. The stranger gate is always named. Pure. */
export function planChecks(files) {
  const tests = (files || []).map((f) => f.path).filter((p) => /(^|\/)[^/]+\.test\.mjs$/.test(p));
  const run = tests.length ? tests.map((t) => 'node --test ' + t) : ['node --test tools/growth-runner.test.mjs'];
  return [...run, 'stranger gate (lib/stranger.js)'];
}

/** proposed -> tested, or rolled when a check fails. Pure. */
export function advance(record, result) {
  if (!record) return null;
  if (result && result.pass) return { ...record, state: 'tested', checks: result.checks || planChecks(record.files), testedAt: result.at || '' };
  if (result && result.pass === false) return { ...record, state: 'rolled', checks: result.checks || [], note: String(result.why || 'a check failed').slice(0, 200) };
  return record;
}

/** a tested change may be committed. The argv never contains a token. Pure. */
export function ship(record) {
  if (!record || record.state !== 'tested') return { ok: false, why: 'only a tested change can be committed' };
  return {
    ok: true,
    record: { ...record, state: 'shipped' },
    commit: { paths: record.files.map((f) => f.path), message: 'Ship a change the self-build runner tested.' },
    push: ['git', 'push', 'origin', 'HEAD'],
  };
}
