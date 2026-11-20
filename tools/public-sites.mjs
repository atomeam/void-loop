// No rival names on public pages (owner, 2026-11-13). The growth ledger, the asks, what Verse learned and Verse's facts about itself are
// served as plain JSON, and their free text names the sites Versus studies. The deploy runs this on its own copy just before upload
// (after tools/public-quotes.mjs, which calls it, so deploy.yml needs no step of its own): each studied site's name or link becomes "another site", and self.json's `tower` keeps only its counts.
// The repo's files stay as they are (append-only records); this never runs on a commit.
//   node tools/public-sites.mjs          rewrite the deploy copy (deploy.yml)
//   node tools/public-sites.mjs --dry    print what it would change
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { deepScrub } from '../void-live-deploy/lib/scrub-sites.js';

export const SERVED = ['self.json', 'void.asks.json', 'void.growth.json', 'void.knowledge.json', 'skills/what.json', 'skills/families.json', 'skills/guide.json'];

/** self.json as served: the tower keeps how many are beaten and how many there are, never which site is next. Pure. */
export function publicSelf(self) {
  const out = deepScrub(self);
  if (out && out.tower) out.tower = { beaten: self.tower.beaten, total: self.tower.total };
  return out;
}

/** rewrite the deploy copy of the served files (tools/public-quotes.mjs calls this from deploy.yml; `node tools/public-sites.mjs` runs it alone). */
export function cleanServed(dry = false) {
  for (const f of SERVED) {
    const p = new URL('../void-live-deploy/' + f, import.meta.url);
    if (!existsSync(p)) continue;
    const src = readFileSync(p, 'utf8'), j = JSON.parse(src), out = JSON.stringify(f === 'self.json' ? publicSelf(j) : deepScrub(j), null, 1) + '\n';
    const changed = JSON.stringify(j) !== JSON.stringify(JSON.parse(out));
    console.log(`public sites: ${f} ${changed ? (dry ? 'would change' : 'cleaned') : 'already clean'}`);
    if (changed && !dry) writeFileSync(p, out);
  }
}
if (process.argv[1] && new URL(import.meta.url).pathname === new URL('file://' + process.argv[1]).pathname) cleanServed(process.argv.includes('--dry'));
