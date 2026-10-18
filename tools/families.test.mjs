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
    'tools/test_void.mjs': 'check(\'weather: rain\', ok); want("how Verse is different: canon")', 'tools/test_3d.mjs': 'want("3d: chess and checkers")', 'tools/test_extension.mjs': '',
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

test('Verse reads its families before it reflects', () => {
  const fam = { totals: { proven: 1, checked: 0, tested: 1, experiment: 1 }, families: [
    { name: 'Games', count: { proven: 1 }, skills: [{ name: 'go', tier: 'proven' }, { name: 'chess', tier: 'tested' }] },
    { name: 'Sky', count: { proven: 0 }, skills: [{ name: 'moon', tier: 'experiment' }] }] };
  const line = familyFacts(fam);
  assert.match(line, /3 skills in 2 families, 1 proven/); assert.match(line, /1 experiment\./); assert.match(line, /Least proven family: Sky/); assert.match(line, /chess, moon/);
  assert.equal(familyFacts(null), '');
});

test('friction (Verse\'s ask): the asks the bench got wrong on main are each skill\'s failing asks, on its row in families.json', () => {
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

test('last_tested and success_rate (asked by Verse, ask-20261013-1823-1): from evidence dates only, carried while unchanged, never from usage', async () => {
  const { benchRun, successRate, lastTested, build: B } = await import('./families.mjs');
  // the bench's last run: the misses file when recorded, else the run that set the floor; nothing recorded is said so
  const files = {
    'tools/bench.misses.json': JSON.stringify({ at: '2026-10-14T03:00:00Z', misses: ['x -> y'] }),
    'tools/bench.best.json': JSON.stringify({ date: '2026-10-11', latency: { ci: { at: '2026-10-11T16:20:28.715Z' } } }),
  };
  const read = (p) => { if (p in files) return files[p]; throw new Error('no ' + p); };
  assert.deepEqual(benchRun(read), { at: '2026-10-14', recorded: true });
  assert.deepEqual(benchRun((p) => (p === 'tools/bench.misses.json' ? JSON.stringify({ at: '', misses: null }) : read(p))), { at: '2026-10-11', recorded: false });
  assert.deepEqual(benchRun(() => { throw new Error('none'); }), { at: '', recorded: false });
  // success rate: passing routed asks over all routed; unknown until the misses are recorded, or with no ask routed
  assert.equal(successRate({ bench: 30, failing: ['a'] }, true), 0.967);
  assert.equal(successRate({ bench: 4 }, true), 1);
  assert.equal(successRate({ bench: 4, failing: ['a'] }, false), null);
  assert.equal(successRate({ bench: 0 }, true), null);
  // last tested: the newer of its tests (today when they changed since the last file, else carried) and the bench's run
  const bench = { at: '2026-10-14', recorded: true }, today = '2026-10-16';
  assert.equal(lastTested({}, 'nothing checks it yet', null, today, bench), null, 'no evidence, no date');
  assert.deepEqual(lastTested({ suite: true }, 'a self-test', null, today, bench), { at: today, by: 'its tests' });
  assert.deepEqual(lastTested({ suite: true }, 'a self-test', { why: 'a self-test', last_tested: '2026-10-12', last_tested_by: 'its tests' }, today, bench), { at: '2026-10-12', by: 'its tests' }, 'unchanged tests keep their date');
  assert.deepEqual(lastTested({ suite: true, browser: 2 }, 'a self-test, 2 browser-suite mentions', { why: 'a self-test', last_tested: '2026-10-12', last_tested_by: 'its tests' }, today, bench), { at: today, by: 'its tests' }, 'a new browser check is new evidence');
  assert.deepEqual(lastTested({ suite: true, bench: 3 }, 'a self-test, 3 real asks in the benchmark', { why: 'a self-test, 3 real asks in the benchmark', last_tested: '2026-10-12', last_tested_by: 'its tests' }, today, bench), { at: '2026-10-14', by: 'the benchmark' }, 'the bench ran later');
  assert.deepEqual(lastTested({ suite: true, bench: 4 }, 'a self-test, 4 real asks in the benchmark', { why: 'a self-test, 3 real asks in the benchmark', last_tested: '2026-10-14', last_tested_by: 'the benchmark' }, today, bench), { at: '2026-10-14', by: 'the benchmark' }, 'a tie keeps what the file said, so --check is stable');
  assert.deepEqual(lastTested({ bench: 2 }, '2 real asks in the benchmark', null, today, { at: '', recorded: false }), null, 'a bench with no recorded run gives no date');
  // the rows: a regeneration with nothing changed is byte-identical (the --check in tools/checks.mjs leans on it)
  const ev = { weather: { suite: true, browser: 1, bench: 2, failing: ['rain'] }, tab: { suite: false, browser: 0, bench: 0 } };
  const b1 = B(['weather', 'tab'], ev, { prev: null, bench, today });
  const row = (b, n) => b.families.flatMap((f) => f.skills).find((s) => s.name === n);
  assert.deepEqual(row(b1, 'weather'), { name: 'weather', tier: 'proven', why: 'a self-test, 1 browser-suite mention, 2 real asks in the benchmark', failing: ['rain'], last_tested: today, last_tested_by: 'its tests', success_rate: 0.5 });
  assert.deepEqual(row(b1, 'tab'), { name: 'tab', tier: 'experiment', why: 'nothing checks it yet' });
  const b2 = B(['weather', 'tab'], ev, { prev: { families: b1.families }, bench, today: '2026-10-20' });
  assert.deepEqual(row(b2, 'weather'), row(b1, 'weather'), 'four days later, nothing changed: the same row');
  for (const s of b1.families.flatMap((f) => f.skills)) for (const k of Object.keys(s)) assert.doesNotMatch(k, /usage|popular|used/, 'no behaviour tracking');
});

test('the daily smoke test (asked by Verse, ask-20261013-1823-2): a failing skill loses its self-test evidence and carries the reasons; a passing one was tested that day', async () => {
  const { smokeRun, evidence: ev2, build: B2, lastTested: LT } = await import('./families.mjs');
  const files = {
    'tools/test_void.mjs': '', 'tools/test_3d.mjs': '', 'tools/test_extension.mjs': '', 'tools/bench.json': '[]',
    'tools/skills-smoke.json': JSON.stringify({ at: '2026-10-17', checked: 2, failing: { weather: ['"rain later" -> place', 'suite got x'] } }),
    'void-live-deploy/skills/weather.js': 'export default { suite() { return { ok: true }; } }', 'void-live-deploy/skills/clock.js': 'export default { suite() { return { ok: true }; } }',
  };
  const read = (p) => { if (p in files) return files[p]; throw new Error('no ' + p); };
  assert.deepEqual(smokeRun(read), { at: '2026-10-17', failing: { weather: ['"rain later" -> place', 'suite got x'] }, streak: {} });
  assert.deepEqual(smokeRun(() => { throw new Error('none'); }), { at: '', failing: {}, streak: {} });
  const e = ev2(['weather', 'clock'], read, () => []);
  assert.deepEqual(e.weather, { suite: false, browser: 0, bench: 0, smoke: ['"rain later" -> place', 'suite got x'] }, 'its own test does not count while the smoke test fails it');
  assert.deepEqual(e.clock, { suite: true, browser: 0, bench: 0 });
  const smoke = smokeRun(read), today = '2026-10-18';
  const b = B2(['weather', 'clock'], e, { prev: null, bench: { at: '', recorded: false }, smoke, today });
  const row = (n) => b.families.flatMap((f) => f.skills).find((s) => s.name === n);
  assert.equal(row('weather').tier, 'experiment'); assert.deepEqual(row('weather').smoke, ['"rain later" -> place', 'suite got x']); assert.equal(row('weather').last_tested, undefined, 'no passing test, no date');
  assert.equal(row('clock').tier, 'tested'); assert.deepEqual([row('clock').last_tested, row('clock').last_tested_by], ['2026-10-18', 'its tests'], 'its tests changed today (first file), newer than the smoke run');
  const b2 = B2(['weather', 'clock'], e, { prev: { families: b.families }, bench: { at: '', recorded: false }, smoke: { ...smoke, at: '2026-10-20' }, today: '2026-10-21' });
  const c2 = b2.families.flatMap((f) => f.skills).find((s) => s.name === 'clock');
  assert.deepEqual([c2.last_tested, c2.last_tested_by], ['2026-10-20', 'the daily smoke test'], 'a later smoke run is the newest test of a passing skill');
  assert.equal(LT({ suite: false, smoke: ['x'] }, 'nothing checks it yet', null, today, { at: '' }, { at: '2026-10-17' }), null, 'a smoke failure gives no date: its self-test does not count and the smoke run did not pass it');
});

test('live evidence (the owner, 2026-10-16): a kept ok artifact of a real call is a fourth kind; fresh, it makes two kinds proven; stale, it still counts as a kind', async () => {
  const { liveFindings, ratingOf: R, evidence: E, LIVE_FRESH_DAYS } = await import('./families.mjs');
  const dir = { rides: ['2026-10-16T0341.json', '2026-10-15T0341.json', 'notes.txt'], social: ['2026-10-01T0100.json'] };
  const files = {
    'findings/rides/2026-10-16T0341.json': JSON.stringify({ attempt: 'live', ok: true, at: '2026-10-16T03:41:41.364Z', skill: 'rides' }),
    'findings/rides/2026-10-15T0341.json': JSON.stringify({ attempt: 'live', ok: false, at: '2026-10-15T03:41:00Z', error: 'timeout' }),
    'findings/social/2026-10-01T0100.json': JSON.stringify({ attempt: 'live', ok: true, at: '2026-10-01T01:00:00Z' }),
    'tools/test_void.mjs': '', 'tools/test_3d.mjs': '', 'tools/test_extension.mjs': '', 'tools/bench.json': '[]',
    'void-live-deploy/skills/rides.js': 'export default { suite() { return { ok: true }; } }', 'void-live-deploy/skills/social.js': 'export default { suite() { return { ok: true }; } }', 'void-live-deploy/skills/dating.js': 'export default { suite() { return { ok: true }; } }',
  };
  const read = (p) => { if (p in files) return files[p]; throw new Error('no ' + p); };
  assert.deepEqual(liveFindings('rides', (s) => dir[s], read), { n: 1, at: '2026-10-16' }, 'a failed call and a non-JSON file do not count');
  assert.deepEqual(liveFindings('dating', (s) => dir[s], read), { n: 0, at: '' });
  const ev = E(['rides', 'social', 'dating'], read, () => [], (s) => dir[s]);
  assert.deepEqual(ev.rides, { suite: true, browser: 0, bench: 0, live: 1, liveAt: '2026-10-16' });
  assert.deepEqual(ev.dating, { suite: true, browser: 0, bench: 0 }, 'no findings dir: no live field, the row is unchanged');
  const today = '2026-10-16';
  assert.deepEqual(R(ev.rides, today), { tier: 'proven', why: 'a self-test, 1 live finding, 2026-10-16' }, 'two kinds, one a fresh live finding: proven');
  assert.equal(R(ev.social, today).tier, 'checked', 'a live finding ' + LIVE_FRESH_DAYS + '+ days old is a kind, not the fresh-live rule');
  assert.equal(R(ev.rides, '2026-10-24').tier, 'checked', 'eight days on, no new finding: back to checked');
  assert.equal(R({ live: 2, liveAt: today }, today).tier, 'tested', 'live alone is one kind');
  assert.equal(R({ suite: true, browser: 1, live: 1, liveAt: '2026-01-01' }, today).tier, 'proven', 'three kinds, stale live included');
  assert.equal(R({ suite: true, browser: 1, bench: 1 }, today).tier, 'proven', 'the three repo kinds still make proven: nothing already proven drops');
  const b = (await import('./families.mjs')).build(['rides', 'social', 'dating'], ev, { prev: null, bench: { at: '', recorded: false }, smoke: { at: '', failing: {} }, today });
  const row = (n) => b.families.flatMap((f) => f.skills).find((s) => s.name === n);
  assert.deepEqual([row('rides').tier, row('rides').last_tested, row('rides').last_tested_by], ['proven', '2026-10-16', 'a live call']);
  const b2 = (await import('./families.mjs')).build(['rides', 'social', 'dating'], ev, { prev: { families: b.families }, bench: { at: '', recorded: false }, smoke: { at: '', failing: {} }, today: '2026-10-17' });
  assert.deepEqual(row('rides'), b2.families.flatMap((f) => f.skills).find((s) => s.name === 'rides'), 'a day later, nothing changed: the same row');
});

test('the 7-day re-test (asked by Verse): a pass dates the skill, a failure joins smoke as re-test lines and drops its self-test', async () => {
  const { retestRun, evidence: E, build: B } = await import('./families.mjs');
  const files = {
    'tools/retest.json': JSON.stringify({ at: '2026-10-20', retested: { clock: { ok: true, failing: [], test: 'clock.test.mjs' }, timer: { ok: false, failing: ['"high timer" -> weather'], test: null } } }),
    'tools/test_void.mjs': '', 'tools/test_3d.mjs': '', 'tools/test_extension.mjs': '', 'tools/bench.json': '[]',
    'void-live-deploy/skills/clock.js': 'export default { suite() { return { ok: true }; } }', 'void-live-deploy/skills/timer.js': 'export default { suite() { return { ok: true }; } }',
  };
  const read = (p) => { if (p in files) return files[p]; throw new Error('no ' + p); };
  const R = retestRun(read);
  assert.deepEqual([R.at, [...R.passed], R.failing], ['2026-10-20', ['clock'], { timer: ['re-test: "high timer" -> weather'] }]);
  assert.deepEqual(retestRun(() => { throw new Error('none'); }).at, '');
  const ev = E(['clock', 'timer'], read, () => [], () => []);
  assert.deepEqual(ev.timer, { suite: false, browser: 0, bench: 0, smoke: ['re-test: "high timer" -> weather'] });
  const b = B(['clock', 'timer'], ev, { prev: null, bench: { at: '', recorded: false }, smoke: { at: '', failing: {} }, retest: R, today: '2026-10-21' });
  const row = (n) => b.families.flatMap((f) => f.skills).find((s) => s.name === n);
  assert.deepEqual([row('clock').last_tested, row('clock').last_tested_by], ['2026-10-21', 'its tests'], 'its tests are newer (first file); the re-test date is a candidate');
  const b2 = B(['clock', 'timer'], ev, { prev: { families: b.families }, bench: { at: '', recorded: false }, smoke: { at: '', failing: {} }, retest: { ...R, at: '2026-10-28' }, today: '2026-10-29' });
  assert.deepEqual([row('clock').last_tested, b2.families.flatMap((f) => f.skills).find((s) => s.name === 'clock').last_tested_by], ['2026-10-21', 'a re-test'], 'a week on, the re-test is its newest test');
  assert.equal(row('timer').tier, 'experiment'); assert.equal(row('timer').last_tested, undefined);
});

// promotion and clean-run streaks (asked by Verse: "a 'skill-stability' metric ... consecutive successful runs for all newly promoted skills")
{
  const { promotedOn, build, smokeRun } = await import('./families.mjs');
  assert.equal(promotedOn('checked', { tier: 'tested' }, '2026-10-16'), '2026-10-16', 'a higher rating than the last file is a promotion today');
  assert.equal(promotedOn('checked', { tier: 'checked', promoted: '2026-10-10' }, '2026-10-16'), '2026-10-10', 'the day is carried while the rating holds');
  assert.equal(promotedOn('tested', { tier: 'checked', promoted: '2026-10-10' }, '2026-10-16'), null, 'a demotion keeps no promotion');
  assert.equal(promotedOn('checked', { tier: 'checked', promoted: '2026-07-01' }, '2026-10-16'), null, 'old promotions fall away after 60 days');
  assert.equal(promotedOn('tested', null, '2026-10-16'), null, 'a first rating is not a promotion');
  const prev = { families: [{ skills: [{ name: 'timer', tier: 'tested' }] }] };
  const b = build(['timer'], { timer: { suite: true, browser: 1, bench: 0 } }, { prev, smoke: { at: '2026-10-16', failing: {}, streak: { timer: 4 } }, today: '2026-10-16' });
  const row = b.families.flatMap((f) => f.skills).find((x) => x.name === 'timer');
  assert.ok(row && (row.tier === 'checked' && row.promoted === '2026-10-16' && row.streak === 4), JSON.stringify(row));
  assert.deepEqual(smokeRun(() => JSON.stringify({ at: '2026-10-16', streak: { x: 3 } })).streak, { x: 3 });
}

test('a unit test that loads the skill from the skills folder it names counts as its own test, like one that imports skills/<name>.js (tools/sky-skills.test.mjs)', () => {
  const files = { 'tools/test_void.mjs': '', 'tools/test_3d.mjs': '', 'tools/test_extension.mjs': '', 'tools/bench.json': '[]' };
  const sky = "const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');\nconst s = await import(pathToFileURL(resolve(dir, 'suntimes.js')).href);";
  const other = "const dir = resolve(here, 'fixtures');\nconst s = await import(pathToFileURL(resolve(dir, 'moontonight.js')).href);"; // a dir that is not the skills folder
  const read = (p) => { if (p in files) return files[p]; if (p === 'tools/sky-skills.test.mjs') return sky; if (p === 'tools/other.test.mjs') return other; throw new Error('no ' + p); };
  const ev = evidence(['suntimes', 'moontonight', 'meteors'], read, () => ['sky-skills.test.mjs', 'other.test.mjs']);
  assert.equal(ev.suntimes.suite, true, 'loaded as resolve(dir, "suntimes.js") from the skills folder');
  assert.equal(ev.moontonight.suite, false, 'a dir that is not the skills folder proves nothing about the skill');
  assert.equal(ev.meteors.suite, false, 'a skill no test names has no unit test');
});
