// the preview state of summoned intents and the peek flag (asked by Verse, 2026-10-16). node --test tools/intent-preview.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { previewOf, previewHtml, planOf, openPlanOf } from '../void-live-deploy/skills/intent.js';
import { ruleReview } from '../void-live-deploy/lib/code-review.js';
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

test('preview takes only a plan Verse can make', () => {
  assert.equal(previewOf('preview I need to ship the product page by Friday'), 'I need to ship the product page by Friday');
  assert.equal(previewOf('Sketch: make a plan to learn Spanish'), 'make a plan to learn Spanish');
  for (const n of ['preview of the movie', 'preview my essay formatting', 'preview', 'ship the product page by Friday']) assert.equal(previewOf(n), '', n);
});
test('the preview card lists steps and pieces and escapes the goal', () => {
  const plan = planOf('I need to ship <b>x</b> page by Friday', new Date(2026, 9, 16));
  const html = previewHtml(esc, plan);
  assert.ok(!html.includes('<b>x</b>') && /would put up: a countdown to the day/.test(html) && /nothing is on your stage yet/.test(html));
  const open = previewHtml(esc, openPlanOf('make a plan to learn Spanish'));
  assert.match(open, /answer engine/); assert.ok(!/data-deploy[^]*data-deploy/.test(open));
});
test('a quoted line cut at 160 characters says so', () => {
  const long = 'const r = eval("' + 'a'.repeat(220) + '");', short = 'const r = eval(x);';
  const f = ruleReview(long).findings.concat(ruleReview(short).findings);
  assert.ok(f[0].more === true && f[0].text.length === 160);
  assert.ok(!('more' in f[f.length - 1]));
});
