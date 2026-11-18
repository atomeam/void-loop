import test from 'node:test';
import assert from 'node:assert/strict';
import { fitness, evaluate, runTournament, wantsOf } from './evolve-tournament.mjs';

const cases = [
  { ask: 'chuck it off the screen', want: 'skill:throw-off' },
  { ask: 'fling it off the screen', want: 'skill:throw-off' },
  { ask: 'show the data flows', want: 'skill:connect-flows' },
];
const bank = [{ ask: 'weather in paris', want: 'skill:weather' }];
const order = ['throw-off', 'connect-flows', 'weather'];
const baseline = (a) => (/weather/.test(a) ? 'weather' : null);
const good = (a) => (/off the screen/.test(a) ? 'throw-off' : (/data flows/.test(a) ? 'connect-flows' : baseline(a)));

test('wants accept skill names, alternatives and row objects', () => {
  assert.deepEqual(wantsOf('skill:calc|holiday'), ['calc', 'holiday']);
  assert.deepEqual(wantsOf({ want: 'weather' }), ['weather']);
});

test('the kill switches zero a candidate no matter how accurate it is', () => {
  const perfect = { accuracy: 1, latencyMs: 1, depth: 1 };
  assert.equal(fitness({ ...perfect, newlyBroken: 1 }), 0);
  assert.equal(fitness({ ...perfect, depth: 10 }), 0);
  assert.equal(fitness({ ...perfect, turns: 6 }), 0);
  assert.equal(fitness({ ...perfect, reads: 9 }), 0);
  assert.ok(fitness(perfect) > 0);
});

test('the entropy tax favours a small generalizing pattern over a regex dump', () => {
  const small = fitness({ accuracy: 1, latencyMs: 1, depth: 2, addedChars: 20, patterns: 1 });
  const huge = fitness({ accuracy: 1, latencyMs: 1, depth: 2, addedChars: 900, patterns: 6 });
  assert.ok(small > huge, small + ' should beat ' + huge);
});

test('regression counts only banked asks this candidate newly broke', () => {
  const broken = evaluate({ router: (a) => (/screen/.test(a) ? 'throw-off' : baseline(a)), baseline, cases, bank, order, candidate: { patterns: ['screen'] } });
  assert.equal(broken.newlyBroken, 0);
  const steals = evaluate({ router: (a) => (/weather|paris/.test(a) ? 'connect-flows' : baseline(a)), baseline, cases, bank, order, candidate: { patterns: ['weather'] } });
  assert.equal(steals.newlyBroken, 1);
});

test('the tournament ranks candidates and promotes only a survivor above threshold', () => {
  const candidates = [
    { strategy: 'good', skill: 'throw-off', patterns: ['off the screen'], addedChars: 13 },
    { strategy: 'broad', skill: 'throw-off', patterns: ['the'], addedChars: 3 },
  ];
  const t = runTournament({ routerFor: (c) => (c.strategy === 'good' ? good : (a) => (/the/.test(a) ? 'throw-off' : baseline(a))), baseline, cases, bank, order, target: 'throw-off', candidates });
  assert.equal(t.ranked[0].candidate.strategy, 'good');
  assert.equal(t.champion.candidate.strategy, 'good');
  const strict = runTournament({ routerFor: () => good, baseline, cases, bank, order, target: 'throw-off', candidates, threshold: 1.01 });
  assert.equal(strict.champion, null);
});
