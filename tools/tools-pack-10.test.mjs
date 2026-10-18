// Tools pack 10 (owner, 2026-10-18): list and table transforms (lib/list-ops.js, skills/list-tools.js) and list templates
// (lib/list-templates.js, skills/list-templates.js). Pure logic only; the browser section "tools pack 10" plays them.
// Run: node --test tools/tools-pack-10.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPS, parseOp, parseTableCreate, runOp, splitTarget, parseDelimited, toCsv, toTsv, toMarkdown, numOf, markerOf, findIdx, colIdx, cloudOf, reorder } from '../void-live-deploy/lib/list-ops.js';
import { TEMPLATES, parseTemplate, cardFor } from '../void-live-deploy/lib/list-templates.js';
import listTools, { visibleRows, ask as toolsAsk } from '../void-live-deploy/skills/list-tools.js';
import listTemplates, { ask as templateAsk } from '../void-live-deploy/skills/list-templates.js';
import { normalizeItems } from '../void-live-deploy/skills/list.js';

const L = (...texts) => ({ items: texts.map((t, i) => ({ id: 'i' + i, text: t, done: false })) });
const run = (ask, th, ctx = {}, opts = {}) => { const p = parseOp(ask, opts); assert.ok(p, 'parsed: ' + ask); return { p, r: runOp(p.op, th, p.args, ctx) }; };
const texts = (items) => items.map((i) => i.text);
const T = (rows, extra = {}) => ({ rows, header: true, ...extra });

test('asks name their card: "the list" and "the table" are taken out, and an ask that does not name one stays with others', () => {
  assert.deepEqual(splitTarget('check all items in the list'), { target: 'list', rest: 'check all items' });
  assert.deepEqual(splitTarget('sort the table by column 2'), { target: 'table', rest: 'sort by column 2' });
  assert.equal(splitTarget('sort').target, null);
  for (const a of ['sort', 'check all', 'move the clock up', 'remove duplicates', 'number it', 'first 3', 'sort my photos by date', 'what is a hash table', 'how to merge two lists in python', 'make a table', 'add milk to the list', 'check off milk', 'remove milk from the list'])
    assert.equal(parseOp(a), null, a);
});

test('checks: check all, uncheck all, invert, remove checked', () => {
  const l = L('a', 'b', 'c'); l.items[1].done = true;
  assert.ok(run('check all on the list', l).r.patch.items.every((i) => i.done));
  assert.ok(run('uncheck all items on the list', l).r.patch.items.every((i) => !i.done));
  assert.deepEqual(run('invert the checks on the list', l).r.patch.items.map((i) => i.done), [true, false, true]);
  assert.deepEqual(texts(run('remove checked items from the list', l).r.patch.items), ['a', 'c']);
  assert.deepEqual(texts(run('delete done items from my list', l).r.patch.items), ['a', 'c']);
  assert.equal(run('remove checked items from the list', L('x')).r.fail, true);
  assert.equal(OPS.filter((o) => ['check-all', 'uncheck-all'].includes(o.id)).length, 2);
});

test('move up and down, to the top, and the edges say so', () => {
  const l = L('milk', 'eggs', 'bread');
  assert.deepEqual(texts(run('move eggs up in the list', l).r.patch.items), ['eggs', 'milk', 'bread']);
  assert.deepEqual(texts(run('move milk down in the list', l).r.patch.items), ['eggs', 'milk', 'bread']);
  assert.deepEqual(texts(run('move bread to the top of the list', l).r.patch.items), ['bread', 'milk', 'eggs']);
  assert.deepEqual(texts(run('move milk to the bottom of the list', l).r.patch.items), ['eggs', 'bread', 'milk']);
  assert.match(run('move milk up in the list', l).r.say, /already first/);
  assert.match(run('move bread down in the list', l).r.say, /already last/);
  assert.match(run('move cheese up in the list', l).r.say, /could not find/);
  assert.equal(findIdx(l.items, 'the BREAD'), 2);
  assert.equal(findIdx(l.items, 'e'), 1); // "e" starts eggs only
  assert.equal(findIdx(L('milk', 'mint').items, 'mi'), -1); // two start with it: not guessed
  assert.equal(findIdx(L('apple pie', 'apple tart').items, 'apple'), -1);
  assert.equal(findIdx(l.items, 'mil'), 0);
});

test('nested sub-items and promote', () => {
  const l = L('bread', 'milk', 'eggs');
  const a = run('indent milk in the list', l).r.patch.items;
  assert.deepEqual(a.map((i) => i.depth || 0), [0, 1, 0]);
  const b = run('nest eggs under bread in the list', l).r.patch.items;
  assert.deepEqual(texts(b), ['bread', 'eggs', 'milk']); assert.equal(b[1].depth, 1);
  const c = run('make eggs a sub item of bread in the list', l).r.patch.items;
  assert.equal(c[1].text, 'eggs');
  assert.equal(run('indent bread in the list', l).r.fail, true); // nothing above it
  assert.deepEqual(run('promote milk in the list', { items: a }).r.patch.items.map((i) => i.depth || 0), [0, 0, 0]);
  assert.equal(run('promote bread in the list', l).r.fail, true);
  assert.deepEqual(normalizeItems([{ id: 'x', text: 'sub', depth: 1, pri: 'high' }]), [{ id: 'x', text: 'sub', done: false, depth: 1, pri: 'high' }]); // list.js keeps them
});

test('list and table swap, in either direction, and the original stays', () => {
  const l = L('milk', 'eggs'); l.items[0].done = true;
  const s = run('turn the list into a table', l).r.spawn;
  assert.equal(s.kind, 'datatable'); assert.deepEqual(s.props.rows, [['Item', 'Done'], ['milk', 'yes'], ['eggs', 'no']]);
  assert.deepEqual(run('convert the list to a table', l).r.spawn.props.rows[0], ['Item', 'Done']);
  assert.deepEqual(run('list to table', l).r.spawn.props.rows[1], ['milk', 'yes']);
  const split = run('turn the list into a table', L('Ann, 31', 'Bo, 40')).r.spawn.props;
  assert.deepEqual(split.rows, [['Ann', '31'], ['Bo', '40']]); assert.equal(split.header, false);
  const back = run('turn the table into a list', T([['Name', 'Age'], ['Ann', '31'], ['Bo', '']])).r.spawn;
  assert.equal(back.kind, 'list'); assert.deepEqual(texts(back.props.items), ['Ann, 31', 'Bo']);
});

test('table edits: add column, add row (with values), delete row and column', () => {
  const t = T([['Name', 'Age'], ['Ann', '31']]);
  assert.deepEqual(run('add a column called City', t).r.patch.rows, [['Name', 'Age', 'City'], ['Ann', '31', '']]);
  assert.deepEqual(run('add a column to the table', t).r.patch.rows[0], ['Name', 'Age', 'Column 3']);
  assert.deepEqual(run('add a row', t).r.patch.rows[2], ['', '']);
  assert.deepEqual(run('add row: Bo, 40', t).r.patch.rows[2], ['Bo', '40']);
  assert.deepEqual(run('delete row 2', t).r.patch.rows, [['Name', 'Age']]);
  assert.deepEqual(run('delete the last row of the table', t).r.patch.rows, [['Name', 'Age']]);
  assert.match(run('delete row 9', t).r.say, /no row 9/);
  assert.deepEqual(run('delete column age', t).r.patch.rows, [['Name'], ['Ann']]);
  assert.deepEqual(run('remove column 1 from the table', t).r.patch.rows, [['Age'], ['31']]);
});

test('sort the table by column: numbers as numbers, header kept, descending', () => {
  const t = T([['Name', 'Age'], ['Cy', '9'], ['Ann', '31'], ['Bo', '100']]);
  assert.deepEqual(run('sort the table by column 2', t).r.patch.rows.map((r) => r[0]), ['Name', 'Cy', 'Ann', 'Bo']);
  assert.deepEqual(run('sort the table by age descending', t).r.patch.rows.map((r) => r[0]), ['Name', 'Bo', 'Ann', 'Cy']);
  assert.deepEqual(run('sort by column 1', t).r.patch.rows.map((r) => r[0]), ['Name', 'Ann', 'Bo', 'Cy']);
  assert.deepEqual(run('sort by name z-a', t).r.patch.rows.map((r) => r[0]), ['Name', 'Cy', 'Bo', 'Ann']);
  assert.match(run('sort by column 7', t).r.say, /no column 7/);
  assert.deepEqual(texts(run('sort the list', L('pear', 'apple', 'fig')).r.patch.items), ['apple', 'fig', 'pear']);
  assert.deepEqual(texts(run('sort the list z-a', L('pear', 'apple', 'fig')).r.patch.items), ['pear', 'fig', 'apple']);
  assert.deepEqual(texts(run('sort the list', L('item 10', 'item 9', 'Item 2')).r.patch.items), ['Item 2', 'item 9', 'item 10']); // numeric order
});

test('column sum, average, min, max, range; money and junk', () => {
  const t = T([['Item', 'Cost'], ['a', '$1,250.50'], ['b', '10'], ['c', 'n/a'], ['d', '4.5%']]);
  assert.match(run('sum of column 2', t).r.say, /= 1265\b|= 1265\.0*5?/);
  assert.equal(run('sum of column 2', t).r.patch.result.startsWith('sum of column 2 = 1265'), true);
  assert.match(run('what is the average of column cost', t).r.say, /= 421\.666667/);
  assert.match(run('smallest in column 2', t).r.say, /= 4\.5/);
  assert.match(run('max of column 2 in the table', t).r.say, /= 1250\.5/);
  assert.match(run('min and max of column 2', t).r.say, /from 4\.5 to 1250\.5/);
  assert.match(run('add up column 2', t).r.say, /sum of column 2/);
  assert.match(run('sum of column 1', t).r.say, /no numbers/);
  assert.equal(numOf('3 kg'), 3); assert.equal(numOf('x3'), null); assert.equal(numOf('-2.5'), -2.5); assert.equal(numOf(''), null);
});

test('CSV, TSV and Markdown in and out', () => {
  assert.deepEqual(parseDelimited('name,age\nAnn,31\n"Smith, Bo","say ""hi"""\n\n'), [['name', 'age'], ['Ann', '31'], ['Smith, Bo', 'say "hi"']]);
  assert.deepEqual(parseDelimited('a\tb\n1\t2', '\t'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseDelimited('a,"x\ny"\n1,2'), [['a', 'x\ny'], ['1', '2']]);
  assert.equal(toCsv([['a', 'b,c'], ['"q"', '']]), 'a,"b,c"\n"""q""",');
  assert.equal(toTsv([['a', 'b\tc']]), 'a\tb c');
  assert.equal(toMarkdown([['A', 'B'], ['1', 'x|y']]), '| A | B |\n| --- | --- |\n| 1 | x\\|y |');
  assert.equal(toMarkdown([['1', '2']], false), '|  |  |\n| --- | --- |\n| 1 | 2 |');
  assert.deepEqual(parseDelimited(toCsv([['a', 'b,c'], ['"q"', 'z']])), [['a', 'b,c'], ['"q"', 'z']]); // round trip
  const c = parseTableCreate('csv to table: name,age // Ann,31 // Bo,40');
  assert.deepEqual(c.rows, [['name', 'age'], ['Ann', '31'], ['Bo', '40']]);
  assert.deepEqual(parseTableCreate('tsv to table:\na\tb\n1\t2').rows, [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseTableCreate('paste csv: x,y\n1,2').rows[1], ['1', '2']);
  assert.deepEqual(parseTableCreate('make a table from csv: p,q // 1,2').rows[0], ['p', 'q']);
  assert.equal(parseTableCreate('csv to table:'), null);
  const t = T([['Name', 'Age'], ['Ann', '31']]);
  assert.equal(run('table to csv', t).r.patch.exportText, 'Name,Age\nAnn,31');
  assert.equal(run('export the table as tsv', t).r.patch.exportText, 'Name\tAge\nAnn\t31');
  assert.equal(run('export the table as markdown', t).r.patch.exportText, '| Name | Age |\n| --- | --- |\n| Ann | 31 |');
  assert.equal(run('markdown table export', t).r.patch.exportAs, 'markdown');
  assert.equal(run('csv export of the table', t).r.patch.exportAs, 'csv');
});

test('new tables: columns, NxM and the 3D table left alone', () => {
  assert.deepEqual(parseTableCreate('data table with columns name, age and city').rows, [['name', 'age', 'city'], ['', '', '']]);
  assert.deepEqual(parseTableCreate('make a table with columns item, price').rows[0], ['item', 'price']);
  assert.equal(parseTableCreate('make a 3x4 table').rows.length, 3);
  assert.equal(parseTableCreate('make a 3x4 table').rows[0].length, 4);
  assert.equal(parseTableCreate('a spreadsheet').rows.length, 3);
  for (const a of ['make a table', 'a table', 'build a wooden table', 'what is a data table', 'table of contents', 'periodic table']) assert.equal(parseTableCreate(a), null, a);
});

test('table views: zebra, freeze, filter, hide empty', () => {
  const t = T([['n', 'v'], ['a', 'milk'], ['', ''], ['b', 'eggs']]);
  assert.equal(run('zebra stripe the table', t).r.patch.zebra, true);
  assert.equal(run('turn off zebra stripes', t).r.patch.zebra, false);
  assert.equal(run('freeze the header row', t).r.patch.freeze, true);
  assert.equal(run('unfreeze the header', t).r.patch.freeze, false);
  assert.equal(run('freeze the header', { rows: [['a']], header: false }).r.patch.header, true);
  assert.equal(run('show only rows containing milk', t).r.patch.filter, 'milk');
  assert.equal(run('filter rows with "egg"', t).r.patch.filter, 'egg');
  assert.equal(run('show all rows', t).r.patch.filter, '');
  assert.equal(run('hide empty rows', t).r.patch.hideEmpty, true);
  assert.deepEqual(visibleRows({ ...t, filter: 'MILK' }).map((x) => x.r), [1]);
  assert.deepEqual(visibleRows({ ...t, hideEmpty: true }).map((x) => x.r), [1, 3]);
  assert.deepEqual(visibleRows(t).map((x) => x.r), [1, 2, 3]);
  assert.deepEqual(visibleRows({ rows: [['x'], ['y']], header: false }).map((x) => x.r), [0, 1]);
});

test('transpose and pivot count', () => {
  const t = T([['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepEqual(run('transpose the table', t).r.patch.rows, [['a', '1'], ['b', '2'], ['c', '3']]);
  assert.deepEqual(run('transpose', { rows: [['a', 'b'], ['c']], header: false }).r.patch.rows, [['a', 'c'], ['b', '']]);
  const p = run('pivot count of column 1', T([['fruit'], ['pear'], ['fig'], ['pear'], ['']])).r.spawn;
  assert.deepEqual(p.props.rows, [['fruit', 'Count'], ['pear', '2'], ['(empty)', '1'], ['fig', '1']]);
  assert.equal(p.kind, 'datatable');
});

test('merge, intersect and subtract make a new list from two', () => {
  const a = L('milk', 'eggs', 'Bread'), b = L('bread', 'jam', 'milk');
  assert.deepEqual(texts(run('merge the lists', a, { other: b }).r.spawn.props.items), ['milk', 'eggs', 'Bread', 'jam']);
  assert.deepEqual(texts(run('intersect the lists', a, { other: b }).r.spawn.props.items), ['milk', 'Bread']);
  assert.deepEqual(texts(run('subtract the second list from the first', a, { other: b }).r.spawn.props.items), ['eggs']);
  assert.match(run('merge the two lists', a, {}).r.say, /two lists/);
  assert.equal(parseOp('merge the lists').op.id, 'merge');
});

test('assign round robin, chunk, sliding pairs', () => {
  const l = L('a', 'b', 'c', 'd', 'e');
  assert.deepEqual(texts(run('assign the list to Ann, Bob', l).r.patch.items), ['a (for Ann)', 'b (for Bob)', 'c (for Ann)', 'd (for Bob)', 'e (for Ann)']);
  assert.deepEqual(texts(run('round robin the list between Ann, Bob and Cy', L('x', 'y', 'z', 'w')).r.patch.items), ['x (for Ann)', 'y (for Bob)', 'z (for Cy)', 'w (for Ann)']);
  const again = run('assign the list to Bob, Ann', { items: run('assign the list to Ann, Bob', l).r.patch.items }).r.patch.items;
  assert.equal(again[0].text, 'a (for Bob)'); // re-dealing replaces the old name
  assert.match(run('assign the list to Ann', l).r.say, /two or more names/);
  assert.deepEqual(run('split the list into groups of 2', l).r.spawn.props.rows, [['a', 'b'], ['c', 'd'], ['e', '']]);
  assert.deepEqual(run('chunk the list by 3', l).r.spawn.props.rows, [['a', 'b', 'c'], ['d', 'e', '']]);
  assert.deepEqual(run('sliding pairs of the list', L('a', 'b', 'c')).r.spawn.props.rows, [['a', 'b'], ['b', 'c']]);
  assert.equal(run('pair up the list', L('solo')).r.fail, true);
});

test('prefix and suffix every item', () => {
  const l = L('milk', 'eggs');
  assert.deepEqual(texts(run('add prefix "- " to every item in the list', l).r.patch.items), ['- milk', '- eggs']);
  assert.deepEqual(texts(run('prefix every item in the list with TODO:', l).r.patch.items), ['TODO:milk', 'TODO:eggs']);
  assert.deepEqual(texts(run('add suffix ! to each item of the list', l).r.patch.items), ['milk!', 'eggs!']);
  assert.deepEqual(texts(run("append '?' to every item on the list", l).r.patch.items), ['milk?', 'eggs?']);
});

test('numbered, lettered, plain and priority', () => {
  assert.equal(run('number the list', L('a')).r.patch.style, 'numbers');
  assert.equal(run('make it a numbered list', L('a'), {}, {}).r.patch.style, 'numbers');
  assert.equal(run('letter the list', L('a')).r.patch.style, 'letters');
  assert.equal(run('show the list as a lettered list', L('a')).r.patch.style, 'letters');
  assert.equal(run('remove the numbers from the list', L('a')).r.patch.style, '');
  assert.deepEqual([1, 2, 26, 27, 28, 52, 53].map((n) => markerOf('letters', n)), ['a.', 'b.', 'z.', 'aa.', 'ab.', 'az.', 'ba.']);
  assert.equal(markerOf('numbers', 3), '3.'); assert.equal(markerOf('', 3), '');
  const l = L('milk', 'eggs');
  assert.equal(run('mark milk high priority in the list', l).r.patch.items[0].pri, 'high');
  assert.equal(run('mark eggs as low priority on the list', l).r.patch.items[1].pri, 'low');
  assert.equal(run('prioritize eggs in the list', l).r.patch.items[1].pri, 'high');
  assert.match(run('mark milk high priority in the list', l).r.say, /^\u{1F534}/u);
  const hi = { items: [{ id: 'a', text: 'milk', pri: 'high' }] };
  assert.equal('pri' in run('clear the priority on milk in the list', hi).r.patch.items[0], false);
});

test('columns and tag cloud', () => {
  assert.equal(run('show the list in 2 columns', L('a')).r.patch.cols, 2);
  assert.equal(run('put the list into three columns', L('a')).r.patch.cols, 3);
  assert.equal(run('show the list in 1 column', L('a')).r.patch.cols, 0);
  assert.equal(run('show the list as a tag cloud', L('a')).r.patch.view, 'cloud');
  assert.equal(run('tag cloud of the list', L('a')).r.patch.view, 'cloud');
  assert.equal(run('show the list as a checklist', L('a')).r.patch.view, '');
  const c = cloudOf(L('red apple', 'green apple', 'the apple pie', 'red pear').items);
  assert.equal(c[0].word, 'apple'); assert.equal(c[0].count, 3); assert.equal(c[0].size, 5);
  assert.equal(c.find((w) => w.word === 'pear').size, 1);
  assert.ok(!c.some((w) => w.word === 'the'));
  assert.ok(cloudOf(L('a b c').items).every((w) => w.size === 3)); // nothing repeats: all the same
});

test('random sample, first N, last N, every Nth make a new list and leave the list', () => {
  const l = L('a', 'b', 'c', 'd', 'e', 'f');
  const seq = [0.1, 0.9, 0.5, 0.3, 0.7]; let k = 0; const rng = () => seq[k++ % seq.length];
  const s = run('pick 3 random from the list', l, { rng }).r.spawn.props.items;
  assert.equal(s.length, 3); assert.equal(new Set(texts(s)).size, 3); assert.ok(texts(s).every((x) => 'abcdef'.includes(x)));
  assert.deepEqual(texts(run('the first 2 of the list', l).r.spawn.props.items), ['a', 'b']);
  assert.deepEqual(texts(run('last 3 items of my list', l).r.spawn.props.items), ['d', 'e', 'f']);
  assert.deepEqual(texts(run('every 2nd item of the list', l).r.spawn.props.items), ['b', 'd', 'f']);
  assert.deepEqual(texts(run('every 3rd item in the list', l).r.spawn.props.items), ['c', 'f']);
  assert.equal(run('pick 99 random from the list', l, { rng }).r.spawn.props.items.length, 6);
  assert.equal(run('every 9th item of the list', l).r.fail, true);
  assert.equal(l.items.length, 6);
});

test('dedupe keeps the first and the order; ignoring case; normalize spaces', () => {
  const l = L('Milk', 'eggs', 'milk', 'Milk', 'eggs ');
  assert.deepEqual(texts(run('remove duplicates from the list', l).r.patch.items), ['Milk', 'eggs', 'milk', 'eggs ']);
  assert.deepEqual(texts(run('dedupe the list ignoring case', l).r.patch.items), ['Milk', 'eggs']);
  assert.deepEqual(texts(run('remove duplicates from the list case insensitive', l).r.patch.items), ['Milk', 'eggs']);
  assert.match(run('dedupe the list', L('a', 'b')).r.say, /no exact duplicates/);
  assert.deepEqual(texts(run('normalize the spaces in the list', L('a   b', ' c  d ')).r.patch.items), ['a b', 'c d']);
  assert.deepEqual(texts(run('tidy the spacing in the list', L('a  b')).r.patch.items), ['a b']);
});

test('drag reorder moves the item to where it was dropped', () => {
  const l = L('a', 'b', 'c', 'd');
  assert.deepEqual(texts(reorder(l.items, 'i0', 'i2')), ['b', 'c', 'a', 'd']);
  assert.deepEqual(texts(reorder(l.items, 'i3', 'i0')), ['d', 'a', 'b', 'c']);
  assert.deepEqual(texts(reorder(l.items, 'zz', 'i0')), ['a', 'b', 'c', 'd']);
  assert.equal(l.items[0].text, 'a');
});

test('column references', () => {
  const t = T([['Name', 'Age'], ['a', '1']]);
  assert.equal(colIdx(t, '2'), 1); assert.equal(colIdx(t, 'age'), 1); assert.equal(colIdx(t, 'last'), 1); assert.equal(colIdx(t, '3'), -1); assert.equal(colIdx(t, 'zip'), -1);
  assert.equal(colIdx({ rows: [['a', 'b']], header: false }, 'a'), -1);
});

test('every owner number from 282 to 331 has an operation (281 and 331 already live in skills/list.js)', () => {
  const have = new Set(OPS.map((o) => o.n));
  for (let n = 282; n <= 330; n++) if (![297, 298, 299, 301, 302, 320, 330].includes(n)) assert.ok(have.has(n), 'op for ' + n);
  // 296-298 are one column-stat op, 299 CSV paste and 301-302 the parser/export, 320 is the grip in list.js, 330 the badge in list.js
  assert.ok(OPS.find((o) => o.id === 'column-stat'));
});

test('templates: nine of them, each asked by its own word and only with "template"', () => {
  const want = { 'shopping list template': 'shopping', 'packing list template': 'packing', 'meeting agenda template': 'agenda', 'groceries list template': 'groceries', 'grocery list template': 'groceries',
    'reading list template': 'reading', 'bug list template': 'bugs', 'ideas list template': 'ideas', 'gratitude list template': 'gratitude', 'contacts template': 'contacts', 'contact list template': 'contacts',
    'make a packing list template': 'packing', 'template for a packing list': 'packing', 'give me a bug tracker template': 'bugs', 'agenda template': 'agenda' };
  for (const [a, key] of Object.entries(want)) assert.equal(parseTemplate(a)?.tpl.key, key, a);
  assert.equal(TEMPLATES.length, 9);
  assert.equal(parseTemplate('packing list template for a beach trip').topic, 'a beach trip');
  for (const a of ['make a grocery list', 'grocery list', 'a shopping list with eggs, milk', 'email template for a meeting agenda', 'what should I pack', 'packing', 'resume template', 'template']) assert.equal(parseTemplate(a), null, a);
  const list = cardFor(TEMPLATES.find((t) => t.key === 'agenda'), 'weekly sync');
  assert.equal(list.kind, 'list'); assert.equal(list.props.title, 'Meeting agenda: weekly sync'); assert.equal(list.props.style, 'numbers'); assert.ok(list.props.items.length >= 5 && list.props.items.every((i) => i.id && i.text && i.done === false));
  const tab = cardFor(TEMPLATES.find((t) => t.key === 'contacts'));
  assert.equal(tab.kind, 'datatable'); assert.deepEqual(tab.props.rows[0], ['Name', 'Phone', 'Email', 'Notes']); assert.equal(tab.props.header, true);
  const bugs = cardFor(TEMPLATES.find((t) => t.key === 'bugs'));
  assert.equal(bugs.kind, 'datatable'); assert.equal(bugs.props.rows[0].length, bugs.props.rows[1].length);
});

// a small stage double: things, select, save, render, say, stage, snapshot
const stage = (things = {}) => { const said = []; let sel = null, saves = 0;
  const api = { things: () => things, selected: () => sel, select: (id) => { sel = id; }, save: () => { saves++; }, render: () => {}, say: (m) => said.push(m), snapshot: () => {}, stage: { clientWidth: 800, clientHeight: 600 }, targetKind: () => null };
  return { api, said, things, saves: () => saves }; };

test('the skills end to end on a stage double', () => {
  const s = stage({ l1: { id: 'l1', kind: 'list', title: '', items: [{ id: 'a', text: 'milk', done: false }, { id: 'b', text: 'eggs', done: true }, { id: 'c', text: 'Milk', done: false }] } });
  assert.equal(toolsAsk('', 'remove checked items from the list', s.api), 'list-tools');
  assert.deepEqual(s.things.l1.items.map((i) => i.text), ['milk', 'Milk']);
  assert.equal(toolsAsk('', 'dedupe the list ignoring case', s.api), 'list-tools');
  assert.equal(s.things.l1.items.length, 1);
  assert.equal(toolsAsk('', 'turn the list into a table', s.api), 'list-tools');
  const tab = Object.values(s.things).find((t) => t.kind === 'datatable');
  assert.deepEqual(tab.rows[1], ['milk', 'no']);
  assert.equal(Object.values(s.things).filter((t) => t.kind === 'list').length, 1); // the list stays
  assert.equal(toolsAsk('', 'sum of column 2', s.api), 'list-tools'); assert.match(s.said.at(-1), /no numbers/);
  assert.equal(toolsAsk('', 'csv to table: x,y // 1,2', s.api), 'table');
  assert.equal(Object.values(s.things).filter((t) => t.kind === 'datatable').length, 2);
  assert.equal(toolsAsk('', 'table to csv', s.api), 'list-tools');
  assert.ok(Object.values(s.things).some((t) => t.kind === 'datatable' && /^x,y\n1,2$|Item,Done/.test(t.exportText || '')));
  assert.equal(toolsAsk('', 'sort my photos', s.api), '');
  const empty = stage();
  assert.equal(toolsAsk('', 'check all on the list', empty.api), 'list-tools'); assert.match(empty.said[0], /no list on the stage/);
  assert.equal(templateAsk('', 'packing list template for a beach trip', empty.api), 'list-template');
  const made = Object.values(empty.things)[0];
  assert.equal(made.kind, 'list'); assert.equal(made.title, 'Packing: a beach trip');
  assert.equal(templateAsk('', 'make a grocery list', empty.api), '');
});

test('routing: examples match, near misses do not', () => {
  for (const sk of [listTools, listTemplates]) {
    for (const e of sk.examples) assert.equal(sk.match(e.toLowerCase(), e), true, sk.name + ': ' + e);
    for (const n of sk.nearMisses) assert.equal(sk.match(n.toLowerCase(), n), false, sk.name + ' must leave: ' + n);
  }
  assert.equal(listTools.match('make a grocery list', 'make a grocery list'), false);
  assert.equal(listTemplates.match('sort the list', 'sort the list'), false);
  assert.equal(listTools.match('shopping list template', 'shopping list template'), false);
  assert.ok(listTools.stageKinds.datatable.mount);
});
