// Self-Refine's loop (docs/LOOP-GAPS.md): critique, rewrite, critique again, until the critic is quiet or nothing more can be
// fixed by rule. Only mechanical rewrites are made, never new claims: a trailing ellipsis becomes a full stop on the sentence
// that is there, and a "N benchmark ask(s)" count is replaced by the listed phrases when the entry carries them. Anything else
// is left for a builder and reported.
//   node tools/loop-refine.mjs [--write]   refines the newest 50 entries of void-live-deploy/void.growth.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RULES } from './loop-critic.mjs';

export const findings = (t) => RULES.filter(([, re]) => re.test(t)).map(([id]) => id);
export function rewrite(t, e = {}) {
  let s = String(t);
  s = s.replace(/\s*(\.\.\.|…)\s*$/, '.').replace(/([.!?])\.$/, '$1');
  const asks = Array.isArray(e.asks) ? e.asks : Array.isArray(e.phrases) ? e.phrases : null;
  if (asks && asks.length) s = s.replace(/\b\d+\s+(benchmark\s+)?asks?\(s\)/i, asks.map((a) => `'${typeof a === 'string' ? a : a.ask}'${a && a.want ? ' opens ' + String(a.want).replace(/^skill:/, '') : ''}`).join(', '));
  return s;
}
/** refine until clean or no change, at most `max` passes. Returns { text, passes, left }. Pure. */
export function refine(t, e = {}, max = 3) {
  let text = String(t), passes = 0;
  while (passes < max && findings(text).length) { const n = rewrite(text, e); passes++; if (n === text) break; text = n; }
  return { text, passes, left: findings(text) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const F = new URL('../void-live-deploy/void.growth.json', import.meta.url); let raw = readFileSync(F, 'utf8'); const g = JSON.parse(raw);
  const list = Array.isArray(g) ? g : Object.values(g); let fixed = 0, left = 0;
  // the ledger's own layout is kept: each rewritten string is swapped in place in the file's text, nothing else moves
  for (const e of list.slice(-50)) for (const k of ['what', 'show']) if (e[k]) { const r = refine(e[k], e); if (r.text !== e[k]) { fixed++; raw = raw.replace(JSON.stringify(e[k]), JSON.stringify(r.text)); } if (r.left.length) { left++; console.log(`left (${r.left.join(',')}): ${r.text.slice(0, 120)}`); } }
  if (process.argv.includes('--write') && fixed) { JSON.parse(raw); writeFileSync(F, raw); }
  console.log(`refine: ${fixed} rewritten, ${left} left for a builder`);
}
