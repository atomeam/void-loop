// The handoff scan (owner, 2026-10-28: "keep finding page-to-page connections we haven't considered"): every page's inputs and outputs,
// the connections already built (one page's result opening another, the lib/handoff.js verse_handoff pattern or a link that carries the
// data), and the ones not built yet, ranked by usefulness. A lap builds the top few and tests them end to end (docs/NEXT.md, loop:handoffs).
//
// A page says what it takes and gives in one tag: <meta name="verse-handoff" content="in: list, number; out: list">. The pages that were
// live when the rule started (2026-10-28) are listed in tools/handoff-types.json instead; that list only shrinks. Every page that ships
// from now on declares its own tag: tools/handoff-scan.test.mjs fails a page with neither. inferTypes() reads a page's controls and is
// only a hint for writing a tag (node tools/handoff-scan.mjs --hint /route/).
//   node tools/handoff-scan.mjs            prints the top connections not built yet
//   node tools/handoff-scan.mjs --write    also writes docs/HANDOFF-GAPS.md
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'void-live-deploy');
/** the types a handoff can carry, and how much a person gains when one page's result opens the next already filled in */
export const TYPES = Object.freeze({ names: 3, items: 2, music: 3, numbers: 3, date: 3, event: 3, color: 3, palette: 3, image: 3, table: 3, location: 3, video: 3, duration: 2, number: 2, url: 2, text: 1, code: 1 });
/** the routes that are not tools a person carries a result between (articles, money and admin pages, games' own boards) */
const SKIP = /^\/(?:obituaries|privacy|fix|podcast|cheat-codes|keep-it-running|first-automation-setup|full-stack-audit|one-time-fix|hosting|store|ledger|identity|conquered|claims|models|studies|og|g|tools|music|humans|remediation|review|cpan|code-review|data|compare)\b/;

const rd = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
/** every page route with an index.html (lib, skills, functions and the like are not pages) */
export function pages(dir = site) {
  const out = [];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (!e.isDirectory() || /^(node_modules|lib|skills|api|functions|vendor|tower\.|og$|\.|_)/.test(e.name)) continue;
    const r = rel + e.name + '/'; if (fs.existsSync(path.join(d, e.name, 'index.html'))) out.push(r); walk(path.join(d, e.name), r); } };
  walk(dir, '/'); return out.sort();
}

/** a declaration's types: "in: list, number; out: list" → { in: ['list','number'], out: ['list'] }, or null when it is not one. Pure. */
export function parseDecl(s) {
  if (typeof s !== 'string') return null;
  const o = { in: [], out: [] }; let any = false;
  for (const part of s.split(';')) { const m = part.match(/^\s*(in|out)\s*:\s*(.*)$/i); if (!m) { if (part.trim()) return null; continue; }
    const ts = m[2].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).filter((t) => t !== 'none');
    if (ts.some((t) => !(t in TYPES))) return null; o[m[1].toLowerCase()] = [...new Set(ts)]; any = true; }
  return any ? o : null;
}
export const declOf = (html) => { const m = String(html).match(/<meta\s+name=["']verse-handoff["']\s+content=["']([^"']*)["']/i); return m ? m[1] : null; };

/** what a page takes and gives, read from its controls when it does not say. Pure (html: the page; src: its own modules' text). */
export function inferTypes(html, src = '') {
  const h = String(html), all = h + '\n' + src, ins = new Set(), outs = new Set();
  if (/<textarea/i.test(h)) ins.add(/\bnames\b/i.test(h) ? 'names' : /one (?:per|a) line|list|entries|items/i.test(h) ? 'items' : 'text');
  if (/type=["']number["']/i.test(h)) ins.add('number');
  if (/type=["'](?:date|datetime-local|month)["']/i.test(h)) ins.add('date');
  if (/type=["']time["']/i.test(h)) ins.add('duration');
  if (/type=["']color["']/i.test(h)) ins.add('color');
  if (/type=["']url["']/i.test(h)) ins.add('url');
  if (/type=["']file["'][^>]*accept=["'][^"']*image/i.test(h)) ins.add('image');
  if (/geolocation|placeholder=["'][^"']*\bcity\b/i.test(all)) ins.add('location');
  if (/\.ics\b|text\/calendar/i.test(all)) outs.add('event');
  if (/toBlob|toDataURL|download=["'][^"']*\.png/i.test(all)) outs.add('image');
  if (/\.csv\b|text\/csv/i.test(all)) outs.add('table');
  if (/<output|aria-live/i.test(h)) outs.add(ins.has('names') ? 'names' : ins.has('items') ? 'items' : ins.has('date') ? 'date' : 'number');
  if (/clipboard/i.test(all)) outs.add('text');
  if (/palette|swatch/i.test(all)) { outs.add('palette'); ins.add('color'); }
  return { in: [...ins], out: [...outs] };
}

/** the routes this page already hands data to: a link to another page that carries something (?x= or #...), or the verse_handoff ring */
export function builtFrom(route, html, src, routes, builders = {}) {
  const all = String(html) + '\n' + String(src), to = new Set();
  for (const m of all.matchAll(/["'`](\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/)(?:\?[a-z_]+=|#)/gi)) if (m[1] !== route && routes.includes(m[1])) to.add(m[1]);
  for (const [fn, page] of Object.entries(builders)) if (page !== route && routes.includes(page) && new RegExp('\\b' + fn + '\\(').test(all)) to.add(page);
  return [...to];
}
/** lib/handoff.js's link builders and the page each one opens with the list in it (wheelLink: '/wheel/#...'), so a page that calls
 *  wheelLink(names) counts as connected to /wheel/ the way a written '/wheel/#' link does. Pure. */
export const buildersOf = (hand) => Object.fromEntries([...String(hand).matchAll(/export const (\w+Link) = [^\n]*?'(\/[a-z0-9-]+\/)[#?]/g)].map((m) => [m[1], m[2]]));

/** a page that is one of its family's variants (/photos/squoosh/ beside /photos/) is not ranked on its own unless it has its own tag */
const variant = (p) => p.route.split('/').length > 3 && !p.declared;

/** the usefulness of opening `to` filled with `from`'s result: the best shared type, doubled when `to` already reads a link (so the
 *  connection is one line), and a little for the pages' own size (a small single-purpose page is quick to wire). Pure. */
export function usefulness(from, to) {
  const shared = from.out.filter((t) => to.in.includes(t)); if (!shared.length) return { score: 0, shared };
  const best = Math.max(...shared.map((t) => TYPES[t]));
  return { score: best * (to.readsLink ? 2 : 1) + (from.declared && to.declared ? 1 : 0), shared };
}

/** the types each page says it takes and gives: its own tag first, then the list of pages that were live before the rule (tools/handoff-types.json) */
export const LEGACY_FILE = path.join(root, 'tools', 'handoff-types.json');
export const legacy = (file = LEGACY_FILE) => { const o = JSON.parse(rd(file) || '{}'); delete o._; return o; };

/** the modules a page imports that are its own: its app.js; a module its index.html imports that only its family and at most one
 *  other reach; or a module further down whose file is named for the page (lib/flights-core.js for /flights/, followed through the
 *  modules that import it). A module every page reaches (the toolkit's "Use with" links) would make every page look connected to
 *  every other, and a shared library deep in the chain (lib/converter.js under /rap/'s video writer) builds links the page never
 *  shows, so neither is its own. */
function ownSources(dir, routes) {
  const importsOf = (code, from) => [...code.matchAll(/(?:from|import|<script\b[^>]*\bsrc=)\s*\(?\s*["']((?:\/|\.\.?\/)[\w./-]+\.js)["']/g)]
    .map((m) => (m[1].startsWith('/') ? m[1] : path.posix.normalize(path.posix.join(path.posix.dirname(from), m[1]))));
  const deps = {}, depsOf = (m) => (deps[m] ??= importsOf(rd(path.join(dir, m)), m));
  const reach = (r) => { const seen = new Set(), todo = importsOf(rd(path.join(dir, r, 'index.html')), r + 'index.html');
    while (todo.length && seen.size < 200) { const m = todo.pop(); if (seen.has(m)) continue; seen.add(m); todo.push(...depsOf(m)); } return seen; };
  const reached = Object.fromEntries(routes.map((r) => [r, reach(r)])), families = {};
  const direct = (r) => new Set(importsOf(rd(path.join(dir, r, 'index.html')), r + 'index.html'));
  const named = (r, m) => path.posix.basename(m).startsWith(r.split('/')[1].split('-')[0]);
  for (const r of routes) for (const m of reached[r]) (families[m] ??= new Set()).add(r.split('/')[1]);
  return Object.fromEntries(routes.map((r) => [r, [...reached[r]].filter((m, _, __, top = direct(r)) => m.startsWith(r) || (families[m].size <= 2 && (top.has(m) || named(r, m)))).map((m) => rd(path.join(dir, m))).join('\n')]));
}

/** the whole scan: { pages: [{ route, declared, in, out, readsLink, built }], gaps: [{ from, to, shared, score }] ranked, built: n, undeclared } */
export function scan(dir = site, types = legacy()) {
  const routes = pages(dir).filter((r) => !SKIP.test(r)), own = ownSources(dir, routes), rows = [], undeclared = [];
  const hand = rd(path.join(dir, 'lib', 'handoff.js')), builders = buildersOf(hand);
  for (const r of routes) {
    const html = rd(path.join(dir, r, 'index.html')), src = own[r], tag = parseDecl(declOf(html)), d = tag || parseDecl(types[r]);
    if (!d) { undeclared.push(r); continue; }
    rows.push({ route: r, declared: !!tag, in: d.in, out: d.out, readsLink: /URLSearchParams|location\.(?:search|hash)/.test(html + src), built: builtFrom(r, html, src, routes, builders) });
  }
  const ring = /verse_handoff/.test(hand) ? (hand.match(/\['(\/[a-z-]+\/)'/g) || []).map((x) => x.slice(2, -1)) : [];
  const done = (a, b) => (ring.includes(a.route) && ring.includes(b.route)) || a.built.includes(b.route);
  const gaps = [], built = [];
  for (const a of rows) for (const b of rows) { if (a === b || a.route.split('/')[1] === b.route.split('/')[1] || variant(a) || variant(b)) continue;
    const u = usefulness(a, b); if (done(a, b)) { built.push({ from: a.route, to: b.route }); continue; }
    if (u.score > 0) gaps.push({ from: a.route, to: b.route, shared: u.shared, score: u.score }); }
  gaps.sort((x, y) => y.score - x.score || x.from.localeCompare(y.from) || x.to.localeCompare(y.to));
  return { pages: rows, gaps, built, undeclared };
}

/** the doc: the top gaps, and every page's types */
export function report(s, top = 40) {
  const L = ['# Handoff gaps', '', 'Generated by `node tools/handoff-scan.mjs --write` (the loop item `loop:handoffs`, docs/NEXT.md). Do not edit by hand.', '',
    'One page\'s result opening another already filled in (lib/handoff.js, `verse_handoff`; or a link that carries the data). ' + s.built.length + ' page pairs are connected; ' + s.gaps.length + ' pairs share a type and are not. Each lap builds the top few and tests them end to end.', '',
    'Score: the shared type\'s weight (names, music, numbers, date, event, color, palette, image, table, location 3; items, number, duration, url 2; text, code 1), doubled when the receiving page already reads its link, +1 when both pages declare their types.', '',
    '## Built', '', s.built.map((b) => b.from + ' → ' + b.to).join(' · ') || 'none', '', '## Not built yet, most useful first', '', '| from | to | carries | score |', '|---|---|---|---|'];
  for (const g of s.gaps.slice(0, top)) L.push('| ' + g.from + ' | ' + g.to + ' | ' + g.shared.join(', ') + ' | ' + g.score + ' |');
  L.push('', '## Every page\'s types', '', '| page | takes | gives | reads its link | types from |', '|---|---|---|---|---|');
  for (const p of s.pages) L.push('| ' + p.route + ' | ' + (p.in.join(', ') || '-') + ' | ' + (p.out.join(', ') || '-') + ' | ' + (p.readsLink ? 'yes' : 'no') + ' | ' + (p.declared ? 'its tag' : 'handoff-types.json') + ' |');
  return L.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = scan();
  console.log(s.pages.length + ' pages, ' + s.pages.filter((p) => p.declared).length + ' with their own tag; ' + s.built.length + ' pairs connected, ' + s.gaps.length + ' not' + (s.undeclared.length ? '; no types: ' + s.undeclared.join(' ') : ''));
  for (const g of s.gaps.slice(0, 12)) console.log('  ' + String(g.score).padStart(2) + '  ' + g.from + ' -> ' + g.to + '  (' + g.shared.join(', ') + ')');
  const h = process.argv.indexOf('--hint'); if (h > 0) { const r = process.argv[h + 1], t = inferTypes(rd(path.join(site, r, 'index.html'))); console.log('hint for ' + r + ': <meta name="verse-handoff" content="in: ' + (t.in.join(', ') || 'none') + '; out: ' + (t.out.join(', ') || 'none') + '">'); }
  if (process.argv.includes('--write')) { fs.writeFileSync(path.join(root, 'docs', 'HANDOFF-GAPS.md'), report(s)); console.log('wrote docs/HANDOFF-GAPS.md'); }
}
