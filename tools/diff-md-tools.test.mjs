// The diff checker and Markdown to HTML (lib/textdiff.js, lib/markdown.js, skills/util.js kinds 'diffmaker' and 'mdmaker').
// 2026-10-30: "diff checker" and "markdown to html" fell to an article that answered nothing.
//   node --test tools/diff-md-tools.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import util, { utilOf } from '../void-live-deploy/skills/util.js';
import { textLines, diffTexts, diffCounts, withContext, MAX_LINES } from '../void-live-deploy/lib/textdiff.js';
import { mdToHtml, mdInlineHtml, safeUrl } from '../void-live-deploy/lib/markdown.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('textdiff: every character counts, the lines are numbered on their own side, and a long run of the same lines folds', () => {
  assert.deepEqual(textLines('a\r\nb\n'), ['a', 'b']); assert.deepEqual(textLines(''), []); assert.deepEqual(textLines('a\n\nb'), ['a', '', 'b']);
  assert.deepEqual(diffTexts('a\nb\nc', 'a\nB\nc\nd'), [{ t: 'same', s: 'a', a: 1, b: 1 }, { t: 'del', s: 'b', a: 2 }, { t: 'add', s: 'B', b: 2 }, { t: 'same', s: 'c', a: 3, b: 3 }, { t: 'add', s: 'd', b: 4 }]);
  assert.deepEqual(diffCounts(diffTexts('x ', 'x')), { del: 1, add: 1, same: 0 }, 'a trailing space is a difference');
  assert.deepEqual(diffCounts(diffTexts('a\n\nb', 'a\nb')), { del: 1, add: 0, same: 2 }, 'a blank line is a difference');
  assert.deepEqual(diffCounts(diffTexts('same\n', 'same')), { del: 0, add: 0, same: 1 }, 'one trailing newline is not a line');
  assert.deepEqual(diffTexts('', 'new'), [{ t: 'add', s: 'new', b: 1 }]);
  const long = Array.from({ length: 20 }, (_, i) => 'l' + i), rows = diffTexts(long.join('\n'), long.map((x, i) => (i === 10 ? 'X' : x)).join('\n'));
  assert.deepEqual(withContext(rows).map((r) => r.t === 'skip' ? 'skip' + r.n : r.t + ':' + r.s), ['skip7', 'same:l7', 'same:l8', 'same:l9', 'del:l10', 'add:X', 'same:l11', 'same:l12', 'same:l13', 'skip6']);
  assert.deepEqual(diffTexts(Array(MAX_LINES + 1).fill('a').join('\n'), 'a'), { tooLong: true });
});

test('markdown: the common Markdown to the HTML a converter gives, with every text escaped and only safe addresses kept', () => {
  assert.equal(mdToHtml('# Title\n\nSome **bold**, *it* and `a*b*`.'), '<h1>Title</h1>\n<p>Some <strong>bold</strong>, <em>it</em> and <code>a*b*</code>.</p>');
  assert.equal(mdToHtml('###### Six ##'), '<h6>Six</h6>');
  assert.equal(mdToHtml('Sub\n---'), '<h2>Sub</h2>'); assert.equal(mdToHtml('Top\n==='), '<h1>Top</h1>'); assert.equal(mdToHtml('---'), '<hr>');
  assert.equal(mdToHtml('one  \ntwo\\\nthree'), '<p>one<br>\ntwo<br>\nthree</p>');
  assert.equal(mdToHtml('- a\n- b\n  - c\n- d'), '<ul>\n<li>a</li>\n<li>b\n<ul>\n<li>c</li>\n</ul></li>\n<li>d</li>\n</ul>');
  assert.equal(mdToHtml('3. x\n4. y'), '<ol start="3">\n<li>x</li>\n<li>y</li>\n</ol>');
  assert.equal(mdToHtml('> a **b**\n> c'), '<blockquote>\n<p>a <strong>b</strong>\nc</p>\n</blockquote>');
  assert.equal(mdToHtml('```js\nif (a < b) {}\n```'), '<pre><code class="language-js">if (a &lt; b) {}\n</code></pre>');
  assert.equal(mdToHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(mdInlineHtml('[a `x` link](https://x.com "t")'), '<a href="https://x.com" title="t">a <code>x</code> link</a>');
  assert.equal(mdInlineHtml('[w](https://en.wikipedia.org/wiki/Foo_(bar))'), '<a href="https://en.wikipedia.org/wiki/Foo_(bar)">w</a>');
  assert.equal(mdInlineHtml('![pic](https://p.png "P") <https://y.org>'), '<img src="https://p.png" alt="pic" title="P"> <a href="https://y.org">https://y.org</a>');
  for (const bad of ['[x](javascript:alert(1))', '[x](JAVASCRIPT:x)', '[x](data:text/html,1)', '[x](vbscript:x)', '![x](javascript:x)']) assert.ok(!/href|src/.test(mdInlineHtml(bad)), bad);
  assert.equal(mdInlineHtml('[x](" onmouseover="a)'), '[x](&quot; onmouseover=&quot;a)', 'a quote never leaves an attribute');
  assert.equal(mdInlineHtml('snake_case_word and 2*3*4 and \\*not\\*'), 'snake_case_word and 2*3*4 and *not*');
  assert.equal(mdInlineHtml('~~gone~~ __strong__'), '<del>gone</del> <strong>strong</strong>');
  for (const [u, ok] of [['https://a.b', true], ['mailto:a@b.c', true], ['/x', true], ['#top', true], ['./a.html', true], ['ftp://x', false], ['java\tscript:x', false]]) assert.equal(!!safeUrl(u), ok, u);
});

test('the asks: the tools by name, and what is not one of them', () => {
  for (const a of ['diff checker', 'Online diff checker', 'text diff', 'text compare tool', 'compare two texts', 'difference checker', 'a diff tool']) assert.deepEqual(utilOf(a), { kind: 'diffmaker' }, a);
  for (const a of ['markdown to html', 'Markdown to HTML converter', 'markdown preview', 'md to html', 'online markdown editor', 'convert markdown to html']) assert.deepEqual(utilOf(a), { kind: 'mdmaker' }, a);
  for (const a of ['what is a diff', 'git diff', 'diff', 'what is markdown', 'markdown syntax', 'markdown price', 'compare iphone and android', 'html to markdown']) assert.equal(utilOf(a), null, a);
  for (const e of util.examples) assert.ok(util.match(e.toLowerCase(), e), e);
  for (const n of util.nearMisses) assert.ok(!util.match(n.toLowerCase(), n), n);
});

// a small stand-in for the card: the fields by class, with input handlers
function fakeCard() {
  const nodes = {}, handlers = {};
  const node = (cls) => (nodes[cls] = nodes[cls] || { cls, value: '', textContent: '', innerHTML: '', dataset: {}, addEventListener: (ev, f) => { handlers[cls] = f; } });
  const el = { innerHTML: '', dataset: {}, addEventListener() {}, querySelectorAll: () => [], querySelector: (s) => (s.startsWith('.') ? node(s.slice(1)) : null) };
  return { el, nodes, type: (cls, v) => { node(cls).value = v; handlers[cls](); } };
}

test('run: the diff checker compares as you type, and what is typed is escaped', async () => {
  const c = fakeCard();
  assert.equal(await util.run('diff checker', { showPage: (f) => { f(c.el); return c.el; }, esc, _pageStill: () => true }), 'util');
  assert.ok(c.el.innerHTML.startsWith('<h2>Diff checker</h2>') && c.el.innerHTML.includes('util-a') && c.el.innerHTML.includes('util-b'), c.el.innerHTML);
  c.type('util-a', 'one\ntwo <b>\nthree'); c.type('util-b', 'one\n2\nthree\nfour');
  assert.equal(c.nodes['util-say'].textContent, '1 line removed, 2 lines added, 2 the same');
  const h = c.nodes['util-diff'].innerHTML;
  assert.ok(h.includes('− two &lt;b&gt;') && !h.includes('<b>') && h.includes('+ 2') && h.includes('+ four'), h);
  c.type('util-b', 'one\ntwo <b>\nthree'); assert.equal(c.nodes['util-say'].textContent, 'The two texts are the same'); assert.equal(c.nodes['util-diff'].innerHTML, '');
});

test('run: Markdown to HTML shows the preview and the HTML to copy', async () => {
  const c = fakeCard();
  await util.run('markdown to html', { showPage: (f) => { f(c.el); return c.el; }, esc, _pageStill: () => true });
  assert.ok(c.el.innerHTML.startsWith('<h2>Markdown to HTML</h2>') && c.el.innerHTML.includes('util-copy'), c.el.innerHTML);
  c.type('util-in', '# Hi\n\n[x](javascript:alert(1)) **b**');
  assert.equal(c.nodes['util-out'].textContent, '<h1>Hi</h1>\n<p>x <strong>b</strong></p>');
  assert.equal(c.nodes['util-md'].innerHTML, c.nodes['util-out'].textContent, 'the preview is the same HTML');
});
