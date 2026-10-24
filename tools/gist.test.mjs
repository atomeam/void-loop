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
test('a GitHub file link: blob and raw links with line anchors; plain repo links and path tricks are not files', async () => {
  const { ghFileOf, ghFilePage } = await import('../void-live-deploy/lib/gist.js');
  const f = ghFileOf('see https://github.com/atomeam/void-loop/blob/main/void-live-deploy/lib/gist.js#L5-L12');
  assert.deepEqual([f.name, f.raw, f.lines], ['gist.js', 'https://raw.githubusercontent.com/atomeam/void-loop/main/void-live-deploy/lib/gist.js', [5, 12]]);
  assert.equal(ghFilePage(f), '/g/?gh=atomeam%2Fvoid-loop%2Fmain%2Fvoid-live-deploy%2Flib%2Fgist.js&L=5-12');
  assert.equal(ghFileOf('https://raw.githubusercontent.com/nodejs/node/main/README.md').name, 'README.md');
  for (const no of ['https://github.com/atomeam/void-loop', 'https://github.com/a/b/blob/main/../../etc/passwd', 'https://github.com/a/b/blob/main', 'look at a/b', 'https://evil.com/github.com/a/b/blob/main/x.js']) assert.equal(ghFileOf(no), null, no);
});
test('reading a GitHub file: the text, or a plain sentence for missing, binary, too big or unreachable', async () => {
  const { ghFileOf, ghFileText } = await import('../void-live-deploy/lib/gist.js');
  const f = ghFileOf('https://github.com/a/b/blob/main/x.js'), seen = [];
  const fake = (status, body) => async (u) => { seen.push(u); return new Response(body, { status }); };
  assert.deepEqual(await ghFileText(f, fake(200, 'const a = 1;\n')), { text: 'const a = 1;\n' }); assert.equal(seen[0], 'https://raw.githubusercontent.com/a/b/main/x.js');
  assert.match((await ghFileText(f, fake(404, 'no'))).error, /no public file there/);
  assert.match((await ghFileText(f, fake(200, new Uint8Array([137, 80, 78, 71, 0, 0, 1])))).error, /not a text file/);
  assert.match((await ghFileText(f, fake(200, 'x'.repeat(500000)))).error, /over 400 KB/);
  assert.match((await ghFileText(f, async () => { throw new Error('down'); })).error, /could not be reached/);
});
test('a locked gist: the link is noise without the passphrase, the files with it; a wrong one opens nothing', async () => {
  const { pack, open, isLocked } = await import('../void-live-deploy/lib/gist.js');
  const files = [['secret.txt', 'the launch is on friday']];
  const link = await pack(files, { pass: 'correct horse' }); assert.ok(isLocked(link)); assert.match(link, /^v1e\./);
  assert.ok(!Buffer.from(link.slice(4), 'base64url').toString('latin1').includes('friday'), 'not readable from the link');
  assert.equal(await open(link), null); assert.equal(await open(link, 'wrong'), null);
  assert.deepEqual((await open('#' + link, 'correct horse')).files, files);
  assert.notEqual(await pack(files, { pass: 'correct horse' }), link, 'a fresh salt each time');
});
test('an edited copy carries what it was copied from; the line comparison finds what changed', async () => {
  const { pack, open, unpack, lineDiff } = await import('../void-live-deploy/lib/gist.js');
  const prev = [['a.js', 'one\ntwo\nthree']], next = [['a.js', 'one\n2\nthree\nfour']];
  const g = await open(await pack(next, { prev })); assert.deepEqual(g.files, next); assert.deepEqual(g.prev, prev);
  assert.deepEqual(await unpack(await pack(next, { prev })), next, 'older callers still get the files');
  assert.deepEqual(lineDiff('one\ntwo\nthree', 'one\n2\nthree\nfour'), [['=', 'one'], ['-', 'two'], ['+', '2'], ['=', 'three'], ['+', 'four']]);
});
