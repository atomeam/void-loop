// stage pack G (asked by the owner, 2026-10-18): the contradiction lamp, ask diff and skill eclipse. The pure parts on fixtures, both ways:
// a clash is found where there is one and nothing is invented where there is none; the line diff; the eclipse parsing, lists and protection.
// node --test tools/stage-pack-g.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { contradictions, contradictsAsk, factsOf, dayIn, timeIn, keyOf, visible, textOfThing } from '../void-live-deploy/lib/contradict.js';
import { diffLines, collapse, identical, diffAsk, linesOf } from '../void-live-deploy/lib/linediff.js';
import { eclipseOf, parseUntil, familiesIn, namesFor, hidden, active, withEntry, without, chipText, leftWords, load, save, PROTECTED } from '../void-live-deploy/lib/eclipse.js';
import lamp from '../void-live-deploy/skills/contradiction-lamp.js';
import adiff from '../void-live-deploy/skills/ask-diff.js';
import ecl, { } from '../void-live-deploy/skills/skill-eclipse.js';
import { stateLines } from '../void-live-deploy/skills/ask-diff.js';

const S = (id, text, extra) => ({ id, kind: 'sticky', text, ...extra });

test('contradiction lamp: finds a clash where there is one', () => {
  const day = contradictions([S('a', 'dentist on friday'), S('b', 'dentist: thursday')]);
  assert.equal(day.length, 1); assert.equal(day[0].kind, 'when'); assert.match(day[0].line, /dentist.*fri.*thu/);
  const time = contradictions([S('a', 'standup at 9am'), S('b', 'standup at 10am')]);
  assert.equal(time.length, 1); assert.match(time[0].line, /9am and 10am/);
  const dates = contradictions([S('a', 'tax deadline oct 12'), S('b', 'tax deadline is 14 oct')]);
  assert.equal(dates.length, 1); assert.match(dates[0].line, /oct 12 and oct 14/);
  const num = contradictions([S('a', 'budget: 500'), S('b', 'the budget is 800')]);
  assert.equal(num.length, 1); assert.equal(num[0].kind, 'number'); assert.match(num[0].line, /500 and 800/);
  assert.equal(contradictions([S('a', 'rent: $1,200'), S('b', 'rent is $1,300')]).length, 1);
  const timers = contradictions([{ id: 't1', kind: 'timer', label: 'focus', duration: 25 * 6e4 }, { id: 't2', kind: 'timer', label: 'focus', duration: 50 * 6e4 }]);
  assert.equal(timers.length, 1); assert.match(timers[0].line, /25 min and 50 min/);
  const dec = contradictions([S('a', 'yes to the new logo'), S('b', 'no to the new logo')]);
  assert.equal(dec.length, 1); assert.equal(dec[0].kind, 'decision');
  assert.equal(contradictions([S('a', 'do buy the van'), S('b', "don't buy the van")]).length, 1);
  assert.equal(contradictions({ a: S('a', 'plan\ndentist friday 3pm'), b: S('b', 'dentist thursday 3pm') }).length, 1); // an object of things, a multi-line text
});

test('contradiction lamp: never invents one', () => {
  const none = (...things) => assert.deepEqual(contradictions(things), [], JSON.stringify(things));
  none(S('a', 'dentist on friday'), S('b', 'dentist on friday'));            // the same day twice agrees
  none(S('a', 'dentist on friday'), S('b', 'dentist on friday at 3pm'));     // one is less exact, not different
  none(S('a', 'dentist on friday'), S('b', 'haircut thursday'));             // two events
  none(S('a', 'dentist friday 3pm'), S('b', 'dentist friday 3pm'), S('c', 'yoga 5pm'));
  none(S('a', 'budget: 500'), S('b', 'budget: 500'));
  none(S('a', 'budget: 500'), S('b', 'rent: 800'));                          // two labels
  none(S('a', 'weight: 70 kg'), S('b', 'weight: 150 lb'));                   // two units are not compared
  none(S('a', '3 apples'), S('b', '5 apples'));                              // no label
  none(S('a', 'budget: 500\nbudget: 800'));                                  // inside one thing is not between two
  none(S('a', 'yes to the logo'), S('b', 'yes to the logo'));
  none(S('a', 'yes to the logo'), S('b', 'no to the font'));
  none({ id: 't1', kind: 'timer', label: 'focus', duration: 6e4 }, { id: 't2', kind: 'timer', label: 'focus', duration: 6e4 });
  none({ id: 't1', kind: 'timer', label: 'focus', duration: 6e4 }, { id: 't2', kind: 'timer', label: 'break', duration: 12e4 });
  none({ id: 't1', kind: 'timer', duration: 6e4 }, { id: 't2', kind: 'timer', duration: 12e4 });  // no label
  none(); none(null, undefined, {}, S('a', ''));
  assert.deepEqual(contradictions([]), []);
});

test('contradiction lamp: the pieces', () => {
  assert.deepEqual(dayIn('call on Friday'), { k: 'week', v: 'fri', rest: 'call on  ' });
  assert.equal(dayIn('oct 5th').v, 'oct 5'); assert.equal(dayIn('5 october').v, 'oct 5'); assert.equal(dayIn('due 2026-10-05').k, 'iso'); assert.equal(dayIn('no date here'), null);
  assert.equal(timeIn('at 3pm').v, 15 * 60); assert.equal(timeIn('9:05 am').v, 545); assert.equal(timeIn('at 15:30').v, 930); assert.equal(timeIn('at 3'), null); assert.equal(timeIn('13pm'), null);
  assert.equal(keyOf('the dentist'), 'dentist'); assert.equal(keyOf('my a'), ''); assert.equal(keyOf('12'), '');
  assert.deepEqual(factsOf('hello there'), []);
  assert.equal(textOfThing({ kind: 'kept', name: 'Plan', html: '<h2>Plan</h2><p>rent: 5</p>' }), 'Plan\nPlan rent: 5');
  const pairs = contradictions([S('a', 'budget: 500'), S('b', 'budget: 800')]);
  assert.equal(visible(pairs, new Set([pairs[0].id])).length, 0); assert.equal(visible(pairs, new Set()).length, 1);
  assert.equal(contradictions([S('a', 'budget: 500'), S('b', 'budget: 800')])[0].id, contradictions([S('b', 'budget: 800'), S('a', 'budget: 500')])[0].id); // order does not matter
});

test('contradiction lamp: match is tight', () => {
  for (const a of ['what contradicts', 'What contradicts?', 'which of my notes contradict each other', 'do any of my notes contradict each other', 'contradiction lamp']) assert.equal(lamp.match(a.toLowerCase(), a), true, a);
  for (const a of ['what contradicts the theory of relativity', 'what contradicts darwin', 'contradiction in terms meaning', 'what is a contradiction', 'contradict me']) assert.equal(lamp.match(a.toLowerCase(), a), false, a);
  assert.equal(contradictsAsk(''), false);
});

test('ask diff: the line diff', () => {
  const rows = diffLines(['timer', '25:00', 'paused', 'start'], ['timer', '40:00', 'paused', 'start', 'goal: write']);
  assert.deepEqual(rows.map((r) => r.t), ['same', 'chg', 'same', 'same', 'add']);
  assert.deepEqual(rows[1], { t: 'chg', a: '25:00', b: '40:00' });
  assert.deepEqual(collapse(rows).map((r) => r.t + (r.n || '')), ['skip1', 'chg', 'skip2', 'add']);
  assert.deepEqual(diffLines(['a', 'b'], ['a']).map((r) => r.t), ['same', 'del']);
  assert.deepEqual(diffLines([], ['x']), [{ t: 'add', b: 'x' }]); assert.deepEqual(diffLines(['x'], []), [{ t: 'del', a: 'x' }]); assert.deepEqual(diffLines([], []), []);
  assert.equal(identical(diffLines(['a', 'b'], ['a  ', ' b'])), true); // whitespace is not a change
  assert.equal(identical(diffLines(['a'], ['b'])), false);
  const mixed = diffLines(['a', 'b', 'c'], ['a', 'x', 'y', 'c']);
  assert.deepEqual(mixed.map((r) => r.t), ['same', 'chg', 'add', 'same']);
  assert.deepEqual(collapse([{ t: 'same' }, { t: 'same' }]), [{ t: 'skip', n: 2 }]);
  assert.deepEqual(linesOf('a\n\n  b  \n'), ['a', 'b']);
  assert.deepEqual(stateLines({ id: 'x', kind: 'timer', x: 1, y: 2, duration: 1500000, running: false, label: 'focus' }), ['[timer]', 'duration: 1500 s', 'label: focus', 'running: false']);
});

test('ask diff: match is tight', () => {
  assert.deepEqual(diffAsk('diff "make a timer" and "make a focus timer for writing"'), { a: 'make a timer', b: 'make a focus timer for writing' });
  assert.deepEqual(diffAsk("Diff 'clock' vs 'world clock'"), { a: 'clock', b: 'world clock' });
  assert.deepEqual(diffAsk('compare “clock” with “world clock”'), { a: 'clock', b: 'world clock' });
  for (const a of ['diff command in g' + 'it', 'diff main and feature', 'compare iphone and android', 'diff "same" and "SAME"', 'diff "only one"', 'what is the diff between two files', '']) assert.equal(diffAsk(a), null, a);
  assert.equal(adiff.match('diff command in g' + 'it', 'diff command in g' + 'it'), false);
  assert.equal(adiff.match('', 'diff "a" and "b b"'), true);
});

test('skill eclipse: parsing durations and weekdays', () => {
  const now = new Date(2026, 9, 18, 14, 30).getTime(); // Sunday 18 Oct 2026
  assert.equal(parseUntil('for an hour', now).until, now + 36e5);
  assert.equal(parseUntil('for 30 minutes', now).until, now + 18e5);
  assert.equal(parseUntil('for 2 hours', now).until, now + 72e5);
  assert.equal(parseUntil('for three days', now).until, now + 3 * 864e5);
  assert.equal(parseUntil('for half an hour', now).until, now + 18e5);
  assert.equal(parseUntil('for the next hour', now).until, now + 36e5);
  const fri = parseUntil('until friday', now), d = new Date(fri.until);
  assert.equal(d.getDay(), 5); assert.equal(d.getHours(), 0); assert.equal(d.getDate(), 23); assert.equal(fri.how, 'until fri');
  assert.equal(new Date(parseUntil('until sunday', now).until).getDate(), 25); // today is Sunday: the next one
  assert.equal(new Date(parseUntil('till tomorrow', now).until).getDate(), 19);
  assert.equal(new Date(parseUntil('until mon', now).until).getDate(), 19);
  for (const bad of ['for a year', 'for 40 days', 'until never', 'until', 'for banana', '', 'for 0 minutes', 'tomorrow']) assert.equal(parseUntil(bad, now), null, bad);
});

test('skill eclipse: asks, families, protection, lists', () => {
  assert.deepEqual(eclipseOf('eclipse media skills until friday'), { act: 'set', ids: ['words'], words: 'media', span: 'until friday' });
  assert.deepEqual(eclipseOf('Eclipse money skills for an hour').ids, ['numbers']);
  assert.deepEqual(eclipseOf('eclipse the games and time skills until friday').ids, ['games', 'time']);
  assert.deepEqual(eclipseOf('eclipse body skills').span, null);
  for (const a of ['lift the eclipse', 'end the eclipse', 'Lift eclipse!']) assert.deepEqual(eclipseOf(a), { act: 'lift' }, a);
  for (const a of ['solar eclipse tonight', 'next lunar eclipse', 'eclipse of the heart', 'eclipse tonight skills', 'eclipse photography tips', 'eclipse', 'lift the weights']) assert.equal(eclipseOf(a), null, a);
  assert.equal(ecl.match('solar eclipse tonight', 'solar eclipse tonight'), false);
  assert.deepEqual(familiesIn('media, money & games'), ['words', 'numbers', 'games']); assert.equal(familiesIn('media and cheese'), null); assert.equal(familiesIn(''), null);
  const fj = { families: [{ id: 'words', skills: ['movie', 'guide', 'news'] }, { id: 'self', skills: ['guide', 'status', 'skill-eclipse', 'state'] }, { id: 'time', skills: ['timer'] }] };
  assert.deepEqual(namesFor(fj, ['words']), ['movie', 'news']);
  assert.deepEqual(namesFor(fj, ['self']), ['state']); // the protected four are never named
  for (const p of ['skill-eclipse', 'guide', 'status', 'stage']) assert.ok(PROTECTED.has(p));
  const now = 1e12;
  const e1 = { fam: 'words', label: 'media', names: ['movie', 'guide', 'skill-eclipse'], until: now + 36e5, how: 'for an hour' }, e2 = { fam: 'time', label: 'time', names: ['timer'], until: now - 1, how: 'for an hour' };
  assert.deepEqual([...hidden([e1, e2], now)], ['movie']); // expired is gone; protected is never hidden even if stored
  assert.equal(active([e1, e2], now).length, 1); assert.equal(hidden(null, now).size, 0); assert.equal(hidden('x', now).size, 0);
  assert.equal(withEntry([e1], { ...e1, until: now + 5 }, now).length, 1); assert.equal(withEntry([e1], { ...e1, fam: 'x' }, now).length, 2);
  assert.deepEqual(without([e1], 'words'), []); assert.deepEqual(without([e1]), []); assert.equal(without([e1], 'other').length, 1);
  assert.equal(chipText({ label: 'media', how: 'until fri', until: now }, now), 'eclipsed: media · until fri');
  assert.equal(chipText({ label: 'money', how: 'for an hour', until: now + 58 * 6e4 }, now), 'eclipsed: money · 58 min left');
  assert.equal(leftWords(3 * 36e5), '3 h left'); assert.equal(leftWords(3 * 864e5), '3 d left');
  const mem = {}; const store = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  assert.deepEqual(load(store), []); save([{ ...e1, until: Date.now() + 36e5 }], store); assert.equal(load(store).length, 1); mem['a2m.void.eclipse.v1'] = 'not json'; assert.deepEqual(load(store), []);
});
