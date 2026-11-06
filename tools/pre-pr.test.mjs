import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedTouched } from './generated.mjs';
import { gateStatus, onlyBuildConflicts } from './merge-gate.mjs';
import { behindCount } from './pre-pr.mjs';

test('a build output in the diff is named, a source file is not', () => {
  assert.deepEqual(generatedTouched(['void-live-deploy/skills/index.json', 'void-live-deploy/skills/order/0100-x', 'tools/pre-pr.mjs']), ['void-live-deploy/skills/index.json']);
});

test('the merge gate regenerates a build output and stops on any other file', () => {
  assert.equal(onlyBuildConflicts(['void-live-deploy/skills/index.json', 'void-live-deploy/sitemap.xml']), true);
  assert.equal(onlyBuildConflicts(['void-live-deploy/skills/index.json', 'void.html']), false);
  assert.equal(onlyBuildConflicts([]), false);
});

test('the merge gate installs packages once after a red run, and only a red that survives the install counts', () => {
  const seq = (...v) => () => v.shift();
  let installs = 0; const install = (s) => () => { installs++; return s; };
  assert.equal(gateStatus(seq(0), install(0)), 0); assert.equal(installs, 0);
  assert.equal(gateStatus(seq(1, 0), install(0)), 0); assert.equal(installs, 1);
  assert.equal(gateStatus(seq(1, 1), install(0)), 1);
  assert.equal(gateStatus(seq(1, 0), install(1)), 1, 'a failed install keeps the first red');
});

test('behind main is the count git prints', () => {
  assert.equal(behindCount('origin/main', 'HEAD', () => ({ status: 0, stdout: '3\n' })), 3);
  assert.equal(behindCount('origin/main', 'HEAD', () => ({ status: 1, stdout: '' })), null);
});

test('the size counts added and removed lines, not build outputs, run records or binaries', async () => {
  const { diffSize } = await import('./pre-pr.mjs');
  const numstat = ['10\t5\ttools/a.mjs', '300\t0\tvoid-live-deploy/skills/index.json', '1\t0\tgrowth/entries/x.json', '-\t-\tvoid-live-deploy/og.png', '7\t3\ttools/bench.json', '2\t2\tlib/{old.js => new.js}'].join('\n');
  const s = diffSize(numstat);
  assert.equal(s.lines, 19);
  assert.deepEqual(s.counted.map((x) => x.file), ['tools/a.mjs', 'lib/new.js']);
});

test('a branch opens only when it is on main, small and shares no file with another open PR', async () => {
  const { refusals, MAX_LINES } = await import('./pre-pr.mjs');
  const prs = [{ number: 7, title: 'team crew', files: ['void-live-deploy/functions/api/team.js', 'domains/handoff.md'] }, { number: 9, title: 'mine', files: ['tools/x.mjs'] }];
  assert.deepEqual(refusals({ behind: 0, files: ['tools/x.mjs', 'domains/handoff.md'], numstat: '5\t1\ttools/x.mjs', prs, self: 9 }), []);
  assert.equal(MAX_LINES, 400);
  const [behind] = refusals({ behind: 2, files: ['tools/x.mjs'], numstat: '1\t0\ttools/x.mjs', prs: [] });
  assert.match(behind, /2 commit\(s\) behind main/);
  const [big] = refusals({ behind: 0, files: ['tools/x.mjs'], numstat: '401\t0\ttools/x.mjs', prs: [] });
  assert.match(big, /401 changed lines, more than 400/);
  assert.deepEqual(refusals({ behind: 0, files: ['tools/x.mjs'], numstat: '400\t0\ttools/x.mjs', prs: [] }), []);
  const [hot] = refusals({ behind: 0, files: ['void-live-deploy/functions/api/team.js'], numstat: '3\t1\tvoid-live-deploy/functions/api/team.js', prs });
  assert.match(hot, /open PR #7 .* also changes void-live-deploy\/functions\/api\/team\.js/);
  assert.deepEqual(refusals({ behind: 0, files: ['void-live-deploy/functions/api/team.js'], numstat: '3\t1\tx', prs: null }), [], 'no PR list (offline): the overlap is not judged');
});
