// What Verse knows, as one small file the brain page searches (owner, 2026-11-03: "make it into a more functional usable brain").
// /brain/ was a simulation to watch; this is the part you can use: every skill with what it does, the asks it answers and the page it powers,
// every tool page, every site Versus took on or tried (what it found and the page it built), the lessons Verse's model recalls when it
// proposes a fix (void.knowledge.json, tools/knowledge-build.mjs), and what Verse did lately (main's own commits). Everything is read from
// files the site already ships or the repo already holds; nothing is typed here. The wants come live from /api/will on the page itself.
//   node tools/brain-knows.mjs            write void-live-deploy/brain/knows.json
//   node tools/brain-knows.mjs --check    exit 1 when it is stale (refresh.mjs: volatile, the deploy rewrites it, since the commits move)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = 'void-live-deploy/brain/knows.json';
export const KINDS = ['skill', 'page', 'site', 'lesson', 'did'];
export const DID_MAX = 60;
const clip = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
const readJson = (f, d) => { try { return JSON.parse(readFileSync(join(root, f), 'utf8')); } catch (_) { return d; } };

/** the skills, from the book (skills/guide.json), the one-line answers (skills/what.json) and the page each powers (lib/card-frame.js PAGE_OF). Pure. */
export function skillsOf(guide, what, pageOf) {
  const out = [], seen = new Set();
  for (const p of (guide && guide.pages) || []) {
    if (p.kind !== 'skill' || !p.name || seen.has(p.name)) continue; seen.add(p.name);
    const pg = pageOf[p.name] || null, ex = (p.examples || []).slice(0, 3);
    out.push({ k: 'skill', id: p.name, t: p.title || p.name, d: clip(what[p.name] || p.line || '', 220), ex, tier: p.tier || '', u: pg ? pg[0] : (ex[0] ? '/?q=' + encodeURIComponent(ex[0]) : '') });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** the tool pages (lib/seo.js PAGES). Pure. */
export const pagesOf = (pages) => (pages || []).map((p) => ({ k: 'page', id: p.path, t: p.name, d: clip(p.does || p.description || '', 220), u: p.path })).sort((a, b) => (a.id < b.id ? -1 : 1));

/** every site Versus took on or tried (assimilated.json), what came of it and the page it built. Pure. */
export const sitesOf = (a) => ((a && a.sites) || []).map((s) => ({
  k: 'site', id: s.site, t: s.site, st: s.status || '', d: clip([s.why, s.learned].filter(Boolean).join('; '), 220), u: s.page || '', src: s.url || '', at: s.at || '',
}));

/** the lessons the model recalls (void.knowledge.json). Pure. */
export const lessonsOf = (list) => (Array.isArray(list) ? list : []).map((l) => ({ k: 'lesson', id: l.id, t: l.consumed, d: clip(l.learned, 240), from: l.from, at: l.at || '' }));

/** main's own commits, newest first, minus the clock's bookkeeping (each is a link to the commit). Pure over `git log` lines "sha\tiso\tsubject". */
export const NOISE = /^(Conductor:|Incident:|Regenerate the generated files|Merge (pull request|branch|remote))/;
export function didOf(lines, repo = 'atomeam/void-loop', max = DID_MAX) {
  const out = [];
  for (const line of lines) {
    const [sha, at, ...rest] = String(line).split('\t'), s = rest.join('\t').trim();
    if (!sha || !s || NOISE.test(s)) continue;
    out.push({ k: 'did', id: sha.slice(0, 9), t: clip(s, 200), u: 'https://github.com/' + repo + '/commit/' + sha, at });
    if (out.length >= max) break;
  }
  return out;
}

/** the file: a note, the counts and the items, in KINDS order. Pure. */
export function build({ guide, what, pageOf, pages, assimilated, knowledge, log }) {
  const items = [...skillsOf(guide, what, pageOf), ...pagesOf(pages), ...sitesOf(assimilated), ...lessonsOf(knowledge), ...didOf(log)];
  const counts = Object.fromEntries(KINDS.map((k) => [k, items.filter((i) => i.k === k).length]));
  return { note: 'What Verse knows, for /brain/: written by tools/brain-knows.mjs from the book, the tool pages, assimilated.json, void.knowledge.json and main\'s commits. Do not edit by hand.', counts, items };
}
export const render = (o) => JSON.stringify(o) + '\n';

async function main() {
  const { PAGES } = await import('../void-live-deploy/lib/seo.js');
  const { PAGE_OF } = await import('../void-live-deploy/lib/card-frame.js');
  let log = [];
  try { log = execFileSync('git', ['log', '--no-merges', '-300', '--format=%H%x09%cI%x09%s', 'HEAD'], { cwd: root, encoding: 'utf8' }).split('\n'); } catch (_) { /* no git: no commits listed */ }
  const o = build({ guide: readJson('void-live-deploy/skills/guide.json', {}), what: readJson('void-live-deploy/skills/what.json', {}), pageOf: PAGE_OF, pages: PAGES,
    assimilated: readJson('void-live-deploy/assimilated.json', {}), knowledge: readJson('void-live-deploy/void.knowledge.json', []), log });
  const text = render(o), target = join(root, OUT), before = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const said = Object.entries(o.counts).map(([k, n]) => n + ' ' + k).join(', ');
  if (process.argv.includes('--check')) { console.log((before === text ? 'current: ' : 'stale: ') + OUT + ' (' + said + ')'); process.exit(before === text ? 0 : 1); }
  writeFileSync(target, text); console.log((before === text ? 'unchanged: ' : 'wrote: ') + OUT + ' (' + said + ', ' + Math.round(text.length / 1024) + ' KB)');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
