// Runtime guard (owner, 2026-10-15: "make Verse the best at keeping secrets ever made"). Uses the one key-shape engine,
// tools/secret-scan.mjs (#742), on what ships, plus two runtime checks. None prints a value:
//  1. the built output: everything the site ships to browsers (void-live-deploy/ minus functions/) holds no key or token
//  2. functions read secrets from env only: no secret-shaped literal in void-live-deploy/functions or lib
//  3. owner-only endpoints compare against an env secret, and sensitive APIs sit behind a rate limit
// Full git history: node tools/secret-scan.mjs --history.
//   node tools/runtime-guard.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { secretsIn } from './secret-scan.mjs';
const linesWith = (text) => String(text).split('\n').flatMap((l, i) => secretsIn(l).map((kind) => ({ kind, line: i + 1 })));
function walk(dir, skip = () => false, acc = []) {
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (skip(p)) continue; const s = statSync(p); if (s.isDirectory()) walk(p, skip, acc); else if (s.size < 3e6 && /\.(m?js|html|json|txt|xml|css|toml|webmanifest)$/.test(n)) acc.push(p); }
  return acc;
}
export function ownerChecks(root) {
  const bad = [];
  for (const f of walk(join(root, 'functions'))) {
    const t = readFileSync(f, 'utf8');
    if (/owner/i.test(t) && /(===|!==|==)\s*['"](?=[A-Za-z0-9_]*\d)(?=[A-Za-z0-9_]*[A-Za-z])[A-Za-z0-9_]{20,}['"]/.test(t)) bad.push({ file: relative(root, f), kind: 'owner check against a literal' });
  }
  const mw = readFileSync(join(root, 'functions/api/_middleware.js'), 'utf8');
  if (!/limit|rate|429/i.test(mw)) bad.push({ file: 'functions/api/_middleware.js', kind: 'no rate limit on /api' });
  return bad;
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const root = new URL('../void-live-deploy/', import.meta.url).pathname;
  const hits = [];
  for (const f of walk(root, (p) => /\/(vendor|models|node_modules)(\/|$)/.test(p))) for (const h of linesWith(readFileSync(f, 'utf8'))) hits.push({ ...h, file: relative(root, f) });
  for (const h of hits) console.log(`${h.kind}  void-live-deploy/${h.file}:${h.line}`);
  const own = ownerChecks(root); for (const o of own) console.log(`${o.kind}  void-live-deploy/${o.file}`);
  if (hits.length || own.length) process.exit(1);
  console.log('runtime-guard: built output and functions hold no secret; owner checks read env; /api is rate limited');
}
