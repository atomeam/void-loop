#!/usr/bin/env node
// Web Lore: the record of every site Verse has come across (owner, 2026-11-06), sorted into categories, each with its cited history.
// Built from what is already on disk, nothing fetched and nothing invented:
//   the sites    every floor of the Versus queue (lib/tower.js: the hand floors and the frontier) and every rival the tower settled (tower.gone.json)
//   the history  void-live-deploy/history/<slug>.json (tools/site-history.mjs from Wikidata, Wikipedia and the Wayback Machine, via tools/parity.mjs)
//   the category in this order: the job the site does (lib/tower-topic.js, from its title and address), the job of its hand floor, what Wikidata
//                says it is (P31, "Kind:" in its history), a machine endpoint's kind (tools/tower-alive.mjs), else "Not sorted yet"
// Writes void-live-deploy/lore.json, which /lore/ lists and functions/lore/[[path]].js answers from, one address per site.
//   node tools/lore.mjs            write it      node tools/lore.mjs --check   fail when it is out of date      --dry   build only, write nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEP = path.join(root, 'void-live-deploy');
const rd = (f, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(DEP, f), 'utf8')); } catch (_) { return d; } };
export const slugOf = (site) => String(site || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const STATE = { current: 'taking on now', passed: 'passed', beaten: 'surpassed', ahead: 'in the queue', settled: 'settled' };
const cap = (s) => { const t = String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1); return t.replace(/^Pdf\b/, 'PDF').replace(/^Vat\b/, 'VAT'); };

// broad shelves for a site no job topic names, read from its own home-page title and address (tower.frontier.json), most specific first; a
// word must say what the site is ("dice" in a dice shop, not "Dice.com" jobs, so jobs come first). A history's Wikidata kind is not overridden:
// it is checked before these. Pure data.
export const SHELVES = Object.freeze([
  ['Jobs and careers', /\b(?:jobs?|careers?|hiring|recruit\w*|job search)\b/i],
  ['Email tools', /\bemail (?:checker|verif\w*|validat\w*)|verify email/i],
  ['Fonts', /\bfonts?\b/i],
  ['Developer tools', /\b(?:api|json|regex|wordpress plugin|code snippets?|sdk|dns|developer|devtools?|github|cdn)\b/i],
  ['File tools', /\b(?:file (?:size|compress\w*|convert\w*)|compress(?:or)?|converter|to mp3|ytmp3)\b/i],
  ['Colour and design', /\bcolou?r (?:scheme|management|palette|picker)|\bdiagram\w*|\bdesign tools?|coloring pages|colouring pages/i],
  ['Image and AI art', /\b(?:ai image|image generator|photo editor|ai art)\b/i],
  ['Banking and finance', /\b(?:bank\w*|credit union|loans?|mortgages?|invest\w*|payments?|pawn|bin checker|financial|finance|crypto\w*|trading|forex)\b/i],
  ['Government and law', /\.gov\b|\bgov\.|\b(?:city of|county|judicial|police|court|ministry|government|council)\b/i],
  ['Health and medicine', /\b(?:medical|health\w*|hospital|clinic|pharma\w*|care news|icu|dental|doctor)\b/i],
  ['Religion and faith', /\b(?:church|biblical|christian|bible|faith|mosque|temple|parish)\b/i],
  ['Education and research', /\b(?:journal of|school|homeschool|university|college|academy|educators?|learn\w*|courses?)\b/i],
  ['Games and play', /\b(?:games?|gaming|dice|rpg|tarot|darts?|rubik|speedsolv\w*|loadouts?|meta stats|timers?|board game|puzzle\w*|drawaria)\b/i],
  ['Cars and transport', /\b(?:cars?|automotive|wheels?|rims|motor\w*|bikes?|cyclists?|ecu|vehicles?|logistics|shipping|parcel|express)\b/i],
  ['Food and drink', /\b(?:coffee|recipes?|food|edible|restaurant|wine|beer|tea)\b/i],
  ['Travel and places', /\b(?:travel|hotels?|flights?|mountain resort|ski|tourism|cruise|ferry|line)\b/i],
  ['Sports', /\b(?:calcio|football|soccer|golf|nba|nfl|cricket|tennis|sport\w*)\b/i],
  ['Video, film and TV', /\b(?:video|film\w*|dvd|movies?|tv|streaming)\b/i],
  ['Music and audio', /\b(?:music|songs?|mp3|audio|radio|podcast\w*)\b/i],
  ['News and magazines', /\b(?:news|times|politics|daily|magazine|journal|press|headlines|reviews?)\b/i],
  ['Shopping', /\b(?:shop\w*|store|buy|sell|deals?|gifts?|clothes|clothing|fashion|dresses|supplies|products?|amazon|ebay)\b/i],
  ['Business software', /\b(?:software|saas|platform|management|automation|marketing|crm|help desk|checkout|tracking|analytics|a\/b testing|lead generation)\b/i],
  ['Communities and nonprofits', /\b(?:community|communities|association|foundation|nonprofit|partners|changemakers|consortium)\b/i],
  ['Security and privacy', /\b(?:password|security|privacy|vpn|antivirus|safer)\b/i],
]);
export const shelfOf = (title, host) => { const t = String(title || '') + ' ' + String(host || '').replace(/\.[a-z.]+$/i, '').replace(/[.-]/g, ' '); for (const [c, re] of SHELVES) if (re.test(t)) return c; return ''; };
// a hand floor's job named like a shelf goes on that shelf, so one kind of site is not split in two ("News" and "News and magazines")
const SAME = { 'News': 'News and magazines', 'Jobs': 'Jobs and careers', 'Remote jobs': 'Jobs and careers', 'Travel': 'Travel and places', 'Music': 'Music and audio',
  'Games': 'Games and play', 'Finance': 'Banking and finance', 'Video': 'Video, film and TV', 'Code hosting': 'Developer tools', 'Code host (Codebase)': 'Developer tools', 'Code host (tildegit)': 'Developer tools' };
/** the category of one site and where it came from: { c, from }. Pure. */
export function categoryOf({ title = '', site = '', label = '', ask = '', kind = '', machine = '' }, topicOf) {
  const host = String(site).replace(/^https?:\/\//, '');
  const t = topicOf(title, host) || topicOf(label + ' ' + ask, '');
  if (t) return { c: cap(t.topic), from: 'job' };
  const hand = String(label).replace(/:\s*\S+\.\S+$/, '').trim();
  if (hand && hand.toLowerCase() !== host.toLowerCase() && !/\.[a-z]{2,}$/i.test(hand)) return { c: SAME[cap(hand)] || cap(hand), from: 'job' };
  if (kind) return { c: cap(kind), from: 'wikidata' };
  if (machine) return { c: 'Machine endpoints', from: 'fetch' };
  const shelf = shelfOf(title, host); if (shelf) return { c: shelf, from: 'title' };
  return { c: 'Not sorted yet', from: '' };
}

export async function build() {
  const { tower } = await import(pathToFileURL(path.join(DEP, 'lib/tower.js')).href);
  const { topicOf } = await import(pathToFileURL(path.join(DEP, 'lib/tower-topic.js')).href);
  const inv = rd('lap.items.json', {}), ev = rd('tower.evidence.json', {}), frontier = rd('tower.frontier.json', null);
  const titles = new Map(((frontier && frontier.sites) || []).map((s) => [slugOf(s.site), s.title || '']));
  const floors = tower(inv.onlySite || [], ev.floors || {}, frontier, null, rd('tower.rank.json'), rd('tower.size.json')).floors;
  const by = new Map();
  for (const f of floors) { const s = slugOf(f.site); if (!s || by.has(s)) continue; by.set(s, { slug: s, site: f.site, url: f.url || '', state: f.state, label: f.label || '', ask: f.ask || '', page: f.page || '' }); }
  const gone = (rd('tower.gone.json', {}) || {}).gone || {};
  for (const [host, g] of Object.entries(gone)) { const s = slugOf(host); if (!s || by.has(s)) continue; by.set(s, { slug: s, site: host, url: 'https://' + host + '/', state: 'settled', gone: g.status, machine: g.status === 'non-site' ? (g.kind || 'endpoint') : '' }); }
  const sites = [];
  for (const e of by.values()) {
    const h = rd(path.join('history', e.slug + '.json'));
    const known = h ? h.events.filter((x) => !x.u) : [];
    const kind = ((known.find((x) => /^Kind: /.test(x.t)) || {}).t || '').replace(/^Kind: /, '').split(',')[0].trim();
    const { c, from } = categoryOf({ title: titles.get(e.slug) || '', site: e.site, label: e.label, ask: e.ask, kind, machine: e.machine }, topicOf);
    const row = { s: e.slug, n: e.site, u: e.url, st: STATE[e.state] || e.state, c, cf: from, f: known.length, a: h ? (h.snaps || []).length : 0 };
    if (e.page) row.p = e.page;
    if (e.gone) row.g = e.gone;
    if (e.machine) row.m = e.machine;
    sites.push(row);
  }
  sites.sort((a, b) => a.c.localeCompare(b.c) || a.n.localeCompare(b.n));
  const cats = new Map(); for (const x of sites) cats.set(x.c, (cats.get(x.c) || 0) + 1);
  return {
    about: 'Every site Verse has come across, sorted by category, each with its cited history. Built by tools/lore.mjs from the Versus queue and void-live-deploy/history/. Do not edit.',
    count: sites.length, documented: sites.filter((x) => x.f).length, facts: sites.reduce((n, x) => n + x.f, 0),
    cats: [...cats.entries()].sort((a, b) => (a[0] === 'Not sorted yet') - (b[0] === 'Not sorted yet') || b[1] - a[1] || a[0].localeCompare(b[0])),
    sites,
  };
}

// names that are also an everyday word or place, so "history of amazon" stays a history question and does not open the site's record
export const AMBIGUOUS = new Set(['amazon', 'time', 'weather', 'bbc', 'random', 'color', 'calculator', 'converter', 'translate', 'translator', 'any', 'calendar', 'exif', 'investing', 'notepad', 'player', 'tasty', 'proton', 'textboard']);
/** the bare names (no dot) the stage answers "history of <name>" for: each documented site's slug, host without its ending, and name. Pure. */
export function namesOf(lore) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const stem = (h) => h.replace(/\.[a-z]{2,}(?:\.[a-z]{2})?$/, '');
  const out = new Set();
  for (const x of lore.sites) {
    if (!x.f) continue;
    for (const k of [x.s, stem(host(x.u)), slugOf(x.n)]) if (k && !k.includes('.') && k.length >= 3 && !AMBIGUOUS.has(k)) out.add(k);
  }
  return [...out].sort();
}
const namesFile = (names) => '// Built by tools/lore.mjs from lore.json: the documented sites a bare name may name ("history of 4chan"). Do not edit.\n'
  + 'export const LORE_NAMES = new Set(' + JSON.stringify(names) + ');\n';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lore = await build(), out = JSON.stringify(lore) + '\n', file = path.join(DEP, 'lore.json');
  const names = namesFile(namesOf(lore)), nfile = path.join(DEP, 'lib', 'lore-names.js');
  const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
  if (process.argv.includes('--dry')) { JSON.parse(out); console.log('lore (dry):', lore.count, 'sites,', lore.documented, 'with a cited history'); }
  else if (process.argv.includes('--check')) { if (read(file) !== out || read(nfile) !== names) { console.error('lore: out of date, run node tools/lore.mjs'); process.exit(1); } }
  else { fs.writeFileSync(file, out); fs.writeFileSync(nfile, names); console.log('lore:', lore.count, 'sites,', lore.documented, 'with a cited history,', lore.facts, 'facts,', lore.cats.length, 'categories'); }
}
