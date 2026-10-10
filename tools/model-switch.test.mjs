// node --test tools/model-switch.test.mjs: from the bake-off's verdict to a change. A challenger that wins under the thresholds
// becomes a PR that sets the answer path's model in lib/models.js, with the table attached and the old model named for a
// one-line revert; a "keep" verdict changes nothing (the workflow only posts the table).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applySwitch, planSwitch, ledgerLine, reviewFollows } from './model-switch.mjs';
import { PATH_MODELS } from '../void-live-deploy/lib/models.js';

const SRC = fs.readFileSync(new URL('../void-live-deploy/lib/models.js', import.meta.url), 'utf8');
const TABLE = '| model | right |\n|:--|--:|\n| `@cf/google/gemma-4-26b-a4b-it` | 30/37 |\n| `@cf/zai-org/glm-4.7-flash` | 34/37 |\n';
const win = { at: '2026-10-10T15:00:00Z', verdict: { switchTo: '@cf/zai-org/glm-4.7-flash', why: '@cf/zai-org/glm-4.7-flash: +4 asks right vs gemma, median first token 80% of its time' }, rows: [{ model: PATH_MODELS.answer }, { model: '@cf/zai-org/glm-4.7-flash' }] };
const keep = { at: '2026-10-10T15:00:00Z', verdict: { switchTo: null, why: 'keep @cf/google/gemma-4-26b-a4b-it: no challenger …' }, rows: [] };

test('a winning verdict sets the answer path\'s model, and only that path', async () => {
  const { src, from } = applySwitch(SRC, '@cf/zai-org/glm-4.7-flash');
  assert.equal(from, PATH_MODELS.answer);
  assert.match(src, /answer: '@cf\/zai-org\/glm-4\.7-flash'/);
  const dir = fs.mkdtempSync('/tmp/ms-'); fs.writeFileSync(dir + '/models.js', src);
  const m = await import(dir + '/models.js');
  assert.equal(m.models('answer'), '@cf/zai-org/glm-4.7-flash');
  for (const p of ['will', 'review', 'figurescript']) assert.equal(m.models(p), PATH_MODELS[p], p + ' keeps its model');
  assert.equal(m.FREE_MODEL, PATH_MODELS.answer, 'the previous model stays named in the file');
  assert.throws(() => applySwitch(SRC, "x'; process.exit(1); '"), /not a Workers AI model id/);
  assert.throws(() => applySwitch(SRC, PATH_MODELS.answer), /already/);
});

test('the PR: branch, title, the table, the previous model and the one-line revert; nothing for a keep', () => {
  const p = planSwitch(win, TABLE, SRC);
  assert.match(p.branch, /^bench\/switch-2026-10-10-glm-4\.7-flash$/);
  assert.match(p.title, /glm-4\.7-flash/);
  assert.ok(p.body.includes(TABLE.trim()), 'the table is in the body');
  assert.match(p.body, new RegExp('Previous model: `' + PATH_MODELS.answer.replace(/[/.]/g, '\\$&') + '`'));
  assert.match(p.body, /revert/i); assert.match(p.body, /answer: FREE_MODEL/);
  assert.match(p.grow, /glm-4\.7-flash/); assert.match(p.grow, /2026-10-10/);
  assert.equal(planSwitch(keep, TABLE, SRC), null);
  assert.equal(planSwitch({ verdict: { switchTo: '@cf/bad id' }, rows: [] }, TABLE, SRC), null, 'a bad id never becomes a PR');
});

test('every run gets its line in the growth ledger: the date, the models that ran, the verdict', () => {
  assert.match(ledgerLine(win), /^model bake-off 2026-10-10 \(gemma-4-26b-a4b-it, glm-4\.7-flash\): switch to glm-4\.7-flash, /);
  assert.match(ledgerLine({ ...keep, rows: [{ model: PATH_MODELS.answer }, { model: '@cf/openai/gpt-oss-20b' }] }), /^model bake-off 2026-10-10 \(gemma-4-26b-a4b-it, gpt-oss-20b\): keep /);
  assert.ok(ledgerLine({ at: '2026-10-10', verdict: { why: 'x'.repeat(999) }, rows: [] }).length < 320);
});

test('the review path follows the winner only when the compliance column says it follows the closer read\'s JSON shape at least as well', async () => {
  const to = '@cf/zai-org/glm-4.7-flash', base = PATH_MODELS.answer;
  const rows = (b, w) => [{ model: base, comply: b }, { model: to, comply: w }];
  assert.equal(reviewFollows({ rows: rows({ asks: 2, json: 2, quotes: 2, echoes: 0 }, { asks: 2, json: 2, quotes: 2, echoes: 0 }) }, to), true);
  assert.equal(reviewFollows({ rows: rows({ asks: 2, json: 2, quotes: 2, echoes: 0 }, { asks: 2, json: 1, quotes: 1, echoes: 1 }) }, to), false);
  assert.equal(reviewFollows({ rows: [{ model: base }, { model: to }] }, to), false, 'no compliance column: the closer read stays');
  const both = planSwitch({ ...win, rows: rows({ asks: 2, json: 1, quotes: 1, echoes: 0 }, { asks: 2, json: 2, quotes: 2, echoes: 0 }) }, TABLE, SRC);
  assert.equal(both.review, true); assert.match(both.title, /^Answer engine and closer read: switch to/); assert.match(both.body, /PATH_MODELS\.review/); assert.match(both.body, /review: FREE_MODEL/);
  const dir = fs.mkdtempSync('/tmp/ms-'); fs.writeFileSync(dir + '/models.js', applySwitch(SRC, to, { review: true }).src);
  const m = await import(dir + '/models.js');
  assert.equal(m.models('review'), to); assert.equal(m.models('answer'), to); assert.equal(m.models('will'), PATH_MODELS.will);
  const only = planSwitch(win, TABLE, SRC);
  assert.equal(only.review, false); assert.match(only.title, /^Answer engine: switch to/); assert.match(only.body, /review and figurescript paths are unchanged/);
});
