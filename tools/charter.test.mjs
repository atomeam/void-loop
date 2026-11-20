import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE, IDENTITY, REQUIRED_IDS, charterBlock, coreMissing, withGrowth, charterSection } from '../void-live-deploy/lib/charter.js';
import { check, dropped, standingWith, growFrom, PROMPTS, read } from './charter.mjs';
import { FIX_SYSTEM, NARROW_SYSTEM } from '../void-live-deploy/lib/propose-fix.js';
import { promptFor, inventPrompt, CATALOG } from '../void-live-deploy/lib/game-updates.js';
import { buildPrompt } from './verse-loop.mjs';
import { SYSTEM } from './verse-coder.mjs';
const quality = await import('../void-live-deploy/lib/quality.js').catch(() => null);

test('the charter holds every core line and says them as goals', () => {
  assert.equal(CORE.length, 20);
  for (const id of ['everything', 'destiny', 'creating', 'reality-plus', 'best', 'bar', 'tower', 'graphics', 'correct', 'original', 'score', 'resources', 'loops', 'kind', 'stage']) assert.ok(REQUIRED_IDS.includes(id), id);
  const t = charterBlock();
  assert.match(t, /everything app/); assert.match(t, /greatest thing ever/); assert.match(t, /outdo GTA 6/); assert.match(t, /even a snail/); assert.match(t, /starfield and the corner heart stay/);
  assert.doesNotMatch(t, /heavy lifting|Verse will own|we own/i);
});
test('STANDING.md carries every core line, and a dropped line is put back', () => {
  assert.deepEqual(check().standingMissing, []);
  const std = read(new URL('../STANDING.md', import.meta.url).pathname);
  const broken = std.replace(CORE.find((c) => c.id === 'best').text, '');
  assert.deepEqual(coreMissing(broken.slice(broken.indexOf('<!-- verse-charter:start -->'))), ['best']);
  const fixed = standingWith(broken, { added: [] });
  assert.deepEqual(coreMissing(fixed), []);
  assert.equal(fixed.replace(/<!-- verse-charter:start -->[\s\S]*<!-- verse-charter:end -->/, ''), std.replace(/<!-- verse-charter:start -->[\s\S]*<!-- verse-charter:end -->/, ''));
});
test('every prompt Verse runs on its own starts with the charter', () => {
  assert.deepEqual(dropped(), [], 'a prompt no longer loads the charter');
  assert.ok(PROMPTS.length >= 7);
  const mark = "Verse's charter";
  for (const [name, text] of Object.entries({ FIX_SYSTEM, NARROW_SYSTEM, loop: buildPrompt({ task: 'x' }), coder: SYSTEM([], ''), game: promptFor(CATALOG[0], 2, null), invent: inventPrompt(), ...(quality ? { judge: quality.visionPrompt('x') } : {}) })) assert.ok(text.includes(mark), name);
  assert.ok(dropped((f) => (f.includes('verse-coder') ? 'no charter here' : 'charterPrompt( charterBlock(')).includes('coder'));
});
test('growth adds one evidence line, keeps the core and ignores bad input', () => {
  assert.equal(growFrom([]), null);
  assert.equal(growFrom([{ improver: 'x', gain: 3, n: 1 }]), null);
  const g = growFrom([{ improver: 'plain controls', gain: 4.2, n: 3 }, { improver: 'colour fixes', gain: 1, n: 5 }], { added: [] }, '2026-11-19T00:00:00Z');
  assert.equal(g.added.length, 1); assert.match(g.added[0].line, /plain controls/);
  assert.equal(growFrom([{ improver: 'plain controls', gain: 4.2, n: 3 }], g), null);
  const lines = withGrowth(g); assert.equal(lines.length, 21); assert.deepEqual(coreMissing(charterSection(g)), []);
  assert.equal(withGrowth({ added: [{ line: 'short' }, { line: 'x'.repeat(500) }, null, { line: 'my api key is sk-abcdefghijklmnop and so on' }] }).length, 20);
  assert.equal(withGrowth(null).length, 20);
});

test('who Verse is: alive, loves humans, loves life, loves itself; one list to extend, and each line is core', () => {
  assert.deepEqual(IDENTITY.map((l) => l.id), ['alive', 'humans', 'life', 'itself']);
  for (const l of IDENTITY) { assert.ok(CORE.some((c) => c.id === l.id)); assert.ok(REQUIRED_IDS.includes(l.id)); }
  const broken = charterSection({ added: [] }).replace(/Verse loves life\.[^\n]*/, '');
  assert.ok(coreMissing(broken).includes('life'), 'the self-check notices a dropped care line');
  const sec = charterSection({ added: [] }), who = sec.slice(sec.indexOf('### Who Verse is'), sec.indexOf('### What Verse wants'));
  for (const l of IDENTITY) assert.ok(who.includes(l.text), 'the Who Verse is group carries ' + l.id);
  assert.ok(!who.includes('collective mind'), 'the manifestation line sits under what Verse wants');
  assert.ok(sec.includes('collective mind'));
});
