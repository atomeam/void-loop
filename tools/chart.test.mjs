import assert from 'node:assert/strict';
import test from 'node:test';
import skill, { chartOf, parseRows, svgOf, csvOf, isChartAsk } from '../void-live-deploy/skills/chart.js';

const ASK = 'make a bar chart from apples 12, oranges 7, bananas 15';

test('the live ask becomes a bar chart of three fruits, not code', () => {
  const q = chartOf(ASK);
  assert.equal(q.kind, 'bar');
  assert.deepEqual(q.rows, [
    { label: 'apples', value: 12 },
    { label: 'oranges', value: 7 },
    { label: 'bananas', value: 15 },
  ]);
  assert.equal(q.needsData, false);
  const svg = svgOf(q);
  assert.match(svg, /<svg\b/);
  assert.match(svg, /apples/);
  assert.match(svg, /<rect\b/);
  assert.doesNotMatch(svg, /matplotlib/);
  assert.match(csvOf(q), /"apples",12/);
});

test('pie and line reads, and a chart with no numbers asks for them', () => {
  const pie = chartOf('pie chart of Q1 40, Q2 35, Q3 25');
  assert.equal(pie.kind, 'pie');
  assert.equal(pie.rows.length, 3);
  assert.match(svgOf(pie), /<path\b/);
  const line = chartOf('line chart jan 10, feb 14, mar 9');
  assert.equal(line.kind, 'line');
  assert.match(svgOf(line), /<polyline\b/);
  const empty = chartOf('make a bar chart');
  assert.equal(empty.needsData, true);
  assert.equal(empty.rows.length, 0);
});

test('look-alikes stay with other skills', () => {
  for (const t of skill.nearMisses) assert.equal(isChartAsk(t), false, t);
  assert.equal(chartOf('what is a bar chart'), null);
  assert.equal(chartOf('organization chart'), null);
  assert.equal(chartOf('apple stock chart'), null);
  assert.equal(chartOf('chart a course to bermuda'), null);
  assert.equal(chartOf("verse's growth chart"), null);
  assert.equal(chartOf('make a picture of a chart'), null);
});

test('examples match, and the suite agrees', () => {
  for (const e of skill.examples) assert.equal(isChartAsk(e), true, e);
  assert.equal(parseRows(ASK).length, 3);
  const s = skill.suite();
  assert.equal(s.ok, true, s.got);
});
