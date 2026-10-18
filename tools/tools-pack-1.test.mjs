// Tools pack 1 (owner, 2026-10-18): notes and writing tools, nested bullets, csv tables, dropped files, scanned codes. Pure logic only;
// the browser section "tools pack 1" in test_void.mjs plays them on the stage.
// Run: node --test tools/tools-pack-1.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordsIn, readingTime, outlineParse, outlineFromAsk, outlineText, shiftLines, enterBullet, parseCsv, rowsFromAsk, sortedRows, mdTable, thingText, thingMarkdown, stageText, findIn, replaceIn, slugOf, noteIntent, kindsOfNoun, targetOf, scanValue } from '../void-live-deploy/lib/note-tools.js';
import noteTools from '../void-live-deploy/skills/note-tools.js';
import { outlineIntent } from '../void-live-deploy/skills/outline-note.js';
import { csvIntent, dropKind, sizeLabel } from '../void-live-deploy/skills/csv-table.js';
import { wantsScan } from '../void-live-deploy/skills/qr-scan.js';

test('words and reading time', () => {
  assert.equal(wordsIn('  one two\nthree  '), 3);
  assert.equal(wordsIn(''), 0);
  assert.equal(readingTime('').label, 'nothing to read');
  assert.equal(readingTime('word '.repeat(10)).label, 'under half a minute');
  assert.equal(readingTime('word '.repeat(150)).label, 'under a minute');
  assert.equal(readingTime('word '.repeat(450)).label, '2 min read');
});

test('outline: parse, build from an ask, indent, outdent, enter', () => {
  assert.deepEqual(outlineParse('- a\n  - b\n    * c\n- d'), [{ depth: 0, text: 'a' }, { depth: 1, text: 'b' }, { depth: 2, text: 'c' }, { depth: 0, text: 'd' }]);
  assert.deepEqual(outlineFromAsk('groceries; > milk; > > oat; > bread'), [{ depth: 0, text: 'groceries' }, { depth: 1, text: 'milk' }, { depth: 2, text: 'oat' }, { depth: 1, text: 'bread' }]);
  assert.deepEqual(outlineFromAsk('a; > > > deep'), [{ depth: 0, text: 'a' }, { depth: 1, text: 'deep' }], 'a level goes one deeper than the line above at most');
  assert.equal(outlineText(outlineFromAsk('a; > b')), '- a\n  - b');
  const t = '- a\n- b\n- c';
  assert.equal(shiftLines(t, 4, 4, 1).text, '- a\n  - b\n- c');
  assert.equal(shiftLines(t, 0, 0, 1).text, t, 'the first line cannot nest');
  assert.equal(shiftLines('- a\n  - b', 4, 4, -1).text, '- a\n- b');
  assert.equal(shiftLines('- a\n- b\n- c', 4, 9, 1).text, '- a\n  - b\n  - c', 'two selected lines nest together');
  assert.equal(shiftLines('- a\n  - b', 4, 4, 1).text, '- a\n  - b', 'cannot go two deeper than the line above');
  const e = enterBullet('- a\n  - b', 9);
  assert.equal(e.text, '- a\n  - b\n  - '); assert.equal(e.pos, e.text.length);
  assert.equal(enterBullet('- a\n  - ', 8).text, '- a\n- ', 'Enter on an empty nested bullet steps out');
  assert.equal(enterBullet('- ', 2).text, '- ', 'and stays put at the top level');
});

test('csv: delimiters, quotes, limits, asks, sorting, markdown', () => {
  assert.deepEqual(parseCsv('name,age\nann,30\nbo,25'), [['name', 'age'], ['ann', '30'], ['bo', '25']]);
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('x,y\n"hi, there","say ""yo"""'), [['x', 'y'], ['hi, there', 'say "yo"']]);
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv(''), []);
  assert.equal(parseCsv(Array.from({ length: 300 }, (_, i) => i + ',x').join('\n')).length, 200);
  assert.equal(parseCsv('a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v')[0].length, 20);
  assert.deepEqual(rowsFromAsk(['name,age', 'ann,30', 'bo,25'].join('⏎')), [['name', 'age'], ['ann', '30'], ['bo', '25']]);
  assert.deepEqual(rowsFromAsk('name,age;ann,30;bo,25'), [['name', 'age'], ['ann', '30'], ['bo', '25']]);
  const rows = [['n', 'v'], ['a', '10'], ['b', '9'], ['c', '100']];
  assert.deepEqual(sortedRows(rows, 1, 1).map((r) => r[0]), ['n', 'b', 'a', 'c'], 'numbers sort as numbers, header stays first');
  assert.deepEqual(sortedRows(rows, 1, -1).map((r) => r[0]), ['n', 'c', 'a', 'b']);
  assert.deepEqual(sortedRows(rows, 0, 0), rows);
  assert.equal(mdTable([['a', 'b'], ['1', 'x|y']]), '| a | b |\n| --- | --- |\n| 1 | x\\|y |');
  assert.deepEqual(csvIntent('csv table: name,age ⏎ ann,30'), { rows: [['name', 'age'], ['ann', '30']] });
  assert.equal(csvIntent('csv'), null); assert.equal(csvIntent('what is a csv file'), null); assert.equal(csvIntent('paste csv:'), null);
});

test('dropped files: what each becomes', () => {
  assert.equal(dropKind('a.CSV', ''), 'table'); assert.equal(dropKind('x', 'text/csv'), 'table');
  assert.equal(dropKind('n.md', ''), 'text'); assert.equal(dropKind('d.json', 'application/json'), 'text');
  assert.equal(dropKind('p.png', 'image/png'), 'image'); assert.equal(dropKind('z.zip', 'application/zip'), 'other');
  assert.equal(sizeLabel(512), '512 B'); assert.equal(sizeLabel(2150), '2.1 KB'); assert.equal(sizeLabel(5 * 1048576), '5.0 MB');
});

test('thing text, markdown, stage text, find, replace', () => {
  const things = {
    s1: { id: 's1', kind: 'sticky', x: 10, y: 10, text: 'buy milk and eggs' },
    n1: { id: 'n1', kind: 'notepad', x: 300, y: 10, title: 'Plan', text: 'call the vet\nMilk run' },
    l1: { id: 'l1', kind: 'list', x: 10, y: 300, title: 'Shop', items: [{ id: 'a', text: 'milk', done: true }, { id: 'b', text: 'tea', done: false }] },
    o1: { id: 'o1', kind: 'outline', x: 300, y: 300, title: '', text: '- a\n  - b' },
    c1: { id: 'c1', kind: 'clock', x: 0, y: 0 },
  };
  assert.equal(thingText(things.c1), null);
  assert.equal(thingMarkdown(things.s1), 'buy milk and eggs\n');
  assert.equal(thingMarkdown(things.n1), '# Plan\n\ncall the vet\nMilk run\n');
  assert.equal(thingMarkdown(things.l1), '# Shop\n\n- [x] milk\n- [ ] tea\n');
  assert.equal(thingMarkdown(things.o1), '- a\n  - b\n');
  assert.equal(thingMarkdown(things.c1), null);
  const txt = stageText(things);
  assert.ok(txt.startsWith('[sticky]\nbuy milk and eggs\n\n[notepad: Plan]'), txt);
  assert.ok(!/clock/.test(txt));
  assert.deepEqual(findIn(things, 'MILK'), { ids: ['s1', 'n1', 'l1'], total: 3 });
  assert.deepEqual(findIn(things, 'zzz'), { ids: [], total: 0 });
  assert.deepEqual(findIn(things, ''), { ids: [], total: 0 });
  assert.deepEqual(replaceIn('milk, Milk and milkshake', 'milk', 'oat milk'), { text: 'oat milk, oat milk and oat milkshake', count: 3 });
  assert.deepEqual(replaceIn('a.b', '.', '-'), { text: 'a-b', count: 1 }, 'the words are literal, not a pattern');
  assert.equal(slugOf('Buy Milk & Eggs!'), 'buy-milk-eggs'); assert.equal(slugOf('', 'note'), 'note');
  assert.deepEqual(kindsOfNoun('note'), ['sticky', 'notepad', 'outline']);
  assert.equal(targetOf(things, 'n1', 'note').id, 'n1');
  assert.equal(targetOf(things, 'n1', 'sticky').id, 's1');
  assert.equal(targetOf(things, null, 'list').id, 'l1');
  assert.equal(targetOf({}, null, 'note'), null);
});

test('note asks it takes and the look-alikes it leaves', () => {
  assert.deepEqual(noteIntent('export this note as markdown'), { act: 'md', noun: 'note' });
  assert.deepEqual(noteIntent('Download the list as a markdown file'), { act: 'md', noun: 'list' });
  assert.equal(noteIntent('export the stage as text').act, 'text');
  assert.equal(noteIntent('a plain text export of the stage').act, 'text');
  assert.deepEqual(noteIntent('find milk on the stage'), { act: 'find', q: 'milk' });
  assert.deepEqual(noteIntent('find "oat milk" in my notes'), { act: 'find', q: 'oat milk' });
  assert.equal(noteIntent('clear the find').act, 'unfind');
  assert.deepEqual(noteIntent('replace milk with oat milk in the note'), { act: 'replace', from: 'milk', to: 'oat milk', all: false, noun: 'note' });
  assert.equal(noteIntent('replace milk with tea in all notes').all, true);
  assert.deepEqual(noteIntent('word count of the selection'), { act: 'count', noun: 'selection' });
  assert.equal(noteIntent('how many words in this note').act, 'count');
  assert.equal(noteIntent('reading time of this note').act, 'reading');
  assert.deepEqual(noteIntent('pin this note to the corner'), { act: 'pin', noun: 'note', v: 'top', h: 'right' });
  assert.deepEqual(noteIntent('pin the sticky to the bottom left corner'), { act: 'pin', noun: 'sticky', v: 'bottom', h: 'left' });
  assert.equal(noteIntent('unpin the note').act, 'unpin');
  assert.deepEqual(noteIntent('collapse long notes'), { act: 'collapse', noun: 'notes', long: true });
  assert.equal(noteIntent('collapse the note').act, 'collapse');
  assert.equal(noteIntent('expand the note').act, 'expand');
  assert.equal(noteIntent('duplicate this note').act, 'duplicate');
  assert.equal(noteIntent('make a copy of the list').act, 'duplicate');
  for (const a of ['what is markdown', 'find a pizza place near me', 'how many words in a novel', 'replace the battery in my phone', 'word count of hamlet', 'collapse of the roman empire',
    'duplicate the zombie', 'clone the zombie', 'pin a map of paris', 'export my data', 'reading time of war and peace', 'find me a recipe for soup', 'copy it', 'expand the universe']) assert.equal(noteIntent(a), null, a);
});

test('outline and scan asks', () => {
  assert.equal(outlineIntent('outline note: groceries; > milk').items.length, 2);
  assert.deepEqual(outlineIntent('nested bullet note'), { fresh: false, items: [] });
  assert.equal(outlineIntent('another outline note').fresh, true);
  for (const a of ['outline', 'what is an outline', 'outline of the roman empire', 'write an outline for my essay on cats', 'bullet points about space']) assert.equal(outlineIntent(a), null, a);
  for (const a of ['scan a qr code', 'read a barcode', 'qr code scanner']) assert.equal(wantsScan(a), true, a);
  for (const a of ['make a qr code for my wifi', 'what is a barcode', 'scan my documents']) assert.equal(wantsScan(a), false, a);
  assert.deepEqual(scanValue('https://example.com/a?b=1'), { type: 'link', value: 'https://example.com/a?b=1' });
  assert.equal(scanValue('javascript:alert(1)').type, 'text');
  assert.equal(scanValue('WIFI:S:home;P:x;;').type, 'text');
  assert.equal(scanValue('  hello ').value, 'hello');
});

test('the note-tools skill takes its examples and none of its near misses', () => {
  for (const e of noteTools.examples) assert.equal(noteTools.match(e.toLowerCase(), e), true, e);
  for (const e of noteTools.nearMisses) assert.equal(noteTools.match(e.toLowerCase(), e), false, e);
});
