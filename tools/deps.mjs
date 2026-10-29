// The dependency map (asked by Verse, ask-20261012-1942-2: "Create a 'dependency map' visualization that shows which skills (like
// 'forge') are most impacted by changes in core code imports"): who imports whom under void-live-deploy/ (skills/**, lib/**,
// functions/**), read off the import lines themselves, and for each lib file how many skills depend on it, directly or through
// another file. Written to void-live-deploy/skills/deps.json; the "dependency map" card (skills/deps.js) shows it.
//   node tools/deps.mjs           write deps.json and print the most depended-on lib files
//   node tools/deps.mjs --check   exit 1 if deps.json is out of date (tools/checks.mjs runs this)
//   node tools/deps.mjs <file>    print what depends on one file (lib/where.js)
// Static imports only (import … from '…', export … from '…', import('…') with a string): a path a script builds at run time
// is not an import the repo can read. Paths outside void-live-deploy/ (a CDN, a bare package) are kept as `external`.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = resolve(root, 'void-live-deploy');
export const OUT = resolve(SITE, 'skills/deps.json');
export const DIRS = ['skills', 'lib', 'functions'];

/** every .js file under the three dirs, as site-relative posix paths (skills/x.js), sorted */
export function listFiles(site = SITE) {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(resolve(site, d)).sort()) { const p = d + '/' + n, full = resolve(site, p); if (statSync(full).isDirectory()) walk(p); else if (/\.m?js$/.test(n)) out.push(p); } };
  for (const d of DIRS) if (existsSync(resolve(site, d))) walk(d);
  return out;
}

const IMPORT = /(?:^|[\s;({=,])(?:import|export)\s*(?:[\w*{}\s,$]+?\s*from\s*)?['"]([^'"\n]+)['"]|(?:^|[\s;({=,])import\s*\(\s*['"]([^'"\n]+)['"]\s*\)/gm; // the word must open a statement or expression: one quoted in a string is text
/** the import specifiers one file's text holds, in order, once each. Pure. */
export function specifiers(text) {
  const out = [], src = String(text || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); // comments carry sample imports
  for (const m of src.matchAll(IMPORT)) { const s = m[1] || m[2]; if (s && !out.includes(s)) out.push(s); }
  return out;
}
/** a specifier resolved to a site path (lib/x.js), or null when it leaves the site. Pure. */
export function resolveSpec(from, spec) {
  if (/^(?:https?:)?\/\//.test(spec) || /^(?:node|npm|cloudflare):/.test(spec)) return null;
  if (spec.startsWith('/')) return spec.slice(1).replace(/[?#].*$/, '');
  if (spec.startsWith('.')) { const p = posix.normalize(posix.join(posix.dirname(from), spec)).replace(/[?#].*$/, ''); return p.startsWith('..') ? null : p; }
  return null; // a bare package name (installed, not in the tree)
}

/** the graph: { files: { path: { imports: [paths], external: [specs] } } } from { path: text }. Pure. */
export function graph(texts) {
  const files = {};
  for (const [p, t] of Object.entries(texts).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const imports = [], external = [];
    for (const s of specifiers(t)) { const r = resolveSpec(p, s); if (r) { if (!imports.includes(r)) imports.push(r); } else if (!external.includes(s)) external.push(s); }
    files[p] = { imports, external };
  }
  return files;
}

/** every file that depends on `path`, directly or through other files: { direct: [], all: [] }, sorted. Pure. */
export function dependants(files, path) {
  const by = {}; for (const [p, f] of Object.entries(files)) for (const i of f.imports) (by[i] = by[i] || []).push(p);
  const direct = (by[path] || []).slice().sort(), all = new Set(), queue = [...direct];
  while (queue.length) { const p = queue.shift(); if (all.has(p)) continue; all.add(p); for (const q of by[p] || []) if (!all.has(q)) queue.push(q); }
  return { direct, all: [...all].sort() };
}
/** how many test files import each lib file directly (tools/*.test.mjs and tools/test_*.mjs, by their import lines): { 'lib/x.js': n }. Pure.
 *  Asked by Verse (a 'dependency-health' skill that compares this map against stability requirements): the requirement it checks is that shared
 *  code many skills depend on has a test that imports it. */
export function testedLibs(testTexts) {
  const n = {};
  for (const [tp, t] of Object.entries(testTexts || {})) for (const s of specifiers(t)) {
    const r = resolveSpec(tp, s);
    if (r && r.startsWith('void-live-deploy/lib/')) { const f = r.slice('void-live-deploy/'.length); n[f] = (n[f] || new Set()).add(tp); }
  }
  return Object.fromEntries(Object.entries(n).map(([f, set]) => [f, set.size]));
}
const isSkill = (p) => /^skills\/[^/]+\.js$/.test(p); // a skill proper: skills/x.js (its helpers, like skills/mini/*, count as files it reaches through)

/** the whole map, deterministic: the files, each with who imports it; the lib files ranked by the skills that depend on them. Pure. */
export function build(texts, testTexts = {}) {
  const files = graph(texts), out = {}, libs = [], tested = testedLibs(testTexts);
  for (const p of Object.keys(files)) {
    const d = dependants(files, p);
    out[p] = { imports: files[p].imports, ...(files[p].external.length ? { external: files[p].external } : {}), importedBy: d.direct, ...(d.all.length !== d.direct.length ? { reachedBy: d.all.filter((x) => !d.direct.includes(x)) } : {}) };
    if (p.startsWith('lib/')) libs.push({ file: p, skills: d.all.filter(isSkill).length, direct: d.direct.filter(isSkill).length, dependants: d.all.length, tests: tested[p] || 0 });
  }
  libs.sort((a, b) => b.skills - a.skills || b.dependants - a.dependants || (a.file < b.file ? -1 : 1));
  const missing = [...new Set(Object.values(files).flatMap((f) => f.imports))].filter((p) => !(p in files) && !existsSync(resolve(SITE, p))).sort();
  return { files: out, libs, missing };
}
export const toJson = (b, files = Object.keys(b.files).length) => JSON.stringify({
  note: 'Who imports whom under void-live-deploy/ (tools/deps.mjs, from the import lines; asked by Verse). libs: each lib file with the skills that depend on it, directly or through another file (skills), directly (direct), and every dependant of any kind (dependants). files: each file\'s imports, the files that import it (importedBy) and the ones that reach it through them (reachedBy).',
  counted: files, libs: b.libs, files: b.files }, null, 1) + '\n';

/** the repo's test files, { 'tools/x.test.mjs': text } */
export function readTests(dir = resolve(root, 'tools')) {
  return Object.fromEntries(readdirSync(dir).filter((n) => /\.test\.mjs$|^test_[\w-]+\.mjs$/.test(n)).sort().map((n) => ['tools/' + n, readFileSync(resolve(dir, n), 'utf8')]));
}

export function readAll(site = SITE) { return Object.fromEntries(listFiles(site).map((p) => [p, readFileSync(resolve(site, p), 'utf8')])); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const b = build(readAll(), readTests()), json = toJson(b), arg = process.argv[2];
  if (arg && arg !== '--check') {
    const p = arg.replace(/^void-live-deploy\//, '').replace(/^\//, ''), f = b.files[p];
    if (!f) { console.error('no such file in the map: ' + p + ' (paths look like lib/where.js)'); process.exit(1); }
    console.log(p + ': imported by ' + f.importedBy.length + ' file' + (f.importedBy.length === 1 ? '' : 's') + (f.reachedBy ? ', reached by ' + f.reachedBy.length + ' more' : ''));
    for (const d of f.importedBy) console.log('  ' + d); for (const d of f.reachedBy || []) console.log('  (through another) ' + d);
    process.exit(0);
  }
  if (b.missing.length) { console.error('imports that point at no file: ' + b.missing.join(', ')); process.exit(1); }
  if (arg === '--check') {
    if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== json) { console.error('void-live-deploy/skills/deps.json is out of date (node tools/deps.mjs)'); process.exit(1); }
    console.log('ok: ' + Object.keys(b.files).length + ' files, ' + b.libs.length + ' lib files mapped'); process.exit(0);
  }
  writeFileSync(OUT, json);
  for (const l of b.libs.slice(0, 12)) console.log(l.file.padEnd(32) + String(l.skills).padStart(4) + ' skills (' + l.direct + ' directly), ' + l.dependants + ' dependants');
  console.log('wrote ' + OUT.replace(root + '/', '') + ': ' + Object.keys(b.files).length + ' files');
}
