// Verse's system of systems (void-live-deploy/lib/systems.js, docs/systems.md): every workflow has exactly one place in the flow, and the
// owner's view joins it with the loop census. Run: node --test tools/systems.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { STAGES, LANES, PLACE, placeOf, systemsOf } from '../void-live-deploy/lib/systems.js';

const files = readdirSync(new URL('../.github/workflows/', import.meta.url)).filter((f) => /\.ya?ml$/.test(f));
const placed = Object.values(PLACE).flat();

test('each workflow has at most one place, and the map is kept up with what runs', () => {
  assert.deepEqual(placed.filter((f, i) => placed.indexOf(f) !== i), [], 'a workflow is in exactly one place');
  const ids = [...STAGES, ...LANES].map((s) => s.id);
  assert.deepEqual(Object.keys(PLACE).sort(), [...ids].sort(), 'every stage and lane has a list, and nothing else does');
  for (const s of [...STAGES, ...LANES]) assert.ok(s.owner && s.job, s.id + ' names its one owner and its job');
  // drift is shown, not failed: a pull request that only adds or retires a loop must not turn main red (the owner view lists it too)
  const unplaced = files.filter((f) => !placeOf(f)), gone = placed.filter((f) => !files.includes(f));
  if (unplaced.length) console.log('not in void-live-deploy/lib/systems.js yet: ' + unplaced.join(', '));
  if (gone.length) console.log('placed but not in .github/workflows (retired, or not merged yet): ' + gone.join(', '));
  assert.ok(unplaced.length <= 10, 'more than 10 workflows have no place: update PLACE in void-live-deploy/lib/systems.js');
});

test('the flow runs signals to feedback, in that order', () => {
  assert.deepEqual(STAGES.map((s) => s.id), ['signals', 'ideas', 'prioritize', 'build', 'gate', 'ship', 'measure', 'feedback']);
});

test('the owner view counts each stage from the census and lists what needs a look', () => {
  const census = { rows: [{ wf: 'will.yml', name: "Verse's will", status: 'working', ran24: 24 }, { wf: 'recruit.yml', name: 'Recruit', status: 'behind', ran24: 6 },
    { wf: 'new-thing.yml', name: 'New', status: 'working', ran24: 1 }] };
  const v = systemsOf(census), ideas = v.stages.find((s) => s.id === 'ideas');
  assert.equal(ideas.loops, PLACE.ideas.length);
  assert.equal(ideas.working, 1);
  assert.deepEqual(ideas.look, [{ wf: 'recruit.yml', name: 'Recruit', status: 'behind' }]);
  assert.equal(ideas.runs24, 30);
  assert.deepEqual(v.unplaced, ['new-thing.yml'], 'a loop the map does not know is shown, not hidden');
  assert.equal(systemsOf(null).stages.length, STAGES.length, 'no census yet still draws the flow');
});

test('docs/systems.md draws the same stages', () => {
  const doc = readFileSync(new URL('../docs/systems.md', import.meta.url), 'utf8');
  assert.match(doc, /```mermaid/);
  for (const s of STAGES) assert.ok(doc.includes(s.name), 'docs/systems.md names the stage ' + s.name);
});

