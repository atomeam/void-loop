// A gist with no server (lib/gist.js): files packed into a link and back, bounded, never throwing on a bad link. Run: node --test tools/gist.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pack, unpack, cleanName, cleanFiles, langOf, tokens, MAX_FILES, MAX_TEXT } from '../void-live-deploy/lib/gist.js';

test('files go into a link and come back exactly, in any language and with line breaks kept', async () => {
  const files = [['hello.py', 'def hi():\n  print("héllo ✓ 你好")\n'], ['notes.md', '# Notes\n\n- one\n- two']];
  const link = await pack(files); assert.match(link, /^v1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await unpack('#' + link), files); assert.deepEqual(await unpack(link), files);
  const big = [['a.js', 'function add(a, b) {\n  return a + b;\n}\n'.repeat(200)]];
  assert.ok((await pack(big)).length < JSON.stringify(big).length / 10, 'real code compresses to a fraction');
});
test('names are clean and different, files and text are capped, a bad link is null and never throws', async () => {
  assert.equal(cleanName('../../etc/pass<wd>.txt'), 'etcpasswd.txt'); assert.equal(cleanName(''), 'snippet.txt'); assert.equal(cleanName('.hidden'), 'hidden');
  const c = cleanFiles([['a.txt', 'x'], ['A.txt', 'y'], ['a.txt', 'z'], ...Array.from({ length: 20 }, (_, i) => ['f' + i, 'q'])]);
  assert.equal(c.length, MAX_FILES); assert.equal(new Set(c.map((f) => f[0].toLowerCase())).size, MAX_FILES);
  assert.equal(cleanFiles([['big.txt', 'x'.repeat(MAX_TEXT + 500)]])[0][1].length, MAX_TEXT);
  for (const bad of ['', '#', '#v1.', '#v2.abc', '#v1.!!!', 'v1.' + 'A'.repeat(100), null, undefined, '#v1.' + 'a'.repeat(200000)]) assert.equal(await unpack(bad), null, String(bad).slice(0, 20));
});
test('a link that unpacks to a mountain is refused, not unpacked', async () => {
  const bomb = Buffer.from(await new Response(new Blob([Buffer.alloc(5e6, 97)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()).toString('base64url');
  assert.equal(await unpack('#v1.' + bomb), null);
});
test('colouring: every character is in exactly one piece, comments and strings are found, other text stays plain', () => {
  for (const [line, lang] of [['const a = "x // not a comment"; // yes', 'js'], ['def f(x): # hi', 'py'], ['  "k": 12.5e3,', 'json'], ['<b class="x"> <!-- c --></b>', 'html'], ['plain text', '']]) assert.equal(tokens(line, lang).map((t) => t[1]).join(''), line, line);
  assert.ok(tokens('return "a"; // b', 'js').some((t) => t[0] === 'k' && t[1] === 'return') && tokens('return "a"; // b', 'js').some((t) => t[0] === 'c' && /^\/\/ b/.test(t[1])));
  assert.equal(langOf('x.py'), 'py'); assert.equal(langOf('Dockerfile'), '');
});
