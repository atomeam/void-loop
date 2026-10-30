// node --test tools/inline-scripts.test.mjs: the files check sees a page's inline scripts (a broken inline module took /news/ down, #1741)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inlineScripts } from './inline-scripts.mjs';

const page = '<!doctype html>\n<script type="module">\nimport x from "./a.js";\n</script>\n<script src="b.js"></script>\n'
  + '<script type="application/ld+json">{"a":1}</script>\n<script data-type="x">var a = 1;</script>\n<script type="importmap">{}</script>\n<script>\nlet b = ;\n</script>\n';

test('it takes the module and classic scripts, and leaves out src, json, ld+json and importmap', () => {
  const s = inlineScripts(page);
  assert.deepEqual(s.map((x) => [x.n, x.module]), [[1, true], [4, false], [6, false]]);
});

test('data-type is not type: a classic script with a data-type attribute is still read', () => {
  assert.equal(inlineScripts('<script data-type="module">x()</script>')[0].module, false);
});

test("a script's lines keep the page's line numbers, so node --check names the page line", () => {
  const bad = inlineScripts(page).find((x) => x.n === 6);
  const dir = mkdtempSync(join(tmpdir(), 'inline-'));
  const p = join(dir, 'x.cjs');
  writeFileSync(p, bad.code);
  const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':10\\b'));
});

test('the news page from #1741 (an else after a statement) does not parse', () => {
  const s = inlineScripts('<script type="module">\nif (a) b();\nweek(c);\nelse status(d);\n</script>');
  const dir = mkdtempSync(join(tmpdir(), 'inline-'));
  const p = join(dir, 'x.mjs');
  writeFileSync(p, s[0].code);
  assert.notEqual(spawnSync(process.execPath, ['--check', p]).status, 0);
});
