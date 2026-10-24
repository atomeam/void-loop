// tools/preload.mjs: a direct page preloads every module it reaches. Run: node --test tools/preload.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { importsOf, graphOf, withPreloads } from './preload.mjs';

test('the static imports of module code, not dynamic ones, comments or strings that only look like them', () => {
  assert.deepEqual(importsOf("import a from '../lib/a.js';\nimport { b } from \"./b.js\";\nexport { c } from '/lib/c.js';\nimport './d.js';\nconst x = import('./lazy.js'); // import z from './z.js'"), ['../lib/a.js', './b.js', '/lib/c.js', './d.js']);
});
test('a page reaches its modules level by level, each once, and the list goes before </head>, rewritten in place the next time', () => {
  const files = { '/skills/coin.js': "import { t } from '../lib/tally.js'; import { c } from '../lib/coins.js';", '/lib/tally.js': "import { r } from './reactions.js';", '/lib/reactions.js': '', '/lib/coins.js': "import { r } from './reactions.js';" };
  const html = '<html><head><title>x</title></head><body><script type="module">import coin from \'/skills/coin.js\';</script></body></html>';
  const g = graphOf(html, (p) => { if (!(p in files)) throw new Error('no'); return files[p]; });
  assert.deepEqual(g, ['/skills/coin.js', '/lib/tally.js', '/lib/reactions.js', '/lib/coins.js']);
  const once = withPreloads(html, g); assert.equal((once.match(/rel="modulepreload"/g) || []).length, 4); assert.ok(once.indexOf('modulepreload') < once.indexOf('</head>'));
  assert.equal(withPreloads(once, g), once, 'the same list twice changes nothing');
  assert.equal((withPreloads(once, g.slice(0, 1)).match(/rel="modulepreload"/g) || []).length, 1, 'a shorter list replaces the old one');
});
