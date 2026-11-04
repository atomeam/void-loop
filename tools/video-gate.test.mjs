// tools/video-gate.mjs + tools/shorts.mjs: a Short is posted only when it is full bleed, legible, real footage, quiet or voiced at
// -14 LUFS, and opens on a hook a stranger cares about (owner, 2026-11-03: "verses videos are bad").
import assert from 'node:assert/strict';
import { hookScore, captionCheck, barsOf, flatEdges, noBars, audioCheck, SAFE } from './video-gate.mjs';
import { SCENES, captionsOf, wrap, padExpr, MOODS } from './shorts.mjs';
for (const m of Object.keys(MOODS)) assert.match(padExpr(m), /^0\.05\*/);

// hooks: the old titles fail, everyday questions pass
assert.ok(hookScore('A word problem shows the number') < 60, 'the Nov 3 Short\'s hook fails');
assert.ok(hookScore('How much of what people will ask has Verse already seen?') < 60, 'jargon caps a hook');
assert.ok(hookScore('Splitting a $84 dinner bill 3 ways?') >= 60);
for (const s of SCENES) assert.ok(hookScore(s.hook) >= 60, s.id + ' hook scores ' + hookScore(s.hook));
assert.equal(hookScore(''), 0);

// bars: cropdetect's pillarbox, and flat padding of any colour
assert.equal(barsOf('crop=1080:1920:0:0').ok, true);
assert.match(barsOf('x crop=608:1920:236:0 y crop=608:1920:236:0').detail, /pillarbox/);
assert.match(barsOf('crop=1080:1600:0:160').detail, /letterbox/);
assert.equal(barsOf('').ok, false);
const live = { left: [40, 60], right: [30, 50], top: [20, 90], bottom: [12, 80] };
assert.equal(flatEdges(live).ok, true);
assert.deepEqual(flatEdges({ ...live, right: [0, 1], bottom: [0, 0] }).ok, false, 'grey padding at the right and bottom (recordVideo) fails');
assert.equal(noBars(barsOf('crop=608:1920:236:0'), flatEdges({ ...live, left: [0, 0], right: [0, 0] })).ok, false, 'black pillar bars fail');
assert.equal(noBars(barsOf('crop=1032:1920:24:0'), flatEdges(live)).ok, true, 'a dark page edge that carries picture is not a bar');

// captions: big, boxed, in the safe zone
const t = { answer: 3, end: 8, total: 10.6 };
for (const s of SCENES) { const c = captionCheck(captionsOf(s, t)); assert.ok(c.ok, s.id + ': ' + c.detail); }
assert.equal(captionCheck([{ text: 'tiny', size: 30, x: 100, y: 400, box: true }]).ok, false);
assert.equal(captionCheck([{ text: 'low', size: 80, x: 100, y: SAFE.y1, box: true }]).ok, false, 'under the Shorts buttons');
assert.equal(captionCheck([{ text: 'bare', size: 80, x: 100, y: 400, box: false }]).ok, false);
assert.equal(captionCheck([]).ok, false, 'no captions fails (sound-off viewers)');
assert.equal(wrap('Splitting a $84 dinner bill 3 ways?', 16), 'Splitting a $84\ndinner bill 3\nways?');

// audio: a voice at -14, or nothing (no music bed)
assert.equal(audioCheck(-14.2, true).ok, true);
assert.equal(audioCheck(-20, true).ok, false);
assert.equal(audioCheck(-Infinity, false).ok, true);
assert.equal(audioCheck(-22, false).ok, true, 'a quiet bed under the captions passes');
assert.equal(audioCheck(-30, false).ok, false, 'a bed too faint to hear is noise');
assert.equal(audioCheck(-15.7, false).ok, false, 'the old music bed with nothing over it fails');
console.log('video-gate: ok');
