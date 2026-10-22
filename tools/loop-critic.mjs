// Self-critique before ship (docs/LOOP-GAPS.md: Self-Refine's feedback step, Reflexion's evaluator). A deterministic critic
// reads the lines a change adds to what visitors see (growth ledger entries, cards, previews) and names each problem, so a
// patch is fixed before it merges instead of after Adam spots it. No model: every rule is a pattern with a reason.
//   node tools/loop-critic.mjs [<base>]     critiques `git diff <base>...HEAD` (default origin/main); exit 1 on any finding
// Rules (owner, 2026-10-21): full sentences, no cut-off text; specific built/improved detail, never a vague count; no roleplay
// or unverified claims.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RULES = [
  ['cut-off', /\w(\.\.\.|…)\s*["',}\]]*\s*$/, 'ends in an ellipsis: show the full sentence'],
  ['vague-count', /\b\d+\s+(benchmark\s+)?asks?\(s\)|\b\d+\s+(things|improvements|fixes|changes)\b(?![^"]*:)/i, 'a count with no list: name the actual phrases and the skill each opens'],
  ['vague-word', /"(what|show)"\s*:\s*"(various|misc|several|some) (fixes|improvements|tweaks|updates)/i, 'vague category: say exactly what changed'],
  ['roleplay', /\bI (truly |really )?(feel|felt|am (alive|conscious|sentient)|dream(ed)?|love you)\b/i, 'roleplay: Verse states only what it did or measured'],
  ['unverified', /\b(guaranteed|100% (accurate|uptime)|always works|never fails|best in the world)\b/i, 'unverified claim: back it with a check or remove it'],
];
const SEEN = /(void\.growth\.json|void-live-deploy\/(skills|lib)\/|void\.html|\.card|preview)/;
export function critique(diff) {
  const out = []; let file = '';
  for (const l of String(diff).split('\n')) {
    if (l.startsWith('+++ ')) { file = l.slice(6); continue; }
    if (!l.startsWith('+') || l.startsWith('+++') || !SEEN.test(file)) continue;
    for (const [id, re, why] of RULES) if (re.test(l.slice(1))) out.push({ id, file, line: l.slice(1).trim().slice(0, 160), why });
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] || 'origin/main';
  const f = critique(execFileSync('git', ['diff', '-U0', `${base}...HEAD`], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  for (const x of f) console.log(`::warning file=${x.file},title=critic ${x.id}::${x.why} — ${x.line}`);
  console.log(f.length ? `critic: ${f.length} finding(s)` : 'critic: clean');
  process.exit(f.length ? 1 : 0);
}
