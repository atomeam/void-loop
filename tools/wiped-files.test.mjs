// Wiped-file guard (lists run, 2026-10-21): two writes on main left lib/stage-tools.js as the one word PLACEHOLDER_REPLACE_ME and cut
// lib/tome.js off in the middle of a doc comment, and nothing caught either. Every tracked script under void-live-deploy/lib, skills and
// functions must be more than a stub, must not start with a placeholder, and must close every block comment it opens.
// Ledger guard (2026-11-11): a whole-file write replaced domains/void.frontier.md, the one build order, with the word PLACEHOLDER on
// main (PR #2701) and nothing in CI caught it: the frontier test runs only from tools/checks.mjs, which no CI job runs, and
// tools/prepush.mjs's ledgerShrinks guard needs a base. So the append-only ledgers are checked here too, base-free, the way the
// scripts are. Run: node --test tools/wiped-files.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEDGERS, ledgerWiped } from './prepush.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', 'void-live-deploy/lib/*.js', 'void-live-deploy/skills/*.js', 'void-live-deploy/functions/**/*.js'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
/** why a script looks wiped or cut short, or '' when it looks whole. Pure. */
export function wipedWhy(src) {
  const s = String(src || '');
  if (s.trim().length < 40) return 'stub (' + s.trim().length + ' bytes)';
  if (/^\s*(?:PLACEHOLDER|SEE_DISK|TODO_REPLACE)/.test(s)) return 'placeholder';
  // walk the code: skip strings and line comments; a block comment must find its */ before the file ends
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === '"' || c === "'" || c === '`') { for (i++; i < s.length && s[i] !== c && !(c !== '`' && s[i] === '\n'); i++) if (s[i] === '\\') i++; continue; }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const end = s.indexOf('*/', i + 2); if (end < 0) return 'ends inside a block comment'; i = end + 1; }
  }
  return '';
}
test('the guard itself: a stub, a placeholder and a cut-off comment are caught; a whole file is not', () => {
  assert.match(wipedWhy('PLACEHOLDER_REPLACE_ME'), /stub|placeholder/); assert.equal(wipedWhy('PLACEHOLDER: ' + 'x'.repeat(60)), 'placeholder');
  assert.equal(wipedWhy('export const a = 1; export const b = 2;\n/** the page\'s own ink art, haunted in Octob'), 'ends inside a block comment');
  assert.equal(wipedWhy('export const a = 1; // a whole file with "/*" in a string\nexport const b = "/*";\n/** ok */\n'), '');
  assert.equal(wipedWhy('export const a = 1; export const b = 2; export const c = 3;\n/** cut off mid comment'), 'ends inside a block comment');
});
test('no tracked page script is wiped or cut short', () => {
  assert.ok(files.length > 100, 'found the scripts');
  const bad = files.map((f) => [f, wipedWhy(readFileSync(resolve(root, f), 'utf8'))]).filter(([, why]) => why);
  assert.deepEqual(bad, []);
});
test('no append-only ledger is wiped to a placeholder (the frontier was, 2026-11-11)', () => {
  assert.ok(LEDGERS.length >= 6, 'found the ledgers');
  const bad = LEDGERS.map((f) => [f, ledgerWiped(f, readFileSync(resolve(root, f), 'utf8'))]).filter(([, why]) => why);
  assert.deepEqual(bad, []);
});
