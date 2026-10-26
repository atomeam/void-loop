// Verse's SEO tool over Verse's own pages (lib/seo-audit.js): every HTML page in void-live-deploy/, what a search engine would trip on,
// pages nothing links to, and which free pages lead to what Verse sells.
//   node tools/seo-audit.mjs            the defects page by page, then the totals
//   node tools/seo-audit.mjs --notes    the notes too (a title or description cut short in a result)
//   node tools/seo-audit.mjs --json     the whole result as JSON
//   node tools/seo-audit.mjs --check    exit 1 when there are more defects than tools/seo-audit.baseline.json allows (checks.mjs runs this;
//                                       the baseline only goes down: --write after a fix lowers it, and it never rises without a person)
//   node tools/seo-audit.mjs --write    write the current counts as the baseline
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPage, auditSite } from '../void-live-deploy/lib/seo-audit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', 'void-live-deploy');
const BASELINE = path.join(here, 'seo-audit.baseline.json');
// not pages a visitor lands on from a search: the libraries, the functions, the deploy's own internal views and the embed frame
const SKIP_DIR = new Set(['vendor', 'functions', 'lib', 'skills', 'node_modules', 'models', 'fonts', 'tower.shots', 'tower.icons', 'data', 'fringe']);
const SKIP_PAGE = /^\/(?:void\.html|404\.html|handoff\.html|studies\.html|surface\.html|calendar\/embed\/|store\/receipt\/)$/;

/** every file under the deploy as a site path ('/photos/index.html'), and the pages among them ('/photos/'). */
export function walk(dir = root, base = '') {
  const files = new Set(), pages = [];
  const go = (d, b) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(d, e.name), p = b + '/' + e.name;
    if (e.isDirectory()) { if (!(b === '' && SKIP_DIR.has(e.name)) || ['lib', 'skills', 'vendor', 'fonts', 'models', 'data'].includes(e.name)) go(full, p); continue; }
    files.add(p);
    if (e.name.endsWith('.html') && !(b === '' ? false : SKIP_DIR.has(b.split('/')[1]))) { const page = e.name === 'index.html' ? b + '/' : p; if (!SKIP_PAGE.test(page)) pages.push({ page, full }); }
  } };
  go(dir, base); return { files, pages };
}
/** the whole site's audit. */
export function run() {
  const { files, pages } = walk();
  return auditSite(pages.sort((a, b) => a.page.localeCompare(b.page)).map(({ page, full }) => auditPage(fs.readFileSync(full, 'utf8'), page, files)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), r = run();
  if (a.includes('--json')) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
  const counts = { pages: r.pages.length, defects: r.defects, notes: r.notes, byKind: r.byKind, orphans: r.orphans.length, toOffers: r.toOffers };
  if (a.includes('--write')) { fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 1) + '\n'); console.log('wrote', path.relative(process.cwd(), BASELINE), JSON.stringify(counts)); process.exit(0); }
  if (a.includes('--check')) {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    // notes are told, not held (a long description is a choice); duplicate titles are told and not held either: Verse's own tower-self loop builds a
  // page from its family's page and can repeat its title (a fault to fix in tools/tower-self.mjs, named in handoff.md), and a check must not stop that loop
  const held = (x) => x.defects - ((x.byKind && x.byKind.duplicate) || 0);
  const worse = held(r) > held(base) || r.orphans.length > base.orphans || r.toOffers < base.toOffers;
    console.log((worse ? 'FAIL' : 'ok') + ' seo-audit: ' + r.pages.length + ' pages, ' + r.defects + ' defects (' + held(r) + ' held, baseline ' + held(base) + '), ' + r.notes + ' notes (' + base.notes + '), ' + r.orphans.length + ' orphans (' + base.orphans + '), ' + r.toOffers + ' pages lead to an offer (' + base.toOffers + ')');
    if (worse) { for (const p of r.pages) for (const d of p.defects) console.log('  ' + p.path + '  ' + d.kind + ': ' + d.message); if (r.orphans.length > base.orphans) console.log('  orphans: ' + r.orphans.join(' ')); console.log('Fix them (node tools/seo-audit.mjs lists them), or after a fix that lowers a count: node tools/seo-audit.mjs --write'); }
    process.exit(worse ? 1 : 0);
  }
  if (a.includes('--notes')) for (const p of r.pages) for (const d of p.notes) console.log(p.path + '  note ' + d.kind + ': ' + d.message);
  for (const p of r.pages) for (const d of p.defects) console.log(p.path + '  ' + d.kind + ': ' + d.message);
  console.log('\norphans (nothing links to them): ' + (r.orphans.join(' ') || 'none'));
  console.log('pages leading to an offer: ' + r.toOffers + '; inbound per offer: ' + Object.entries(r.offers).map(([o, l]) => o + ' ' + l.length).join(', '));
  console.log('hardest descriptions (grade): ' + r.hardest.map((h) => h.path + ' ' + h.grade).join(', '));
  console.log('\n' + r.pages.length + ' pages, ' + r.notes + ' notes (titles and descriptions cut short in a result; --notes lists them), ' + r.defects + ' defects: ' + Object.entries(r.byKind).map(([k, n]) => k + ' ' + n).join(', '));
}
