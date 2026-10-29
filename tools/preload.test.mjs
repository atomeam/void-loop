// tools/preload.mjs: a direct page preloads every module it reaches. Run: node --test tools/preload.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { importsOf, graphOf, graphFrom, withPreloads, withAskLibs } from './preload.mjs';

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
test('void.html lists every module its ask libs reach on one line, from the roots its marker names, so they are asked for at once', () => {
  const files = { '/lib/a.js': "import { k } from './k.js';", '/lib/k.js': "import { w } from './w.js';", '/lib/w.js': '', '/lib/b.js': "import { k } from './k.js';" };
  const read = (p) => { if (!(p in files)) throw new Error('no'); return files[p]; };
  assert.deepEqual(graphFrom(['/lib/a.js', '/lib/b.js'], read), ['/lib/a.js', '/lib/k.js', '/lib/w.js', '/lib/b.js']);
  const page = "<script>\n    // ask-libs: tools/preload.mjs /lib/a.js /lib/b.js\n    const ASK_LIB_GRAPH = [];\n    const warm = 1;\n</script>";
  const once = withAskLibs(page, read);
  assert.ok(once.includes("const ASK_LIB_GRAPH = ['/lib/a.js', '/lib/k.js', '/lib/w.js', '/lib/b.js'];"), once);
  assert.ok(once.includes('const warm = 1;'), 'the code after the line stays');
  assert.equal(withAskLibs(once, read), once, 'the same graph twice changes nothing');
  assert.equal(withAskLibs('<script>const x = 1;</script>', read), null, 'a page without the marker has no list to write');
});
