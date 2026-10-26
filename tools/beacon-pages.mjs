// Every page people can land on counts its visits (coordinator, 2026-10-26: search and launch traffic lands on the tool pages, not the stage, so
// a page without the beacon is traffic Verse cannot see). The beacon is one tag, `<script src="/visit.js" defer></script>` (functions/api/visit.js,
// docs/playbooks/traffic.md): deferred, so it never holds up the first paint, and the beacon itself waits for the load event.
// The generated pages carry it from their templates (tools/tool-site-pages.mjs, fix-pages.mjs, music-pages.mjs, photos/index.html for
// photos-pages.mjs; functions/is-it/[what].js writes it into its own head); the hand-written ones get it from this tool, before </head>.
//   node tools/beacon-pages.mjs           add the tag to every sitemap page that lacks it
//   node tools/beacon-pages.mjs --check   exit 1 naming each sitemap page without it (tools/beacon-pages.test.mjs runs this in checks.mjs)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TAG = '<script src="/visit.js" defer></script>';
const HAS = /<script[^>]*\ssrc="\/visit\.js"[^>]*>/;
/** pages served by a function, not a file: the file whose source writes the page's head */
export const FUNCTIONS = Object.freeze({ '/is-it/': 'void-live-deploy/functions/is-it/[what].js' });

/** the sitemap's addresses -> [{ url, file, fn }] for the HTML pages (llms.txt and other non-HTML entries skipped). Pure but for the reads. */
export function pages(cwd = root) {
  const xml = readFileSync(resolve(cwd, 'void-live-deploy/sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>https:\/\/a-to-mind\.com([^<]*)<\/loc>/g)].map((m) => m[1] || '/');
  const out = [];
  for (const u of urls) {
    if (/\.(txt|xml|json)$/.test(u)) continue;
    const fn = Object.keys(FUNCTIONS).find((p) => u.startsWith(p) && u !== p);
    if (fn) { out.push({ url: u, file: FUNCTIONS[fn], fn: true }); continue; }
    out.push({ url: u, file: 'void-live-deploy' + (u === '/' ? '/index.html' : u.endsWith('/') ? u + 'index.html' : u) });
  }
  return out;
}

/** the html with the tag on its own line just before </head>; unchanged when it is there already or there is no </head>. Pure. */
export function withBeacon(html) {
  if (HAS.test(html)) return html;
  const i = html.indexOf('</head>'); if (i < 0) return html;
  return html.slice(0, i) + TAG + '\n' + html.slice(i);
}

/** the sitemap pages without the beacon: [{ url, file, why }] */
export function missing(cwd = root) {
  const bad = [], seen = new Set();
  for (const p of pages(cwd)) {
    const f = resolve(cwd, p.file);
    if (!existsSync(f)) { bad.push({ ...p, why: 'no file' }); continue; }
    if (p.fn && seen.has(p.file)) continue; seen.add(p.file);
    if (!HAS.test(readFileSync(f, 'utf8'))) bad.push({ ...p, why: 'no ' + TAG });
  }
  return bad;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const bad = missing();
    if (bad.length) { console.error(bad.map((b) => b.url + ' (' + b.file + '): ' + b.why).join('\n') + '\nrun node tools/beacon-pages.mjs (or add the tag to the generator that writes the page)'); process.exit(1); }
    console.log('ok: every sitemap page (' + pages().length + ') carries the visit beacon'); process.exit(0);
  }
  let n = 0;
  for (const p of pages()) {
    if (p.fn) continue;
    const f = resolve(root, p.file); if (!existsSync(f)) continue;
    const html = readFileSync(f, 'utf8'), want = withBeacon(html);
    if (want !== html) { writeFileSync(f, want); n++; console.log('beacon: ' + p.url); }
  }
  console.log('added the beacon to ' + n + ' page(s)');
}
