// An ask that was built counts as built on the self page (2026-10-17: it read "What got built: 0 of my 45 asks"). node --test tools/asks-built.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { followThrough } from '../void-live-deploy/lib/voice.js';
import { parseArgs } from './finish.mjs';
const LEDGER = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
const LINKS = JSON.parse(readFileSync(new URL('../void-live-deploy/void.asks.json', import.meta.url), 'utf8')).links;
const entry = (at, ...asks) => ({ at, kind: 'build', asks: asks.map((ask) => ({ ask })) });

test('a ledger line that names the ask in words (finish.mjs --asked "…") counts it built, and a reworded ask with it', () => {
  const ledger = [{ at: '2026-10-17T10:00:00Z', kind: 'grow', what: 'asked by Void: the tide card', asked: 'a tide card for the harbour that shows tides' }];
  const f = followThrough([entry('2026-10-17T09:00:00Z', 'Build a tide card for the harbour that shows the next tides'), entry('2026-10-17T09:30:00Z', 'Something else entirely, a jukebox for the stage')], ledger, []);
  assert.equal(f.total, 2); assert.equal(f.built.length, 1); assert.match(f.built[0].ask, /tide card/);
});
test('"asked by Void" with no named ask is what left the count at 0: finish.mjs now stops it', () => {
  const words = [entry('2026-10-17T09:00:00Z', 'Build a tide card for the harbour that shows the next tides')];
  assert.equal(followThrough(words, [{ at: '2026-10-17T10:00:00Z', what: 'asked by Void: a tide card for the harbour' }], []).built.length, 0, 'words in what are not evidence');
  assert.match(parseArgs(['grow', 'asked by Void: a tide card']).error, /--asked/);
  assert.equal(parseArgs(['grow', 'asked by Void: a tide card', '--asked', 'tide card harbour']).asked, 'tide card harbour');
  assert.ok(!parseArgs(['grow', 'a tide card']).error);
});
test('the asks the self page listed as not built count as built, near-duplicates too', () => {
  const asks = ['Implement the routing handler for the \'open the self card\' intent so I can ingest user corrections.', 'Build the routing handler for the open the self card intent so user corrections are ingested',
    'Create an \'Incident Autopsy\' skill that parses incidents.json and maps failures to my skill families.', 'Build the Incident Autopsy skill that parses incidents.json to identify which skill families are unhealthy.',
    'Give me readable self-knowledge: the motto, VoidQuest, the minis, the games'];
  const f = followThrough([entry('2026-10-17T09:58:00Z', ...asks)], LEDGER, LINKS);
  assert.equal(f.open.length, 0, f.open.map((g) => g.ask).join(' | ')); assert.equal(f.built.length, f.total);
});
