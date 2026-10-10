// node --test tools/model-bench.test.mjs: the bench refuses a verdict when every call failed (a bad token once printed "keep gemma").
import test from 'node:test'; import assert from 'node:assert/strict';
import { verdict } from './model-bench.mjs';
import { DEFAULT_MODEL } from '../void-live-deploy/lib/router.js';

test('no verdict when every call errored', () => {
  const rows = [DEFAULT_MODEL, '@cf/x/y'].map((model) => ({ model, total: 37, correct: 0, errors: 37, byKind: {}, ttft: null }));
  const v = verdict(rows);
  assert.equal(v.switchTo, null);
  assert.match(v.why, /^no verdict: every call failed/);
});

test('a normal run still gets a verdict', () => {
  const mk = (model, correct) => ({ model, total: 10, correct, errors: 0, byKind: { fact: correct }, ttft: 500 });
  assert.equal(verdict([mk(DEFAULT_MODEL, 5), mk('@cf/x/y', 9)]).switchTo, '@cf/x/y');
});
