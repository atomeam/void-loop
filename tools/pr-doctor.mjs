// What to do with one stuck pull request. Update a branch that fell behind, regenerate a stale generated file,
// or hand a failing check to Verse's coder. Never close a pull request, and never skip or disable a check.
//   node tools/pr-doctor.mjs < pulls.json     one plan as JSON, or null
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NEVER = ['close', 'skip', 'disable'];
const DO = new Set(['update', 'regenerate', 'fix']);

/** the steps for one pull request, oldest work first. Pure. */
export function planFor(pr = {}) {
  const steps = [];
  if (pr.behind || pr.mergeable === 'behind' || pr.mergeable === 'dirty') steps.push({ do: 'update', why: 'behind main' });
  if (pr.generatedStale) steps.push({ do: 'regenerate', why: 'a generated file is stale; regenerate it, do not skip the check' });
  for (const name of pr.failing || []) if (name) steps.push({ do: 'fix', check: String(name), why: 'failing check ' + name + ': fix the code, never the test' });
  return { number: pr.number, ref: pr.ref || '', steps: steps.filter((s) => DO.has(s.do)), never: NEVER };
}

/** the oldest open pull request that has a step, or null. Closed and merged pulls are left as they are. Pure. */
export function pickOne(prs) {
  const open = (prs || []).filter((p) => p && !p.merged_at && p.state !== 'closed');
  const ranked = open.map((p) => planFor(p)).filter((p) => p.steps.length);
  ranked.sort((a, b) => String((open.find((p) => p.number === a.number) || {}).updated || '').localeCompare(String((open.find((p) => p.number === b.number) || {}).updated || '')));
  return ranked[0] || null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = readFileSync(0, 'utf8').trim();
  let prs;
  try { const v = JSON.parse(text); prs = Array.isArray(v) ? v : [v]; } catch (e) {
    try { prs = text.split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_) { console.error('pr-doctor: stdin must be JSON: ' + e.message); process.exit(2); }
  }
  const plan = pickOne(prs);
  console.log(JSON.stringify(plan));
  process.exit(plan ? 0 : 3);
}
