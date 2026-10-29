// Parity inventories (owner, 2026-10-28: an obituary may say "beaten" only when Verse is better in every way). For every site of the tower:
//   docs/PARITY/<slug>.md      every feature the original offers, have / partial / missing in Verse, with evidence on both sides
//   docs/PARITY/live.json      what a scan of the original's own pages found (which features it shows, its menus and buttons)
//   docs/PARITY/README.md      the missing features ranked by how many visitors they reach
//   void-live-deploy/parity.json   the numbers /obituaries/ shows (match %, the missing features)
//   void-live-deploy/history/<slug>.json  the cited timeline /obituaries/ opens, read from docs/HISTORY/<slug>.md (tools/site-history.mjs);
//                                  every event carries its source link (s), u marks an unknown
// The feature rows live in tools/parity-catalog.mjs; this tool only measures. A live menu item or button that no row covers is listed as
// "unreviewed", and unreviewed rows block "beaten" exactly like missing ones.
//   node tools/parity.mjs --scan [slug...]   read the originals' live pages again (network)
//   node tools/parity.mjs --write            rebuild the docs and the two json files (no network)
//   node tools/parity.mjs --check            fail when they are out of date
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOG, GENERIC } from './parity-catalog.mjs';
import { slugOf } from './site-history.mjs';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEP = path.join(root, 'void-live-deploy');
const PDIR = path.join(root, 'docs/PARITY'), HDIR = path.join(root, 'docs/HISTORY');
const LIVE = path.join(PDIR, 'live.json');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return d; } };

export async function floorsBySite() {
  const { tower } = await import(pathToFileURL(path.join(DEP, 'lib/tower.js')).href);
  const inv = readJson(path.join(DEP, 'lap.items.json'), {}), ev = readJson(path.join(DEP, 'tower.evidence.json'), {});
  // the tower's own floors, and the site Verse is on now (tower.target.json) when it comes from the frontier: its inventory is the one the
  // Versus card is judged by, so it is built here like any floor's (2026-10-29: sycophanthex.com's page was written by hand and went stale)
  const base = tower(inv.onlySite || [], ev.floors || {}, null).floors, ids = new Set(base.map((f) => f.id));
  const target = readJson(path.join(DEP, 'tower.target.json'), {}).id || null;
  const extra = target && !ids.has(target) ? tower(inv.onlySite || [], ev.floors || {}, readJson(path.join(DEP, 'tower.frontier.json'), null), null, null, null, target).floors.filter((f) => f.id === target) : [];
  const floors = base.concat(extra);
  const by = new Map();
  for (const f of floors) { const s = slugOf(f.site); if (!by.has(s)) by.set(s, { slug: s, site: f.site, url: f.url, floors: [] }); by.get(s).floors.push(f); }
  return [...by.values()];
}
const basePage = (p) => String(p || '').split('?')[0].split('#')[0];
export const catalogFor = (page) => { const b = basePage(page); if (CATALOG[b]) return { key: b, rows: CATALOG[b] }; const top = '/' + b.split('/')[1] + '/'; return CATALOG[top] ? { key: top, rows: CATALOG[top] } : { key: '', rows: GENERIC }; };

// the Verse page's own source: its html, its scripts, and the modules they import (two levels)
const srcCache = new Map();
export function verseSources(page) {
  const b = basePage(page); if (srcCache.has(b)) return srcCache.get(b);
  const out = []; const seen = new Set();
  const add = (rel, depth) => {
    const file = path.join(DEP, rel); if (seen.has(file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return; seen.add(file);
    const text = fs.readFileSync(file, 'utf8'); out.push({ rel: 'void-live-deploy/' + rel, text: codeOnly(text, rel.endsWith('.js')) });
    if (depth > 2) return;
    const dir = path.posix.dirname(rel);
    for (const m of text.matchAll(/(?:src=|from\s*|import\s*\(\s*)["'](\.{0,2}\/?[\w./-]+\.js)["']/g)) {
      const r = m[1].startsWith('/') ? m[1].slice(1) : path.posix.normalize(path.posix.join(dir, m[1]));
      if (!r.startsWith('..') && !/lib\/(toolkit|seo|i18n-words)\.js$/.test(r)) add(r, depth + 1);
    }
  };
  add((b.replace(/^\//, '') || '') + (b.endsWith('/') ? 'index.html' : '/index.html'), 0);
  srcCache.set(b, out); return out;
}
// what the page does, not what it says about itself: the head (title, description), comments and css are blanked, keeping line numbers
const blank = (m) => m.replace(/[^\n]/g, ' ');
const jsOnly = (t) => t.replace(/(^|[^\w'"\/*])\/\*[\s\S]*?\*\//g, (m, a) => a + blank(m.slice(a.length))).replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (m, a) => a + blank(m.slice(a.length)));
export const codeOnly = (t, js) => js ? jsOnly(t) : t.replace(/<head>[\s\S]*?<\/head>/i, blank).replace(/<style[\s\S]*?<\/style>/gi, blank).replace(/<!--[\s\S]*?-->/g, blank).replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + jsOnly(b) + c);
function probe(page, re) {
  if (!re) return null;
  for (const { rel, text } of verseSources(page)) {
    const m = re.exec(text); if (!m) continue;
    const line = text.slice(0, m.index).split('\n').length;
    const l = text.split('\n')[line - 1]; const at = Math.max(0, l.indexOf(m[0]) - 30);
    return rel + ':' + line + ' `' + l.slice(at, at + 90).trim().replace(/`/g, "'").replace(/\|/g, '/') + '`';
  }
  return null;
}

// ---- the live scan
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*?(?:aria-label|title|alt|placeholder)="([^"]*)"[^>]*>/gi, ' $1 ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const CHROME = /^(home|about|about us|contact|contact us|privacy|privacy policy|terms|terms of (use|service)|cookies?|cookie (settings|policy|preferences)|accept( all)?|reject( all)?|close|menu|skip to (main )?content|log ?in|sign ?in|sign ?up|register|log ?out|help|faq|blog|careers|jobs|press|advertise|search|more|next|previous|back|english|language|©.*|copyright.*|sitemap|accessibility|feedback|send feedback|support|legal|imprint|impressum|x|ok|go|submit|learn more|learn more .{1,60}|forgot .{1,40}|by @\w+|read more|try again|see (all|more)|view (all|more)|show (all|more)|load more|about .{1,30}|privacy .{1,20}|terms .{1,20}|get started|start (now|free)|try (it )?(now|free)|\W*)$/i;
function surfaceOf(html) {
  const labels = new Set();
  for (const m of html.matchAll(/<(button|a)\b[^>]*>([\s\S]{1,200}?)<\/\1>/gi)) { const t = textOf(m[2]).trim(); if (t.length > 2 && t.length < 40 && !CHROME.test(t) && /[a-z]/i.test(t)) labels.add(t); }
  for (const m of html.matchAll(/placeholder="([^"]{3,60})"/gi)) labels.add('Input: ' + m[1]);
  return [...labels].slice(0, 80);
}
export async function scanSite(s) {
  const r = { url: s.url, scanned: new Date().toISOString().slice(0, 10), status: 0, title: '', hits: {}, surface: [] };
  if (!s.url) return r;
  try {
    const res = await fetch(s.url, { headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'en' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    r.status = res.status; const html = (await res.text()).slice(0, 3e6);
    r.title = ((/<title[^>]*>([^<]*)/i.exec(html) || [])[1] || '').trim().slice(0, 120);
    const text = textOf(html);
    const rows = new Map(); for (const f of s.floors) for (const row of catalogFor(f.page).rows) rows.set(row[0], row);
    for (const [id, , , live] of rows.values()) { if (!live) continue; const m = live.exec(text); if (m) { const at = Math.max(0, m.index - 40); r.hits[id] = text.slice(at, at + 110).trim(); } }
    r.surface = res.ok ? surfaceOf(html) : [];
  } catch (e) { r.status = 0; r.error = String(e.message || e).slice(0, 80); }
  return r;
}

// ---- the inventory of one site
export function inventory(s, live) {
  const rows = []; const seen = new Set();
  for (const f of s.floors) {
    const cat = catalogFor(f.page);
    for (const row of cat.rows) {
      const [id, area, label, liveRe, vRe, pRe, scope, fixed] = row;
      if (seen.has(id)) continue;
      const hit = live && live.hits && live.hits[id];
      const named = Array.isArray(scope) && scope.includes(s.site);
      if (!(scope === 'core' || named || hit)) continue;
      seen.add(id);
      const orig = hit ? 'its live page (' + live.scanned + '): "' + hit.replace(/\|/g, '/') + '"' : named ? 'studied by hand: ' + s.site + ' offers this (' + s.url + ')' : 'every site of this kind offers it';
      let status, ev;
      if (fixed) { status = fixed; ev = 'not studied yet'; }
      else { const h = probe(f.page, vRe); const p = h ? null : probe(f.page, pRe); status = h ? 'have' : p ? 'partial' : 'missing'; ev = h || p || 'no sign of it in the source of ' + basePage(f.page); }
      rows.push({ id, area, label, status, original: orig, verse: ev, page: basePage(f.page) });
    }
  }
  // live menu items and buttons no row covers: unreviewed until a row is written for them
  const allRe = s.floors.flatMap((f) => catalogFor(f.page).rows.map((r) => r[3]).filter(Boolean));
  const un = ((live && live.surface) || []).filter((t) => !CHROME.test(String(t).trim()) && !allRe.some((re) => re.test(t))).slice(0, 12); // a sign-in page's chrome stored by an older scan is not a feature either
  for (const t of un) rows.push({ id: 'live:' + t, area: 'Unreviewed', label: t.replace(/\|/g, '/'), status: 'unreviewed', original: 'a menu item, button or box on its live page (' + live.scanned + ')', verse: 'not compared yet', page: basePage(s.floors[0].page) });
  if (!live || !(live.status >= 200 && live.status < 300)) rows.push({ id: 'live:blocked', area: 'Unreviewed', label: 'Its live pages could not be read' + (live ? ' (HTTP ' + (live.status || 'no answer') + ')' : '') + ', so its own menus and settings are not studied yet', status: 'unreviewed', original: 'the live scan of ' + (s.url || 'its address'), verse: 'not compared yet', page: basePage(s.floors[0].page) });
  const n = (k) => rows.filter((r) => r.status === k).length;
  const have = n('have'), partial = n('partial'), missing = n('missing'), unreviewed = n('unreviewed'), total = rows.length;
  const pct = total ? Math.round((100 * (have + partial / 2)) / total) : 0;
  return { rows, have, partial, missing, unreviewed, total, pct };
}

const STATUS = { have: 'have', partial: 'partial', missing: 'missing', unreviewed: 'unreviewed' };
export function renderParity(s, inv, live) {
  const L = [];
  L.push('# ' + s.site + ': feature parity', '');
  L.push('Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.', '');
  L.push('- Original: ' + s.site + (s.url ? ' (' + s.url + ')' : ''));
  L.push('- Verse: ' + s.floors.map((f) => (f.page || 'no page yet') + ' (' + f.id + ', tower gate ' + f.n + ' of ' + f.m + (f.beaten ? ', gate passed' : '') + ')').join('; '));
  L.push('- Live scan: ' + (live ? live.scanned + ', HTTP ' + (live.status || 'no answer') + (live.title ? ', page title "' + live.title.replace(/\|/g, '/') + '"' : '') : 'not scanned yet'));
  L.push('- History: [docs/HISTORY/' + s.slug + '.md](../HISTORY/' + s.slug + '.md)', '');
  L.push('**Match: ' + inv.pct + '%**: ' + inv.have + ' have, ' + inv.partial + ' partial, ' + inv.missing + ' missing, ' + inv.unreviewed + ' unreviewed, of ' + inv.total + ' features.', '');
  L.push('| Feature | Area | Verse | Evidence on the original | Evidence in Verse |', '| --- | --- | --- | --- | --- |');
  for (const r of inv.rows) L.push('| ' + r.label + ' | ' + r.area + ' | ' + STATUS[r.status] + ' | ' + r.original + ' | ' + r.verse + ' |');
  L.push('');
  return L.join('\n');
}

// ---- history.json from docs/HISTORY
export function historyFor(slug) {
  let md; try { md = fs.readFileSync(path.join(HDIR, slug + '.md'), 'utf8'); } catch (_) { return null; }
  const events = []; let sec = '';
  for (const line of md.split('\n')) {
    const h = /^## (.+)/.exec(line); if (h) { sec = h[1]; continue; }
    if (!line.startsWith('- ') || /^- (Site|Floors|Wikidata|Wikipedia):/.test(line)) continue;
    if (/unknown \(no source/.test(line) && !/\]\(http/.test(line)) { events.push({ k: sec, t: line.slice(2).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'), u: 1 }); continue; }
    const src = (/\]\((https?:[^)]+)\)\)?\s*$/.exec(line) || /\]\((https?:[^)]+)\)/.exec(line) || [])[1]; if (!src) continue;
    const y = (/\b(1[89]\d\d|20\d\d)\b/.exec(line) || [])[1] || '';
    const t = line.slice(2).replace(/\s*\(\[(source|Wayback Machine)\]\([^)]*\)\)\s*$/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    events.push({ k: sec, y, t: t.slice(0, 300), s: src });
  }
  const snaps = [...md.matchAll(/\[(\d{4})\]\((https:\/\/web\.archive\.org[^)]+)\)/g)].map((m) => [m[1], m[2]]);
  return { events, snaps };
}

export async function build(liveAll) {
  const sites = await floorsBySite();
  const files = {}; const parity = {}; const history = {}; const rank = new Map();
  for (const s of sites) {
    const live = liveAll[s.slug];
    const inv = inventory(s, live);
    files[path.join(PDIR, s.slug + '.md')] = renderParity(s, inv, live);
    parity[s.slug] = { site: s.site, pct: inv.pct, have: inv.have, partial: inv.partial, missing: inv.missing, unreviewed: inv.unreviewed, total: inv.total, gaps: inv.rows.filter((r) => r.status !== 'have').map((r) => (r.status === 'partial' ? '(partial) ' : r.status === 'unreviewed' ? '(unreviewed) ' : '') + r.label).slice(0, 40) };
    const h = historyFor(s.slug); if (h) { files[path.join(DEP, 'history', s.slug + '.json')] = JSON.stringify({ site: s.site, doc: 'docs/HISTORY/' + s.slug + '.md', ...h }) + '\n'; parity[s.slug].events = h.events.filter((e) => !e.u).length; }
    for (const r of inv.rows) if (r.status === 'missing' || r.status === 'partial') { const k = r.page + ' · ' + r.label; const e = rank.get(k) || { page: r.page, label: r.label, status: r.status, sites: [] }; e.sites.push(s.site); rank.set(k, e); }
  }
  const BIG = /Google|ESPN|BBC|Yahoo|Spotify|Apple|LinkedIn|Allrecipes|Trello|4chan|bing|deepl|notion|outlook|icloud/i;
  const ranked = [...rank.values()].map((e) => ({ ...e, score: e.sites.length + 5 * e.sites.filter((x) => BIG.test(x)).length })).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const R = ['# Parity: what Verse still lacks', '', 'Built by `node tools/parity.mjs --write`. One file per site in this folder; each names every feature of the original and whether Verse has it, with evidence. The list below ranks the missing and partial features by the visitors they reach: one point for each original site that offers it, five more for each of the most-visited originals (the ones named in plain text in the score).', '', '| Score | Verse page | Feature | Status | Original sites that have it |', '| --- | --- | --- | --- | --- |'];
  for (const e of ranked.slice(0, 120)) R.push('| ' + e.score + ' | ' + e.page + ' | ' + e.label + ' | ' + e.status + ' | ' + e.sites.slice(0, 8).join(', ') + (e.sites.length > 8 ? ' and ' + (e.sites.length - 8) + ' more' : '') + ' |');
  files[path.join(PDIR, 'README.md')] = R.join('\n') + '\n';
  files[path.join(DEP, 'parity.json')] = JSON.stringify({ note: 'Built by tools/parity.mjs from docs/PARITY and docs/HISTORY. Do not edit.', sites: parity }) + '\n';
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  fs.mkdirSync(PDIR, { recursive: true });
  const liveAll = readJson(LIVE, {});
  if (args.includes('--scan')) {
    const only = args.filter((a) => !a.startsWith('--'));
    const sites = (await floorsBySite()).filter((s) => !only.length || only.includes(s.slug));
    let i = 0;
    await Promise.all(Array.from({ length: 6 }, async () => { while (i < sites.length) { const s = sites[i++]; liveAll[s.slug] = await scanSite(s); console.log(liveAll[s.slug].status, s.slug, Object.keys(liveAll[s.slug].hits).length, 'hits', liveAll[s.slug].surface.length, 'labels'); } }));
    const sorted = Object.fromEntries(Object.keys(liveAll).sort().map((k) => [k, liveAll[k]]));
    fs.writeFileSync(LIVE, JSON.stringify(sorted, null, 1) + '\n');
  }
  if (args.includes('--write') || args.includes('--check')) {
    const files = await build(readJson(LIVE, {}));
    const hdir = path.join(DEP, 'history'); fs.mkdirSync(hdir, { recursive: true });
    const extra = fs.readdirSync(hdir).map((f) => path.join(hdir, f)).filter((f) => !files[f]);
    if (args.includes('--write')) for (const f of extra) fs.unlinkSync(f);
    const stale = args.includes('--check') ? extra.slice() : [];
    stale.push(...Object.entries(files).filter(([f, t]) => { try { return fs.readFileSync(f, 'utf8') !== t; } catch (_) { return true; } }).map(([f]) => f));
    for (let i = 0; i < stale.length; i++) stale[i] = path.relative(root, stale[i]);
    if (args.includes('--write')) { for (const [f, t] of Object.entries(files)) fs.writeFileSync(f, t); console.log('parity: wrote', Object.keys(files).length, 'files (' + stale.length + ' changed)'); }
    else if (stale.length) { console.error('parity: out of date, run node tools/parity.mjs --write:\n  ' + stale.slice(0, 10).join('\n  ')); process.exit(1); }
    else console.log('parity: up to date');
  }
}
