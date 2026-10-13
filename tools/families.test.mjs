import test from 'node:test';
import assert from 'node:assert/strict';
import { ratingOf, build, evidence, FAMILIES } from './families.mjs';
import { familyFacts } from '../void-live-deploy/lib/voice.js';

test('a rating is earned from evidence: one kind tested, two checked, three (or two with 3+ real asks) proven, none an experiment', () => {
  assert.equal(ratingOf({}).tier, 'experiment');
  assert.equal(ratingOf({ suite: true }).tier, 'tested');
  assert.equal(ratingOf({ suite: true, browser: 2 }).tier, 'checked');
  assert.equal(ratingOf({ browser: 1, bench: 34 }).tier, 'proven');
  assert.equal(ratingOf({ suite: true, browser: 1, bench: 1 }).tier, 'proven');
  assert.match(ratingOf({ suite: true, bench: 3 }).why, /a self-test, 3 real asks/);
});

test('evidence is read off the repo: suite(), a unit test of the skill or its rules, both browser suites, benchmark asks', () => {
  const files = {
    'tools/test_void.mjs': 'check(\'weather: rain\', ok); want("how Void is different: canon")', 'tools/test_3d.mjs': 'want("3d: chess and checkers")', 'tools/test_extension.mjs': '',
    'tools/bench.json': JSON.stringify([{ ask: 'a', want: 'skill:weather' }, { ask: 'b', want: 'calc|answer' }]),
    'tools/poker.test.mjs': "import * as P from '../void-live-deploy/skills/poker-rules.js';",
    'void-live-deploy/skills/draw.js': 'export default { suite() { return 1; } }',
  };
  const read = (p) => { if (p in files) return files[p]; throw new Error('no ' + p); };
  const ev = evidence(['weather', 'calc', 'chess', 'checkers', 'poker', 'draw', 'different', 'tab'], read, () => ['poker.test.mjs']);
  assert.deepEqual(ev.weather, { suite: false, browser: 1, bench: 1 });
  assert.equal(ev.calc.bench, 1); assert.equal(ev.chess.browser, 1); assert.equal(ev.checkers.browser, 1);
  assert.equal(ev.poker.suite, true); assert.equal(ev.draw.suite, true); assert.equal(ev.different.browser, 1);
  assert.deepEqual(ev.tab, { suite: false, browser: 0, bench: 0 });
});

test('every skill sits in one family; one in no family, or a family member that is not a skill, is reported', () => {
  const all = FAMILIES.flatMap((f) => f.skills);
  assert.equal(new Set(all).size, all.length, 'no skill is in two families');
  const b = build([...all.filter((n) => n !== 'go'), 'brand-new'], {});
  assert.deepEqual(b.unplaced, ['brand-new']); assert.deepEqual(b.missing, ['go']);
  assert.equal(b.totals.experiment, all.length - 1);
});

test('Void reads its families before it reflects', () => {
  const fam = { totals: { proven: 1, checked: 0, tested: 1, experiment: 1 }, families: [
    { name: 'Games', count: { proven: 1 }, skills: [{ name: 'go', tier: 'proven' }, { name: 'chess', tier: 'tested' }] },
    { name: 'Sky', count: { proven: 0 }, skills: [{ name: 'moon', tier: 'experiment' }] }] };
  const line = familyFacts(fam);
  assert.match(line, /3 skills in 2 families, 1 proven/); assert.match(line, /1 experiment\./); assert.match(line, /Least proven family: Sky/); assert.match(line, /chess, moon/);
  assert.equal(familyFacts(null), '');
});

test('friction (Void\'s ask): the asks the bench got wrong on main are each skill\'s failing asks, on its row in families.json', () => {
  const files = {
    'tools/test_void.mjs': '', 'tools/test_3d.mjs': '', 'tools/test_extension.mjs': '',
    'tools/bench.json': JSON.stringify([{ ask: 'Weather in Oslo', want: 'skill:weather' }, { ask: 'rain later', want: 'skill:weather' }, { ask: '15% of 80', want: 'calc|answer' }, { ask: 'set a timer', want: 'timer' }]),
    'tools/bench.misses.json': JSON.stringify({ misses: ['weather in oslo -> skill:place', '15% of 80 -> answer', 'an ask no longer in the bench -> x'] }),
  };
  const read = (p) => { if (p in files) return files[p]; throw new Error('no ' + p); };
  const ev = evidence(['weather', 'calc', 'timer'], read, () => []);
  assert.deepEqual(ev.weather.failing, ['Weather in Oslo']);
  assert.deepEqual(ev.calc.failing, ['15% of 80']);
  assert.equal('failing' in ev.timer, false, 'nothing missed: no field, so families.json is unchanged');
  const none = evidence(['weather'], (p) => (p === 'tools/bench.misses.json' ? JSON.stringify({ misses: null }) : read(p)), () => []);
  assert.equal('failing' in none.weather, false, 'misses not recorded yet');
  const b = build(['weather', 'calc', 'timer'], ev);
  const row = (n) => b.families.flatMap((f) => f.skills).find((s) => s.name === n);
  assert.deepEqual(row('weather').failing, ['Weather in Oslo']);
  assert.equal(row('timer').failing, undefined);
});
