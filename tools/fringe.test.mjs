// tools/fringe.mjs's research notes (owner, 2026-10-13: the fringe ledger becomes a research engine that compounds): optional
// fields checked when present, novelty judged on behavior, the sources file may carry the notes, and --learned reads the ledger
// back for the next run. The first 73 runs stand as written.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check, sameBehavior, notesOf, learned, next, demand } from './fringe.mjs';

const real = JSON.parse(readFileSync(new URL('./fringe.json', import.meta.url), 'utf8'));
assert.deepEqual(check(real), [], 'the ledger as it stands, no notes anywhere, is fine');
const last = real[real.length - 1];
const withNotes = (notes) => real.slice(0, -1).concat({ ...last, ...notes });

// the notes, each checked only when present
assert.deepEqual(check(withNotes({ hypothesis: 'A gesture you opt into can stand in for a typed ask.', behavior: 'Hold two fingers on the stage to save the current card as a gesture.', findings: ['works on touch screens'], failure_modes: [{ what: 'pinch zoom fights the gesture', evidence: 'iPad Safari: the card zooms instead' }], next_experiments: ['try it with a pen'], combines: ['attention'] })), []);
for (const [bad, re] of [[{ hypothesis: '' }, /hypothesis must be a line/], [{ behavior: 'x'.repeat(401) }, /behavior must be a line/], [{ findings: 'one' }, /findings must be a list/],
  [{ failure_modes: [{ what: 'it broke' }] }, /failure_modes must be a list of \{ what, evidence \}/], [{ combines: ['opt-in-gesture'] }, /combines must list other known families/], [{ combines: ['tarot'] }, /combines must list other/]])
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
const L = learned(withNotes({ findings: ['works on touch'], failure_modes: [{ what: 'pinch zoom', evidence: 'iPad' }], next_experiments: ['a pen'], behavior: 'Hold two fingers to save a card', combines: ['attention'] }));
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
console.log('fringe-notes: ok');
