#!/usr/bin/env node
// Verse proposes its own architectural upgrades (owner, 2026-10-13: "if it can already identify its own friction points, it needs to
// start suggesting its own architectural upgrades"). Each proposal ties a measured friction to the component that causes it and a
// concrete change, ranked by impact over cost. Proposals only: they reach Verse's will (tools/will.py) and a builder, and every
// change still goes through a PR, Verse's review and the full suite on main, which reverts what breaks (the sandbox and the
// canary Verse asked for already exist; nothing here changes code on its own).
//   node tools/upgrades.mjs            the ranked proposals, in words
//   node tools/upgrades.mjs --json     the same, for tools/will.py
// Evidence, all read from the repo:
//   hotspots   a file that is both large and changed often (lines x commits in the last 30 days; git history needed, the will's
//              workflow fetches it), with its largest function: the place where bugs come from (complexity times churn)
//   flaky      an area whose checks went red on main more than once (tools/flakes.json, the spotter's record)
//   failing    a skill the everyday benchmark got wrong on its last clean run (void-live-deploy/skills/families.json)
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = /^(?:void\.html|void-live-deploy\/(?:lib|skills|functions)\/.+\.js)$/;

/** the largest function in a source text, by lines (function declarations and `name = (...) =>` blocks, braces counted outside
 *  strings and comments): { name, lines } or null. Approximate on purpose; it names a place to look, not a measure to trust. */
export function largestFunction(text) {
  const src = String(text || ''), lines = src.split('\n');
  let best = null;
  const head = /(?:^|[^\w$.])(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  for (const m of src.matchAll(head)) {
    const open = src.indexOf('{', m.index + m[0].length - 1);
    if (open < 0) continue;
    let depth = 0, i = open, q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
      // a regex literal (a / where a value cannot end: after an operator, a bracket or a keyword) is skipped like a string
      if (c === '/' && /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase)\s*$/.test(src.slice(Math.max(0, i - 12), i))) {
        let cls = false;
        for (i++; i < src.length && src[i] !== '\n'; i++) { const d = src[i]; if (d === '\\') { i++; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; }
        continue;
      }
      if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
    }
    const n = src.slice(open, i).split('\n').length;
    if (!best || n > best.lines) best = { name: m[1] || m[2], lines: n, at: src.slice(0, m.index).split('\n').length + 1 };
  }
  return best && best.lines <= lines.length ? best : null;
}

/** the proposals from the evidence, ranked (impact / cost, highest first). Pure. */
export function propose({ churn = {}, files = {}, flakes = [], families = null } = {}) {
  const out = [];
  // hotspots: lines x commits; the top three files with real churn
  const hot = Object.entries(churn).filter(([f, n]) => n >= 5 && files[f]).map(([f, n]) => ({ f, n, lines: files[f].split('\n').length, big: largestFunction(files[f]) }))
    .sort((a, b) => b.n * b.lines - a.n * a.lines).slice(0, 3);
  for (const h of hot) {
    const fn = h.big && h.big.lines >= 80 ? h.big : null;
    out.push({ kind: 'hotspot', component: h.f + (fn ? ' · ' + fn.name + '()' : ''),
      evidence: `${h.lines} lines, changed in ${h.n} commits in the last 30 days` + (fn ? `; its largest function, ${fn.name}, is about ${fn.lines} lines (line ${fn.at})` : ''),
      action: fn ? `split ${fn.name}() into small named parts (a table of handlers in place of one long chain), then move it out of ${h.f} into its own module with its own tests`
        : `split ${h.f} by responsibility into modules with their own tests`,
      impact: Math.min(10, Math.round(Math.log2(h.n * h.lines))), cost: fn ? 3 : 5 });
  }
  // flaky areas: the check's own label up to its colon, red on main twice or more
  const areas = {};
  for (const x of Array.isArray(flakes) ? flakes : []) { const a = String((x && x.check) || '').toLowerCase().split(/[:(]/)[0].trim().slice(0, 50); if (a && a !== 'suite ran to the end') (areas[a] = areas[a] || []).push(x); } // the suite's own crash check is no area of Verse
  for (const [a, xs] of Object.entries(areas).filter(([, xs]) => xs.length >= 2).sort((p, q) => q[1].length - p[1].length).slice(0, 3))
    out.push({ kind: 'flaky', component: 'the "' + a + '" checks', evidence: `red on main ${xs.length} times (tools/flakes.json), last ${String(xs[xs.length - 1].at || '').slice(0, 10)}`,
      action: 'find what those checks wait on (a fixed timeout, an animation, a race with a fetch) and make them wait on the state they assert, so a slow machine cannot turn main red', impact: Math.min(10, 3 + 2 * xs.length), cost: 2 });
  // failing skills
  const skills = families && Array.isArray(families.families) ? families.families.flatMap((f) => f.skills || []) : [];
  for (const s of skills.filter((x) => Array.isArray(x.failing) && x.failing.length).slice(0, 3))
    out.push({ kind: 'failing', component: 'skills/' + s.name + '.js', evidence: `the benchmark got ${s.failing.length} of its asks wrong: ${s.failing.map((a) => '"' + a + '"').join(', ')}`,
      action: `widen ${s.name}'s match to those wordings, add each as an example, and check the router still sends its near-misses elsewhere`, impact: 4 + 2 * s.failing.length, cost: 1 });
  return out.map((p) => ({ ...p, score: Math.round((p.impact / p.cost) * 10) / 10 })).sort((a, b) => b.score - a.score);
}

/** what the repo shows: commits per source file in the last 30 days, the files, the flakes and the families */
export function evidence(git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) {
  const churn = {};
  try { for (const f of git(['log', '--since=30 days ago', '--name-only', '--format=']).split('\n')) if (SOURCES.test(f)) churn[f] = (churn[f] || 0) + 1; } catch (_) {}
  const files = {};
  for (const f of Object.keys(churn)) { const p = resolve(root, f); if (existsSync(p)) files[f] = readFileSync(p, 'utf8'); }
  const json = (p) => { try { return JSON.parse(readFileSync(resolve(root, p), 'utf8')); } catch (_) { return null; } };
  return { churn, files, flakes: json('tools/flakes.json') || [], families: json('void-live-deploy/skills/families.json') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ps = propose(evidence());
  if (process.argv.includes('--json')) { console.log(JSON.stringify(ps)); process.exit(0); }
  if (!ps.length) { console.log('No upgrade proposals: no hotspot, flaky area or failing skill in the evidence (is the git history there?).'); process.exit(0); }
  console.log('Verse\'s architectural upgrades, ranked by impact over cost (proposals: each goes through a PR, Verse\'s review and the suite on main):\n');
  ps.forEach((p, i) => console.log(`${i + 1}. [${p.kind}] ${p.component}  (impact ${p.impact}, cost ${p.cost}, score ${p.score})\n   why: ${p.evidence}\n   do:  ${p.action}\n`));
}
