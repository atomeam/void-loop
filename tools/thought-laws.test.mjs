// Operating laws for serious thought (owner, 2026-10-18): causal-scars, counterfactual-draft, witness-claims. Pure logic only;
// the browser section "thought laws" in test_void.mjs plays them on the stage.
// Run: node --test tools/thought-laws.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScars, parseEdges, addEdges, reach, rootsOf, dies, removeWith, depths } from '../void-live-deploy/skills/causal-scars.js';
import { parseCounter, sentences, dependents, fractureOf, flip, shadowOf } from '../void-live-deploy/skills/counterfactual-draft.js';
import { parseWitness, parseClaims, parseWitnessAsk, canCommit, commit, witnessLine } from '../void-live-deploy/skills/witness-claims.js';

test('scars: asks it takes and the look-alikes it leaves', () => {
  assert.deepEqual(parseScars('map the scars of my decisions'), { edges: [] });
  assert.deepEqual(parseScars('what depends on this decision'), { edges: [] });
  assert.deepEqual(parseScars('map the scars of my decisions: A > b, c; D > e').edges, [['A', 'b'], ['A', 'c'], ['D', 'e']]);
  for (const a of ['what is a scar', 'how do I make a decision', 'what depends on the weather', 'add milk to my list']) assert.equal(parseScars(a), null, a);
});

test('scars: reachability, what dies with a decision, and shared causes survive', () => {
  // A causes x and y; B causes y and z; y has two causes, so removing A kills x and w only
  const g = addEdges({ nodes: [], edges: [] }, parseEdges('A > x, y; B > y, z; x > w'));
  assert.deepEqual(rootsOf(g).sort(), ['A', 'B']);
  assert.deepEqual([...reach(g, ['A'])].sort(), ['A', 'w', 'x', 'y']);
  assert.deepEqual(dies(g, 'A').sort(), ['w', 'x']);
  assert.deepEqual(dies(g, 'B').sort(), ['z']);
  const after = removeWith(g, 'A');
  assert.deepEqual([...after.nodes].sort(), ['B', 'y', 'z']);
  assert.ok(after.edges.every(([a, b]) => after.nodes.includes(a) && after.nodes.includes(b)));
  assert.deepEqual(depths(g), { A: 0, x: 1, w: 2, y: 1, B: 0, z: 1 });
});

test('scars: loops, repeats and size are held back', () => {
  const g = addEdges({ nodes: [], edges: [] }, [['a', 'b'], ['b', 'c'], ['c', 'a'], ['a', 'b']]);
  assert.equal(g.edges.length, 2); // c>a would close a loop; the repeat of a>b is dropped
  const many = addEdges({ nodes: [], edges: [] }, Array.from({ length: 100 }, (_, i) => ['d' + i, 'c' + i]));
  assert.ok(many.nodes.length <= 40);
});

test('counterfactual: parsing, dependents, fracture line', () => {
  const p = parseCounter('what if my assumption is false: people want speed. Document: We ship fast. People want speed, so we skip polish. Price stays low.');
  assert.equal(p.assumption, 'people want speed');
  assert.equal(sentences(p.doc).length, 3);
  assert.deepEqual(parseCounter('write the opposite of my plan'), { assumption: '', doc: '' });
  for (const a of ['write a plan for my week', 'what if it rains tomorrow', 'what is an assumption']) assert.equal(parseCounter(a), null, a);
  assert.deepEqual(dependents('people want speed', p.doc).map((x) => x.dep), [false, true, false]);
  assert.equal(fractureOf('people want speed', p.doc), 1);
  assert.equal(fractureOf('the moon is cheese', p.doc), -1);
  // a consequence sentence right after a dependent one depends too
  assert.deepEqual(dependents('people want speed', 'People want speed. So we skip polish. Rent is due.').map((x) => x.dep), [true, true, false]);
});

test('counterfactual: the shadow flips dependents and keeps the rest', () => {
  assert.equal(flip('Users are loyal.'), 'Users are not loyal.');
  assert.equal(flip('Users are not loyal.'), 'Users are loyal.');
  assert.equal(flip('We cannot wait.'), 'We can wait.');
  assert.equal(flip('Ship it.'), 'It is not the case that ship it.');
  assert.equal(shadowOf('people want speed', 'We ship fast. People want speed, so we skip polish. Price stays low.'),
    'Suppose this is false: people want speed. We ship fast. It is not the case that people want speed, so we skip polish. Price stays low.');
});

test('witness: parsing, committing needs a witness, unverified is shown as such', () => {
  assert.deepEqual(parseWitness('data: q3.csv'), { kind: 'data', value: 'q3.csv' });
  assert.deepEqual(parseWitness('assumes: price holds, no rival'), { kind: 'assumes', value: 'price holds, no rival' });
  assert.deepEqual(parseWitness('Unverified'), { kind: 'unverified', value: '' });
  for (const w of ['', 'trust me', 'data:', 'q3.csv']) assert.equal(parseWitness(w), null, w);
  const cl = parseClaims('revenue grew @ data: q3.csv; launch is easy; users stay @ unverified');
  assert.deepEqual(cl.map((c) => c.witness && c.witness.kind), ['data', null, 'unverified']);
  assert.equal(canCommit(cl[1]).ok, false);
  const no = commit(cl, 1);
  assert.equal(no.moved, false); assert.equal(no.claims, cl); assert.match(no.why, /witness/);
  const yes = commit(cl, 0);
  assert.equal(yes.moved, true); assert.equal(yes.claims[0].state, 'committed'); assert.equal(cl[0].state, 'draft');
  assert.equal(witnessLine(yes.claims[0].witness), 'data: q3.csv');
  assert.equal(witnessLine(cl[2].witness), 'unverified');
  assert.equal(witnessLine(null), 'no witness');
});

test('witness: asks it takes and the look-alikes it leaves', () => {
  assert.deepEqual(parseWitnessAsk('proof-carrying claims'), { claims: [] });
  assert.equal(parseWitnessAsk('make proof carrying claims: a @ data: x; b').claims.length, 2);
  for (const a of ['what is a claim', 'file an insurance claim', 'proof of purchase', 'what is proof carrying code']) assert.equal(parseWitnessAsk(a), null, a);
});
