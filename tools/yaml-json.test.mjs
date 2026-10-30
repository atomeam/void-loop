// YAML to JSON, JSON to YAML and the YAML check: the lib (lib/yamljson.js), the asks that open it in skills/util.js, and the card.
//   node --test tools/yaml-json.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { yamlToJson, jsonToYaml, parseYaml, toYaml, plainValue } from '../void-live-deploy/lib/yamljson.js';
import util, { utilOf } from '../void-live-deploy/skills/util.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('plainValue: YAML 1.2 core types, and the words a 1.1 reader turns into booleans stay text', () => {
  assert.equal(plainValue('null'), null); assert.equal(plainValue('~'), null); assert.equal(plainValue(''), null);
  assert.equal(plainValue('true'), true); assert.equal(plainValue('False'), false);
  assert.equal(plainValue('42'), 42); assert.equal(plainValue('-1.5e3'), -1500); assert.equal(plainValue('0x1F'), 31); assert.equal(plainValue('0o17'), 15);
  for (const s of ['yes', 'no', 'on', 'off', 'y', 'n']) assert.equal(plainValue(s), s, s);
  assert.equal(plainValue('12345678901234567890'), '12345678901234567890');
  assert.equal(plainValue('007'), 7);
});

test('parseYaml: maps, lists, flow, quotes, blocks, comments, anchors and documents', () => {
  const y = [
    '# a config',
    'name: Ann  # trailing note',
    'age: 30',
    'tags: [a, "b c", 3]',
    'opts: {x: 1, y: [true, null]}',
    'list:',
    '  - one',
    '  - k: v',
    '    j: 2',
    '- top-level is not allowed here',
  ].join('\n');
  assert.ok(yamlToJson(y).error, 'a list item under a map at column 0 is an error');
  const ok = [
    'name: Ann  # trailing note', 'age: 30', 'tags: [a, "b c", 3]', 'opts: {x: 1, y: [true, null]}',
    'list:', '  - one', '  - k: v', '    j: 2', 'quoted: \'it\'\'s\'', 'esc: "tab\\tend"',
    'lit: |', '  line 1', '  line 2', 'fold: >', '  a', '  b', '', '  c', 'base: &b {p: 1}', 'more:', '  <<: *b', '  q: 2', 'when: yes',
  ].join('\n');
  assert.deepEqual(parseYaml(ok), {
    name: 'Ann', age: 30, tags: ['a', 'b c', 3], opts: { x: 1, y: [true, null] }, list: ['one', { k: 'v', j: 2 }],
    quoted: "it's", esc: 'tab\tend', lit: 'line 1\nline 2\n', fold: 'a b\nc\n', base: { p: 1 }, more: { p: 1, q: 2 }, when: 'yes',
  });
  assert.deepEqual(parseYaml('a: 1\n---\nb: 2\n...\n'), [{ a: 1 }, { b: 2 }]);
  assert.equal(parseYaml(''), null);
  // a key named __proto__ is data, not a prototype
  const p = parseYaml('__proto__: {polluted: 1}');
  assert.equal(Object.getPrototypeOf(p), Object.prototype); assert.deepEqual(Object.keys(p), ['__proto__']);
});

test('yamlToJson: says what it found, and names the line of a fault', () => {
  const r = yamlToJson('a: 1\nb: [x, y]');
  assert.deepEqual(JSON.parse(r.json), { a: 1, b: ['x', 'y'] }); assert.equal(r.what, 'a map of 2 keys'); assert.equal(r.docs, 1);
  assert.equal(yamlToJson('- 1\n- 2').what, 'a list of 2 items');
  assert.equal(yamlToJson('a: 1\n---\nb: 2').what, '2 documents, as one list');
  assert.match(yamlToJson('a: 1\n\tb: 2').error, /^Line 2: /);
  assert.match(yamlToJson('a: [1, 2\nb: 3').error, /^Line \d+: /);
  assert.match(yamlToJson('a: *nope').error, /^Line 1: /);
  assert.equal(yamlToJson('   ').error, 'Paste YAML first.');
});

test('jsonToYaml: quotes what a reader would misread, writes | blocks, and a round trip keeps the data', () => {
  assert.equal(jsonToYaml('{"a":"yes","b":"12","c":"x: y","d":"","e":"- z","f":true,"g":null}').yaml,
    'a: "yes"\nb: "12"\nc: "x: y"\nd: ""\ne: "- z"\nf: true\ng: null');
  assert.equal(jsonToYaml('{"t":"one\\ntwo\\n"}').yaml, 't: |\n  one\n  two');
  assert.equal(jsonToYaml('[]').yaml, '[]');
  assert.match(jsonToYaml('{oops').error, /not valid JSON/);
  const data = { name: 'Ann', n: [1, 2.5, -3], deep: { list: [{ a: 'on' }, [], {}], note: 'line\nnext' }, empty: '', nul: null, flag: false, hash: 'a #b', lead: ' sp' };
  assert.deepEqual(parseYaml(toYaml(data)), data);
  assert.deepEqual(JSON.parse(yamlToJson(jsonToYaml(JSON.stringify(data)).yaml).json), data);
});

test('the asks: the tool by name both ways, the check, and what is not one of them', () => {
  for (const a of ['yaml to json', 'yml to json', 'convert yaml to json', 'YAML to JSON converter', 'online yaml to json', 'yaml json converter', 'yaml validator', 'validate yaml', 'yaml linter']) assert.deepEqual(utilOf(a), { kind: 'yamljson', dir: 'yaml' }, a);
  for (const a of ['json to yaml', 'json to yml', 'convert json to yaml', 'JSON to YAML converter']) assert.deepEqual(utilOf(a), { kind: 'yamljson', dir: 'json' }, a);
  for (const a of ['yaml to yml', 'json to json', 'what is yaml', 'yaml vs json', 'yaml syntax']) assert.equal(utilOf(a), null, a);
  for (const e of util.examples) assert.ok(util.match(e.toLowerCase(), e), e);
  for (const n of util.nearMisses) assert.ok(!util.match(n.toLowerCase(), n), n);
});

// a small stand-in for the card: the fields by class, with their handlers
function fakeCard() {
  const nodes = {}, handlers = {};
  const node = (cls) => (nodes[cls] = nodes[cls] || { cls, value: '', textContent: '', innerHTML: '', dataset: {}, setAttribute() {}, addEventListener: (ev, f) => { handlers[cls] = f; } });
  const el = { innerHTML: '', dataset: {}, addEventListener() {}, querySelectorAll: () => [], querySelector: (s) => (s.startsWith('.') ? node(s.slice(1)) : s === 'h2' ? node('h2') : null) };
  return { el, nodes, type: (cls, v) => { node(cls).value = v; handlers[cls](); }, press: (cls) => handlers[cls]() };
}

test('run: YAML to JSON converts as you type, names a fault, and one press turns it round with the output as input', async () => {
  const c = fakeCard();
  assert.equal(await util.run('yaml to json', { showPage: (f) => { f(c.el); return c.el; }, esc, _pageStill: () => true }), 'util');
  assert.ok(c.el.innerHTML.startsWith('<h2>YAML to JSON</h2>') && c.el.innerHTML.includes('util-flip') && c.el.innerHTML.includes('util-copy'), c.el.innerHTML);
  c.type('util-in', 'a: 1\nb: <x>');
  assert.deepEqual(JSON.parse(c.nodes['util-out'].textContent), { a: 1, b: '<x>' });
  assert.equal(c.nodes['util-say'].textContent, 'Valid YAML: a map of 2 keys');
  c.type('util-in', 'a: 1\n\tb: 2');
  assert.equal(c.nodes['util-out'].textContent, ''); assert.match(c.nodes['util-say'].textContent, /^Line 2: /);
  c.type('util-in', 'a: yes');
  c.press('util-flip');
  assert.equal(c.nodes.h2.textContent, 'JSON to YAML');
  assert.equal(c.nodes['util-out'].textContent, 'a: "yes"');
});

test('run: "json to yaml" opens the card the other way round', async () => {
  const c = fakeCard();
  await util.run('json to yaml', { showPage: (f) => { f(c.el); return c.el; }, esc, _pageStill: () => true });
  assert.ok(c.el.innerHTML.startsWith('<h2>JSON to YAML</h2>'), c.el.innerHTML);
  c.type('util-in', '{"x":[1,"no"]}');
  assert.equal(c.nodes['util-out'].textContent, 'x:\n  - 1\n  - "no"');
});
