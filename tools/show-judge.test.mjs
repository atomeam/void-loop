import assert from 'node:assert/strict';
import { publishScores, separates } from '../void-live-deploy/lib/show-pipe.js';
import { calibrate, readScore } from './show-judge.mjs';

assert.equal(readScore('Score 4. A list.'), 4);
assert.equal(readScore('no number here'), 0);
const split = [
  { kind: 'bad', min: 2 }, { kind: 'bad', min: 3 }, { kind: 'bad', min: 1 },
  { kind: 'good', min: 7 },
];
assert.equal(separates(split), true);
assert.equal(separates([{ kind: 'bad', min: 6 }, { kind: 'bad', min: 2 }, { kind: 'bad', min: 2 }, { kind: 'good', min: 7 }]), false);
const blocked = publishScores({ human: 9, separated: false, clarity: 9, originality: 9, entertainment: 9, impressive: 9 }, { kind: 'short', lines: [{ who: 'Verse', text: 'A card arrived.' }, { who: 'Critic', text: 'I will sign it.' }] }, 'short');
assert.equal(blocked.pass, false);
const open = publishScores({ human: 7, separated: true, clarity: 8, originality: 8, entertainment: 8, impressive: 8 }, { kind: 'short', lines: [{ who: 'Verse', text: 'A card arrived on the stage.' }, { who: 'Critic', text: 'I will sign the card.' }] }, 'short');
assert.equal(open.pass, true);

// Live run of tools/show-judge.mjs on 2026-11-10. The bad fixtures' minimums fell under 6 only because
// one prompt scored them 1, while another prompt scored the talking book 8 and the page reading 7.
// The hand-written good fixture's minimum was 3. The free judge cannot separate them, so nothing is published.
const recorded = [
  { id: 'journal', kind: 'bad', min: 1, scores: [5, 1, 1] },
  { id: 'old34', kind: 'bad', min: 1, scores: [7, 8, 1] },
  { id: 'page', kind: 'bad', min: 1, scores: [7, 3, 1] },
  { id: 'good', kind: 'good', min: 3, scores: [4, 3, 10] },
];
assert.equal(separates(recorded), false);
assert.ok(recorded.filter((r) => r.kind === 'bad').every((r) => r.min < 6));
assert.ok(recorded.find((r) => r.id === 'good').min < 6, 'the good fixture did not clear 6');
assert.equal(publishScores({ human: 9, separated: separates(recorded), clarity: 9, originality: 9, entertainment: 9, impressive: 9 }, { kind: 'short', lines: [{ who: 'Verse', text: 'A card arrived.' }, { who: 'Critic', text: 'I will sign it.' }] }, 'short').pass, false);
console.log('show-judge: free judge cannot separate; publish blocked');
