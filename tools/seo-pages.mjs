// Puts what lib/seo.js knows onto each tool page (owner, 2026-10-25: "pop up before all of our defeated sites"; honest search presence only):
// between <!-- seo --> and <!-- /seo --> in the head, the canonical link and the one JSON-LD script; between <!-- asks --> and <!-- /asks --> above
// the "Use with" row, the visible "Common asks" links to the exact setups people want (the same links the JSON-LD's potentialAction points at, so a
// crawler and a person reach the same place); and in llms.txt, between <!-- tools --> markers under "Tool pages", one honest line per tool page.
// Each block is inserted the first time and rewritten after, so a change to the table reaches every page by one command and never by hand.
//   node tools/seo-pages.mjs           write every page
//   node tools/seo-pages.mjs --check   exit 1 when a page's block differs from the table (tools/refresh.mjs runs this; checks.mjs fails on stale)
// A page another builder is working on is skipped by name (SKIP) so two agents never edit one file at once; its row waits in the table.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, headTags, asksRow, llmsLines } from '../void-live-deploy/lib/seo.js';
import { TOOLS, MORE_PAGES, relatedOf } from '../void-live-deploy/lib/toolkit.js';
import { PRODUCTS } from '../void-live-deploy/lib/products.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** pages left alone for now, with why (handoff.md: who is on it) */
export const SKIP = Object.freeze({
  '/resize-image/': 'the tower session is on this page (handoff.md, 2026-10-25); its row in lib/seo.js waits for it',
  '/weather/': 'the tower session\'s current fight (handoff.md, 2026-10-25); its row in lib/seo.js waits for it',
});
export const HEAD = ['<!-- seo -->', '<!-- /seo -->'];
export const ASKS = ['<!-- asks -->', '<!-- /asks -->'];
export const LLMS = ['<!-- tools -->', '<!-- /tools -->'];
// what Verse's own SEO audit found (tools/seo-audit.mjs, 2026-10-26): 44 pages nothing linked to in the HTML a crawler reads, because each page's
// "Use with" row is drawn by script, and the four services and Code Review Pro reached by no free page but the One-Time Fix. So: the same links,
// written into the page (the script still replaces them with its own row, ask bar and hand-offs), every tool on /tools/, and the services
// linked to each other.
export const RELATED = ['<!-- related -->', '<!-- /related -->'];
export const MORE = ['<!-- more-tools -->', '<!-- /more-tools -->'];
export const OFFERS = ['<!-- offers -->', '<!-- /offers -->'];
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pathOf = (url) => new URL(url).pathname;

/** the "Use with" links of a page as plain HTML (what mountRelated draws, without the script's hand-offs): null for a page with none. Pure. */
export function relatedLinks(path) {
  const list = relatedOf(path); if (!list.length) return null;
  return '<span class="tk-label">Use with</span> ' + [...list, ...(path !== '/tools/' ? [{ href: '/tools/', label: 'All tools' }] : [])].map((r) => '<a href="' + esc(r.href) + '">' + esc(r.label) + '</a>').join(' ');
}
/** the html with the related row's links written inside <nav id="related">, between the markers; null when the page has no such nav. Pure. */
export function withRelated(html, path) {
  const links = relatedLinks(path), at = html.indexOf('<nav id="related"'); if (!links || at < 0) return null;
  const open = html.indexOf('>', at) + 1, close = html.indexOf('</nav>', open); if (close < 0) return null;
  return html.slice(0, open) + RELATED[0] + links + RELATED[1] + html.slice(close);
}
/** the tools /tools/ does not list by hand yet, as one more section of real links (from lib/toolkit.js TOOLS, which every page's row uses). Pure. */
export function moreTools(html) {
  const listed = new Set([...withoutBlock(html, MORE).matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1].split('?')[0]));
  // MORE_PAGES: pages of their own that no tool row reaches yet, linked here so none is an orphan (tools/seo-audit.mjs); the stage card lists them too
  // one line per name: a page Verse built twice for two sites (lib/self-sites.js, /convert/unit-converter/ and -2/) is one tool to a reader
  const names = new Set([...withoutBlock(html, MORE).matchAll(/href="\/[^"]*">([^<]*)</g)].map((m) => m[1].toLowerCase()));
  const extra = [...Object.entries(TOOLS), ...MORE_PAGES].filter(([p], i, a) => p !== '/tools/' && !listed.has(p) && a.findIndex((x) => x[0] === p) === i)
    .filter(([, name]) => { const k = String(name).toLowerCase(); if (names.has(k)) return false; names.add(k); return true; });
  // each with the same "Open here" button as the hand-written rows, and the searches people make for it (lib/seo.js asks) for the page's find box
  const asks = new Map(PAGES.map((g) => [g.path, (g.asks || []).join(' ')]));
  return '<section><h2>More tools</h2><ul>' + extra.map(([p, name]) => '<li' + (asks.get(p) ? ' data-find="' + esc(asks.get(p)) + '"' : '') + '><a href="' + esc(p) + '">' + esc(name)
    + '</a><button type="button" data-open="' + esc(p) + '">Open here</button></li>').join('') + '</ul></section>';
}
/** on each paid page: the other things Verse does for people, each with its one plain line (lib/products.js), and the free fixes. Pure. */
export function offersRow(path) {
  const others = PRODUCTS.filter((p) => pathOf(p.page) !== path);
  return '<p class="muted offers">More ways Verse helps: ' + others.map((p) => '<a href="' + esc(pathOf(p.page)) + '">' + esc(p.name) + '</a> (' + esc(p.adds) + ')').join('; ')
    + '; or <a href="/fix/">look your error up free</a>.</p>';
}
export const OFFER_PAGES = Object.freeze(PRODUCTS.map((p) => pathOf(p.page)));

/** the html with `block` between the markers [open, close]: replaced when they are there, else inserted on its own line before `before`;
 *  unchanged (and `null` returned) when `before` is missing too. Pure. */
export function withBlock(html, [open, close], block, before) {
  const a = html.indexOf(open), b = html.indexOf(close, a + open.length);
  if (a >= 0 && b >= 0) return html.slice(0, a) + open + '\n' + block + '\n' + close + html.slice(b + close.length);
  const i = html.indexOf(before); if (i < 0) return null;
  return html.slice(0, i) + open + '\n' + block + '\n' + close + '\n' + html.slice(i);
}

/** the html with the block between [open, close] taken out. Pure. */
export function withoutBlock(html, [open, close]) {
  const a = html.indexOf(open), b = html.indexOf(close, a + open.length);
  return a >= 0 && b >= 0 ? html.slice(0, a) + html.slice(b + close.length) : html;
}

/** a page's html as it should be: the head block (a page that writes its own canonical, the /tools/ kit page, keeps it and gets the JSON-LD alone)
 *  and, when the table has common asks for it, the visible row of real links just above the "Use with" row. Pure. */
export function seoOf(html, path) {
  const head = withBlock(html, HEAD, headTags(path, undefined, { canonical: !/rel="canonical"/.test(withoutBlock(html, HEAD)) }), '</head>');
  const row = asksRow(path); if (head === null || !row) return head;
  return withBlock(head, ASKS, row, '<nav id="related"') ?? head;
}

/** llms.txt as it should be: one honest line per tool page between the markers of its "Tool pages" section (null when the section is missing). Pure. */
export const llmsOf = (text) => (text.includes(LLMS[0]) ? withBlock(text, LLMS, llmsLines().join('\n'), LLMS[0]) : null);

/** every file the generator reaches: [{ path, file, html, want }] (want null when a page has no </head>, or llms.txt no "Tool pages" markers). */
export function build(cwd = root) {
  const out = [];
  for (const p of PAGES) {
    if (SKIP[p.path]) continue;
    const file = resolve(cwd, 'void-live-deploy' + p.path + 'index.html');
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    out.push({ path: p.path, file, html, want: seoOf(html, p.path) });
  }
  const seen = new Set(out.map((o) => o.path));
  // every tool page's "Use with" row in its HTML (the pages in the seo table got theirs above)
  for (const path of Object.keys(TOOLS)) {
    if (SKIP[path]) continue;
    const file = resolve(cwd, 'void-live-deploy' + path + 'index.html'); if (!existsSync(file)) continue;
    const prev = seen.has(path) ? out.find((o) => o.path === path) : null, html = prev ? prev.want : readFileSync(file, 'utf8');
    const want = withRelated(html ?? '', path); if (want === null) continue;
    if (prev) prev.want = want; else { out.push({ path, file, html, want }); seen.add(path); }
  }
  { const path = '/tools/', file = resolve(cwd, 'void-live-deploy/tools/index.html'), prev = out.find((o) => o.path === path);
    const html = prev ? prev.want : readFileSync(file, 'utf8'), want = withBlock(html, MORE, moreTools(html), '  <p class="tie">');
    if (want !== null) { if (prev) prev.want = want; else out.push({ path, file, html, want }); } }
  for (const path of OFFER_PAGES) {
    const file = resolve(cwd, 'void-live-deploy' + path + 'index.html'); if (!existsSync(file)) continue;
    const prev = out.find((o) => o.path === path), html = prev ? prev.want : readFileSync(file, 'utf8'), want = withBlock(html, OFFERS, offersRow(path), '</main>');
    if (want !== null) { if (prev) prev.want = want; else out.push({ path, file, html, want }); }
  }
  const llms = resolve(cwd, 'void-live-deploy/llms.txt'), text = readFileSync(llms, 'utf8');
  out.push({ path: '/llms.txt', file: llms, html: text, want: llmsOf(text) });
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), bad = [];
  let n = 0;
  for (const { path, file, html, want } of build()) {
    if (want === null) { bad.push(path + (path === '/llms.txt' ? ' has no "Tool pages" markers (' + LLMS.join(' ') + ')' : ' has no </head>')); continue; }
    if (want === html) continue;
    if (check) bad.push(path + ' is out of date (node tools/seo-pages.mjs)'); else { writeFileSync(file, want); n++; }
  }
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  console.log(check ? 'ok: every tool page carries its canonical and JSON-LD' : 'wrote ' + n + ' page(s)' + (Object.keys(SKIP).length ? '; skipped ' + Object.keys(SKIP).join(', ') : ''));
}
