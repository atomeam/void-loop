#!/usr/bin/env node
// The add-only ratchet for paid members' ideas (owner, 2026-10-29: paid members "still not be able to take anything away only add
// positive improvements"). Enforced by code, not trust: one lap of tools/verse-loop.mjs on a member:<id> job runs this on its changes
// before it commits, and refuses the lap when any rule breaks. Members' work then merges like any lap (automerge on Verse's review),
// and verify.yml still reverts a merge that turns main red. The rules:
//   1. no file is deleted or renamed, anywhere
//   2. no existing file gets shorter (an edit may change lines, never shrink the file)
//   3. no test is taken away: a changed *.test.* file keeps every test( / it( / assert line it had (they may be added to)
//   4. no registered entry leaves a registry (skills/families.json, void.asks.json, void.growth.json, tower.frontier.json,
//      tower.evidence.json, skills/order/, tools/handoff-types.json is exempt: that list may only shrink by its own rule)
//   5. no score drops: a number under a key that names a score (score, completeness, ahead, beaten, surpassed, passed, coverage,
//      percent, pct, facts, tests, green) is never lower than it was
//   node tools/add-only.mjs [--base origin/main]   exit 0 = add-only, 1 = what broke, one line each
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REGISTRIES = Object.freeze([
  'void-live-deploy/skills/families.json', 'void-live-deploy/void.asks.json', 'void-live-deploy/void.growth.json',
  'void-live-deploy/tower.frontier.json', 'void-live-deploy/tower.evidence.json',
]);
export const SHRINK_OK = Object.freeze(['tools/handoff-types.json', 'docs/TAGTEAM.md']); // lists whose own rule lets them shrink
const SCORE_KEY = /^(?:score|scores|completeness|complete|ahead|beaten|surpassed|passed|passes|pass|coverage|percent|pct|match|matched|facts|tests|green)$/i;
const TEST_FILE = /\.test\.(?:mjs|js|cjs|ts)$|(?:^|\/)test_[^/]*\.(?:py|mjs)$|_test\.py$/;
const TEST_LINE = /\b(?:test|it|describe)\s*\(|\bassert\b|\bexpect\s*\(/;

/** git's --name-status lines -> [{ status, path, to? }]. Pure. */
export function parseStatus(text) {
  return String(text || '').split('\n').filter(Boolean).map((l) => { const [s, a, b] = l.split('\t'); return { status: s[0], path: a, ...(b ? { to: b } : {}) }; });
}

/** every entry a JSON value registers: object key paths, and array items by their id/name/slug/ask/at or their whole value. Pure. */
export function entries(v, at = '') {
  const out = new Set();
  const walk = (x, p) => {
    if (Array.isArray(x)) {
      x.forEach((it) => {
        const id = it && typeof it === 'object' && !Array.isArray(it) ? (it.id ?? it.name ?? it.slug ?? it.site ?? it.ask ?? it.page ?? it.at) : undefined;
        const k = p + '[' + (id !== undefined ? String(id) : typeof it === 'object' ? JSON.stringify(it) : String(it)) + ']';
        out.add(k);
        if (it && typeof it === 'object' && id !== undefined) walk(it, k); // an item without an id is matched whole
      });
    } else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) { const q = p + '.' + k; out.add(q); walk(y, q); }
  };
  walk(v, at);
  return out;
}

/** numbers under score-like keys, by path. Pure. */
export function scores(v) {
  const out = new Map();
  const walk = (x, p) => {
    if (Array.isArray(x)) x.forEach((it) => { const id = it && typeof it === 'object' ? (it.id ?? it.name ?? it.slug ?? it.site ?? it.page) : undefined; if (id !== undefined) walk(it, p + '[' + id + ']'); });
    else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) { const q = p + '.' + k; if (typeof y === 'number' && SCORE_KEY.test(k)) out.set(q, y); else walk(y, q); }
  };
  walk(v, '');
  return out;
}

/** The rules, on a list of changes and a reader for each side. read(side, path) -> text or null. -> [why, ...]. Pure but for read. */
export function addOnly(changes, read) {
  const why = [];
  for (const c of changes) {
    if (c.status === 'D' && !SHRINK_OK.includes(c.path)) why.push('deletes ' + c.path);
    if (c.status === 'R') why.push('renames ' + c.path + ' to ' + c.to);
    if (c.status !== 'M') continue;
    const a = read('base', c.path), b = read('head', c.path);
    if (a == null || b == null) continue;
    if (!SHRINK_OK.includes(c.path) && b.split('\n').length < a.split('\n').length) why.push('shortens ' + c.path + ' (' + a.split('\n').length + ' lines to ' + b.split('\n').length + ')');
    if (TEST_FILE.test(c.path)) {
      const kept = new Set(b.split('\n').map((l) => l.trim()));
      const gone = a.split('\n').map((l) => l.trim()).filter((l) => TEST_LINE.test(l) && !kept.has(l));
      if (gone.length) why.push('takes ' + gone.length + ' test line' + (gone.length === 1 ? '' : 's') + ' out of ' + c.path + ' (first: ' + gone[0].slice(0, 80) + ')');
    }
    if (/\.json$/.test(c.path)) {
      let ja, jb; try { ja = JSON.parse(a); jb = JSON.parse(b); } catch (_) { if (REGISTRIES.includes(c.path)) why.push(c.path + ' is no longer valid JSON'); continue; }
      if (REGISTRIES.includes(c.path)) { const have = entries(jb), lost = [...entries(ja)].filter((k) => !have.has(k)); if (lost.length) why.push('removes ' + lost.length + ' entr' + (lost.length === 1 ? 'y' : 'ies') + ' from ' + c.path + ' (first: ' + lost[0].slice(0, 80) + ')'); }
      const sb = scores(jb); for (const [k, n] of scores(ja)) if (sb.has(k) && sb.get(k) < n) { why.push('drops ' + c.path + k + ' from ' + n + ' to ' + sb.get(k)); break; }
    }
  }
  return why;
}

/** The working tree (staged, unstaged and new files) against base, in the repo at cwd. -> [why, ...] */
export function check(cwd = process.cwd(), base = 'origin/main') {
  const git = (...a) => spawnSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  spawnSync('git', ['add', '-A', '--intent-to-add'], { cwd }); // new files show as added, never as nothing
  const st = git('diff', '--name-status', '-M', base);
  if (st.status) return ['could not compare with ' + base + ': ' + String(st.stderr).trim()];
  const read = (side, p) => { if (side === 'head') return existsSync(resolve(cwd, p)) ? readFileSync(resolve(cwd, p), 'utf8') : null; const r = git('show', base + ':' + p); return r.status ? null : r.stdout; };
  return addOnly(parseStatus(st.stdout), read);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--base'), base = i > 0 ? process.argv[i + 1] : 'origin/main';
  const why = check(process.cwd(), base);
  if (why.length) { for (const w of why) console.log('add-only: ' + w); process.exit(1); }
  console.log('add-only: nothing taken away');
}
