// tools/fringe.mjs's research notes (owner, 2026-10-13: the fringe ledger becomes a research engine that compounds): optional
// fields checked when present, novelty judged on behavior, the sources file may carry the notes, and --learned reads the ledger
// back for the next run. The first 73 runs stand as written.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check, sameBehavior, notesOf, learned, next, demand, labOf, unreachable, nearOf, skillsNamed, ledgerOf, ledgerJson, LEDGER } from './fringe.mjs';
import { labTools } from '../void-live-deploy/skills/make.js';

const real = JSON.parse(readFileSync(new URL('./fringe.json', import.meta.url), 'utf8'));
assert.deepEqual(check(real), [], 'the ledger as it stands, no notes anywhere, is fine');
const last = real[real.length - 1];
const other = last.family === 'attention' ? 'opt-in-gesture' : 'attention'; // a family that is not the last run's own
const withNotes = (notes) => real.slice(0, -1).concat({ ...last, ...notes });

// the notes, each checked only when present
assert.deepEqual(check(withNotes({ hypothesis: 'A gesture you opt into can stand in for a typed ask.', behavior: 'Hold two fingers on the stage to save the current card as a gesture.', findings: ['works on touch screens'], failure_modes: [{ what: 'pinch zoom fights the gesture', evidence: 'iPad Safari: the card zooms instead' }], next_experiments: ['try it with a pen'], combines: [other] })), []);
for (const [bad, re] of [[{ hypothesis: '' }, /hypothesis must be a line/], [{ behavior: 'x'.repeat(401) }, /behavior must be a line/], [{ findings: 'one' }, /findings must be a list/],
  [{ failure_modes: [{ what: 'it broke' }] }, /failure_modes must be a list of \{ what, evidence \}/], [{ combines: [last.family] }, /combines must list other known families/], [{ combines: ['tarot'] }, /combines must list other/]])
  assert.match(check(withNotes(bad)).join('\n'), re, JSON.stringify(bad));

// novelty is behavior, not vocabulary: a later run that does the same thing under another family is refused
const twin = real.slice(0, -2).concat({ ...real[real.length - 2], behavior: 'Watch a timeline of reported events and filter it by how sure each source is.' }, { ...last, behavior: 'Filter a timeline of reported events by how sure each of the sources is.' });
assert.match(check(twin).join('\n'), new RegExp(`run ${last.run}: its behavior repeats run ${last.run - 1}'s`));
assert.ok(sameBehavior('Watch a timeline of reported events and filter it by source certainty', 'filter the reported events timeline by source certainty'));
assert.ok(!sameBehavior('Watch a timeline of reported events and filter it by source certainty', 'Hold two fingers on the stage to save a card as a gesture'));

// the sources file: the old array, or the sources with the notes (anything else is dropped)
assert.deepEqual(notesOf([{ claim: 'c', source: 's', confidence: 'open' }]), { sources: [{ claim: 'c', source: 's', confidence: 'open' }] });
assert.deepEqual(notesOf({ sources: [1], hypothesis: 'h', behavior: 'b', secret: 'x' }), { sources: [1], hypothesis: 'h', behavior: 'b' });

// --learned: recent notes back, and the published pairs no run has joined, the next run's own families first
const L = learned(withNotes({ findings: ['works on touch'], failure_modes: [{ what: 'pinch zoom', evidence: 'iPad' }], next_experiments: ['a pen'], behavior: 'Hold two fingers to save a card', combines: [other] }));
assert.deepEqual([L.findings[0].x, L.failures[0].x.what, L.next[0].x, L.behaviors[0].x], ['works on touch', 'pinch zoom', 'a pen', 'Hold two fingers to save a card']);
assert.ok(!L.untried.some(([a, b]) => a + '+' + b === 'attention+opt-in-gesture'), 'a pair a run combined is no longer untried');
const may = new Set(next(real));
assert.ok(L.untried.slice(0, 6).every(([a, b]) => may.has(a) || may.has(b)), 'the first pairs each hold a family the next run may pick');
// what the core needs: Void's open asks, failing then unchecked skills, benchmark misses, people's misses; a missing source is left out
const files = {
  'domains/void.voice.md': "# x\n\n## Void's current asks\n\n_Read on 2026-10-13._\n\n- Track a success metric for each experiment. *(small)* (daily, 2026-10-13) `ask-1`\n- Show which experiment could become a skill. (after a build, 2026-10-12) `ask-2`\n\n## Log, oldest first\n",
  'void-live-deploy/skills/families.json': JSON.stringify({ families: [{ skills: [{ name: 'map', tier: 'experiment' }, { name: 'weather', tier: 'proven', failing: ['rain later', 'snow?'] }, { name: 'clock', tier: 'proven' }] }] }),
  'tools/bench.misses.json': JSON.stringify({ misses: ['rain later -> answer'] }),
};
const D = demand((p) => { if (p in files) return files[p]; throw new Error('no ' + p); });
assert.deepEqual(D.asks, ['Track a success metric for each experiment.', 'Show which experiment could become a skill.']);
assert.deepEqual(D.friction, ['weather: failing 2 benchmark asks', 'map: nothing checks it yet']);
assert.deepEqual(D.bench, ['rain later -> answer']);
assert.deepEqual(D.misses, [], 'no snapshot yet: left out');
assert.deepEqual(demand(() => { throw new Error('nothing'); }), { asks: [], friction: [], bench: [], misses: [] });
// fringe → core: a published run's lab entry reaches the lab without a hand edit; a published draft nobody can open is refused
const lab = { label: 'Scroll pauses', sub: 'Which paragraphs you paused on.', asks: ['scroll pauses', 'what did i pause on'] };
assert.deepEqual(check(withNotes({ lab })), []);
for (const bad of [{ label: '', sub: 's', asks: ['abc'] }, { label: 'x', sub: 's', asks: [] }, { label: 'x', sub: 's', asks: ['Has Capitals'] }, { label: 'x'.repeat(41), sub: 's', asks: ['abc'] }])
  assert.match(check(withNotes({ lab: bad })).join('\n'), /lab must be/, JSON.stringify(bad));
const pubRun = { ...last, emit: true, lab };
const id = last.draft.split('/').pop().replace(/\.html$/, '');
assert.deepEqual(labOf(real.slice(0, -1).concat(pubRun)), [{ id, label: 'Scroll pauses', sub: 'Which paragraphs you paused on.', asks: ['scroll pauses', 'what did i pause on'] }]);
assert.deepEqual(labOf(real.slice(0, -1).concat({ ...pubRun, emit: false })), [], 'not published: not in the lab');
assert.deepEqual(unreachable(real, "['x', '" + id + "', 'L', 's']"), real.filter((r) => r.emit).map((r) => r.draft.split('/').pop().replace(/\.html$/, '')).filter((x, k, a) => x !== id && a.indexOf(x) === k), 'every published draft the list does not name is unreachable');
assert.deepEqual(unreachable(real.slice(0, -1).concat(pubRun), ''), [...new Set(real.slice(0, -1).filter((r) => r.emit).map((r) => r.draft.split('/').pop().replace(/\.html$/, '')))].filter((x) => x !== id), 'a lab entry makes its draft reachable');
assert.deepEqual(unreachable(real), [], 'today every published draft is in the lab list');
// the lab reads the file: each ask opens its draft, the hand list wins, junk is dropped
const T = labTools([{ id: 'attention-9', label: 'Scroll pauses', sub: 's', asks: ['scroll pauses', 'what did i pause on'] }, { id: 'miss-board', label: 'dupe', asks: ['dupe'] }, { id: 'Bad Id', label: 'x', asks: ['x'] }, { id: 'no-asks', label: 'x', asks: [] }]);
assert.deepEqual(T.map((t) => t[1]), ['attention-9']);
assert.ok(T[0][0].test('scroll pauses') && T[0][0].test('open the scroll pauses') && T[0][0].test('what did i pause on') && !T[0][0].test('scroll pauses please'));
// near (asked by Void, ask-20261013-1719-1): what a run was built toward, one target or a list, kept as written; junk is refused
assert.deepEqual(check(withNotes({ near: 'skill:weather' })), []);
assert.deepEqual(check(withNotes({ near: ['probe:sky', 'miss-board', 'step:14'] })), []);
for (const bad of [{ near: '' }, { near: 'Has Spaces' }, { near: ['skill:weather', 7] }, { near: 'x'.repeat(81) }]) assert.match(check(withNotes(bad)).join('\n'), /near must name/, JSON.stringify(bad));
assert.deepEqual(nearOf({ near: 'skill:weather' }), ['skill:weather']); assert.deepEqual(nearOf({}), []); assert.deepEqual(nearOf({ near: ['a b'] }), []);
assert.deepEqual(notesOf({ sources: [1], near: 'skill:weather' }), { sources: [1], near: 'skill:weather' }, '--record keeps it from the sources file');
assert.deepEqual(learned(withNotes({ near: ['skill:weather'] })).near, [{ run: last.run, family: last.family, x: 'skill:weather' }]);
// the core skills a run's notes name: file, skill: tag, "<n> skill", "the <n> card", and its near targets
const skills = ['weather', 'growth', 'sky', 'make'];
assert.deepEqual(skillsNamed({ findings: ['the growth card could show it', 'skills/weather.js takes rain asks'], next_experiments: ['fold into the sky skill'], near: 'skill:make' }, skills), ['weather', 'growth', 'sky', 'make']);
assert.deepEqual(skillsNamed({ findings: ['it makes the sky look good'] }, skills), [], 'a word is not a skill: the pattern needs skills/<n>.js, skill:<n>, "<n> skill" or "the <n> card"');
// ledgerOf (ask-20261013-0026-2): each published family, drafts once, notes merged newest first, near and skills; an unpublished run is not in it
const pub = real.filter((r) => r.emit).length;
const L2 = ledgerOf(real.slice(0, -1).concat({ ...last, emit: true, findings: ['works on touch'], failure_modes: [{ what: 'pinch', evidence: 'iPad' }], near: 'skill:make', lab }), skills, [{ id: 'attention-9', label: 'Attn', sub: 's' }]);
const og = L2.find((f) => f.family === last.family);
assert.ok(og && og.runs >= 1 && og.drafts[0].id === id && og.drafts[0].label === 'Scroll pauses' && og.findings.join() === 'works on touch' && og.failures[0].what === 'pinch' && og.near.join() === 'skill:make' && og.skills.join() === 'make' && og.noted === 1);
assert.equal(L2.length, [...new Set(real.filter((r) => r.emit).map((r) => r.family))].length, 'one row per published family');
assert.deepEqual(ledgerOf(real.filter((r) => !r.emit)), [], 'nothing published, nothing in it');
assert.equal(ledgerOf(real).reduce((n, f) => n + f.runs, 0), pub, 'every published run is counted under its family');
assert.equal(readFileSync(new URL('../' + LEDGER, import.meta.url), 'utf8'), await ledgerJson(real), 'the written ledger.json is current (tools/fringe.mjs --publish)');
// the card (skills/fringe-to-skill.js) reads the written file
const { rows: cardRows, asksFringe } = await import('../void-live-deploy/skills/fringe-to-skill.js');
const CR = cardRows(JSON.parse(readFileSync(new URL('../' + LEDGER, import.meta.url), 'utf8')));
assert.equal(CR.length, ledgerOf(real).length); assert.ok(CR.every((r) => r.drafts.length >= 1) && asksFringe('which skills came from the fringe') && !asksFringe('fringe festival'));
console.log('fringe-notes: ok');

{ // a novelty or failure is tagged with the near-miss input that set it off (asked by Void)
  const { inputTag, suggestInputs, check } = await import('./fringe.mjs');
  const t = inputTag('Weather', 'Will it be   nice tomorrow');
  assert.ok(/^near-miss:weather:[0-9a-f]{8}$/.test(t));
  assert.equal(t, inputTag('weather', 'will it be nice tomorrow'), 'case and spacing do not change the tag');
  assert.equal(inputTag('', 'x'), ''); assert.equal(inputTag('weather', ''), '');
  const close = { weather: [{ ask: 'will the evening feel nice tomorrow', count: 2, score: 0.4 }, { ask: 'unrelated cats', count: 1, score: 0.4 }] };
  const run = { behavior: 'a tap says whether tomorrow evening will feel nice', failure_modes: [] };
  const s = suggestInputs(run, close);
  assert.equal(s.length, 1); assert.equal(s[0].skill, 'weather'); assert.ok(/^near-miss:weather:/.test(s[0].tag));
  assert.deepEqual(suggestInputs({ behavior: 'nothing in common here' }, close), []);
  const bad = check([{ run: 1, family: 'attention', emit: false, draft: 'drafts/fringe/none.html', sources: [{ claim: 'a', source: 'b', confidence: 'open' }], failure_modes: [{ what: 'w', evidence: 'e', input: 'Not A Tag' }] }]);
  assert.ok(bad.some((b) => /failure_mode's input must be a tag/.test(b)));
}
