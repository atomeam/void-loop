// The four math-transplant stage skills (owner, 2026-10-18): sheaf-check, spectral-review, task-diagram, gauge-feedback.
// Pure cores only; the browser section "math transplants" plays them on the stage. Run: node --test tools/math-transplants.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sheaf, { bodyOf, parseNotes, glue, verdict } from '../void-live-deploy/skills/sheaf-check.js';
import spectral, { textOf, highSpans, bands, damp } from '../void-live-deploy/skills/spectral-review.js';
import tasks, { parseTasks, graphOf, squares, blockers, blockerLine, bodyOf as tasksBody } from '../void-live-deploy/skills/task-diagram.js';
import gauge, { parseFeedback, egoOf, core, frames, review } from '../void-live-deploy/skills/gauge-feedback.js';
import { splitOn } from '../void-live-deploy/lib/stage-math.js';

const routes = (skill, yes, no) => {
  for (const a of yes) assert.equal(!!skill.match(a.toLowerCase(), a), true, skill.name + ' should take: ' + a);
  for (const a of no) assert.equal(!!skill.match(a.toLowerCase(), a), false, skill.name + ' should leave: ' + a);
};
const others = [sheaf, spectral, tasks, gauge];

test('splitOn trims and drops empties', () => assert.deepEqual(splitOn(' a ;; b ;', /;/), ['a', 'b']));

test('sheaf-check: disagreement is an obstruction with the minimal pair', () => {
  const g = glue(parseNotes('launch: Friday; owner: Ana | launch: Monday; owner: ana | budget: 5'));
  assert.equal(g.glues, false);
  assert.equal(g.obstructions.length, 1);
  assert.deepEqual(g.obstructions[0], { subject: 'launch', a: { note: 'note 1', value: 'friday' }, b: { note: 'note 2', value: 'monday' } });
  assert.deepEqual(g.overlaps.sort(), ['launch', 'owner']);
  assert.match(verdict(g, 3), /do not glue: 1 obstruction\./);
});

test('sheaf-check: agreeing overlaps glue (case, spacing and 5 vs 5.0 do not matter)', () => {
  const g = glue(parseNotes('price: 5; Color: Red\n\n price: 5.0; color: red.  ---  size: L'));
  assert.equal(g.glues, true);
  assert.deepEqual(g.obstructions, []);
  assert.match(verdict(g, 3), /^The notes glue: all 2 shared subjects agree/);
  assert.match(verdict(glue(parseNotes('a: 1 | b: 2')), 2), /share no subject/);
  assert.match(verdict(glue(parseNotes('a: 1')), 1), /at least two/);
});

test('sheaf-check: a pair in one note is not a conflict, three notes still name one pair', () => {
  assert.equal(glue(parseNotes('a: 1; a: 2 | b: 1')).glues, true); // within one note is that note's own business
  const g = glue(parseNotes('a: 1 | a: 2 | a: 3'));
  assert.equal(g.obstructions.length, 1);
  assert.equal(g.obstructions[0].a.note, 'note 1');
});

test('sheaf-check: routing', () => {
  routes(sheaf, ['do my notes agree: launch: friday | launch: monday', 'sheaf check: a: 1 | a: 2', 'Check if my notes agree: x: 1 --- x: 1'],
    ['do my notes agree with the plan', 'sheaf cohomology explained', 'take a note: launch is friday', 'do my notes agree']);
  assert.equal(bodyOf('do my notes agree: nothing here'), null);
  for (const s of others.filter((s) => s !== sheaf)) assert.equal(!!s.match('do my notes agree: a: 1 | a: 2', 'do my notes agree: a: 1 | a: 2'), false, s.name);
});

test('spectral-review: bands by fixed rules', () => {
  const text = '# Plan\n\nWe ship Friday. It is very simple, because users really want it. However we simply need tests.\n\nSecond paragraph starts here. Then it quickly ends.';
  const b = bands(text);
  assert.deepEqual(b.slow.map((s) => s.text.trim()), ['# Plan', 'We ship Friday.', 'Second paragraph starts here.']);
  assert.ok(b.mid.every((s) => /because|however/i.test(s.text)));
  assert.equal(b.mid.length, 2);
  assert.deepEqual(highSpans(text).map((s) => s.text.toLowerCase()), ['very', 'really', 'simply', 'quickly']);
  assert.deepEqual(highSpans('It is it is the the end.').map((s) => s.kind), ['repeat']);
  assert.deepEqual(highSpans('Only a family reply'), []); // -ly words that are not adverbs
});

test('spectral-review: damping the high band strikes filler and leaves the slow band alone', () => {
  const text = 'We ship Friday. It is very simple, really good, and just fine.';
  assert.equal(damp(text, 1).result, text);
  const d = damp(text, 0);
  assert.equal(d.struckCount, 3);
  assert.equal(d.result, 'We ship Friday. It is simple, good, and fine.');
  assert.ok(d.result.startsWith('We ship Friday.'));
  assert.equal(damp(text, 0.5).struckCount, 2); // ceil(0.5 * 3)
  assert.deepEqual(damp(text, 0.5), damp(text, 0.5)); // deterministic
  assert.equal(damp(text, 'junk').struckCount, 0);
});

test('spectral-review: routing', () => {
  routes(spectral, ['spectral review of We basically just ship it quickly.', 'Spectral review: This is really very good indeed.'],
    ['spectral analysis of the sun', 'review my essay', 'what is spectral clustering', 'spectral review of x']);
  assert.equal(textOf('spectral review of we'), null);
});

test('task-diagram: parsing arrows, chains and the goal', () => {
  assert.deepEqual(parseTasks('a -> b, b -> c; goal: c'), { edges: [['a', 'b'], ['b', 'c']], goal: 'c' });
  assert.deepEqual(parseTasks('write → review → ship').edges, [['write', 'review'], ['review', 'ship']]);
  assert.deepEqual(parseTasks('a -> a').edges, []);
});

test('task-diagram: finds the commutative square', () => {
  const g = graphOf(parseTasks('a -> b, b -> c, a -> d, d -> c'));
  const sq = squares(g);
  assert.equal(sq.length, 1);
  assert.equal(sq[0].from, 'a'); assert.equal(sq[0].to, 'c');
  assert.deepEqual(sq[0].routes.map((r) => r.join('>')).sort(), ['a>b>c', 'a>d>c']);
  assert.equal(g.goal, 'c');
  const b = blockers(g);
  assert.deepEqual(b.stuck, []);
  assert.match(blockerLine(b, g), /^No blocker/);
  assert.deepEqual(squares(graphOf(parseTasks('a -> b, b -> c'))), []); // one route is not a square
});

test('task-diagram: names the real blocker (dead end, no path to the goal)', () => {
  const g = graphOf(parseTasks('a -> b, b -> ship, a -> c, c -> d; goal: ship'));
  const b = blockers(g);
  assert.deepEqual(b.stuck.sort(), ['c', 'd']);
  assert.deepEqual(b.missing, ['d -> ship']);
  assert.match(blockerLine(b, g), /^The real blocker: d -> ship \(missing\)\. 2 tasks have no path to ship/);
  const loop = graphOf(parseTasks('a -> b, b -> a'));
  assert.equal(blockers(loop).cycle, true);
  assert.match(blockerLine(blockers(loop), loop), /loop/);
  assert.ok(blockers(graphOf(parseTasks('a -> b; goal: z'))).unreached);
});

test('task-diagram: routing', () => {
  routes(tasks, ['map my tasks a -> b, b -> c, a -> d, d -> c', 'Map my tasks: write -> ship; goal: ship'],
    ['map my route to work', 'map my tasks for tomorrow', 'what is a commutative diagram', 'map my tasks']);
  assert.equal(tasksBody('map my tasks for tomorrow'), null);
});

test('gauge-feedback: ego flags', () => {
  assert.deepEqual(egoOf('You always miss the deadline.').blame, ['you always']);
  assert.deepEqual(egoOf('Your login page is brilliant!').flattery, ['brilliant']);
  assert.deepEqual(egoOf('As your manager I say it is slow').status, ['as your manager']);
  assert.deepEqual(egoOf('The login page misses the deadline.'), { blame: [], flattery: [], status: [] });
});

test('gauge-feedback: three frames per statement, ego removed', () => {
  assert.equal(core('You always miss the deadline.'), 'this draft often miss the deadline');
  const f = frames('You never test the checkout flow.');
  assert.match(f.neutral, /^Observation: this draft does not yet test the checkout flow\.$/);
  assert.match(f.kind, /^Something worth looking at together: .*Thanks for the work so far\.$/);
  assert.match(f.blunt, /^This draft does not yet test the checkout flow\. Change it\.$/);
  assert.doesNotMatch(core('Brilliant, the login page is genius'), /brilliant|genius/i);
});

test('gauge-feedback: only statements about the work reach the permanent record', () => {
  const r = review(parseFeedback('clean this feedback: You always miss the deadline. You are a genius! The login page is slow. As your manager I am disappointed. | work: login page deadline'));
  assert.equal(r.items.length, 4);
  assert.deepEqual(r.items.map((i) => i.keep), [true, false, true, false]);
  assert.equal(r.record.length, 2);
  assert.ok(r.record.every((x) => !/genius|manager/.test(x)));
  assert.ok(r.items[1].flagged && r.items[1].ego.flattery.length);
  // no work text: nothing survives and the card asks for it
  const none = review({ feedback: 'The login page is slow.', work: '' });
  assert.equal(none.needsWork, true); assert.deepEqual(none.record, []);
});

test('gauge-feedback: routing', () => {
  routes(gauge, ['clean this feedback: You always miss the deadline. | work: deadline', 'Clean this feedback you never test the checkout flow'],
    ['give me feedback on my essay', 'clean this room', 'how do I give better feedback', 'clean this feedback']);
  assert.deepEqual(parseFeedback('clean this feedback: the page is slow | work: web page'), { feedback: 'the page is slow', work: 'web page' });
});
