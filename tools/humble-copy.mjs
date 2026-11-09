// Humble copy (owner, 2026-11-09: "find any other part where verse is tooting its own horn and remove it, we never do that, first of all we
// arent shit"). Verse never brags: no win counts, no "conquered", "surpassed" or "outclassed" rivals, no "the best" or "better than X" about
// itself, no "look what I made". This scans the copy people see (the site's pages, skills, libraries, text files) with comments taken out,
// so the owner's own words quoted in a comment are history, not copy. A word that is a game's own rule ("beat the level") or a data key
// ('surpassed' as an outcome id, the /conquered/ path) is not a boast and is not matched; anything else that matches has to be rewritten
// or named in ALLOW with the reason. Run: node tools/humble-copy.mjs (exit 1 on a boast); node --test tools/humble-copy.test.mjs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = 'void-live-deploy';
const EXT = /\.(?:html|js|mjs|txt|md|xml|webmanifest)$/;
const SKIP_DIR = /^(?:vendor|node_modules|incidents|podcast|sounds|tower-evidence|tower\.shots|tower\.icons|data|history)$/;
// the tower card is being rebuilt by another worker (docs/TAGTEAM.md, 2026-11-09 humble copy): its files are checked once it lands
export const PENDING = new Set([
  'lib/tower.js', 'skills/tower.js', 'skills/mini/tower.js', 'lib/tower-art.js', 'lib/tower-rank.js', 'conquered/index.html',
]);

/** the boasts: each { id, re }. Words only, in prose; a data key or a path is not prose (see strip and the lookarounds). */
export const BOASTS = [
  { id: 'conquer', re: /(?<![/\w'"-])conquer(?:s|ed|ing|or|ors)?(?![/\w'"-])/gi },
  { id: 'outclass', re: /\boutclass(?:es|ed|ing)?\b/gi },
  { id: 'surpassed', re: /\b(?:has|have|had|been|it|Verse|we|I|I've|we've|haven't|hasn't|every site|sites?|all|is|are|was|were|be|not yet)\s+(?:been\s+|already\s+|now\s+)?surpass(?:ed|es|ing)?\b|\bsurpassing\b|\bsurpass(?:ed|es)? (?:it|them|every|all|the (?:site|rival|competition))\b/gi },
  { id: 'defeated', re: /\bdefeated (?:sites?|rivals?|targets?|competitors?|tools?)\b|\bevery defeated\b/gi },
  { id: 'dominate', re: /\bdominat(?:e|es|ed|ing|ion)\b(?! the (?:board|centre|center))/gi },
  { id: 'crush', re: /\bcrush(?:es|ed|ing)? (?:the |every |all )?(?:competition|rivals?|competitors?|sites?)\b/gi },
  { id: 'beat-rivals', re: /\b(?:beats?|beaten|beating|outdo(?:es|ne)?|outperform(?:s|ed)?) (?:every|all|the|other|its|our) (?:sites?|rivals?|competitors?|competition|tools?)\b|\bbeaten in every way\b/gi },
  { id: 'best', re: /\b(?:Verse|I|we|A-to-Mind)(?:'s| is| am| are|'m|'re)? (?:the )?(?:best|greatest|smartest|superior|number one|#1)\b/gi },
  { id: 'than-rival', re: /\b\d+x faster than\b|\b(?:better|smarter|faster) than (?:the best site|every|all|any other|other sites|the competition|its rivals?)\b/gi },
  { id: 'awe', re: /\bawe-?inspiring\b|\bin awe\b/gi },
  { id: 'i-made', re: /\b(?:look what I made|I made [\d,]+|everything I made|I built this:)/gi },
  { id: 'win-count', re: /\b\d[\d,]* (?:sites?|rivals?) (?:surpassed|beaten|conquered)\b|\b(?:surpassed|beaten|conquered) [\d,]+ (?:sites?|rivals?)\b/gi },
];

/** ALLOW: [file, boast id, a piece of the matched line, why]. Keep it small and explicit. */
export const ALLOW = [
  ['assimilated/index.html', 'conquer', "'passed, conquering in background':", 'the old data label (tools/assimilated.mjs LABEL) as a key, mapped to plain words for the page'],
  ['lib/autopsy.js', 'i-made', 'look what i made', 'what a person may type to open the walkthrough, matched, never shown'],
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
