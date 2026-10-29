// Speed for the direct pages (owner, 2026-10-24: "speed fixes a lot of our other issues and is worth fixing permanently"): a page whose module
// imports a module that imports another is a waterfall, one round trip per level (/flip/ was page -> skills/coin.js -> lib/tally.js ->
// lib/reactions.js and lost the tower's speed aspect, 1747 ms against 860). Every module a direct page reaches by static imports is listed in its
// head as <link rel="modulepreload">, between two marker comments, so the browser asks for all of them at once. Generated, never kept by hand:
//   node tools/preload.mjs          rewrite the lists (the pages under void-live-deploy/<name>/index.html that load modules)
//   node tools/preload.mjs --check  exit 1 when a page's list is missing or stale (tools/checks.mjs runs it)
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
  const seen = [], scripts = [...String(html).matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const visit = (spec, from) => {
    if (!/^[./]/.test(spec)) return; // a bare or full URL: not ours
    const p = new URL(spec, 'https://x' + from).pathname; if (seen.includes(p)) return;
    let code; try { code = read(p); } catch (_) { return; }
    seen.push(p); for (const s of importsOf(code)) visit(s, p);
  };
  for (const s of scripts) for (const spec of importsOf(s)) visit(spec, '/');
  return seen;
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
  if (check && stale) process.exit(1);
  if (check) console.log('preload: every direct page preloads its modules');
}
