#!/usr/bin/env node
// The dependency scanner for moves into skills/ (asked by Verse: "Implement a dependency scanner that automatically updates the
// published-page check whenever a file is moved into the skills/ directory"). Main went red once because the published-page check
// proved the rendered page was the homepage by finding /mountCalendar/ in its HTML, and #545 moved that function into
// skills/calendar.js (63a00fd). A check keyed on a name the page no longer holds fails on every run and nothing says why.
//   node tools/moved-check.mjs              static: a check in tools/ that looks for a name in page HTML (`/Name/.test(pg.html)`,
//                                           `html.includes('Name')`) where void.html no longer declares it but skills/ or lib/ does
//   node tools/moved-check.mjs --base main  also read the diff against a base: names removed from void.html and added in skills/
//   node tools/moved-check.mjs --update     rewrite each such check to look for the homepage's own stage instead (`<div id="stage"`),
//                                           which no skill move can take away, and say what changed
// Pure parts are exported for tools/moved-check.test.mjs. Reads files and git only; --update edits only the lines it names.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ANCHOR = '<div id="stage"'; // the homepage's own stage: it is in the page whatever moves out of it
const DECL = /(?:^|[\s;{(])(?:async\s+)?(?:function\s*\*?\s+|(?:const|let|var|class)\s+)([A-Za-z_$][\w$]{4,})\b/g;

/** the names a text declares (function x, const x, class X). Pure. */
export function declared(text) { return new Set([...String(text || '').matchAll(DECL)].map((m) => m[1])); }
/** names a diff removed from the page and added somewhere else: those moved. Pure. */
export function movedNames(pageDiff, otherDiff) {
  const gone = new Set(), plus = (d, sign) => String(d || '').split('\n').filter((l) => l[0] === sign && !l.startsWith(sign.repeat(3))).join('\n');
  for (const n of declared(plus(pageDiff, '-'))) gone.add(n);
  const there = declared(plus(otherDiff, '+'));
  return [...gone].filter((n) => there.has(n) && !declared(plus(pageDiff, '+')).has(n)).sort();
}
// a check that looks for a bare name in something named html/page: /Name/.test(pg.html), html.includes('Name'), page.indexOf("Name")
const LOOK = [
  /\/([A-Za-z_$][\w$]{4,})\/[a-z]*\.test\(\s*([\w.$]*(?:html|Html|HTML|page|Page)[\w.$]*)\s*\)/g,
  /([\w.$]*(?:html|Html|HTML|page|Page)[\w.$]*)\.(?:includes|indexOf)\(\s*['"]([A-Za-z_$][\w$]{4,})['"]\s*\)/g,
];
/** the checks in a file's lines that look for a name: [{ line, name, text }]. Pure. */
export function lookups(text) {
  const out = [];
  String(text || '').split('\n').forEach((t, i) => {
    for (const re of LOOK) for (const m of t.matchAll(new RegExp(re.source, re.flags))) out.push({ line: i + 1, name: re === LOOK[0] ? m[1] : m[2], text: t }); // void-review: ok: LOOK is a fixed list of regex literals in this file, never user input
  });
  return out;
}
/** the lookups whose name the page lacks and `elsewhere` declares: the checks a move broke. Pure. */
export function dangling(file, text, pageText, elsewhere, moved = []) {
  return lookups(text).filter((l) => (moved.includes(l.name) || !pageText.includes(l.name)) && elsewhere.has(l.name) && !pageText.includes('function ' + l.name) && !pageText.includes('const ' + l.name)).map((l) => ({ file, ...l }));
}
/** one line with its broken lookup pointed at the stage. Pure. */
export function updated(text, name) {
  const esc = name.replace(/[$]/g, '\\$&');
  return text.replace(new RegExp('/' + esc + '/([a-z]*)\\.test\\(', 'g'), (_, f) => '/' + ANCHOR + '/' + f + '.test(').replace(new RegExp("\\.(includes|indexOf)\\(\\s*(['\"])" + esc + "\\2", 'g'), (_, fn, q) => '.' + fn + '(' + q + ANCHOR + q)
    .replace(/$/, text.includes('moved-check') ? '' : ' /* moved-check: ' + name + ' moved out of the page */');
}

const read = (p) => readFileSync(resolve(root, p), 'utf8');
function elsewhereNames() {
  const out = new Set();
  for (const d of ['void-live-deploy/skills', 'void-live-deploy/lib']) for (const f of readdirSync(resolve(root, d))) if (/\.m?js$/.test(f)) for (const n of declared(read(d + '/' + f))) out.add(n);
  return out;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
  const pageText = read('void.html'), elsewhere = elsewhereNames();
  let moved = [];
  const base = arg('--base');
  if (base) {
    const git = (...a) => { try { return execFileSync('git', ['diff', base + '...HEAD', '--', ...a], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (_) { return ''; } };
    moved = movedNames(git('void.html'), git('void-live-deploy/skills', 'void-live-deploy/lib'));
    if (moved.length) console.log('moved out of the page since ' + base + ': ' + moved.join(', '));
  }
  const files = readdirSync(resolve(root, 'tools')).filter((f) => /\.mjs$/.test(f) && f !== 'moved-check.mjs' && !/moved-check/.test(f)).map((f) => 'tools/' + f);
  const bad = files.flatMap((f) => dangling(f, read(f), pageText, elsewhere, moved));
  if (!bad.length) { console.log('ok: no check looks for a name the page lost to skills/ or lib/'); process.exit(0); }
  for (const b of bad) console.log(b.file + ':' + b.line + ': looks for ' + b.name + ' in the page, which now lives in skills/ or lib/' + (process.argv.includes('--update') ? '' : ' (node tools/moved-check.mjs --update points it at the stage)'));
  if (process.argv.includes('--update')) {
    for (const f of [...new Set(bad.map((b) => b.file))]) {
      const lines = read(f).split('\n');
      for (const b of bad.filter((x) => x.file === f)) lines[b.line - 1] = updated(lines[b.line - 1], b.name);
      writeFileSync(resolve(root, f), lines.join('\n'));
      console.log('updated ' + f + ': ' + bad.filter((x) => x.file === f).map((x) => x.name).join(', ') + ' now looks for ' + ANCHOR);
    }
    process.exit(0);
  }
  process.exit(1);
}
