// audit-sanity: public HTML, JS, and worker/API endpoints must not use lore/rivalry copy or name competitor sites.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIR = resolve(root, 'void-live-deploy');
const FORBIDDEN_DOMAINS = ['dalyfeds.com', 'fnyfeds.com', 'wshareit.com', 'googletagmanager.com'];
const FORBIDDEN_LORE = ['THE RACE', "Tower's browser run", 'deck Verse built', 'take on dalyfeds'];

function walk(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(html|js|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

const hits = [];
for (const f of walk(DIR)) {
  if (relative(root, f).replace(/\\/g, '/').includes('void-live-deploy/internet-history/')) continue;
  const text = readFileSync(f, 'utf8');
  const rel = relative(root, f);
  for (const d of FORBIDDEN_DOMAINS) {
    if (text.includes(d)) { hits.push(rel + ': forbidden domain ' + d); break; }
  }
  for (const lore of FORBIDDEN_LORE) {
    if (text.includes(lore)) { hits.push(rel + ': lore copy "' + lore + '"'); break; }
  }
}
if (hits.length) {
  console.log('FAIL audit-sanity: ' + hits.join(', '));
  process.exit(1);
} else {
  console.log('ok audit-sanity: no forbidden domains or lore copy found');
}
