// Text tools (owner, 2026-10-18, "tools pack 9"): the transform table in lib/text-tools.js and the skill that shows its result.
// Run: node --test tools/text-tools.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, textToolOf, runTextTool, wrap, lineDiff, twoBoxes, sentencesOf, frequency, toHtml, toMarkdown, toPlain } from '../void-live-deploy/lib/text-tools.js';
import skill from '../void-live-deploy/skills/text-tools.js';

const ctx = { now: new Date(2026, 9, 18, 9, 5, 7), rng: () => 0 };
const out = (ask) => { const r = runTextTool(ask, ctx); return r ? r.text : null; };

test('every ask in the table gives the expected text', () => {
  const rows = [
    ['toggle case: Hello World', 'hELLO wORLD'],
    ['trim: ⏎  a  ⏎  b  ', 'a\nb'],
    ['remove trailing spaces: a  ⏎ b\t', 'a\nb'],
    ['remove duplicate lines: a ⏎ b ⏎ a ⏎ c', 'a\nb\nc'],
    ['sort these lines: pear ⏎ Apple ⏎ fig ⏎ item10 ⏎ item2', 'Apple\nfig\nitem2\nitem10\npear'],
    ['sort lines z to a: b ⏎ a ⏎ c', 'c\nb\na'],
    ['reverse the line order: 1 ⏎ 2 ⏎ 3', '3\n2\n1'],
    ['number the lines: x ⏎ ⏎ y', '1. x\n\n2. y'],
    ['unnumber lines: 1. x ⏎ 22) y ⏎ 3: z', 'x\ny\nz'],
    ['join lines: a ⏎ b ⏎ c', 'a b c'],
    ['join lines with comma: a ⏎ b ⏎ c', 'a, b, c'],
    ['split on comma: a, b ,c', 'a\nb\nc'],
    ['split on newline: a ⏎ b', '[\n "a",\n "b"\n]'],
    ['wrap at 10: the quick brown fox', 'the quick\nbrown fox'],
    ['unwrap paragraph: a ⏎ b ⏎ ⏎ c ⏎ d', 'a b\n\nc d'],
    ['double-space: a ⏎ b', 'a\n\nb'],
    ['remove blank lines: a ⏎ ⏎ b', 'a\nb'],
    ['indent by 2: a ⏎ b', '  a\n  b'],
    ['indent with a tab: a', '\ta'],
    ['quote: hi', '"hi"'],
    ['block quote: a ⏎ b', '> a\n> b'],
    ['unquote: "hi"', 'hi'],
    ['unquote: > “hi”', 'hi'],
    ['square brackets: hi', '[hi]'],
    ['curly braces: hi', '{hi}'],
    ['parenthesize: hi', '(hi)'],
    ['make it bold: hi', '**hi**'],
    ['markdown italic: hi', '*hi*'],
    ['markdown code: x', '`x`'],
    ['strikethrough: hi', '~~hi~~'],
    ['date stamp', '2026-10-18'],
    ['insert the time', '09:05'],
    ['date stamp: note', '2026-10-18 note'],
    ['random adjective', 'amber'],
    ['2 placeholder names', 'Alex Archer\nAlex Archer'],
    ['count paragraphs: a ⏎ ⏎ b ⏎ ⏎ c', '3 paragraphs (blocks split by a blank line)'],
    ['count sentences: Hi Dr. Who. Go now! ok?', '3 sentences (a stop after Mr., Dr. or e.g. does not end one)'],
    ['average sentence length: One two. Three four five.', '2.5 words per sentence (5 words in 2 sentences)'],
    ['longest word: a bb cccc dd', 'cccc (4 letters)'],
    ['repeated words: the the cat', 'Twice in a row: "the the" at word 1\nNo word used more than once (little words left out).'],
    ['tabs to spaces: a\tb', 'a    b'],
    ['smart quotes on: He said "hi" and it\'s fine', 'He said “hi” and it’s fine'],
    ['smart quotes off: “hi” it’s', '"hi" it\'s'],
    ['en dash: pages 1-5', 'pages 1–5'],
    ['em dash: yes -- no', 'yes—no'],
    ['ellipsis: wait...', 'wait…'],
    ['insert an em dash', '—'],
    ['insert a non-breaking space', ' '],
    ['copy as html: # Hi ⏎ ⏎ **b** & [x](https://a.com)', '<h1>Hi</h1>\n<p><strong>b</strong> &amp; <a href="https://a.com">x</a></p>'],
    ['copy as markdown: <p><b>hi</b> <a href="https://a.com">x</a></p>', '**hi** [x](https://a.com)'],
    ['paste plain: **b** and [x](https://a.com)', 'b and x (https://a.com)'],
    ['clear formatting: <b>bold</b> <i>it</i>', 'bold it'],
    ['highlight: hi', '<mark style="background-color:#fff176;color:#000">hi</mark>'],
    ['highlight green: hi', '<mark style="background-color:#a5d6a7;color:#000">hi</mark>'],
    ['remove highlight: <mark style="x">a</mark> ==b==', 'a b'],
    ['comment out: a ⏎ ⏎ b', '// a\n\n// b'],
    ['comment out as python: a', '# a'],
    ['comment out as html: a', '<!-- a -->'],
    ['add TODO prefix: fix this', 'TODO: fix this'],
    ['add FIXME prefix: fix this', 'FIXME: fix this'],
    ['add version suffix: report.docx ⏎ plan-v2.md ⏎ notes', 'report-v2.docx\nplan-v3.md\nnotes-v2'],
    ['slugify Hello World! Café & Co', 'hello-world-cafe-and-co'],
    ['title from first line: ⏎ # My Great Title. ⏎ more', 'My Great Title'],
    ['extract urls: see https://a.com/x. and www.b.org, ok', 'https://a.com/x\nwww.b.org'],
    ['extract emails: mail bob@x.com, al@y.co.uk', 'bob@x.com\nal@y.co.uk'],
    ['extract numbers: 3 apples and 1,200.5 pears -4', '3\n1,200.5\n-4'],
    ['mask phones: call +1 (555) 123-4567 now, id 12345', 'call +* (***) ***-4567 now, id 12345'],
    ['mask emails: bob@x.com and al@y.org', 'b***@x.com and a***@y.org'],
    ['rot13 Hello, World', 'Uryyb, Jbeyq'],
    ['rot13: Uryyb', 'Hello'],
    ['caesar: abc xyz', 'def abc'],
    ['caesar shift 5: Hello', 'Mjqqt'],
    ['caesar shift -3: Khoor', 'Hello'],
    ['keep only digits: a1b2 ⏎ c3', '12\n3'],
    ['keep only letters: a1 b2!', 'a b'],
    ['are listen and silent anagrams', '“listen” and “silent” are anagrams: the same 6 letters.'],
    ['anagram: dormitory, dirty room', '“dormitory” and “dirty room” are anagrams: the same 9 letters.'],
    ['diff: a ⏎ b ⏎ c ⏎ --- ⏎ a ⏎ c ⏎ d', '  a\n- b\n  c\n+ d'],
    ['common lines: a ⏎ b ⏎ --- ⏎ b ⏎ c', 'b'],
    ['unique lines: a ⏎ b ⏎ a', 'b'],
    ['unique lines: a ⏎ b ⏎ --- ⏎ b ⏎ c', '1: a\n2: c'],
    ['word frequency: the cat the dog', '2  the\n1  cat\n1  dog'],
    ['top 10 words: the cat and the dog and the bird', '1  bird\n1  cat\n1  dog'],
  ];
  for (const [ask, want] of rows) assert.equal(out(ask), want, ask);
});

test('notes explain what happened, and bad input explains itself', () => {
  assert.match(runTextTool('remove duplicate lines: a ⏎ a ⏎ b').note, /1 duplicate line removed/);
  assert.match(runTextTool('diff: just one box').note, /---/);
  assert.match(runTextTool('anagram: only one').note, /two words/);
  assert.equal(runTextTool('extract emails: no addresses here').text, '');
  assert.match(runTextTool('extract emails: bob@x.com').note, /1 address found/);
  const hl = runTextTool('highlight: <b>x</b>');
  assert.match(hl.preview, /&lt;b&gt;x&lt;\/b&gt;/); // the preview is built from escaped text
  assert.ok(!/<b>/.test(hl.preview));
});

test('ways to ask: polite words, colon or line break, and the asks it must leave alone', () => {
  for (const a of ['please sort these lines: b ⏎ a', 'Can you sort these lines: b ⏎ a', 'sort lines a to z: b ⏎ a', 'sort these lines ⏎ b ⏎ a', 'sort: b ⏎ a', 'alphabetize: b ⏎ a']) assert.equal(textToolOf(a)?.id, 'sort-az', a);
  assert.equal(textToolOf('sort these lines:'), null); // no text: not an ask
  for (const a of ['what is rot13', 'rot13 is a cipher', 'sort my life out', 'sort the laundry', 'how do I remove duplicate lines in excel', 'extract the juice from a lemon', 'what is an anagram',
    'uppercase letters in spanish', 'compare: iphone vs pixel', 'code: 12345', 'analyze: my code', 'frequency', 'quote of the day', 'indent', 'wrap up the meeting', 'diff of the week', 'highlight reel'])
    assert.equal(textToolOf(a), null, a);
  // a colon inside the text is the text's own
  assert.equal(out('reverse the line order: 12:30 ⏎ 13:45'), '13:45\n12:30');
});

test('the table is complete: each row has a unique id, a title, a head and a function', () => {
  const ids = TOOLS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TOOLS) assert.ok(t.title && t.heads.length && typeof t.fn === 'function', t.id);
  assert.ok(TOOLS.length >= 70);
});

test('helpers: wrap, diff, boxes, sentences, frequency, markup', () => {
  assert.equal(wrap('aaaa bbbb cccc', 10), 'aaaa bbbb\ncccc');
  assert.equal(wrap('supercalifragilistic word', 10), 'supercalifragilistic\nword');
  assert.deepEqual(lineDiff('a\nb', 'a\nb'), ['  a', '  b']);
  assert.deepEqual(lineDiff('', 'x'), ['- ', '+ x']);
  assert.deepEqual(twoBoxes('a\n---\nb'), ['a', 'b']);
  assert.equal(twoBoxes('a b'), null);
  assert.deepEqual(sentencesOf('Mr. Smith left. He said 3.5 times! Why?'), ['Mr. Smith left.', 'He said 3.5 times!', 'Why?']);
  assert.deepEqual(frequency('b a b A c', false), [['a', 2], ['b', 2], ['c', 1]]);
  assert.equal(toHtml('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
  assert.ok(!/href="javascript/.test(toHtml('[x](javascript:alert(1))')));
  assert.equal(toMarkdown('<ul><li>a</li><li>b</li></ul>'), '- a\n- b');
  assert.equal(toPlain('# Title\n\n*it* `code` ~~gone~~'), 'Title\n\nit code gone');
});

test('the skill: its examples and near misses', () => {
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
  assert.ok(typeof skill.run === 'function' && skill.name === 'text-tools');
});

test('limits: a huge paste is cut, two big boxes are refused, nothing throws', () => {
  assert.equal(runTextTool('sort these lines: ' + 'x\n'.repeat(60000)).text.length <= 50000, true);
  const big = Array.from({ length: 700 }, (_, i) => 'l' + i).join(' ⏎ ');
  assert.match(runTextTool('diff: ' + big + ' ⏎ --- ⏎ ' + big).note, /Up to 600 lines/);
  for (const a of ['', ' ', ':', 'sort:', 'diff: ⏎ --- ⏎ ', 'caesar shift 9999: abc', 'wrap at 5: aaaaaaaaaaaaaaa']) assert.doesNotThrow(() => runTextTool(a), a);
});
