// The lab importer (owner, 2026-10-29: "get all these live and working too"): the hourly experiments the lab repo makes (github atomeam/a-to-mind.com,
// drafts/<dir>/index.html, each one standalone file) become pages of Verse at /lab/<slug>/, with a gallery at /lab/.
//   node tools/lab-import.mjs --drafts <dir>     write void-live-deploy/lab/<slug>/ for every draft with an index.html (idempotent; never deletes)
//   node tools/lab-import.mjs --drafts <dir> --out <dir> --skip a,b   somewhere else; leave drafts out (broken ones, from lab-sync)
// What it does to a draft, and only this (the experiment's own logic is never rewritten):
//  - every inline executable <script> moves to app.js next to the page (app-2.js, ... for more), keeping type="module" or classic exactly. The
//    deploy hashes every inline script into a rule of its own in _headers and the Pages limit is 80 rules, so a page with none costs nothing;
//    an external same-origin script needs no hash. JSON-LD and import maps are data and stay.
//  - head: <title>, description, canonical, share card, viewport and lang when missing, the shared lab.css and the visit beacon. Title and
//    description come from the draft's SPEC.md (first heading, first prose line), else from the page's own title, never invented.
//  - body: one visually hidden <h1> when the page has none, and one small footer: back to the lab, ask Verse.
//  - a page that uses navigator.gpu or navigator.xr also loads /lab/needs.js, which tells the visitor honestly when the browser lacks it.
//  - files next to index.html that the page names (core.js, a worklet) are copied beside it.
// Pure parts are exported and tested in tools/lab-import.test.mjs. The headless test is tools/lab-probe.mjs, the pipeline tools/lab-sync.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LAB_DIR = path.join(root, 'void-live-deploy', 'lab');
export const SITE = 'https://a-to-mind.com';
// what the page takes from other Verse pages and gives them (tools/handoff-scan.mjs): an experiment stands alone
const HANDOFF = '<meta name="verse-handoff" content="in: none; out: none">';
const BEACON = '<script src="/visit.js" defer></script>';
const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** a draft's directory name -> its page slug ('F044-Resonant Echo' -> 'f044-resonant-echo'). Pure. */
export const slugOf = (dir) => String(dir).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/** the number in a draft's name ('F-300-x' -> 300, '044-x' -> 44), 0 when there is none. Pure. */
export const numberOf = (dir) => { const m = /^f?-?0*(\d+)/i.exec(String(dir)); return m ? Number(m[1]) : 0; };

/** the leading tag of a heading or title: 'F-300 and a dash', 'Draft 048 and a colon' (any dash: \\p{Pd}) */
const TAG = /^(?:draft\s+)?f?-?\d+[\s:\u00b7\p{Pd}]*/iu;
const plain = (s) => String(s).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
/** the first sentence or two of a line, at most `max` characters, cut at a sentence or a word and never closed with an ellipsis. Pure. */
export function clip(text, max = 165) {
  // a line that stops on , ; or : (a SPEC line wrapped mid-sentence, a cut at '; ') ends with a full stop, never the dangling mark (26 /lab/ pages did)
  const s = plain(text); if (s.length <= max) return s.replace(/[,;:]$/, '.');
  const cut = s.slice(0, max), dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (dot > 60) return cut.slice(0, dot) + '.';
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:(\-]+$/, '');
}
/** SPEC.md -> { title, blurb }: the first heading (the F-number tag dropped) and the first prose line (after "Concept" when there is one). Nulls when absent. Pure. */
export function parseSpec(md) {
  const lines = String(md || '').split(/\r?\n/);
  const h = lines.find((l) => /^#\s+\S/.test(l));
  let title = h ? plain(h.replace(/^#\s+/, '')).replace(TAG, '').trim() : null;
  if (title && /^PLACEHOLDER/i.test(title)) title = null;
  const prose = (l) => { const t = l.trim(); return t.length > 30 && !/^(#|\*\*[^*]+:\*\*|```|\||---)/.test(t) && !(t.length < 90 && /^\w[\w ]{0,20}:\s/.test(t)) && !/^PLACEHOLDER/.test(t); };
  const at = lines.findIndex((l) => /^##\s+(concept|what it is|summary|idea)\b/i.test(l));
  let line = at >= 0 ? lines.slice(at + 1).find(prose) : null;
  if (!line) line = lines.slice(h ? lines.indexOf(h) + 1 : 0).find(prose);
  return { title: title || null, blurb: line ? clip(line.replace(/^[-*]\s+/, '')) : null };
}
/** the features a page needs the browser to have, read off its source: ['webgpu'], ['webxr'], both or none. Pure. */
export function needsOf(html) {
  const out = []; if (/navigator\.gpu\b/.test(html)) out.push('webgpu'); if (/navigator\.xr\b/.test(html)) out.push('webxr'); return out;
}
const humanize = (dir) => String(dir).replace(/^f?-?\d+[-_ ]*/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/** the metadata for a draft: { slug, num, title, blurb, source } from its SPEC.md and its own <title>. Pure. */
export function metaOf(dir, html, specMd) {
  const spec = parseSpec(specMd), own = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html), ownDesc = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html);
  const ownTitle = own ? plain(decode(own[1])).replace(TAG, '') : '';
  const title = spec.title || ownTitle || humanize(dir);
  const blurb = spec.blurb || (ownDesc ? clip(decode(ownDesc[1])) : '') || 'A Verse lab experiment: ' + title + '.';
  return { slug: slugOf(dir), num: numberOf(dir), title: rename(title), blurb: rename(blurb), source: dir };
}

/** the rename (AGENTS.md: "Everything a person reads says Verse"): the old name as a word, capital letter only (the lowercase void is the dark stage), in text a person reads. Pure. */
export const rename = (text) => String(text).replace(/\b(?:Void|V01D)\b/g, 'Verse');
/** html with the old name changed in its text nodes only: never in tags, attributes, scripts, styles or comments (an id or a CSS selector must keep matching). Pure. */
export function renameMarkup(html) {
  return String(html).replace(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->)|>([^<]+)</g, (all, block, text) => (block ? all : '>' + rename(text) + '<'));
}
const EXEC = /^(?:module|text\/javascript|application\/javascript|)$/i;
/** html -> { html, scripts: [{ file, type, code }] }: every inline executable script replaced by a same-folder external one. Pure. */
export function externalize(html) {
  const scripts = [];
  const out = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (all, attrs, code) => {
    if (/\bsrc\s*=/i.test(attrs)) return all;
    const t = (/\btype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs) || [, ''])[1];
    if (!EXEC.test(t) || !code.trim()) return all;
    const file = scripts.length ? 'app-' + (scripts.length + 1) + '.js' : 'app.js';
    scripts.push({ file, type: t, code });
    return '<script' + attrs.replace(/\s+$/, '') + ' src="' + file + '"></script>';
  });
  return { html: out, scripts };
}

/** why a draft cannot be a page, or ''. A script that never closes is a file cut off mid-write: it would stay inline (a rule of its own at deploy) and cannot run. Pure. */
export function unfinished(html) {
  const left = externalize(String(html)).html.replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, '').replace(/<script\b[^>]*type\s*=\s*["'](?!module|text\/javascript|application\/javascript)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
  return /<script\b/i.test(left) ? 'truncated file: a <script> never closes, so the page ends mid-code' : '';
}

/** the draft as a page of Verse: scripts external, head and footer wrapped around it. Pure. meta is metaOf(); needs is needsOf(). */
export function convertPage(html, meta, needs = needsOf(html)) {
  const ext = externalize(String(html)), scripts = ext.scripts.map((x) => ({ ...x, code: rename(x.code) }));
  let h = renameMarkup(ext.html);
  const url = SITE + '/lab/' + meta.slug + '/', title = meta.title + ' · Verse lab';
  if (!/<html\b/i.test(h)) h = '<html lang="en">' + h + '</html>';
  else if (!/<html\b[^>]*\slang\s*=/i.test(h)) h = h.replace(/<html\b/i, '<html lang="en"');
  if (!/<head\b/i.test(h)) h = h.replace(/<html\b[^>]*>/i, (m) => m + '<head></head>');
  const hadViewport = /<meta[^>]*name=["']viewport["']/i.test(h), hadCharset = /<meta[^>]*charset/i.test(h);
  h = h.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '').replace(/<meta\b[^>]*name=["']description["'][^>]*>\s*/gi, '');
  const head = [hadCharset ? '' : '<meta charset="utf-8">', hadViewport ? '' : '<meta name="viewport" content="width=device-width,initial-scale=1">',
    HANDOFF,
    '<title>' + esc(title) + '</title>', '<meta name="description" content="' + esc(meta.blurb) + '">',
    '<meta property="og:type" content="website">', '<meta property="og:site_name" content="Verse">', '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(meta.blurb) + '">', '<meta property="og:url" content="' + url + '">', '<meta property="og:image" content="' + SITE + '/og.png">',
    '<meta name="twitter:card" content="summary_large_image">', '<link rel="canonical" href="' + url + '">', '<link rel="icon" href="/icon.svg" type="image/svg+xml">',
    '<link rel="stylesheet" href="/lab/lab.css">', needs.length ? '<script src="/lab/needs.js" data-needs="' + needs.join(' ') + '" defer></script>' : '', BEACON].filter(Boolean).join('\n');
  h = /<\/head>/i.test(h) ? h.replace(/<\/head>/i, () => head + '\n</head>') : h.replace(/<head\b[^>]*>/i, (m) => m + head);
  const hasH1 = /<h1\b/i.test(h);
  const tail = (hasH1 ? '' : '<h1 class="vl-sr">' + esc(meta.title) + '</h1>\n') + '<footer class="vl-bar"><a href="/lab/">&larr; Lab</a> <a href="/">Ask Verse anything</a></footer>\n';
  h = /<\/body>/i.test(h) ? h.replace(/<\/body>/i, () => tail + '</body>') : /<\/html>/i.test(h) ? h.replace(/<\/html>/i, () => '<body>' + tail + '</body></html>') : h + '\n' + tail;
  return { html: h, scripts };
}

/** the shared stylesheet and the honest notice for a browser without WebGPU or WebXR: written next to the pages by every import. */
export const LAB_CSS = `/* /lab/ (tools/lab-import.mjs): the footer every experiment wears, and the notice for a browser that lacks what it needs */
.vl-bar{position:fixed;left:8px;bottom:8px;z-index:2147483646;font:12px/1.4 system-ui,-apple-system,sans-serif;background:rgba(7,6,11,.78);color:#ecebf5;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:3px 12px;opacity:.6;transition:opacity .2s}
.vl-bar:hover,.vl-bar:focus-within{opacity:1}.vl-bar a{color:inherit;margin-right:8px}.vl-bar a:last-child{margin-right:0}
.vl-sr{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:0;padding:0;border:0}
.vl-note{position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;font:14px/1.45 system-ui,-apple-system,sans-serif;background:#2b1a05;color:#ffe3b0;border:1px solid #b8791b;border-radius:10px;padding:8px 12px}
.vl-note button{font:inherit;float:right;margin-left:10px;background:transparent;color:inherit;border:1px solid currentColor;border-radius:999px;padding:0 10px;cursor:pointer}
/* the gallery */
.lab{max-width:1000px;margin:0 auto;padding:20px 16px 56px;color:#ecebf5;font:16px/1.5 system-ui,-apple-system,sans-serif}
.lab-page{margin:0;background:radial-gradient(ellipse at 50% 0,#1d1830,#07060b 70%) fixed;min-height:100vh}
.lab h1{font-size:28px;margin:8px 0 4px}.lab .lead{opacity:.75;margin:0 0 18px}.lab a{color:inherit}
.lab ul{list-style:none;margin:0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.lab li{border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.04)}
.lab li a{display:block;padding:12px 14px;text-decoration:none;min-height:44px}.lab li a:hover,.lab li a:focus-visible{background:rgba(255,255,255,.08);border-radius:12px}
.lab h2{font-size:16px;margin:0 0 4px}.lab li p{margin:0;font-size:13px;opacity:.75}.lab .meta{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12px;opacity:.9}
.badge{border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:0 8px}.badge.works{border-color:#4cc38a;color:#8ae6b6}.badge.needs-webgpu,.badge.needs-webxr{border-color:#e0a030;color:#ffd48a}
.lab footer{margin-top:28px;font-size:13px;opacity:.65}
`;
export const NEEDS_JS = `// /lab/needs.js (tools/lab-import.mjs): a lab experiment that needs WebGPU or WebXR says so plainly when this browser has neither,
// instead of sitting blank. It only adds a note above the page; the experiment's own code is not touched.
(function () {
  var tag = document.currentScript, need = ((tag && tag.getAttribute('data-needs')) || '').split(' ');
  function note(text) {
    var d = document.createElement('div'); d.className = 'vl-note'; d.setAttribute('role', 'status');
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Dismiss'; b.addEventListener('click', function () { d.remove(); });
    d.appendChild(b); d.appendChild(document.createTextNode(text)); document.body.appendChild(d);
  }
  function go() {
    var gone = [];
    if (need.indexOf('webgpu') >= 0 && !navigator.gpu) gone.push('WebGPU');
    if (need.indexOf('webxr') >= 0 && !navigator.xr) gone.push('WebXR');
    if (gone.length) return note('This experiment uses ' + gone.join(' and ') + ', which this browser does not offer, so part of it may stay blank or limited. A recent desktop Chrome or Edge' + (gone.indexOf('WebXR') >= 0 ? ' with a headset' : '') + ' runs it fully.');
    if (need.indexOf('webgpu') >= 0 && navigator.gpu.requestAdapter) navigator.gpu.requestAdapter().then(function (a) { if (!a) note('This browser has WebGPU but found no graphics adapter, so this experiment may stay blank or limited.'); }, function () {});
  }
  if (document.body) go(); else addEventListener('DOMContentLoaded', go);
})();
`;

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
/** a draft's fingerprint: changes when its page or its SPEC changes. */
export const hashOf = (d) => sha(d.html + '\0' + d.spec);
function writeIfChanged(file, text) {
  try { if (fs.readFileSync(file, 'utf8') === text) return false; } catch (_) { /* new */ }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return true;
}
/** the drafts that have an index.html: [{ dir, html, spec }], by name. */
export function readDrafts(draftsDir) {
  return fs.readdirSync(draftsDir).sort().filter((d) => fs.existsSync(path.join(draftsDir, d, 'index.html'))).map((dir) => {
    const spec = path.join(draftsDir, dir, 'SPEC.md');
    return { dir, html: fs.readFileSync(path.join(draftsDir, dir, 'index.html'), 'utf8'), spec: fs.existsSync(spec) ? fs.readFileSync(spec, 'utf8') : '' };
  });
}
/** import the drafts into `out` (`only`: just these slugs; `skip`: not these; `noticeFor`: the slugs that get the missing-WebGPU/WebXR notice, all that use them when null): pages, app.js files, the sibling files they name, and the shared css and notice. Returns [{ ...meta, needs, hash, changed }]. Never deletes. */
export function importDrafts({ drafts, out = LAB_DIR, skip = new Set(), only = null, noticeFor = null }) {
  const done = []; const seen = new Set();
  writeIfChanged(path.join(out, 'lab.css'), LAB_CSS); writeIfChanged(path.join(out, 'needs.js'), NEEDS_JS);
  for (const d of readDrafts(drafts)) {
    const meta = metaOf(d.dir, d.html, d.spec);
    if (!meta.slug || seen.has(meta.slug)) continue; seen.add(meta.slug);
    if (skip.has(meta.slug) || (only && !only.has(meta.slug))) continue;
    const cut = unfinished(d.html);
    if (cut) { done.push({ ...meta, needs: needsOf(d.html), hash: hashOf(d), changed: false, error: cut }); continue; }
    const needs = needsOf(d.html), { html, scripts } = convertPage(d.html, meta, !noticeFor || noticeFor.has(meta.slug) ? needs : []), dir = path.join(out, meta.slug);
    let changed = writeIfChanged(path.join(dir, 'index.html'), html);
    for (const s of scripts) changed = writeIfChanged(path.join(dir, s.file), s.code.replace(/^\n/, '')) || changed;
    for (const f of fs.readdirSync(path.join(drafts, d.dir))) {
      const p = path.join(drafts, d.dir, f);
      if (/\.md$/i.test(f) || f === 'index.html' || !fs.statSync(p).isFile() || !d.html.includes(f)) continue;
      const buf = fs.readFileSync(p); const dest = path.join(dir, f);
      if (!fs.existsSync(dest) || !fs.readFileSync(dest).equals(buf)) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(dest, buf); changed = true; }
    }
    done.push({ ...meta, needs, hash: hashOf(d), changed });
  }
  return done;
}

export const STATUS_LABEL = { works: 'Works', 'needs-webgpu': 'Needs WebGPU', 'needs-webxr': 'Needs WebXR' };
/** the experiments to list, newest first (highest F-number), then by name. Broken ones are never listed. Pure. */
export function listed(catalog) {
  return catalog.filter((e) => STATUS_LABEL[e.status]).sort((a, b) => (b.num - a.num) || (a.slug < b.slug ? -1 : 1));
}
/** the gallery page at /lab/ from the catalog: plain static cards, no script. Pure. */
export function renderGallery(catalog) {
  const rows = listed(catalog), works = rows.filter((e) => e.status === 'works').length;
  const desc = 'Experiments from the Verse lab, each a single page you can open and play with: ' + rows.length + ' that run in a browser. No sign-up, nothing leaves your device.';
  const card = (e) => '<li><a href="/lab/' + esc(e.slug) + '/"><h2>' + esc(e.title) + '</h2><p>' + esc(e.blurb) + '</p><div class="meta"><span class="badge ' + esc(e.status) + '">' + STATUS_LABEL[e.status] + '</span><span>' + (e.num ? 'F' + String(e.num).padStart(3, '0') : 'draft') + '</span></div></a></li>';
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' + HANDOFF + '\n<title>Verse lab: ' + rows.length + ' small experiments to play with</title>\n'
    + '<meta name="description" content="' + esc(desc) + '">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Verse">\n<meta property="og:title" content="Verse lab: small experiments to play with">\n<meta property="og:description" content="' + esc(desc) + '">\n'
    + '<meta property="og:url" content="' + SITE + '/lab/">\n<meta property="og:image" content="' + SITE + '/og.png">\n<meta name="twitter:card" content="summary_large_image">\n<link rel="canonical" href="' + SITE + '/lab/">\n<link rel="icon" href="/icon.svg" type="image/svg+xml">\n'
    + '<link rel="stylesheet" href="/lab/lab.css">\n' + BEACON + '\n</head>\n<body class="lab-page">\n<main class="lab">\n<h1>Verse lab</h1>\n<p class="lead">Small experiments the lab makes every hour: living fields, tiny minds, sound and touch. ' + works + ' run in any recent browser; the rest say what they need, such as WebGPU or a headset. Newest first.</p>\n<ul>\n'
    + rows.map(card).join('\n') + '\n</ul>\n<footer><a href="/tools/">All tools</a> &middot; <a href="/">Ask Verse anything</a></footer>\n</main>\n</body>\n</html>\n';
}
export const readCatalog = (out = LAB_DIR) => { try { return JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8')); } catch (_) { return []; } };
export function writeCatalog(catalog, out = LAB_DIR) {
  const sorted = [...catalog].sort((a, b) => (b.num - a.num) || (a.slug < b.slug ? -1 : 1));
  const a = writeIfChanged(path.join(out, 'catalog.json'), JSON.stringify(sorted, null, 1) + '\n');
  const b = writeIfChanged(path.join(out, 'index.html'), renderGallery(sorted)); return a || b;
}

/** what to try first for a broken experiment, from its error text. Pure. */
export function tryNext(error) {
  const e = String(error || '');
  if (/blank page/.test(e)) return 'it paints nothing: open it, find why the script draws no canvas or text (a stub file, a missing element id)';
  if (/already been declared/.test(e)) return 'two let or const of one name in one script: rename or merge them';
  if (/Unexpected token|Invalid left-hand|Unexpected identifier|missing \)|SyntaxError/.test(e)) return "a syntax error: run node --check on the page's app.js and fix the line it names";
  if (/is not defined/.test(e)) return 'a name used and never declared (a helper or constant that was dropped): find the missing declaration and restore it';
  if (/is not a function|Cannot read properties/.test(e)) return 'the script reads an element or value that is not there: check the element ids and the order the script runs in';
  if (/object stores|IDBDatabase|IndexedDB/.test(e)) return 'IndexedDB store missing: create it in onupgradeneeded or bump the database version';
  if (/http \d{3}|request failed/.test(e)) return 'a file the page names is not beside it: copy it or fix the path';
  return 'open it in a browser, read the console, fix the first error';
}
/** domains/lab.broken.md: one queue-ready line per experiment that was not published, from the catalog. Pure. */
export function brokenMd(catalog) {
  const rows = catalog.filter((e) => e.status === 'broken').sort((a, b) => (b.num - a.num) || (a.slug < b.slug ? -1 : 1));
  return '# Lab experiments that did not run (tools/lab-sync.mjs writes this file; do not edit by hand)\n\n'
    + 'Each line is a job for the free coder: the lab draft imported, opened in headless Chromium and failed, so it is NOT published at /lab/ (the catalog marks it broken).\n'
    + 'Fix the draft in the lab repo or in a copy, then run `node tools/lab-sync.mjs --drafts <drafts dir> --only <slug>`; a draft that now runs is published and leaves this list.\n\n'
    + (rows.length ? rows.map((e) => '- ' + e.slug + ' | draft: drafts/' + e.source + '/index.html | error: ' + String(e.error || '').replace(/\s+/g, ' ') + ' | try: ' + tryNext(e.error)).join('\n') + '\n' : '(none)\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const drafts = arg('--drafts'); if (!drafts) { console.error('usage: node tools/lab-import.mjs --drafts <drafts dir> [--out <dir>] [--skip slug,slug]'); process.exit(2); }
  const out = path.resolve(arg('--out', LAB_DIR)), skip = new Set((arg('--skip', '') || '').split(',').filter(Boolean));
  // with a catalog beside the pages (tools/lab-sync.mjs wrote it), re-import what it published the way it was tested: the broken ones left out, the notice only on needs-*
  const cat = readCatalog(out), notice = cat.length ? new Set(cat.filter((e) => e.status.startsWith('needs-')).map((e) => e.slug)) : null;
  for (const e of cat) if (e.status === 'broken') skip.add(e.slug);
  const rows = importDrafts({ drafts: path.resolve(drafts), out, skip, noticeFor: notice });
  for (const r of rows) { const e = cat.find((x) => x.slug === r.slug); if (e) { e.title = r.title; e.blurb = r.blurb; } } // the wording follows the importer's (the rename, a changed SPEC)
  if (cat.length) writeCatalog(cat, out);
  console.log('lab-import: ' + rows.length + ' drafts, ' + rows.filter((r) => r.changed).length + ' written to ' + path.relative(process.cwd(), out));
}
