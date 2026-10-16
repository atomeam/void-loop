import test from 'node:test';
import assert from 'node:assert/strict';
import { specifiers, resolveSpec, graph, dependants, build, toJson, listFiles, readAll } from './deps.mjs';

test('import lines are read as written: static imports, re-exports and import() with a string; comments and built paths are not', () => {
  const src = `import { a } from '../lib/a.js';\nimport * as B from "./b.js"; // import { x } from './gone.js'\nexport { c } from '/lib/c.js';\n/* import y from './gone2.js' */\nconst m = await import('./d.js');\nconst p = './' + name + '.js'; import(p);\nimport 'https://cdn.example/x.js';\nimport('../lib/a.js');\nconst s = "import { q } from './quoted.js'";`;
  assert.deepEqual(specifiers(src), ['../lib/a.js', './b.js', '/lib/c.js', './d.js', 'https://cdn.example/x.js']);
});

test('a specifier resolves to a site path, or leaves the site', () => {
  assert.equal(resolveSpec('skills/x.js', '../lib/a.js'), 'lib/a.js');
  assert.equal(resolveSpec('functions/api/mcp.js', '../../lib/guard.js'), 'lib/guard.js');
  assert.equal(resolveSpec('skills/mini/chess.js', '../scene3d.js'), 'skills/scene3d.js');
  assert.equal(resolveSpec('skills/x.js', '/skills/figures3d.js?v=2'), 'skills/figures3d.js');
  assert.equal(resolveSpec('skills/x.js', 'https://cdn.example/three.js'), null);
  assert.equal(resolveSpec('skills/x.js', 'node:fs'), null);
  assert.equal(resolveSpec('skills/x.js', 'three'), null);
  assert.equal(resolveSpec('lib/a.js', '../../outside.js'), null);
});

test('the graph and its dependants: direct importers, and the files that reach a file through them, each counted once', () => {
  const texts = {
    'skills/x.js': "import { a } from '../lib/a.js'; import { b } from '../lib/b.js';",
    'skills/y.js': "import { b } from '../lib/b.js';",
    'skills/mini/z.js': "import { s } from '../scene3d.js';",
    'skills/scene3d.js': "import { a } from '../lib/a.js'; import 'https://cdn.example/x.js';",
    'lib/a.js': '',
    'lib/b.js': "import { a } from './a.js';",
    'functions/api/r.js': "import { b } from '../../lib/b.js';",
  };
  const g = graph(texts);
  assert.deepEqual(g['skills/x.js'], { imports: ['lib/a.js', 'lib/b.js'], external: [] });
  assert.deepEqual(g['skills/scene3d.js'].external, ['https://cdn.example/x.js']);
  assert.deepEqual(dependants(g, 'lib/b.js'), { direct: ['functions/api/r.js', 'lib/b.js'].filter((p) => p !== 'lib/b.js').concat(['skills/x.js', 'skills/y.js']).sort(), all: ['functions/api/r.js', 'skills/x.js', 'skills/y.js'] });
  const A = dependants(g, 'lib/a.js');
  assert.deepEqual(A.direct, ['lib/b.js', 'skills/scene3d.js', 'skills/x.js']);
  assert.deepEqual(A.all, ['functions/api/r.js', 'lib/b.js', 'skills/mini/z.js', 'skills/scene3d.js', 'skills/x.js', 'skills/y.js']);
  const b = build(texts);
  assert.deepEqual(b.libs.map((l) => [l.file, l.skills, l.direct, l.dependants]), [['lib/a.js', 3, 2, 6], ['lib/b.js', 2, 2, 3]], 'skills proper (skills/x.js) count; a helper under skills/mini/ is a file it reaches through');
  assert.deepEqual(b.files['lib/a.js'].reachedBy, ['functions/api/r.js', 'skills/mini/z.js', 'skills/y.js']);
  assert.equal('reachedBy' in b.files['lib/b.js'], false, 'no extra field when nothing reaches it indirectly');
  assert.deepEqual(b.missing, []);
  assert.equal(toJson(b), toJson(build(texts)), 'deterministic: the --check compares bytes');
  assert.match(toJson(b), /"counted": 7/);
});

test('the real tree: every file under skills/, lib/ and functions/ is read, no import points at a missing file, and the written map is current', () => {
  const files = listFiles();
  assert.ok(files.includes('skills/family-health.js') && files.includes('lib/ask-text.js') && files.some((f) => f.startsWith('functions/api/')));
  const b = build(readAll());
  assert.deepEqual(b.missing, [], 'an import that points at no file is a broken page');
  assert.ok(b.libs[0].skills >= 1 && b.libs[0].file.startsWith('lib/'));
});

test('the card (skills/deps.js) reads the asks and the written map', async () => {
  const { parseAsk, findFile, dependantsOf } = await import('../void-live-deploy/skills/deps.js');
  const { readFileSync } = await import('node:fs');
  const deps = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/deps.json', import.meta.url), 'utf8'));
  assert.deepEqual(parseAsk('what depends on lib/ask-text.js'), { file: 'lib/ask-text.js' });
  assert.equal(parseAsk('what depends on the weather'), null);
  assert.equal(findFile(deps, 'ask-text.js'), 'lib/ask-text.js');
  const D = dependantsOf(deps, 'lib/ask-text.js');
  assert.ok(D.skills.length >= 20 && D.skills.every((s) => /^skills\//.test(s.file)));
});
