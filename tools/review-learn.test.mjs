import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExtra, caughtBy, learnFromPr, summary, langOfPath, EXTRA, closerReadOf, phantomsIn, lessonsIn, hunkRanges, lessonSummary, slugFor, addedLines, symbolsIn, placeBySymbol } from './review-learn.mjs';

test('the extra reviewer\'s severity and title are read from both of its formats', () => {
  assert.deepEqual(parseExtra('**🗄️ Data Integrity & Integration** | **🟡 Minor** | **⚡ Quick win**\n\n**Reject invalid estimates instead of changing them.**\n\nIf a participant…'),
    { severity: 'minor', title: 'Reject invalid estimates instead of changing them.' });
  assert.deepEqual(parseExtra('_⚠️ Potential issue_\n\n**Guard the parsed value.**\n\nmore'), { severity: 'issue', title: 'Guard the parsed value.' });
  assert.equal(parseExtra('_🧹 Nitpick (assertive)_\n\n**Rename x.**').severity, 'nitpick');
  assert.equal(parseExtra('**🔴 Critical**\n\nplain words first line').title, 'plain words first line');
});

test('Void caught a spot when it flagged something within 3 lines, notes aside', () => {
  const f = [{ line: 10, kind: 'risk', rule: 'a' }, { line: 30, kind: 'note', rule: 'n' }];
  assert.equal(caughtBy(f, 12).rule, 'a');
  assert.equal(caughtBy(f, 14), null);
  assert.equal(caughtBy(f, 30), null);
});

test('each extra finding on a merged PR is checked against Void\'s review of the file at that commit', () => {
  const file = "const a = 1;\nconst l = JSON.parse(localStorage.getItem('k') || '[]').filter((x) => x);\nconst b = 2;\n";
  const comments = [
    { user: { login: EXTRA }, path: 'x.js', original_line: 2, original_commit_id: 's1', body: '_⚠️ Potential issue_\n\n**Validate the shape.**' },
    { user: { login: EXTRA }, path: 'x.js', original_line: 40, original_commit_id: 's1', body: '**🟡 Minor**\n\n**Something Void cannot see.**' },
    { user: { login: EXTRA }, path: 'notes.md', original_line: 3, original_commit_id: 's1', body: '**🟡 Minor**\n\n**Docs.**' },
    { user: { login: EXTRA }, path: 'x.js', original_line: 2, original_commit_id: 's1', body: '_🧹 Nitpick_\n\n**Style.**' },
    { user: { login: EXTRA }, in_reply_to_id: 1, path: 'x.js', original_line: 2, body: 'reply' },
    { user: { login: 'someone' }, path: 'x.js', original_line: 2, body: 'a person' },
  ];
  const rows = learnFromPr(7, comments, (p, sha) => (p === 'x.js' && sha === 's1' ? file : null));
  assert.equal(rows.length, 4);
  assert.ok(['json-array-shape', 'json-parse-storage'].includes(rows[0].caught));
  assert.equal(rows[1].caught, null);
  assert.equal(rows[2].reviewed, false);
  const s = summary(rows);
  assert.deepEqual([s.findings, s.scored, s.caught, s.rate, s.notReviewable], [4, 2, 1, 50, 1]);
  assert.equal(s.missed[0].title, 'Something Void cannot see.');
  assert.equal(summary([]).rate, null);
  assert.equal(langOfPath('a/b.MJS'), 'javascript');
  assert.equal(langOfPath('README.md'), null);
});

test("Void's own closer read: a 'not defined' claim about a name the file imports, or a claim about the mask, counts as a false finding the filter removes", () => {
  const body = "<!-- void-review -->\n### Void's review\n\n#### A closer read\n\n* **Line 149 (answer.js):** `redact` is not defined in `answer.js`. This will cause a ReferenceError.\n\n* **Line 3 (answer.js):** `frobnicate` is not defined.\n\n* **Line 28:** `TOKEN` is assigned using `[redacted]`, which is not a valid value.\n\n**Not blocking:** none.\n\n<sub>Reviewed</sub>";
  const fileAt = (p, sha) => (p.endsWith('answer.js') && sha === 'sha1' ? "import { redact } from '../../lib/automation-fix.js';\nexport async function onRequestPost() {}\n" : 'const TOKEN = 1;');
  const rows = phantomsIn(254, body, ['void-live-deploy/functions/api/answer.js', 'tools/x.mjs'], 'sha1', fileAt);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.false), [true, false, true]);
  assert.deepEqual(rows.map((r) => r.dropped), [true, false, true]);
  assert.deepEqual(rows[0].files, ['void-live-deploy/functions/api/answer.js']);
  assert.equal(rows[2].mask, true);
  assert.equal(closerReadOf('no marker'), null);
  assert.equal(phantomsIn(1, '<!-- void-review -->\nno closer read here', [], 'x', () => null).length, 0);
});

test("lessons: a closer-read finding with a line is placed on the file it names or the file whose hunk covers it, checked against the rules, and listed as a candidate case when they missed it; praise and phantoms are not lessons", () => {
  const body = "<!-- void-review -->\n#### A closer read\n\n### Performance\n* **Line 2 (q.js):** The `load` function runs a query inside a loop. This is slow.\n\n* **Line 60:** The `TOKEN` is assigned using `[redacted]`, which is not valid.\n\n* **Line 9:** The regex correctly expands the pattern.\n\n* **Line 58:** `JSON.parse` here is unguarded.\n\n* **Line 300:** Something in a line no hunk covers.\n\n**Not blocking:** none\n<sub>x</sub>";
  const files = [{ filename: 'q.js', patch: '@@ -1,2 +1,4 @@' }, { filename: 'lib/other.js', patch: '@@ -50,2 +55,12 @@' }, { filename: 'notes.md', patch: '@@ -1 +1 @@' }];
  const texts = { 'q.js': "async function load(rows) {\n  for (const r of rows) { const n = await db.prepare('SELECT COUNT(*) FROM t').first(); }\n}\n", 'lib/other.js': 'const a = 1;\n' + 'x();\n'.repeat(56) + "const v = JSON.parse(localStorage.getItem('k')).filter(Boolean);\n" };
  const rows = lessonsIn(9, body, files.map((f) => f.filename), 's', (p) => texts[p] ?? null, hunkRanges(files));
  assert.deepEqual(rows.map((r) => [r.line, r.path || null, r.placed, r.caught || null]), [[2, 'q.js', true, 'query-in-loop'], [58, 'lib/other.js', true, 'json-parse-storage'], [300, null, false, null]]);
  assert.equal(rows[0].sentence, 'The `load` function runs a query inside a loop.');
  const sum = lessonSummary(rows);
  assert.deepEqual([sum.closerFound, sum.rulesFlagged, sum.unplaced, sum.candidates.length], [2, 2, 1, 0]);
  assert.equal(slugFor('The `upsert` function performs a `SELECT COUNT(*)` inside a loop.'), 'performs-inside-loop');
  assert.deepEqual(hunkRanges(files)['lib/other.js'], [[55, 66]]);
});

test("lessons by symbol: a finding that names a function rather than a file is placed on the one file whose added lines carry that symbol; a symbol in two files, or in none, leaves it unplaced", () => {
  const files = [
    { filename: 'a.js', patch: '@@ -1,2 +1,4 @@\n const x = 1;\n+function frob(n) {\n+  return n * 2;\n+}\n const y = 2;' },
    { filename: 'b.js', patch: '@@ -10,2 +10,3 @@\n let q;\n+const v = JSON.parse(localStorage.getItem(\'k\')).filter(Boolean);\n let w;\n@@ -40 +41,2 @@\n z();\n+const shared = frobnicate();' },
    { filename: 'c.js', patch: '@@ -1 +1,2 @@\n a();\n+const shared = 2;' },
  ];
  const added = addedLines(files);
  assert.deepEqual(added['a.js'], [[2, 'function frob(n) {'], [3, '  return n * 2;'], [4, '}']]);
  assert.deepEqual(added['b.js'].map(([n]) => n), [11, 42]);
  assert.deepEqual(symbolsIn('The `frob()` function and `this` and `JSON.parse` here; `frob` again.'), ['frob', 'JSON.parse']);
  assert.deepEqual(symbolsIn('The provided diff is a documentation update to `void.frontier.md` and `tools/checks.mjs`.'), [], 'file names are not symbols');
  assert.deepEqual(placeBySymbol('`frob` doubles without a guard.', added, ['a.js', 'b.js', 'c.js']), { path: 'a.js', line: 2, symbol: 'frob' });
  assert.equal(placeBySymbol('`shared` is declared twice.', added, ['a.js', 'b.js', 'c.js']), null, 'a symbol in two files decides nothing');
  assert.equal(placeBySymbol('`nowhere` is wrong.', added, ['a.js', 'b.js', 'c.js']), null);
  assert.equal(placeBySymbol('`frobnicate` is not `frob`.', added, ['a.js', 'b.js', 'c.js']).path, 'b.js', 'whole symbols only: frob does not match frobnicate');
  const body = "<!-- void-review -->\n#### A closer read\n\n* **Line 11:** `JSON.parse` is unguarded here.\n\n* **Line 2 (no file):** The `frob` function has no guard.\n\n* **Line 500:** The `frob` result is never checked.\n\n* **Bug:** `shared` is declared in two files.\n\n* The `frob` helper is also exported twice.\n\n* Something vague with no symbol at all.\n\n* The provided diff is a documentation update to `void.frontier.md`.\n\n* `b.js:11`: the parse is still unguarded.\n\n**Not blocking:** none\n<sub>x</sub>";
  const texts = { 'a.js': 'const x = 1;\nfunction frob(n) {\n  return n * 2;\n}\nconst y = 2;\n', 'b.js': 'let q;\n'.repeat(10) + "const v = JSON.parse(localStorage.getItem('k')).filter(Boolean);\nlet w;\n" + 'z();\n'.repeat(29) + 'const shared = frobnicate();\n', 'c.js': 'a();\nconst shared = 2;\n' };
  const rows = lessonsIn(9, body, files.map((f) => f.filename), 's', (p) => texts[p] ?? null, hunkRanges(files), added);
  assert.deepEqual(rows.map((r) => [r.line, r.path || null, r.placed, r.symbol || null]),
    [[11, 'b.js', true, null], [2, 'a.js', true, 'frob'], [2, 'a.js', true, 'frob'], [0, null, false, null], [2, 'a.js', true, 'frob'], [11, 'b.js', true, null]]);
  assert.equal(rows[5].caught, 'json-parse-storage', 'the file:line form places like "Line N"; a paragraph that only quotes a file name is not a finding');
  assert.equal(rows[3].sentence, '`shared` is declared in two files.', 'a symbol found in two files is counted as unplaced; a paragraph with neither line nor symbol is not a finding');
  assert.equal(rows[0].caught, 'json-parse-storage', 'the line-and-hunk placement is unchanged');
  assert.equal(rows[2].line, 2, 'a line the closer read miscounted (500) moves to the symbol\'s own line');
  assert.equal(rows[4].sentence, 'The `frob` helper is also exported twice.');
  const sum = lessonSummary(rows);
  assert.deepEqual([sum.closerFound, sum.unplaced, sum.bySymbol], [5, 1, 3]);
});
