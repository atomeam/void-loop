#!/usr/bin/env node
// The judge of the fringe → core loop (owner, 2026-10-13: "if you want void to be truly self-sustaining, you need to focus on
// the feedback loops between the fringe experiments and the core"): how often people really open each lab experiment
// (lib/used.js, counted through /api/miss) can lift it into the core, and only that:
//   promote     opened on PROMOTE_DAYS or more different days in the last 30, and its self-test is held on main (the page has
//               a selftest() and the browser suite's lab check runs it): a want to make it a core skill of its own
//   test first  opened that often but no self-test runs on main: a want to add one
// Use only ever adds. Nothing is retired or shelved for going unused (owner, 2026-10-13: "Remember no one knows about our site
// yet, so don't throw out skills just because no one uses them; that's a disaster."; docs/RULES.md).
// Wants only: tools/will.py adds them to Verse's will, and a builder still takes each through a PR, Verse's review and the suite.
// With no count to read (no token, the endpoint down) nothing is judged.
//   node tools/lab-use.mjs            the verdicts, in words
//   node tools/lab-use.mjs --json     the same, for tools/will.py
// Needs VOID_MISSES_TOKEN (owner-only GET /api/misses?used=1); VOID_USED_FILE = a saved copy of that answer, for tests.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PROMOTE_DAYS = 3;

/** the verdicts. tools: [{ id, label }]; used: [{ id, days, opens, last }]; selfTested: Set of ids. Pure. */
export function judge({ tools = [], used = [], selfTested = new Set() } = {}) {
  const by = new Map(used.map((u) => [u.id, u])), out = [];
  for (const t of tools) {
    const u = by.get(t.id);
    if (u && u.days >= PROMOTE_DAYS) {
      if (selfTested.has(t.id)) out.push({ verdict: 'promote', ...t, days: u.days, opens: u.opens, why: `opened on ${u.days} different days in the last 30 (${u.opens} opens), and its self-test is held on main` });
      else out.push({ verdict: 'test first', ...t, days: u.days, opens: u.opens, why: `opened on ${u.days} different days in the last 30, but no self-test runs on main: add it to the lab check before it becomes a core skill` });
    }
  }
  const rank = { promote: 0, 'test first': 1 };
  return out.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.days - a.days || a.id.localeCompare(b.id));
}

/** the ids the browser suite's lab check runs, whose page defines selftest() */
export function selfTestedIds(suite, pageOf) {
  const m = /const lab = \[([\s\S]*?)\];/.exec(suite);
  const ids = m ? [...m[1].matchAll(/'([a-z0-9-]+)'\]/g)].map((x) => x[1]) : [];
  return new Set(ids.filter((id) => /selftest\s*[:(=]/.test(pageOf(id) || '')));
}

async function usedNow() {
  if (process.env.VOID_USED_FILE) return JSON.parse(readFileSync(resolve(process.env.VOID_USED_FILE), 'utf8')).used;
  const tok = process.env.VOID_MISSES_TOKEN;
  if (!tok) return null;
  const res = await fetch((process.env.VOID_SITE || 'https://a-to-mind.com') + '/api/misses?used=1', { headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-lab-use/1.0' }, signal: AbortSignal.timeout(30e3) });
  if (!res.ok) throw new Error('GET /api/misses?used=1: HTTP ' + res.status);
  return (await res.json()).used;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = process.argv.includes('--json');
  let used = null;
  try { used = await usedNow(); } catch (e) { console.error('lab-use: ' + e.message); }
  if (!Array.isArray(used)) { if (json) console.log('[]'); else console.log('No use count to read (VOID_MISSES_TOKEN or VOID_USED_FILE): nothing judged.'); process.exit(0); }
  const { toolList } = await import('../void-live-deploy/skills/make.js');
  const page = (id) => { const p = resolve(root, 'void-live-deploy/fringe', id + '.html'); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
  const vs = judge({ tools: toolList(), used, selfTested: selfTestedIds(readFileSync(resolve(root, 'tools/test_void.mjs'), 'utf8'), page) });
  if (json) { console.log(JSON.stringify(vs)); process.exit(0); }
  if (!vs.length) console.log(`Nothing to lift yet: no experiment opened on ${PROMOTE_DAYS}+ different days.`);
  for (const v of vs) console.log(`[${v.verdict}] ${v.label} (${v.id}): ${v.why}`);
}
