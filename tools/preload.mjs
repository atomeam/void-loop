// Speed for the direct pages (owner, 2026-10-24: "speed fixes a lot of our other issues and is worth fixing permanently"): a page whose module
// imports a module that imports another is a waterfall, one round trip per level (/flip/ was page -> skills/coin.js -> lib/tally.js ->
// lib/reactions.js and lost the tower's speed aspect, 1747 ms against 860). Every module a direct page reaches by static imports is listed in its
// head as <link rel="modulepreload">, between two marker comments, so the browser asks for all of them at once. Generated, never kept by hand:
//   node tools/preload.mjs          rewrite the lists (the pages under void-live-deploy/<name>/index.html that load modules)
//   node tools/preload.mjs --check  exit 1 when a page's list is missing or stale (tools/checks.mjs runs it)
// void.html imports the libs every ask waits on only once someone starts to ask, so its list is a line of code, not a <link> in its head:
// ASK_LIB_GRAPH, every module those libs reach, written from the roots named on the line above it (and copied to both deploy copies).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'void-live-deploy');
const START = '<!-- modulepreload: tools/preload.mjs -->', END = '<!-- /modulepreload -->';

/** the static import specifiers in a piece of module code (import x from '...', import '...', export ... from '...'); dynamic import() is not followed. Pure. */
export function importsOf(code) {
  const out = [], re = /(?:^|[;\n}])\s*(?:import|export)\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g; let m;
  const plain = String(code).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  while ((m = re.exec(plain))) out.push(m[1]);
  return out;
}
/** every site path a page reaches through static imports, in first-reached order (/skills/coin.js, /lib/tally.js, ...). */
export function graphOf(html, read = (p) => fs.readFileSync(path.join(site, p), 'utf8')) {
  const scripts = [...String(html).matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  return graphFrom(scripts.flatMap((s) => importsOf(s)), read);
}
/** every site path the given module specifiers reach through static imports, themselves first, in first-reached order. */
export function graphFrom(specs, read = (p) => fs.readFileSync(path.join(site, p), 'utf8')) {
  const seen = [];
  const visit = (spec, from) => {
    if (!/^[./]/.test(spec)) return; // a bare or full URL: not ours
    const p = new URL(spec, 'https://x' + from).pathname; if (seen.includes(p)) return;
    let code; try { code = read(p); } catch (_) { return; }
    seen.push(p); for (const s of importsOf(code)) visit(s, p);
  };
  for (const spec of specs) visit(spec, '/');
  return seen;
}
const ASK_LIBS_RE = /(\/\/ ask-libs: tools\/preload\.mjs((?: \S+)+)\n\s*const ASK_LIB_GRAPH = )\[[^\]\n]*\];/;
/** void.html with its ASK_LIB_GRAPH line written from the roots its marker line names; null when the page has no such line. Pure given read. */
export function withAskLibs(html, read) {
  const m = String(html).match(ASK_LIBS_RE); if (!m) return null;
  const list = graphFrom(m[2].trim().split(' '), read);
  return String(html).replace(ASK_LIBS_RE, (_, head) => head + '[' + list.map((p) => "'" + p + "'").join(', ') + '];');
}
/** the page with its preload list written (or rewritten) just before </head>. Pure. */
export function withPreloads(html, paths) {
  const block = START + '\n' + paths.map((p) => '<link rel="modulepreload" href="' + p + '">').join('\n') + '\n' + END;
  const cut = String(html).replace(new RegExp('\\n?' + START.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\n?'), '');
  return paths.length ? cut.replace(/<\/head>/i, '\n' + block + '\n</head>') : cut;
}
export const pages = () => fs.readdirSync(site, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(site, d.name, 'index.html'))).map((d) => path.join(site, d.name, 'index.html'))
  .filter((f) => /type=["']module["']/.test(fs.readFileSync(f, 'utf8')));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'); let stale = 0;
  for (const f of pages()) {
    const html = fs.readFileSync(f, 'utf8'), next = withPreloads(html, graphOf(html)), name = path.relative(root, f);
    if (next === html) continue;
    if (check) { stale++; console.error('preload: ' + name + ' does not preload every module it imports; run node tools/preload.mjs'); } else { fs.writeFileSync(f, next); console.log('preload: ' + name + ' ' + graphOf(html).join(' ')); }
  }
  { const f = path.join(root, 'void.html'), html = fs.readFileSync(f, 'utf8'), next = withAskLibs(html);
    if (next === null) { stale++; console.error('preload: void.html has no ask-libs line (const ASK_LIB_GRAPH) under its marker'); }
    else if (next !== html) { if (check) { stale++; console.error('preload: void.html ASK_LIB_GRAPH does not list every module the ask libs import; run node tools/preload.mjs'); }
      else { for (const g of [f, path.join(site, 'index.html'), path.join(site, 'void.html')]) fs.writeFileSync(g, next); console.log('preload: void.html ASK_LIB_GRAPH (and both deploy copies)'); } } }
  if (check && stale) process.exit(1);
  if (check) console.log('preload: every direct page preloads its modules');
}
