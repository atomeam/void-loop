// The loop census (tools/loop-census.mjs) and the owner's read of it (functions/api/loops.js). Run: node --test tools/loop-census.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatOf, nameOf, slots24, rowOf, census } from './loop-census.mjs';
import { loopsOf, onRequestGet } from '../void-live-deploy/functions/api/loops.js';

const NOW = Date.parse('2026-11-20T21:00:00Z'), H = 3600000;
const run = (hAgo, o = {}) => ({ created_at: new Date(NOW - hAgo * H).toISOString(), run_started_at: new Date(NOW - hAgo * H).toISOString(), updated_at: new Date(NOW - hAgo * H + 120000).toISOString(), status: 'completed', conclusion: 'success', event: 'schedule', ...o });
const YAML = "# The daily check (tools/x.mjs). It reads the site.\n# More words.\nname: daily check\non:\n  schedule:\n    - cron: '17 9 * * *'\n  workflow_dispatch:\n";

test('what a loop is, its name and how often its crons fire', () => {
  assert.equal(whatOf(YAML), 'The daily check (tools/x.mjs).');
  assert.equal(nameOf(YAML, 'x.yml'), 'daily check'); assert.equal(nameOf('on: push', 'x.yml'), 'x.yml');
  assert.equal(slots24(['17 9 * * *'], NOW), 1); assert.equal(slots24(['*/15 * * * *'], NOW), 96); assert.equal(slots24(['7,37 * * * *'], NOW), 48);
});
test('a row: working, behind, failing, late and its minutes', () => {
  const ok = rowOf({ file: 'x.yml', yaml: YAML, runs: [run(2)], now: NOW });
  assert.equal(ok.status, 'working'); assert.equal(ok.ran24, 1); assert.equal(ok.expected24, 1); assert.equal(ok.minutesPerRun, 2); assert.equal(ok.costCentsPerDay, 0);
  assert.equal(ok.lateMin, Math.round((NOW - 2 * H - Date.parse('2026-11-20T09:17:00Z')) / 60000));
  const red = rowOf({ file: 'x.yml', yaml: YAML, runs: [run(1, { conclusion: 'failure' }), run(25, { conclusion: 'failure' }), run(49, { conclusion: 'failure' })], now: NOW });
  assert.equal(red.status, 'failing'); assert.equal(red.streak, 3); assert.equal(red.rate, 0);
  const often = "name: q\non:\n  schedule:\n    - cron: '*/15 * * * *'\n";
  assert.equal(rowOf({ file: 'q.yml', yaml: often, runs: [run(1), run(5)], now: NOW }).status, 'behind');
  assert.equal(rowOf({ file: 'p.yml', yaml: 'on:\n  pull_request:\n', runs: [], now: NOW }).status, 'on pull requests');
  assert.equal(rowOf({ file: 'p.yml', yaml: YAML, runs: [], now: NOW, unread: true }).status, 'unread');
  const c = census([ok, red], NOW);
  assert.equal(c.rows[0].status, 'failing'); assert.equal(c.loops, 2); assert.equal(c.failing, 1); assert.equal(c.costCents24, 0);
});
test('the owner reads the census; anyone else gets a missing page', async () => {
  const rec = { updated: 'u', census: { loops: 1, rows: [] }, ticks: [{ at: 'a', catchup: ['x.yml'], cancelled: ['x.yml#1'] }, { at: 'b' }] };
  const v = loopsOf(rec);
  assert.equal(v.census.loops, 1); assert.equal(v.clock.caughtUp24, 1); assert.equal(v.clock.cancelled24, 1); assert.deepEqual(loopsOf(null).clock.caught, []);
  const r = await onRequestGet({ request: new Request('https://a-to-mind.com/api/loops'), env: {} }, async () => { throw new Error('not reached'); });
  assert.equal(r.status, 404);
});
