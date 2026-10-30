// CSV to JSON, JSON to CSV and the CSS minifier: the libs (lib/csvjson.js, lib/cssmin.js), the asks that open them in
// skills/util.js, and the cards they draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { csvToJson, jsonToCsv, cellValue, fieldNames, csvCell } from '../void-live-deploy/lib/csvjson.js';
import { minifyCss } from '../void-live-deploy/lib/cssmin.js';
import util, { utilOf } from '../void-live-deploy/skills/util.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('csvToJson: header names the fields, plain numbers and booleans become values, other text stays text', () => {
  const r = csvToJson('name,age,,name\nann,30,x,007\n"b, o",1.5,true,');
  assert.equal(r.rows, 2); assert.equal(r.cols, 4);
  assert.deepEqual(JSON.parse(r.json), [
    { name: 'ann', age: 30, 'column 3': 'x', name_2: '007' },
    { name: 'b, o', age: 1.5, 'column 3': true, name_2: '' },
  ]);
  assert.deepEqual(JSON.parse(csvToJson('a;b\n1;2', { typed: false }).json), [{ a: '1', b: '2' }]);
  assert.ok(csvToJson('').error);
  assert.equal(cellValue('1e3'), 1000); assert.equal(cellValue('1,5'), '1,5'); assert.equal(cellValue('12345678901234567890'), '12345678901234567890');
  assert.deepEqual(fieldNames(['a', 'a', '', 'a_2']), ['a', 'a_2', 'column 3', 'a_2_2']);
});

test('jsonToCsv: objects give columns in first-seen order, rows stay rows, bad input says why', () => {
  assert.deepEqual(jsonToCsv('[{"a":1,"b":"x,y"},{"c":{"d":2},"a":" sp"}]'), { csv: 'a,b,c\n1,"x,y",\n" sp",,"{""d"":2}"', rows: 2, cols: 3 });
  assert.equal(jsonToCsv('[[1,2],[3,"q\\"t"]]').csv, '1,2\n3,"q""t"');
  assert.equal(jsonToCsv('{"a":1}').csv, 'a\n1');
  assert.match(jsonToCsv('oops').error, /not valid JSON/);
  assert.match(jsonToCsv('[1,2]').error, /Every item/);
  assert.match(jsonToCsv('[]').error, /array/);
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  // a round trip keeps the data
  const csv = 'name,note\nann,"says ""hi"", twice"\nbo,plain';
  assert.equal(jsonToCsv(csvToJson(csv).json).csv, csv);
});

test('minifyCss: removes comments and spaces it may remove, keeps the ones that change meaning', () => {
  const src = '/*! keep */\n/* drop */\na  >  b ,  c + d ~ e  {\n color : red ;\n width: calc( 100% - 2px + 1em );\n background: url( \'a b.png\' ) no-repeat;\n content: "  x ; } ";\n}\ndiv :hover , p::before { margin : 0 auto ; }\n@media screen and (min-width: 600px) { .x { top: 0 } }';
  const r = minifyCss(src);
  assert.equal(r.css, '/*! keep */ a>b,c+d~e{color:red;width:calc(100% - 2px + 1em);background:url(\'a b.png\') no-repeat;content:"  x ; } "}div :hover,p::before{margin:0 auto}@media screen and (min-width:600px){.x{top:0}}');
  assert.ok(r.after < r.before);
  assert.equal(minifyCss('').css, '');
});

test('the asks: the tools by name, and what is not one of them', () => {
  for (const a of ['csv to json', 'Convert CSV to JSON', 'csv to json converter', 'a csv to json tool', 'online csv to json', 'convert this csv to json']) assert.deepEqual(utilOf(a), { kind: 'csvjson', dir: 'csv' }, a);
  for (const a of ['json to csv', 'convert json to csv', 'JSON to CSV converter']) assert.deepEqual(utilOf(a), { kind: 'csvjson', dir: 'json' }, a);
  for (const a of ['minify css', 'CSS minifier', 'compress css', 'css minify', 'css compressor', 'an online css minifier']) assert.deepEqual(utilOf(a), { kind: 'cssmin' }, a);
  for (const a of ['what is csv', 'what is json', 'csv vs json', 'minify js', 'what is css', 'css grid']) assert.equal(utilOf(a), null, a);
  for (const e of util.examples) assert.ok(util.match(e.toLowerCase(), e), e);
  for (const n of util.nearMisses) assert.ok(!util.match(n.toLowerCase(), n), n);
});

// a small stand-in for the card: the fields by class, with their handlers
function fakeCard() {
  const nodes = {}, handlers = {};
  const node = (cls) => (nodes[cls] = nodes[cls] || { cls, value: '', textContent: '', innerHTML: '', dataset: {}, addEventListener: (ev, f) => { handlers[cls] = f; } });
  const el = { innerHTML: '', dataset: {}, addEventListener() {}, querySelectorAll: () => [], querySelector: (s) => (s.startsWith('.') ? node(s.slice(1)) : null) };
  return { el, nodes, type: (cls, v) => { node(cls).value = v; handlers[cls](); }, press: (cls) => handlers[cls]() };
}

test('run: CSV to JSON converts as you type, and turns round to JSON to CSV', async () => {
  const c = fakeCard();
  assert.equal(await util.run('csv to json', { showPage: (f) => { f(c.el); return c.el; }, esc, _pageStill: () => true }), 'util');
  assert.ok(c.el.innerHTML.startsWith('<h2>CSV to JSON</h2>') && c.el.innerHTML.includes('util-flip') && c.el.innerHTML.includes('util-copy'), c.el.innerHTML);
  c.type('util-in', 'a,b\n1,<x>');
  assert.deepEqual(JSON.parse(c.nodes['util-out'].textContent), [{ a: 1, b: '<x>' }]);
  assert.equal(c.nodes['util-say'].textContent, '1 row, 2 fields');
  c.press('util-flip');
  c.type('util-in', '[{"a":1},{"a":2}]');
  assert.equal(c.nodes['util-out'].textContent, 'a\n1\n2');
  c.type('util-in', '[{');
  assert.equal(c.nodes['util-out'].textContent, ''); assert.match(c.nodes['util-say'].textContent, /not valid JSON/);
});

test('run: "json to csv" opens the card the other way round', async () => {
  const c = fakeCard();
  await util.run('json to csv', { showPage: (f) => { f(c.el); return c.el; }, esc, _pageStill: () => true });
  assert.ok(c.el.innerHTML.startsWith('<h2>JSON to CSV</h2>'), c.el.innerHTML);
  c.type('util-in', '{"x":"a,b"}');
  assert.equal(c.nodes['util-out'].textContent, 'x\n"a,b"');
});

test('run: the CSS minifier shrinks as you type and says by how much', async () => {
  const c = fakeCard();
  await util.run('minify css', { showPage: (f) => { f(c.el); return c.el; }, esc, _pageStill: () => true });
  assert.ok(c.el.innerHTML.startsWith('<h2>CSS minifier</h2>'), c.el.innerHTML);
  c.type('util-in', 'a { color : red ; }');
  assert.equal(c.nodes['util-out'].textContent, 'a{color:red}');
  assert.equal(c.nodes['util-say'].textContent, '19 bytes to 12 bytes (37% smaller)');
});
