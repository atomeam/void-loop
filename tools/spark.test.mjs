// lib/spark.js: the one sparkline drawer (the Site Test stability trend in skills/growth.js, the self card's growth velocity in lib/self-blocks.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sparkSvg } from '../void-live-deploy/lib/spark.js';
import { sparkSvg as fromGrowth } from '../void-live-deploy/skills/growth.js';

test('spark: the stability sparkline draws as it did from skills/growth.js (0..100 bottom to top, the last point a dot), and growth.js re-exports the same drawer', () => {
  const pts = [{ health: 70 }, { health: 80 }, { health: 90 }], svg = sparkSvg(pts);
  assert.equal(fromGrowth, sparkSvg, 'one drawer: a lib never imports a skill, so the skill imports the lib');
  assert.match(svg, /^<svg class="st-spark" width="72" height="18" viewBox="0 0 72 18" aria-hidden="true"><polyline points="3\.0,6\.2 36\.0,4\.8 69\.0,3\.4" fill="none" stroke="currentColor"/);
  assert.match(svg, /<circle cx="69\.0" cy="3\.4" r="2" fill="currentColor"\/><\/svg>$/);
  assert.ok(!svg.includes('<line'), 'no ticks unless asked');
  assert.equal(sparkSvg([]), ''); assert.equal(sparkSvg(null), '');
  assert.match(sparkSvg([{ health: 50 }]), /<polyline points="69\.0,9\.0"/, 'one point sits at the right edge');
  assert.match(sparkSvg([{ health: 500 }, { health: -5 }]), /points="3\.0,2\.0 69\.0,16\.0"/, 'values are clamped to the scale');
});

test('spark: options read another field, scale to another top, name the class and draw a tick under each point (the growth velocity)', () => {
  const days = [{ n: 0 }, { n: 2 }, { n: 1 }], svg = sparkSvg(days, 84, 18, { key: 'n', max: 2, cls: 'vs-spark', ticks: true });
  assert.match(svg, /^<svg class="vs-spark" width="84" height="18" viewBox="0 0 84 18" aria-hidden="true">/);
  assert.equal((svg.match(/<line class="sp-tick"/g) || []).length, 3, 'a tick a point');
  assert.match(svg, /<line class="sp-tick" x1="3\.0" y1="16" x2="3\.0" y2="18"/);
  assert.match(svg, /<polyline points="3\.0,16\.0 42\.0,2\.0 81\.0,9\.0"/, '0 at the bottom, max at the top, half way between');
  assert.match(svg, /<circle cx="81\.0" cy="9\.0"/);
  assert.match(sparkSvg([{ n: 0 }, { n: 0 }], 84, 18, { key: 'n', max: 1 }), /points="3\.0,16\.0 81\.0,16\.0"/, 'a week of nothing is a flat line along the bottom');
  assert.match(sparkSvg(days, 72, 18, { key: 'n', max: 0 }), /points="3\.0,16\.0 36\.0,15\.7 69\.0,15\.9"/, 'a top of 0 falls back to 100: counts stay in the box');
});
