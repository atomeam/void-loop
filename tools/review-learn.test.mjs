import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExtra, caughtBy, learnFromPr, summary, langOfPath, EXTRA } from './review-learn.mjs';

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
