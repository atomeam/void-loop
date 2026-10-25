// Puts what lib/seo.js knows onto each tool page (owner, 2026-10-25: "pop up before all of our defeated sites"; honest search presence only):
// between <!-- seo --> and <!-- /seo --> in the head, the canonical link and the one JSON-LD script. The block is inserted before </head> the first
// time and rewritten after, so a change to the table reaches every page by one command and never by hand.
//   node tools/seo-pages.mjs           write every page
//   node tools/seo-pages.mjs --check   exit 1 when a page's block differs from the table (tools/refresh.mjs runs this; checks.mjs fails on stale)
// A page another builder is working on is skipped by name (SKIP) so two agents never edit one file at once; its row waits in the table.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, headTags } from '../void-live-deploy/lib/seo.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** pages left alone for now, with why (handoff.md: who is on it) */
export const SKIP = Object.freeze({
  '/resize-image/': 'the tower session is on this page (handoff.md, 2026-10-25); its row in lib/seo.js waits for it',
  '/weather/': 'the tower session\'s current fight (handoff.md, 2026-10-25); its row in lib/seo.js waits for it',
});
export const HEAD = ['<!-- seo -->', '<!-- /seo -->'];

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

/** a page's html as it should be: a page that writes its own canonical (the /tools/ kit page) keeps it and gets the JSON-LD alone. Pure. */
export const seoOf = (html, path) => withBlock(html, HEAD, headTags(path, undefined, { canonical: !/rel="canonical"/.test(withoutBlock(html, HEAD)) }), '</head>');

/** every page the generator reaches: [{ path, file, html, want }] (want null when the page has no </head>). */
export function build(cwd = root) {
  const out = [];
  for (const p of PAGES) {
    if (SKIP[p.path]) continue;
    const file = resolve(cwd, 'void-live-deploy' + p.path + 'index.html');
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    out.push({ path: p.path, file, html, want: seoOf(html, p.path) });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), bad = [];
  let n = 0;
  for (const { path, file, html, want } of build()) {
    if (want === null) { bad.push(path + ' has no </head>'); continue; }
    if (want === html) continue;
    if (check) bad.push(path + ' is out of date (node tools/seo-pages.mjs)'); else { writeFileSync(file, want); n++; }
  }
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  console.log(check ? 'ok: every tool page carries its canonical and JSON-LD' : 'wrote ' + n + ' page(s)' + (Object.keys(SKIP).length ? '; skipped ' + Object.keys(SKIP).join(', ') : ''));
}
