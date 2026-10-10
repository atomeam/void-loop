// node --test tools/model-switch.test.mjs: from the bake-off's verdict to a change. A challenger that wins under the thresholds
// becomes a PR that sets the answer path's model in lib/models.js, with the table attached and the old model named for a
// one-line revert; a "keep" verdict changes nothing (the workflow only posts the table).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applySwitch, planSwitch, planReviewFollow, applyReviewFollow, pathModel, ledgerLine, reviewFollows } from './model-switch.mjs';
import { PATH_MODELS, FREE_MODEL } from '../void-live-deploy/lib/models.js';

// the live file with every path back on FREE_MODEL: the test is about the tool, not about which model the answer path uses today
const LIVE = fs.readFileSync(new URL('../void-live-deploy/lib/models.js', import.meta.url), 'utf8');
const SRC = ['answer', 'review'].reduce((src, p) => src.replace(new RegExp(`(\\bexport const PATH_MODELS = \\{[^}\\n]*?\\b${p}:\\s*)'[^'\\n]*'`), '$1FREE_MODEL'), LIVE);
const BASE = { ...PATH_MODELS, answer: FREE_MODEL, review: FREE_MODEL }, short = (m) => m.split('/').pop();
const TABLE = '| model | right |\n|:--|--:|\n| `@cf/google/gemma-4-26b-a4b-it` | 30/37 |\n| `@cf/zai-org/glm-4.7-flash` | 34/37 |\n';
const win = { at: '2026-10-10T15:00:00Z', verdict: { switchTo: '@cf/zai-org/glm-4.7-flash', why: '@cf/zai-org/glm-4.7-flash: +4 asks right vs gemma, median first token 80% of its time' }, rows: [{ model: BASE.answer }, { model: '@cf/zai-org/glm-4.7-flash' }] };
const keep = { at: '2026-10-10T15:00:00Z', verdict: { switchTo: null, why: 'keep @cf/google/gemma-4-26b-a4b-it: no challenger …' }, rows: [] };

test('a winning verdict sets the answer path\'s model, and only that path', async () => {
  const { src, from } = applySwitch(SRC, '@cf/zai-org/glm-4.7-flash');
  assert.equal(from, BASE.answer);
  assert.match(src, /answer: '@cf\/zai-org\/glm-4\.7-flash'/);
  const dir = fs.mkdtempSync('/tmp/ms-'); fs.writeFileSync(dir + '/models.js', src);
  const m = await import(dir + '/models.js');
  assert.equal(m.models('answer'), '@cf/zai-org/glm-4.7-flash');
  for (const p of ['will', 'review', 'figurescript']) assert.equal(m.models(p), BASE[p], p + ' keeps its model');
  assert.equal(m.FREE_MODEL, BASE.answer, 'the previous model stays named in the file');
  assert.throws(() => applySwitch(SRC, "x'; process.exit(1); '"), /not a Workers AI model id/);
  assert.throws(() => applySwitch(SRC, BASE.answer), /already/);
  assert.equal(pathModel(SRC, 'answer'), FREE_MODEL); assert.equal(pathModel(applySwitch(SRC, '@cf/zai-org/glm-4.7-flash').src, 'answer'), '@cf/zai-org/glm-4.7-flash');
  assert.equal(pathModel(LIVE, 'answer'), PATH_MODELS.answer, 'the live file reads as it is'); assert.equal(pathModel(LIVE, 'review'), PATH_MODELS.review);
});

test('the PR: branch, title, the table, the previous model and the one-line revert; nothing for a keep', () => {
  const p = planSwitch(win, TABLE, SRC);
  assert.match(p.branch, /^bench\/switch-2026-10-10-glm-4\.7-flash$/);
  assert.match(p.title, /glm-4\.7-flash/);
  assert.ok(p.body.includes(TABLE.trim()), 'the table is in the body');
  assert.match(p.body, new RegExp('Previous model: `' + BASE.answer.replace(/[/.]/g, '\\$&') + '`'));
  assert.match(p.body, /revert/i); assert.match(p.body, /answer: FREE_MODEL/);
  assert.match(p.grow, /glm-4\.7-flash/); assert.match(p.grow, /2026-10-10/);
  assert.equal(planSwitch(keep, TABLE, SRC), null);
  assert.equal(planSwitch({ verdict: { switchTo: '@cf/bad id' }, rows: [] }, TABLE, SRC), null, 'a bad id never becomes a PR');
});

test('every run gets its line in the growth ledger: the date, the models that ran, the verdict', () => {
  assert.equal(ledgerLine(win).slice(0, 80 + short(FREE_MODEL).length), `model bake-off 2026-10-10 (${short(FREE_MODEL)}, glm-4.7-flash): switch to glm-4.7-flash, @cf/zai-org/glm-4.7-flash: +4 asks right vs ge`.slice(0, 80 + short(FREE_MODEL).length));
  assert.ok(ledgerLine({ ...keep, rows: [{ model: BASE.answer }, { model: '@cf/openai/gpt-oss-20b' }] }).startsWith(`model bake-off 2026-10-10 (${short(FREE_MODEL)}, gpt-oss-20b): keep `));
  assert.ok(ledgerLine({ at: '2026-10-10', verdict: { why: 'x'.repeat(999) }, rows: [] }).length < 320);
});

test('the review path follows the winner only when the compliance column says it follows the closer read\'s JSON shape at least as well', async () => {
  const to = '@cf/zai-org/glm-4.7-flash', base = BASE.answer;
  const rows = (b, w) => [{ model: base, comply: b }, { model: to, comply: w }];
  assert.equal(reviewFollows({ rows: rows({ asks: 2, json: 2, quotes: 2, echoes: 0 }, { asks: 2, json: 2, quotes: 2, echoes: 0 }) }, to), true);
  assert.equal(reviewFollows({ rows: rows({ asks: 2, json: 2, quotes: 2, echoes: 0 }, { asks: 2, json: 1, quotes: 1, echoes: 1 }) }, to), false);
  assert.equal(reviewFollows({ rows: [{ model: base }, { model: to }] }, to), false, 'no compliance column: the closer read stays');
  const both = planSwitch({ ...win, rows: rows({ asks: 2, json: 1, quotes: 1, echoes: 0 }, { asks: 2, json: 2, quotes: 2, echoes: 0 }) }, TABLE, SRC);
  assert.equal(both.review, true); assert.match(both.title, /^Answer engine and closer read: switch to/); assert.match(both.body, /PATH_MODELS\.review/); assert.match(both.body, /review: FREE_MODEL/);
  const dir = fs.mkdtempSync('/tmp/ms-'); fs.writeFileSync(dir + '/models.js', applySwitch(SRC, to, { review: true }).src);
  const m = await import(dir + '/models.js');
  assert.equal(m.models('review'), to); assert.equal(m.models('answer'), to); assert.equal(m.models('will'), BASE.will);
  const only = planSwitch(win, TABLE, SRC);
  assert.equal(only.review, false); assert.match(only.title, /^Answer engine: switch to/); assert.match(only.body, /review and figurescript paths are unchanged/);
});

test('a keep where the closer read lags the answer engine: the review path follows when the run shows the answer model complies at least as well', async () => {
  const to = '@cf/zai-org/glm-4.7-flash', lag = applySwitch(SRC, to).src; // the answer path switched earlier, the review path did not
  assert.equal(pathModel(lag, 'answer'), to); assert.equal(pathModel(lag, 'review'), FREE_MODEL);
  const run = (a, r) => ({ at: '2026-10-11T15:00:00Z', verdict: { switchTo: null, why: 'keep ' + to + ': no challenger …' }, rows: [{ model: to, comply: a }, { model: FREE_MODEL, comply: r }] });
  const p = planSwitch(run({ asks: 2, json: 2, quotes: 2, echoes: 0 }, { asks: 2, json: 2, quotes: 1, echoes: 0 }), TABLE, lag);
  assert.ok(p && p.reviewOnly && p.review, 'a review-only plan');
  assert.equal(p.to, to); assert.equal(p.from, FREE_MODEL);
  assert.match(p.branch, /^bench\/review-follow-2026-10-11-glm-4\.7-flash$/); assert.match(p.title, /^Closer read: follow the answer engine to glm-4\.7-flash/);
  assert.match(p.body, /2\/2 valid JSON first time, 2\/2 every quote found, 0 echoes/); assert.match(p.body, /review: FREE_MODEL/); assert.ok(p.body.includes(TABLE.trim()));
  assert.match(p.grow, /the closer read follows the answer engine to glm-4\.7-flash/);
  const dir = fs.mkdtempSync('/tmp/ms-'); fs.writeFileSync(dir + '/models.js', applyReviewFollow(lag, p.to).src);
  const m = await import(dir + '/models.js');
  assert.equal(m.models('review'), to); assert.equal(m.models('answer'), to); assert.equal(m.models('will'), FREE_MODEL); assert.equal(m.FREE_MODEL, FREE_MODEL);
  // equal compliance follows too; worse does not; a missing model, no compliance column or paths that already agree change nothing
  assert.ok(planSwitch(run({ asks: 2, json: 2, quotes: 2, echoes: 0 }, { asks: 2, json: 2, quotes: 2, echoes: 0 }), TABLE, lag));
  assert.equal(planSwitch(run({ asks: 2, json: 1, quotes: 1, echoes: 1 }, { asks: 2, json: 2, quotes: 2, echoes: 0 }), TABLE, lag), null, 'the closer read keeps the model that complies better');
  assert.equal(planSwitch({ ...run({ asks: 2, json: 2, quotes: 2, echoes: 0 }, null), rows: [{ model: to, comply: { asks: 2, json: 2, quotes: 2, echoes: 0 } }] }, TABLE, lag), null, 'the closer read\'s model was not in the run');
  assert.equal(planSwitch({ at: '2026-10-11', verdict: { switchTo: null }, rows: [{ model: to }, { model: FREE_MODEL }] }, TABLE, lag), null, 'no compliance column');
  assert.equal(planSwitch(run({ asks: 2, json: 2, quotes: 2, echoes: 0 }, { asks: 2, json: 2, quotes: 2, echoes: 0 }), TABLE, SRC), null, 'both paths on FREE_MODEL: nothing to follow');
  assert.equal(planReviewFollow(keep, TABLE, SRC), null);
  assert.throws(() => applyReviewFollow(lag, FREE_MODEL), /already/);
});
