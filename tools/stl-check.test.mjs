// the STL check (lib/stl-check.js, skills/stl-check.js): a forge print read back from its own STL gets the forge's own verdict,
// an ASCII cube is read and watertight, a cube with a facet missing is not, a file cut short or not an STL says so in words,
// and the card shows the file's name and the notes through esc.
//   node --test tools/stl-check.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStl, checkStl } from '../void-live-deploy/lib/stl-check.js';
import { build, stl, printCheck, THINGS } from '../void-live-deploy/skills/forge-rules.js';
import skill, { isStlCheck, resultHtml } from '../void-live-deploy/skills/stl-check.js';

const CUBE = [ // 10 mm cube, Z up, each facet wound outward
  [[0, 0, 0], [0, 10, 0], [10, 10, 0]], [[0, 0, 0], [10, 10, 0], [10, 0, 0]], [[0, 0, 10], [10, 0, 10], [10, 10, 10]], [[0, 0, 10], [10, 10, 10], [0, 10, 10]],
  [[0, 0, 0], [10, 0, 0], [10, 0, 10]], [[0, 0, 0], [10, 0, 10], [0, 0, 10]], [[0, 10, 0], [0, 10, 10], [10, 10, 10]], [[0, 10, 0], [10, 10, 10], [10, 10, 0]],
  [[0, 0, 0], [0, 0, 10], [0, 10, 10]], [[0, 0, 0], [0, 10, 10], [0, 10, 0]], [[10, 0, 0], [10, 10, 0], [10, 10, 10]], [[10, 0, 0], [10, 10, 10], [10, 0, 10]],
];
const ascii = (facets) => 'solid cube\n' + facets.map((f) => ' facet normal 0 0 0\n  outer loop\n' + f.map((v) => '   vertex ' + v.join(' ')).join('\n') + '\n  endloop\n endfacet').join('\n') + '\nendsolid cube\n';
const bytes = (s) => new TextEncoder().encode(s);

test('a forge print read back from its own STL gets the forge verdict', () => {
  const m = build(Object.keys(THINGS)[0]), r = checkStl(stl(m), 'forge.stl');
  assert.equal(r.ok, true);
  assert.equal(r.triangles, m.indices.length / 3);
  assert.deepEqual(r.size, m.size);
  assert.deepEqual(r.notes, printCheck(m).notes);
});

test('an ASCII cube is watertight and faces outward; one facet gone and it is open', () => {
  const r = checkStl(bytes(ascii(CUBE)));
  assert.equal(r.format, 'ASCII');
  assert.equal(r.triangles, 12);
  assert.ok(r.closed && r.outward && r.fits, JSON.stringify(r.notes));
  assert.deepEqual(r.size, [10, 10, 10]);
  assert.equal(r.volumeCm3, 1);
  const open = checkStl(bytes(ascii(CUBE.slice(1))));
  assert.equal(open.closed, false);
  assert.equal(open.ok, false);
  assert.match(open.notes.join(' '), /open edges: 3/);
  const inward = checkStl(bytes(ascii(CUBE.map((f) => [f[0], f[2], f[1]]))));
  assert.equal(inward.outward, false);
  assert.equal(inward.ok, false);
});

test('a file that is not an STL, empty or cut short says so in words', () => {
  assert.match(checkStl(new ArrayBuffer(0)).error, /empty/);
  assert.match(checkStl(bytes('hello')).error, /not an STL|no facets/);
  const whole = new Uint8Array(stl(build(Object.keys(THINGS)[0])));
  assert.match(checkStl(whole.slice(0, whole.length - 10)).error, /cut short/);
  assert.throws(() => parseStl(bytes('solid x\n facet normal 0 0 0\n outer loop\n vertex 0 0 0\n vertex 1 0 0\n endloop\nendsolid')), /three corners/);
});

test('the asks are its and the near misses are not', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['Is my STL watertight?', 'check this stl file for holes', 'stl validator']) assert.ok(isStlCheck(a), a);
});

test('the card shows the name and every note through esc', () => {
  const seen = [], esc = (s) => { seen.push(String(s)); return String(s).replace(/</g, '&lt;'); };
  const html = resultHtml(esc, '<b>x.stl', checkStl(bytes(ascii(CUBE.slice(1)))));
  assert.ok(!html.includes('<b>x.stl'));
  assert.ok(seen.includes('It is not watertight.'));
  assert.match(resultHtml(esc, 'y.stl', checkStl(new ArrayBuffer(0))), /empty/);
});
