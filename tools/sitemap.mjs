// The sitemap, generated (owner, 2026-10-25: "we should figure out a way for our site to pop up before all of our defeated sites"). It was hand-written
// and listed none of the tool pages, so a search engine found /base64/ or /convert/ only by luck. Now one list, drawn from the code that knows the pages:
// the home page, every tool page (lib/toolkit.js TOOLS), the tower pages, the pages Verse sells from, the /fix/ pages (tools/fix-pages.json) and every
// /is-it/<day> the function answers (skills/is-it.js DAYS, the weekdays, the weekend, a weekday, a leap year). lastmod is the day the page's file last
// changed in git (today for a file changed and not yet committed), so it is right only at the deploy: refresh.mjs runs it as a volatile step.
//   node tools/sitemap.mjs           write void-live-deploy/sitemap.xml
//   node tools/sitemap.mjs --check   exit 1 when the committed file lists a different set of pages (lastmod aside)
// Honest search presence only: every URL here answers, and nothing is listed twice (tools/sitemap.test.mjs).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PAGES as PHOTO_PAGES } from './photos-pages.mjs';
import { TOOLS } from '../void-live-deploy/lib/toolkit.js';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
import { DAYS, isIt } from '../void-live-deploy/skills/is-it.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = 'https://a-to-mind.com';
export const OUT = 'void-live-deploy/sitemap.xml';
const D = 'void-live-deploy/';

// the pages that were in the hand-written sitemap, kept: what Verse sells from, the hub pages, the guide for agents
const KEPT = [
  ['/cheat-codes/', 'weekly', '0.8', [D + 'cheat-codes/index.html']],
  ['/store/', 'weekly', '0.9', [D + 'store/index.html']],
  ['/code-review/', 'weekly', '0.9', [D + 'code-review/index.html']],
  ['/autopilot/', 'daily', '0.7', [D + 'autopilot/index.html', D + 'autopilot/app.js']], // what Verse did on its own (2026-10-30)
  ['/llms.txt', 'weekly', '0.5', [D + 'llms.txt']],
  ['/one-time-fix/', 'weekly', '0.8', [D + 'one-time-fix/index.html']],
  ['/keep-it-running/', 'weekly', '0.8', [D + 'keep-it-running/index.html']],
  ['/full-stack-audit/', 'weekly', '0.8', [D + 'full-stack-audit/index.html']],
  ['/first-automation-setup/', 'weekly', '0.8', [D + 'first-automation-setup/index.html']],
  // pages the site links to that no other list holds: Verse's own films and podcast, the obituaries studio, the markets screener
  ['/films/', 'weekly', '0.6', [D + 'films/index.html']],
  ['/podcast/', 'weekly', '0.6', [D + 'podcast/index.html']],
  ['/obituaries/', 'weekly', '0.7', [D + 'obituaries/index.html']],
  ['/markets/screener/', 'weekly', '0.7', [D + 'markets/screener/index.html']],
  // pages linked from the site and its footers that no list held, so neither a search engine nor the self-check opened them: the privacy policy,
  // the boards' rules, and the four pages under /generators/ (the editor, the character chat, the story writer, the forum)
  ['/privacy/', 'monthly', '0.3', [D + 'privacy/index.html']],
  ['/boards/rules/', 'monthly', '0.4', [D + 'boards/rules/index.html']],
  ['/generators/make/', 'weekly', '0.8', [D + 'generators/make/index.html']],
  ['/generators/chat/', 'weekly', '0.7', [D + 'generators/chat/index.html']],
  ['/generators/story/', 'weekly', '0.7', [D + 'generators/story/index.html']],
  ['/generators/forum/', 'weekly', '0.6', [D + 'generators/forum/index.html']],
];
// the /is-it/ pages are rendered by one function from one skill: a change to either is a change to every day
const IS_IT_FILES = [D + 'functions/is-it/[what].js', D + 'skills/is-it.js'];
const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'the-weekend', 'weekday', 'leap-year'];

/** one slug per day the function knows, the first name of each (christmas, not xmas), weekdays first; only slugs isIt answers. Pure. */
export function isItSlugs(days = DAYS) {
  const seen = new Set(), out = [];
  for (const [key, [name]] of Object.entries(days)) { if (seen.has(name)) continue; seen.add(name); out.push(key.replace(/\s+/g, '-')); }
  return [...WEEK, ...out].filter((slug) => isIt('is it ' + slug.replace(/-/g, ' ')));
}

/** the day a file last changed, from git ('YYYY-MM-DD'); today when it is changed in the working tree or has no commit yet. */
export function lastmod(files, cwd = root, today = new Date().toISOString().slice(0, 10)) {
  const present = files.filter((f) => existsSync(resolve(cwd, f)));
  if (!present.length) return today;
  const dirty = spawnSync('git', ['status', '--porcelain', '--', ...present], { cwd, encoding: 'utf8' });
  if (dirty.status === 0 && dirty.stdout.trim()) return today;
  const r = spawnSync('git', ['log', '-1', '--format=%cs', '--', ...present], { cwd, encoding: 'utf8' });
  const day = (r.stdout || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
}

/** the tower floors' own pages (lib/tower.js FLOORS page), each once, in floor order; `has(path)` says the page's file exists. Pure given has. */
export function floorPages(floors = FLOORS, has = () => true) {
  const seen = new Set(), out = [];
  for (const f of floors) { const p = f && f.page; if (typeof p !== 'string' || !/^\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)?$/.test(p) || seen.has(p) || !has(p)) continue; seen.add(p); out.push(p); }
  return out;
}

/** every page as { loc, changefreq, priority, files } in a fixed order; `fixPages` is tools/fix-pages.json, `floors` the floor pages that exist. Pure. */
export function pages({ tools = TOOLS, fixPages = [], days = DAYS, lab = [], floors = [] } = {}) {
  const out = [{ loc: '/', changefreq: 'daily', priority: '1.0', files: [D + 'index.html'] }];
  for (const p of Object.keys(tools)) out.push({ loc: p, changefreq: 'weekly', priority: '0.9', files: [D + p.slice(1) + 'index.html'] });
  for (const p of PHOTO_PAGES) out.push({ loc: '/photos/' + p.slug + '/', changefreq: 'weekly', priority: '0.8', files: [D + 'photos/' + p.slug + '/index.html'] }); // the photos lane's own pages (tools/photos-pages.mjs)
  out.push({ loc: '/conquered/', changefreq: 'daily', priority: '0.8', files: [D + 'conquered/index.html', D + 'tower.frontier.json'] });
  out.push({ loc: '/compare/', changefreq: 'daily', priority: '0.6', files: [D + 'compare/index.html', D + 'tower.frontier.json'] });
  for (const [loc, changefreq, priority, files] of KEPT) out.push({ loc, changefreq, priority, files });
  // the studios the tower floors link to (/paint/, /cpan/, /books/ ...): linked from /conquered/, so a person reaches them; now a search engine and the self-check do too
  const listed = new Set(out.map((e) => e.loc));
  for (const p of floors) if (!listed.has(p)) out.push({ loc: p, changefreq: 'weekly', priority: '0.7', files: [D + p.slice(1) + 'index.html'] });
  out.push({ loc: '/fix/', changefreq: 'monthly', priority: '0.8', files: [D + 'fix/index.html'] });
  for (const p of fixPages) out.push({ loc: '/fix/' + p.slug + '/', changefreq: 'monthly', priority: '0.7', files: [D + 'fix/' + p.slug + '/index.html'] });
  if (lab.length) { out.push({ loc: '/lab/', changefreq: 'daily', priority: '0.6', files: [D + 'lab/index.html', D + 'lab/catalog.json'] }); for (const slug of lab) out.push({ loc: '/lab/' + slug + '/', changefreq: 'monthly', priority: '0.4', files: [D + 'lab/' + slug + '/index.html'] }); } // the lab's experiments (tools/lab-import.mjs): the listed ones in lab/catalog.json
  for (const slug of isItSlugs(days)) out.push({ loc: '/is-it/' + slug, changefreq: 'daily', priority: '0.6', files: IS_IT_FILES });
  return out;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** the XML for entries [{ loc, lastmod, changefreq, priority }]. Pure. */
export function xml(entries) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + entries.map((e) => '  <url>\n    <loc>' + esc(SITE + e.loc) + '</loc>\n    <lastmod>' + esc(e.lastmod) + '</lastmod>\n    <changefreq>' + e.changefreq + '</changefreq>\n    <priority>' + e.priority + '</priority>\n  </url>\n').join('')
    + '</urlset>\n';
}

/** the <loc> values of a sitemap, in order. Pure. */
export const locsOf = (text) => [...String(text || '').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

export function build(cwd = root) {
  const fixPages = JSON.parse(readFileSync(resolve(cwd, 'tools/fix-pages.json'), 'utf8'));
  const labFile = resolve(cwd, 'void-live-deploy/lab/catalog.json');
  const lab = existsSync(labFile) ? JSON.parse(readFileSync(labFile, 'utf8')).filter((e) => e.status !== 'broken').map((e) => e.slug).sort() : [];
  const floors = floorPages(FLOORS, (p) => existsSync(resolve(cwd, D + p.slice(1) + 'index.html')));
  return pages({ fixPages, lab, floors }).map((p) => ({ ...p, lastmod: lastmod(p.files, cwd) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = build(), text = xml(entries), file = resolve(root, OUT);
  if (process.argv.includes('--check')) {
    const have = existsSync(file) ? locsOf(readFileSync(file, 'utf8')) : [], want = locsOf(text);
    const missing = want.filter((u) => !have.includes(u)), extra = have.filter((u) => !want.includes(u));
    if (missing.length || extra.length) { console.error('sitemap.xml is stale (node tools/sitemap.mjs): missing ' + missing.join(', ') + (extra.length ? '; extra ' + extra.join(', ') : '')); process.exit(1); }
    console.log('ok: sitemap.xml lists ' + have.length + ' pages');
  } else { writeFileSync(file, text); console.log('wrote ' + OUT + ': ' + entries.length + ' pages'); }
}
