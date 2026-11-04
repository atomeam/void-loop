// Every site Verse has assimilated or tried to, in one list (owner, 2026-11-03: "I want a history of every site we assimilate somewhere easy
// to find"): void-live-deploy/assimilated.json, which a-to-mind.com/assimilated/ shows. Generated, never kept by hand, from what the repo
// already records, so nothing in it is made up:
//   - lib/tool-sites.js SITE_PAGES and lib/self-sites.js SELF_SITES: each site a Verse page was built from ("<lane>: <host>"), with what it took
//   - domains/tower-self.json: each site Versus by itself read, what came of it and why, and (from 2026-11-03) its ease score when picked
//   - the tower (lib/tower.js with the published tower.*.json): the floors Verse has surpassed and when they were last measured
//   - domains/assimilated.backfill.json: the commit that first named each site, from git history (node tools/assimilated.mjs --backfill)
// It runs in tools/tower-self-land.sh after every Versus run, and as a volatile refresh step at every deploy (tools/refresh.mjs), so the page
// is current without anyone touching it.
//   node tools/assimilated.mjs             write void-live-deploy/assimilated.json
//   node tools/assimilated.mjs --check     exit 1 when the committed file is not what this writes
//   node tools/assimilated.mjs --backfill  rewrite domains/assimilated.backfill.json from git (needs the full history)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { topicOf } from '../void-live-deploy/lib/tower-topic.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = 'void-live-deploy/assimilated.json', BACKFILL = 'domains/assimilated.backfill.json', REPO = 'https://github.com/atomeam/void-loop';
// the files whose history names the sites, oldest evidence first
export const SOURCES = ['void-live-deploy/lib/tool-sites.js', 'void-live-deploy/lib/self-sites.js', 'domains/tower-self.json', 'void-live-deploy/lib/tower.js'];
// how far each outcome got, so a site's row shows the furthest one (a site built and then surpassed reads surpassed)
const RANK = { surpassed: 6, passed: 5.8, current: 5.5, assimilated: 5, covered: 5, built: 5, 'page built': 5, discarded: 3, 'not-judged': 2, 'no-family': 1, walled: 1, gone: 1 };
const LABEL = { surpassed: 'surpassed', passed: 'passed, conquering in background', current: 'now assimilating', covered: 'assimilated into an existing page', assimilated: 'assimilated', built: 'assimilated', 'page built': 'assimilated', discarded: 'built, then discarded', 'not-judged': 'read, not judged yet', 'no-family': 'read, no page family fits it', walled: 'walled', gone: 'could not be read' };

const read = (cwd, f) => { try { return JSON.parse(readFileSync(resolve(cwd, f), 'utf8')); } catch (_) { return null; } };
export const hostOf = (u) => { try { return new URL(/^https?:/.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
const what = (r) => { const t = r.tools || r.panels || r.features; return !t ? '' : (Array.isArray(t) ? t : Object.keys(t)).join(', '); };

/** the rows, newest first, from the already-loaded inputs. Pure. */
export function historyOf({ sitePages = [], selfSites = [], state = { sites: {} }, floors = [], backfill = { hosts: {} }, exists = () => true }) {
  const rows = new Map();
  const row = (site) => { if (!rows.has(site)) rows.set(site, { site, url: 'https://' + site + '/', status: '', outcome: '', at: '', page: '', lane: '', took: '', why: '', learned: '', ease: null, first: (backfill.hosts || {})[site] || null, sources: [] }); return rows.get(site); };
  const lift = (r, outcome) => { if ((RANK[outcome] || 0) >= (RANK[r.outcome] || 0)) { r.outcome = outcome; r.status = LABEL[outcome] || outcome; } };
  const src = (r, s) => { if (!r.sources.includes(s)) r.sources.push(s); };
  for (const p of sitePages) {
    const m = /^(.+?):\s*(\S+)$/.exec(p.lane || ''); if (!m) continue; // the lane's leader page ("pdf") is Verse's own, not a site
    const r = row(hostOf(m[2])); r.lane = r.lane || m[1]; r.page = r.page || p.path; r.took = r.took || what(p); lift(r, 'page built'); src(r, 'void-live-deploy/lib/tool-sites.js');
  }
  for (const s of selfSites) {
    const r = row(hostOf(s.url)); r.lane = r.lane || s.family || ''; r.page = s.page || s.path || r.page; r.url = s.url || r.url; if (s.added && (!r.at || s.added > r.at)) r.at = s.added;
    lift(r, 'page built'); src(r, 'void-live-deploy/lib/self-sites.js');
  }
  for (const [host, s] of Object.entries((state && state.sites) || {})) {
    const r = row(hostOf(host)); lift(r, s.outcome || ''); if (s.at && (!r.at || s.at > r.at)) r.at = s.at;
    if (s.page && !r.page) r.page = s.page; if (s.family && !r.lane) r.lane = s.family; if (s.why) r.why = s.why; if (s.title && !r.took) r.took = s.title;
    if (s.ease && typeof s.ease.score === 'number') r.ease = { score: s.ease.score, place: s.ease.place ?? null, why: s.ease.why || '' };
    src(r, 'domains/tower-self.json');
  }
  // the target the Versus card shows (tower.target.json, lib/tower.js): the same site, page and score here, so the card and the page agree
  for (const f of floors) {
    if (f.state !== 'current' || !f.site) continue;
    const r = row(hostOf(f.url || f.site)); lift(r, 'current'); r.current = true; if (f.page) r.page = f.page; if (f.topic) r.topic = f.topic;
    r.score = { n: f.n, m: f.m }; r.why = 'the target now: Verse is ahead on ' + f.n + ' of ' + f.m + ' aspects' + (f.topic ? ', measured against ' + f.page + ', the page that does its job (' + f.topic + ')' : ''); src(r, 'void-live-deploy/tower.target.json');
  }
  // PASSED (owner, 2026-11-03): the Tower moved on; the open aspects are measured in the background until it is conquered (lib/tower.js)
  for (const f of floors) {
    if (!f.cleared || f.beaten || !f.site) continue;
    const r = row(hostOf(f.url || f.site)); lift(r, 'passed'); if (f.page) r.page = f.page; if (f.topic) r.topic = f.topic; r.score = { n: f.n, m: f.m };
    r.why = 'Passed ' + f.site + ' (' + f.n + '/' + f.m + ', ' + ((f.missingFeatures || []).length ? 'missing ' + f.missingFeatures.length + ' feature' + (f.missingFeatures.length === 1 ? '' : 's') : 'conquering in background') + ')' + (f.behind && f.behind.length ? '; fixing: ' + f.behind.join(', ') : ''); if (f.at && (!r.at || f.at > r.at)) r.at = f.at; src(r, 'void-live-deploy/tower.target.json');
  }
  for (const f of floors) {
    if (!f.beaten || !f.site) continue;
    const r = row(hostOf(f.url || f.site)); lift(r, 'surpassed'); if (f.page) r.page = f.page; if (f.taught || f.learned) r.learned = f.taught || f.learned; r.score = { n: f.n, m: f.m };
    r.why = 'ahead of it on ' + f.n + ' of ' + f.m + ' aspects, measured head to head'; if (f.at && (!r.at || f.at > r.at)) r.at = f.at; src(r, 'void-live-deploy/tower.evidence.json');
  }
  // the whole-site crawl (tools/site-crawl.mjs, tower.features.json): pages read and the features Verse lacks, on every site the Tower stands on
  for (const f of floors) { if (!f.crawled || !(f.url || f.site)) continue; const r = rows.get(hostOf(f.url || f.site)); if (!r) continue; r.crawl = { pages: f.crawled.pages, templates: f.crawled.templates, features: f.crawled.features, missing: f.missingFeatures || [], at: f.crawled.at }; src(r, 'void-live-deploy/tower.features.json'); }
  for (const r of rows.values()) if (!r.at && r.first) r.at = r.first.at; // a lane page with no date of its own dates from the commit that added it
  // a row links only to a page that is there (Verse status crawl, 2026-11-03: /text-editor/notepad-plus-plus/ was a 404): a page that was
  // removed or merged links to the page that does its job now (lib/tower-topic.js, "always combine pages when possible"), else to none,
  // and `pageWas` keeps the old path as history
  for (const r of rows.values()) if (r.page && !exists(r.page)) {
    const t = topicOf([r.took, r.lane, r.site].join(' '), r.site), now = t && exists(t.page) ? t.page : '';
    r.pageWas = r.page; r.page = now;
  }
  return [...rows.values()].filter((r) => r.site).sort((a, b) => (b.at || '').localeCompare(a.at || '') || a.site.localeCompare(b.site));
}

/** the whole file from the rows. Pure. */
export function fileOf(rows) {
  const n = (f) => rows.filter(f).length;
  return { note: 'Every site Verse has assimilated or tried to, newest first. Generated by tools/assimilated.mjs from lib/tool-sites.js, lib/self-sites.js, domains/tower-self.json, the tower evidence and the git history (domains/assimilated.backfill.json); nothing is typed by hand. ease: the score Versus picked the site by (higher is easier, tools/tower-self.mjs easeOf), recorded from 2026-11-03.',
    repo: REPO, target: (() => { const c = rows.find((r) => r.current); return c ? { site: c.site, page: c.page, score: c.score || null } : null; })(), counts: { sites: rows.length, surpassed: n((r) => r.outcome === 'surpassed'), passed: n((r) => r.outcome === 'passed'), assimilated: n((r) => RANK[r.outcome] === 5), current: n((r) => r.outcome === 'current'), tried: n((r) => (RANK[r.outcome] || 0) < 5) }, sites: rows };
}

/** the floors of the tower as the stage reads them, from the published files. */
export async function floorsOf(cwd = root) {
  const { tower, towerArgs, learnedOf, fatalityOf } = await import(pathToFileURL(resolve(cwd, 'void-live-deploy/lib/tower.js')).href);
  const [inv, ev, fr, rk, sz, tg, ft] = ['lap.items.json', 'tower.evidence.json', 'tower.frontier.json', 'tower.rank.json', 'tower.size.json', 'tower.target.json', 'tower.features.json'].map((f) => read(cwd, 'void-live-deploy/' + f));
  const t = tower(...towerArgs((inv && inv.onlySite) || [], { ev, fr, rk, sz, tg, ft }));
  // a surpassed floor is dated by its newest head-to-head measure in the evidence
  // what each site taught Verse, as the card's "What each site taught me" says it (skills/tower.js verseTake): its lesson, else Verse's edge
  const taught = (f) => learnedOf(f) || (fatalityOf(f) ? 'Verse\'s edge: ' + fatalityOf(f) : '');
  const cur = t.floors.find((f) => f.state === 'current');
  return (cur ? [{ ...cur }] : []).concat(t.floors.filter((f) => f.beaten || f.cleared).map((f) => { const dates = JSON.stringify((ev && ev.floors && ev.floors[f.id]) || {}).match(/20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/g) || []; return { ...f, taught: taught(f), at: dates.length ? dates.sort((a, b) => a.localeCompare(b)).at(-1) + 'Z' : '' }; }));
}

/** whether a site path ('/convert/', '/calculator/?mode=vat') is a page in the deploy folder. */
export const pageExists = (cwd = root) => (path) => { const p = String(path || '').replace(/[?#].*$/, ''); if (!p.startsWith('/') || p.includes('..')) return false; const f = resolve(cwd, 'void-live-deploy' + p); return existsSync(p.endsWith('/') ? f + '/index.html' : f) || existsSync(f + '.html') || existsSync(f + '/index.html'); };

export async function build(cwd = root) {
  const ts = await import(pathToFileURL(resolve(cwd, 'void-live-deploy/lib/tool-sites.js')).href);
  return fileOf(historyOf({ sitePages: ts.SITE_PAGES || [], selfSites: ts.SELF_SITES || [], state: read(cwd, 'domains/tower-self.json') || { sites: {} }, floors: await floorsOf(cwd), backfill: read(cwd, BACKFILL) || { hosts: {} }, exists: pageExists(cwd) }));
}

/** the first commit that named each host on an added line of SOURCES, from `git log --reverse -p` text. Pure. */
export function firstSeen(log, hosts) {
  const out = {}, want = [...hosts].filter(Boolean), left = new Set(want); let at = '', sha = '', file = '';
  for (const line of String(log).split('\n')) {
    if (line.startsWith('@@COMMIT ')) { [, sha, at] = line.split(' '); continue; }
    if (line.startsWith('+++ b/')) { file = line.slice(6); continue; }
    if (!line.startsWith('+') || line.startsWith('+++') || !left.size) continue;
    for (const h of left) if (line.includes(h)) { out[h] = { at: new Date(at).toISOString().replace('.000Z', 'Z'), sha, file }; left.delete(h); }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2] || '';
  if (arg === '--backfill') {
    const hosts = (await build()).sites.map((r) => r.site);
    const log = execFileSync('git', ['log', '--reverse', '-p', '--no-color', '--format=@@COMMIT %h %cI', '--', ...SOURCES], { cwd: root, maxBuffer: 1 << 30 }).toString();
    const found = firstSeen(log, hosts);
    writeFileSync(resolve(root, BACKFILL), JSON.stringify({ note: 'The commit that first named each assimilated or tried site in ' + SOURCES.join(', ') + ', from git history (node tools/assimilated.mjs --backfill). Rewritten only by that command.', hosts: found }, null, 1) + '\n');
    console.log('backfill: ' + Object.keys(found).length + ' of ' + hosts.length + ' sites found in git history');
  }
  const want = JSON.stringify(await build(), null, 1) + '\n', file = resolve(root, OUT);
  if (arg === '--check') { if (!existsSync(file) || readFileSync(file, 'utf8') !== want) { console.error(OUT + ' is stale: node tools/assimilated.mjs'); process.exit(1); } console.log('ok: ' + OUT + ' is current'); }
  else { writeFileSync(file, want); const j = JSON.parse(want); console.log('wrote ' + OUT + ': ' + j.counts.sites + ' sites (' + j.counts.surpassed + ' surpassed, ' + j.counts.assimilated + ' assimilated, ' + j.counts.tried + ' tried)'); }
}
