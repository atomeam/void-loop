import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExtra, caughtBy, learnFromPr, summary, langOfPath, EXTRA, closerReadOf, phantomsIn, lessonsIn, hunkRanges, lessonSummary, slugFor } from './review-learn.mjs';

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
