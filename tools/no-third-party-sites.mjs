// no-third-party-sites: public files under void-live-deploy/ must not name competitor sites.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const FORBIDDEN = ['dalyfeds.com', 'fnyfeds.com', 'wshareit.com'];
const DIR = resolve(root, 'void-live-deploy');

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
  for (const d of FORBIDDEN) {
    if (text.includes(d)) hits.push(relative(root, f) + ': ' + d);
  }
}
if (hits.length) {
  console.log('FAIL no-third-party-sites: ' + hits.join(', '));
  process.exit(1);
} else {
  console.log('ok no-third-party-sites: no forbidden third-party site names found');
}
