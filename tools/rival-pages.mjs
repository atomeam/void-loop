// Every rival on the tower has its own page (docs/TOWER-RULES.md rule 8): a-to-mind.com/rival/?site=<slug> reads void-live-deploy/rivals/<slug>.json,
// written here from the rival's feature study (docs/PARITY/<slug>.md, tools/parity.mjs) and joined on the page with its own history
// (void-live-deploy/history/<slug>.json, tools/site-history.mjs). rivals/index.json maps each rival to its Verse page (lib/tower.js `page`:
// LANE_PAGES, the hand floors and the topic pages, never a new page) and each Verse page to every rival it covers, with the union of their
// features (rule 7): a page that covers several rivals must carry every feature any of them has, and its floors count as assimilated only when
// every rival on it is (lib/tower.js pageGroups).
//   node tools/rival-pages.mjs           write void-live-deploy/rivals/
//   node tools/rival-pages.mjs --check   exit 1 when a file is stale or missing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tower, towerArgs, basePage } from '../void-live-deploy/lib/tower.js';
import { siteSlug } from '../void-live-deploy/lib/obituary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), SITE = path.join(ROOT, 'void-live-deploy'), OUT = path.join(SITE, 'rivals'), DOCS = path.join(ROOT, 'docs', 'PARITY');
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SITE, f), 'utf8')); } catch (_) { return null; } };
const STATUS = ['missing', 'partial', 'unreviewed', 'have'];
/** the feature rows of a docs/PARITY page: [{ feature, area, status, original, verse }]. Pure. */
export function featuresOf(md) {
  const out = [];
  for (const line of String(md || '').split('\n')) {
    if (!/^\| /.test(line)) continue;
    const cells = line.replace(/^\|\s*|\s*\|\s*$/g, '').split(/\s(?<!\\)\|\s/).map((c) => c.replace(/\\\|/g, '|').trim());
    if (cells.length < 5 || cells[0] === 'Feature' || /^-+$/.test(cells[0]) || !STATUS.includes(cells[2])) continue;
    out.push({ feature: cells[0], area: cells[1], status: cells[2], original: cells[3], verse: cells[4].replace(/`/g, '') });
  }
  return out;
}
/** the original's name and address from a docs/PARITY page ("- Original: X (url)"). Pure. */
export const originalOf = (md) => { const m = String(md || '').match(/^- Original: (.+?) \((https?:[^)\s]+)\)/m); return m ? { site: m[1], url: m[2] } : null; };
/** the worst status of one feature across the rivals that have it (a combined page has it only when it has it for every one). Pure. */
const worst = (a, b) => (STATUS.indexOf(a) <= STATUS.indexOf(b) ? a : b);
/** every file: { files: { 'slug.json': obj }, index }. Pure over its inputs. */
export function build({ floors, docs }) {
  const bySlug = new Map();
  for (const f of floors) { const s = siteSlug(f.site); if (!docs[s]) continue; if (!bySlug.has(s)) bySlug.set(s, []); bySlug.get(s).push(f); }
  const files = {}, rivals = {}, pages = {};
  for (const [slug, fl] of [...bySlug].sort((a, b) => a[0].localeCompare(b[0]))) {
    const md = docs[slug], o = originalOf(md) || { site: fl[0].site, url: fl[0].url }, features = featuresOf(md);
    const verse = fl.filter((f) => f.page).map((f) => ({ floor: f.id, page: f.page, base: basePage(f.page), assimilated: !!f.beaten }));
    const count = (st) => features.filter((x) => x.status === st).length, total = features.length;
    files[slug + '.json'] = { site: o.site, slug, url: o.url, verse, match: { pct: total ? Math.round(100 * count('have') / total) : 0, have: count('have'), partial: count('partial'), missing: count('missing'), unreviewed: count('unreviewed'), total }, features, lacks: features.filter((x) => x.status !== 'have').map((x) => ({ feature: x.feature, status: x.status, original: x.original })), study: 'docs/PARITY/' + slug + '.md', history: '/history/' + slug + '.json' };
    rivals[slug] = { site: o.site, pages: [...new Set(verse.map((v) => v.base))] };
    for (const v of verse) {
      const p = pages[v.base] || (pages[v.base] = { rivals: [], union: {} });
      if (!p.rivals.includes(slug)) p.rivals.push(slug);
      for (const x of features) { const u = p.union[x.feature] || (p.union[x.feature] = { status: x.status, rivals: [] }); u.status = worst(u.status, x.status); if (!u.rivals.includes(slug)) u.rivals.push(slug); }
    }
  }
  for (const p of Object.values(pages)) p.union = Object.entries(p.union).map(([feature, u]) => ({ feature, ...u })).sort((a, b) => a.feature.localeCompare(b.feature));
  const index = { about: 'Written by tools/rival-pages.mjs. Each rival (a site on the tower) and the Verse pages that take it on; each Verse page and every rival it covers, with the union of their features: the worst status a feature has for any of them. A page is assimilated only when every rival on it is (docs/TOWER-RULES.md).', rivals, pages };
  return { files, index };
}
const readDocs = () => Object.fromEntries(fs.readdirSync(DOCS).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => [f.replace(/\.md$/, ''), fs.readFileSync(path.join(DOCS, f), 'utf8')]));
export function current() {
  const tg = rd('tower.target.json'), args = towerArgs((rd('lap.items.json') || {}).onlySite || [], { ev: rd('tower.evidence.json'), fr: rd('tower.frontier.json'), tg, gn: rd('tower.gone.json'), pa: rd('parity.json') });
  return build({ floors: tower(...args).floors, docs: readDocs() });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { files, index } = current(), all = { ...files, 'index.json': index }, check = process.argv.includes('--check');
  let stale = 0;
  if (!check) fs.mkdirSync(OUT, { recursive: true });
  for (const [name, obj] of Object.entries(all)) {
    const p = path.join(OUT, name), txt = JSON.stringify(obj) + '\n';
    if (check) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== txt) { stale++; console.log('stale: rivals/' + name); } } else if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== txt) fs.writeFileSync(p, txt);
  }
  console.log((check ? 'checked ' : 'wrote ') + Object.keys(all).length + ' rival files' + (stale ? ', ' + stale + ' stale (run node tools/rival-pages.mjs)' : ''));
  if (check && stale) process.exit(1);
}
