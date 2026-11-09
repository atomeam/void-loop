import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addedCheckLines, discoveredChecks, overlapRate, settleChecks } from './checks-list.mjs';
import { BUILD_OUTPUTS } from './generated.mjs';
import { APPEND_TEXT } from './records.mjs';
import { refusals } from './pre-pr.mjs';

const LIST = `const x = 1;
for (const [name, file] of [
  ['a', 'a.test.mjs'],
]) {
  run(file);
}
`;

test('a new check is a file, and two added list lines become one list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'checks-d-'));
  writeFileSync(join(dir, 'tide.chk'), 'tide card\ntide.test.mjs\n');
  assert.deepEqual(discoveredChecks(dir), [['tide card', 'tide.test.mjs']]);
  assert.equal(addedCheckLines("+  ['tide', 'tide.test.mjs'],\n").length, 1);
  const ours = LIST.replace("['a', 'a.test.mjs'],", "['a', 'a.test.mjs'],\n  ['b', 'b.test.mjs'],");
  const theirs = LIST.replace('const x = 1;', 'const x = 2;').replace("['a', 'a.test.mjs'],", "['a', 'a.test.mjs'],\n  ['c', 'c.test.mjs'],");
  const settled = settleChecks(LIST, ours, theirs);
  assert.match(settled, /const x = 2;/);
  assert.match(settled, /\['b', 'b\.test\.mjs'\]/);
  assert.match(settled, /\['c', 'c\.test\.mjs'\]/);
  assert.equal(settleChecks(LIST, LIST.replace('const x = 1;', 'const x = 3;'), theirs), null);
});

test('the skill index is generated and a new check line is refused', () => {
  assert.ok(BUILD_OUTPUTS.includes('void-live-deploy/skills/index.json'), 'file void-live-deploy/skills/index.json is generated and must not be committed');
  assert.ok(APPEND_TEXT.includes('domains/handoff.md'));
  assert.ok(APPEND_TEXT.includes('domains/growth-inbox.md'));
  const [line] = refusals({ behind: 0, files: ['tools/checks.mjs'], numstat: '1\t0\ttools/checks.mjs', prs: [], checkDiff: "+  ['tide', 'tide.test.mjs'],\n" });
  assert.match(line, /rule: check-list-is-one-file/);
  assert.match(line, /file: tools\/checks\.mjs/);
  const index = refusals({ behind: 0, files: ['void-live-deploy/skills/index.json'], numstat: '2\t0\tvoid-live-deploy/skills/index.json', prs: [] });
  assert.match(index.join('\n'), /skills\/index\.json/);
});

test('settled shared files drop out of the overlap rate', () => {
  const prs = [
    { created: '2026-11-09T20:00:00Z', merged_at: '2026-11-09T22:00:00Z', files: ['tools/checks.mjs', 'tools/x.mjs'] },
    { created: '2026-11-09T21:00:00Z', merged_at: '2026-11-09T23:00:00Z', files: ['tools/checks.mjs'] },
    { created: '2026-11-09T21:30:00Z', merged_at: '2026-11-09T22:30:00Z', files: ['tools/test_void.mjs', 'tools/checks.mjs'] },
  ];
  const before = overlapRate(prs, []);
  assert.equal(before.pairs, 3);
  assert.equal(before.share, 3);
  const after = overlapRate(prs, ['tools/checks.mjs']);
  assert.equal(after.after, 0, 'every shared file in this set was the check list');
  assert.ok(after.rateAfter < before.rate);
});
