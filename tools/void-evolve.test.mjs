import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { weakest, baselineRouter, routerFor, cycle, record } from './void-evolve.mjs';
import { seedFromBench, append } from './evolve-bank.mjs';

const skills = [
  { name: 'throw-off', examples: ['throw it off the screen'], match: (l, t) => /throw it off the screen/.test(t) },
  { name: 'weather', examples: ['weather in paris'], match: (l) => /weather/.test(l) },
  { name: 'tidy-up', examples: ['clear the screen'], match: (l) => /clear the screen/.test(l) },
];
const bench = [{ ask: 'weather in paris', want: 'skill:weather' }, { ask: 'clear the screen', want: 'skill:tidy-up' }];

test('the least proven skill is the one with no benchmark and few examples', () => {
  assert.equal(weakest(skills, bench), 'throw-off');
});

test('a candidate pattern is applied at its skill, not ahead of the whole order', () => {
  const baseline = baselineRouter(skills);
  assert.equal(baseline('weather in paris'), 'weather');
  const router = routerFor([skills[1], skills[0], skills[2]], { skill: 'throw-off', patterns: ['^weather in paris$'], flags: 'i' });
  assert.equal(router('weather in paris'), 'weather', 'a throw-off pattern cannot steal a weather ask');
  assert.equal(router('chuck it off the screen'), null);
});

test('a full cycle picks a champion and proposes only the asks it now answers', async () => {
  const cases = [
    { ask: 'chuck it off the screen', want: 'skill:throw-off' },
    { ask: 'weather in paris', want: 'skill:weather' },
  ];
  const report = await cycle({ skills, bench, bank: seedFromBench(bench), cases, target: 'throw-off', now: '2026-11-18T00:00:00Z' });
  assert.equal(report.target, 'throw-off');
  assert.equal(report.missed, 1);
  assert.equal(report.ranked.length, 3);
  assert.ok(['conservative', 'adaptive', 'synthesis'].includes(report.champion.strategy));
  assert.deepEqual(report.proposed.map((r) => r.ask), ['chuck it off the screen']);
  const bank = append(seedFromBench(bench), report.proposed, bench);
  assert.equal(bank.rows.length, 1);
});

test('reports only grow', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-report-'));
  const path = resolve(dir, 'void.evolve.json');
  const first = { at: '1', target: 'throw-off' }, second = { at: '2', target: 'weather' };
  assert.equal(record(first, path), 1);
  assert.equal(record(second, path), 2);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), [first, second]);
});
