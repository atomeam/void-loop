// Banned phrases in the copy people see. This used to be a house-rule boast filter (no "conquered", "surpassed", "the best",
// "look what I made" and the like); that taste rule was agent-made and is gone, so Verse may say any of those. What is left is the
// phrase the owner asked never to see: "heavy lifting". It scans the site's pages, skills, libraries and text files with comments
// taken out, so a note in a comment is history, not copy. Run: node tools/humble-copy.mjs (exit 1 on a hit); node --test tools/humble-copy.test.mjs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = 'void-live-deploy';
const EXT = /\.(?:html|js|mjs|txt|md|xml|webmanifest)$/;
const SKIP_DIR = /^(?:vendor|node_modules|incidents|podcast|sounds|tower-evidence|tower\.shots|tower\.icons|data|history)$/;
// the tower card is being rebuilt by another worker (docs/TAGTEAM.md, 2026-11-09 humble copy): its files are checked once it lands
export const PENDING = new Set([
  'lib/tower.js', 'skills/tower.js', 'skills/mini/tower.js', 'lib/tower-art.js', 'lib/tower-rank.js',
]);

/** the banned phrases: each { id, re }. Words only, in prose. */
export const BOASTS = [
  { id: 'heavy-lifting', re: /\bheavy lifting\b/gi },
];

/** ALLOW: [file, boast id, a piece of the matched line, why]. Keep it small and explicit. */
export const ALLOW = [
];

/** the text with comments taken out: block, HTML and line comments (a line comment needs a space or start before //, so https:// stays). Pure. */
export function strip(src) {
  return String(src)
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
}

/** every boast in a text: [{ id, line, text }]. Pure. */
export function boastsIn(src) {
  const t = strip(src), out = [], lines = t.split('\n');
  lines.forEach((l, i) => {
    for (const b of BOASTS) { b.re.lastIndex = 0; let m; while ((m = b.re.exec(l))) out.push({ id: b.id, line: i + 1, text: l.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50).trim(), hit: m[0] }); }
  });
  return out;
}

const allowed = (file, h) => ALLOW.some(([f, id, piece]) => f === file && id === h.id && h.text.includes(piece));

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) { if (!SKIP_DIR.test(n)) walk(p, out); } else if (EXT.test(n)) out.push(p);
  }
  return out;
}
/** every boast left in the site's copy: [{ file, id, line, text }]. */
export function scan(root = ROOT) {
  const out = [];
  for (const p of walk(root)) {
    const file = relative(root, p).split('\\').join('/');
    if (PENDING.has(file) || /(?:^|\/)tower[.-]/.test(file)) continue;
    for (const h of boastsIn(readFileSync(p, 'utf8'))) if (!allowed(file, h)) out.push({ file, ...h });
  }
  return out;
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const hits = scan();
  for (const h of hits) console.log(h.file + ':' + h.line + ' [' + h.id + '] ' + h.text);
  console.log(hits.length ? hits.length + ' boast(s): rewrite them plainly, or name a real non-boast in ALLOW with its reason' : 'humble copy: no boasts');
  process.exit(hits.length ? 1 : 0);
}
