// Which checks `node tools/checks.mjs --changed` runs (tools/checks-changed.mjs), on fixtures: a changed lib picks the tests that import it
// (directly, two levels down, or through the dependency map), an unrelated change skips them, void.html picks all, structural stays on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { select, whyRun, testImports, reached, resolveRepo, isStructural, parsePorcelain, REACHES_ALL, STRUCTURAL } from './checks-changed.mjs';

const texts = {
  'tools/where.test.mjs': "import test from 'node:test';\nimport { findPlace } from '../void-live-deploy/lib/where.js';\n",
  'tools/grow.test.mjs': "import { grow } from './grow.mjs';\n",
  'tools/grow.mjs': "import { ledger } from '../void-live-deploy/lib/ledger.js';\nimport { readFileSync } from 'node:fs';\n",
  'tools/chess-replay.test.mjs': "import { readFileSync } from 'node:fs';\nconst src = readFileSync('void-live-deploy/skills/chess.js', 'utf8');\n",
  'tools/poker.test.mjs': "import { deal } from '../void-live-deploy/skills/poker.js';\n",
  'tools/skills-index.test.mjs': "import { build } from './skills-index.mjs';\n",
};
const readText = (p) => (p in texts ? texts[p] : null);
const deps = { files: {
  'lib/where.js': { imports: ['lib/geo.js'], importedBy: ['skills/where.js'] },
  'lib/geo.js': { imports: [], importedBy: ['lib/where.js'], reachedBy: ['skills/where.js'] },
  'skills/where.js': { imports: ['lib/where.js'], importedBy: [] },
} };
const jobs = [
  { name: 'copies' }, // inline check, no file of its own
  { name: 'index', file: 'skills-index.mjs' }, // a tool run with --check
  { name: 'skills-index', file: 'skills-index.test.mjs' }, // a test named structural
  { name: 'where', file: 'where.test.mjs' },
  { name: 'grow', file: 'grow.test.mjs' },
  { name: 'chess-replay', file: 'chess-replay.test.mjs' },
  { name: 'poker', file: 'poker.test.mjs' },
];
const names = (s) => s.run.map((j) => j.name);
const structural = ['copies', 'index', 'skills-index'];

test('a changed lib picks the tests importing it: directly, and through what the test imports (two levels)', () => {
  const s = select(jobs, ['void-live-deploy/lib/where.js'], { deps, readText });
  assert.deepEqual(names(s), [...structural, 'where']);
  assert.equal(s.why.where, 'imports void-live-deploy/lib/where.js');
  assert.deepEqual(s.skipped.map((j) => j.name), ['grow', 'chess-replay', 'poker']);
  assert.equal(s.line, '--changed: 4 of 7 checks (3 skipped: nothing they cover changed: grow, chess-replay, poker)');
  const two = select(jobs, ['void-live-deploy/lib/ledger.js'], { deps, readText });
  assert.deepEqual(names(two), [...structural, 'grow']);
  assert.equal(two.why.grow, 'imports void-live-deploy/lib/ledger.js');
});

test('the dependency map carries a change up: a lib nobody tests directly reaches the tests of what imports it', () => {
  const s = select(jobs, ['void-live-deploy/lib/geo.js'], { deps, readText });
  assert.deepEqual(names(s), [...structural, 'where']);
  assert.equal(s.why.where, 'imports void-live-deploy/lib/where.js');
  assert.deepEqual([...reached(['void-live-deploy/lib/geo.js'], deps)].sort(), ['void-live-deploy/lib/geo.js', 'void-live-deploy/lib/where.js', 'void-live-deploy/skills/where.js']);
  assert.deepEqual([...reached(['docs/RULES.md'], null)], ['docs/RULES.md']); // no map, a file outside the site: only itself
});

test('an unrelated change skips every targeted test and keeps the structural ones', () => {
  const s = select(jobs, ['docs/RULES.md', 'domains/void.agents.log.md'], { deps, readText });
  assert.deepEqual(names(s), structural);
  assert.equal(s.line, '--changed: 3 of 7 checks (4 skipped: nothing they cover changed: where, grow, chess-replay, poker)');
  for (const n of structural) assert.equal(s.why[n], 'structural');
});

test('a changed test runs itself; a file named like a check or written in a test picks it (skills read by path, not imported)', () => {
  assert.deepEqual(names(select(jobs, ['tools/poker.test.mjs'], { deps, readText })), [...structural, 'poker']);
  const byName = select(jobs, ['void-live-deploy/skills/chess.js'], { deps, readText });
  assert.deepEqual(names(byName), [...structural, 'chess-replay']);
  assert.equal(byName.why['chess-replay'], 'named after chess.js');
  assert.equal(whyRun({ name: 'replay', file: 'chess-replay.test.mjs' }, ['void-live-deploy/skills/chess.js'], { reach: new Set(['void-live-deploy/skills/chess.js']), readText }), 'named after chess.js');
  assert.equal(whyRun({ name: 'replay', file: 'replay.test.mjs' }, ['void-live-deploy/skills/chess.js'], { reach: new Set(['void-live-deploy/skills/chess.js']), readText: () => "readFileSync('skills/chess.js')" }), 'reads chess.js');
  assert.equal(whyRun({ name: 'replay', file: 'replay.test.mjs' }, ['void-live-deploy/skills/chess.js'], { reach: new Set(['void-live-deploy/skills/chess.js']), readText: () => 'nothing here' }), '');
});

test('void.html, index.html, sw.js, a workflow, package.json or the runner itself runs everything; so does a git failure', () => {
  for (const f of ['void.html', 'void-live-deploy/index.html', 'void-live-deploy/flip/index.html', 'void-live-deploy/sw.js', '.github/workflows/deploy.yml', 'package.json', 'package-lock.json', 'tools/checks.mjs', 'tools/pool.mjs', 'tools/checks-changed.mjs']) {
    assert.ok(REACHES_ALL.test(f), f);
    const s = select(jobs, ['docs/RULES.md', f], { deps, readText });
    assert.equal(s.run.length, jobs.length, f); assert.equal(s.skipped.length, 0);
    assert.equal(s.line, `--changed: all 7 checks (${f} changed: it reaches everything)`);
  }
  for (const f of ['void-live-deploy/lib/where.js', 'tools/grow.mjs', 'docs/index.md', 'void-live-deploy/skills/sw-helper.js']) assert.ok(!REACHES_ALL.test(f), f);
  const s = select(jobs, null, { deps, readText });
  assert.equal(s.run.length, jobs.length); assert.equal(s.line, '--changed: all 7 checks (git could not say what changed)');
});

test('structural: no test file of its own, or a name in STRUCTURAL', () => {
  assert.ok(isStructural({ name: 'copies' }));
  assert.ok(isStructural({ name: 'index', file: 'skills-index.mjs' }));
  assert.ok(isStructural({ name: 'fringe', file: 'fringe.mjs' }));
  assert.ok(isStructural({ name: 'map-coverage', file: 'map-coverage.test.mjs' }));
  assert.ok(!isStructural({ name: 'where', file: 'where.test.mjs' }));
  assert.ok(!isStructural({ name: 'sky', file: 'test_sky.mjs' }));
  for (const n of ['map-sync', 'map-coverage', 'skills-index', 'skills-unlisted', 'ledger-proof', 'preload', 'families', 'guide', 'secret-scan', 'checks-changed']) assert.ok(STRUCTURAL.has(n), n);
});

test('imports resolve to repo paths; packages, URLs and node: are not files; porcelain lines give the path (a rename its new name)', () => {
  assert.equal(resolveRepo('tools/where.test.mjs', '../void-live-deploy/lib/where.js'), 'void-live-deploy/lib/where.js');
  assert.equal(resolveRepo('tools/grow.test.mjs', './grow.mjs'), 'tools/grow.mjs');
  assert.equal(resolveRepo('tools/x.test.mjs', '/skills/figures3d.js?v=2'), 'void-live-deploy/skills/figures3d.js');
  assert.equal(resolveRepo('tools/x.test.mjs', 'node:fs'), null);
  assert.equal(resolveRepo('tools/x.test.mjs', 'playwright'), null);
  assert.equal(resolveRepo('tools/x.test.mjs', 'https://cdn.example/x.js'), null);
  assert.equal(resolveRepo('tools/x.test.mjs', '../../outside.js'), null);
  assert.deepEqual([...testImports('tools/grow.test.mjs', readText)].sort(), ['tools/grow.mjs', 'void-live-deploy/lib/ledger.js']);
  assert.deepEqual([...testImports('tools/grow.test.mjs', readText, 1)], ['tools/grow.mjs']);
  assert.deepEqual(parsePorcelain(' M tools/a.mjs\n?? tools/b.mjs\nR  old.md -> new.md\n'), ['tools/a.mjs', 'tools/b.mjs', 'new.md']);
});
