import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotLines, summary, takeNext, isHeld, towerTake } from './next.mjs';
import { readFrontier } from './frontier.mjs';

test('a session with no token reads the public snapshot: terms and counts, never ask text', () => {
  const lines = snapshotLines({ at: '2026-10-11T06:23:00Z', distinctAsks: 40, terms: [{ term: 'tide', asks: 5, misses: 9 }], make: [{ term: 'boat', asks: 3, misses: 3 }] });
  assert.match(lines[0], /2026-10-11 \(40 distinct asks/);
  assert.ok(lines.some((l) => /tide {2}\(5 asks, 9 misses\)/.test(l)));
  assert.ok(lines.some((l) => /boat/.test(l)));
  assert.deepEqual(snapshotLines(null), ['The miss snapshot is not readable.']);
});

test('summary reads the real frontier', () => {
  const s = summary(readFrontier());
  assert.ok(Array.isArray(s.steps) && s.open.length > 0);
});

test('there is always a next thing: never "nothing to do"', () => {
  assert.match(takeNext({ steps: [{ n: 3, title: 'The salvage shelf' }], open: [{ title: 'A' }] }), /^cleanup step 3/);
  assert.match(takeNext({ open: [{ title: 'Paid Verse' }] }), /^Paid Verse/);
  assert.match(takeNext({ targets: [{ title: 'Verification loop' }] }), /^Verification loop/);
  assert.match(takeNext({}), /Verse's top ask/);
  const s = summary(readFrontier());
  assert.ok(s.targets.length >= 5 && s.targets[0].title === 'Verification loop' && s.take.length > 0, JSON.stringify(s.targets));
});

test("Verse's asks, most repeated first, without the ones built (the menu a run takes from when the queue is empty)", async () => {
  const { repeatedAsks } = await import('./next.mjs');
  const voice = [
    '## Verse\'s current asks', '', '- Learn backgammon. (daily, 2026-10-12) `ask-20261012-1-1`', '', '## Older',
    'Asks: "Add a refusal object to every I cannot." (small); "Learn backgammon now please."',
    'Asks: "Add a refusal object to every I cannot." (small)',
    'Asks: "add a REFUSAL object to every I cannot"; "Learn backgammon."',
  ].join('\n');
  const rows = repeatedAsks(voice);
  assert.equal(rows[0].ask, 'Add a refusal object to every I cannot.');
  assert.equal(rows[0].times, 3); // wording differences in case and punctuation are one ask
  assert.equal(rows[0].small, true);
  // built through a link to a real ledger entry: gone from the menu
  const built = repeatedAsks(voice, [{ at: '2026-10-13T00:00:00Z' }], [{ ask: 'ask-20261012-1-1', ledgerAt: '2026-10-13T00:00:00Z' }]);
  assert.ok(!built.some((r) => r.ask === 'Learn backgammon.'));
  // a link to an entry that does not exist proves nothing
  assert.ok(repeatedAsks(voice, [], [{ ask: 'ask-20261012-1-1', ledgerAt: 'nope' }]).some((r) => r.ask === 'Learn backgammon.'));
});

test('a held frontier item or ask is not taken while its site is the Versus target, and the target comes first (owner, 2026-10-29)', () => {
  const held = [{ words: 'Absorb every repository on the account into the core code', frontier: 'Absorb and connect every repo', until: 'sycophanthex.com' }];
  assert.ok(isHeld('Absorb and connect every repo', held, 'sycophanthex.com'), 'by its frontier title');
  assert.ok(isHeld('Absorb every repository on the account into the core code to unify the system architecture.', held, 'sycophanthex.com'), 'by its words, reworded');
  assert.ok(!isHeld('Absorb and connect every repo', held, 'next-site.com'), 'the hold ends when the target moves on');
  assert.ok(!isHeld('Paid Verse', held, 'sycophanthex.com'));
  const text = '**Folded in from the old lists (2026-10-11), still open, each with where it came from:**\n- **Absorb and connect every repo** (`owner`): x\n- **Paid Verse:** y\n';
  const s = summary(text, { held, target: 'sycophanthex.com' });
  assert.deepEqual(s.held.map((o) => o.title), ['Absorb and connect every repo']);
  assert.ok(!s.open.some((o) => /Absorb/.test(o.title)));
  const tower = towerTake('sycophanthex.com', [{ site: 'sycophanthex.com', features: [{ id: 'catalog', void: 'none' }, { id: 'tags', void: 'beats' }] }]);
  assert.deepEqual([tower.site, tower.next.id, tower.beats, tower.total], ['sycophanthex.com', 'catalog', 1, 2]);
  assert.match(takeNext({ open: [{ title: 'Paid Verse' }], tower }), /^sycophanthex\.com: catalog \(the Versus target/);
  assert.match(takeNext({ steps: [{ n: 3, title: 'The salvage shelf' }], tower }), /^cleanup step 3/, 'a cleanup step still goes first');
  assert.equal(towerTake('sycophanthex.com', [{ site: 'sycophanthex.com', features: [{ id: 'catalog', void: 'beats' }] }]), null, 'a beaten target is no take');
  assert.equal(towerTake('none.com', []), null);
});
