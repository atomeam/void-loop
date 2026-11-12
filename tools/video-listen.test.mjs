// The video card's listen mode and accessibility pass (frontier #29 step 5, lists run 23, 2026-11-12). Audio only means the official
// player shrinks to a 200 x 200 square (the smallest the embed terms allow) and stays visible and playing; nothing is downloaded or hidden.
// The card is a labelled region with a polite live line, CC and Listen say their state with aria-pressed, and Enter or Space plays a result.
// Run: node --test tools/video-listen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { videoAskOf } from '../void-live-deploy/lib/video.js';

test('listen asks on the card, and the explicit video forms without one', () => {
  for (const a of ['audio only', 'audio-only mode', 'listen mode', 'listening mode on', 'just the audio', 'only the sound', 'switch to audio only']) assert.deepEqual(videoAskOf(a, { hasCard: true }), { kind: 'listen', on: true }, a);
  for (const a of ['audio only video', 'play the video as audio only', 'audio only player']) assert.deepEqual(videoAskOf(a), { kind: 'listen', on: true }, a);
  for (const a of ['show the video', 'show the video again', 'bring back the full player', 'audio only off', 'exit listen mode', 'video mode']) assert.deepEqual(videoAskOf(a, { hasCard: true }), { kind: 'listen', on: false }, a);
});
test('without a card the bare forms leave the ask to other skills, and the old watch asks are unchanged', () => {
  for (const a of ['audio only', 'listen mode', 'just the audio', 'show the video', 'video mode', 'listen to music']) assert.equal(videoAskOf(a), null, a);
  assert.deepEqual(videoAskOf('captions on', { hasCard: true }), { kind: 'captions', on: true });
  assert.equal(videoAskOf('play the moon landing video').kind, 'play');
  assert.equal(videoAskOf('speed 1.5x', { hasCard: true }).kind, 'speed');
});
test('the card wires listen mode and the accessibility pass', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/video.js', import.meta.url), 'utf8');
  assert.ok(src.includes("width:200px;height:200px"), 'listen mode is the 200 x 200 square');
  assert.ok(/q\.kind === 'listen'/.test(src), 'the ask reaches the card');
  assert.ok(src.includes('class="g-btn vd-listen" aria-pressed="false"') && src.includes('class="g-btn vd-cc" aria-pressed="false"'));
  assert.ok(src.includes("role=\"status\" aria-live=\"polite\""), 'a polite live line');
  assert.ok(src.includes("setAttribute('role', 'region')") && src.includes("'Video player'"), 'a labelled region');
  assert.ok(/e\.key === 'Enter' \|\| e\.key === ' '/.test(src), 'Enter or Space plays a result');
  assert.ok(!/display:\s*none[^;]*vd-frame|visibility:\s*hidden/.test(src), 'the player is never hidden');
});
