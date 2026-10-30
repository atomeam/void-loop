// Body asks people type (skills/heart.js, skills/breath.js): the fat-burning heart rate in plain words, and a breathing
// guide for "help me calm down" / "i can't sleep" (4-7-8, the pattern people use to fall asleep).
// Run: node --test tools/body-asks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import heart from '../void-live-deploy/skills/heart.js';
import breath, { breathOf, stepAt } from '../void-live-deploy/skills/breath.js';

test('heart: the fat-burning heart rate, asked plainly', () => {
  for (const a of ['what heart rate burns fat', 'what heart rate burns the most fat', 'best heart rate to burn fat', 'fat burning zone',
    "what's the fat burning zone", 'heart rate for fat loss', 'fat burning heart rate', 'fat burning heart rate for a 35 year old'])
    assert.ok(heart.match(a, a), a);
  for (const a of ['what burns fat', 'foods that burn fat', 'does running burn fat', 'fat loss tips', 'heart rate monitor'])
    assert.ok(!heart.match(a, a), a);
});

test('breath: calming and falling asleep open a breathing guide', () => {
  assert.equal(breathOf('help me calm down'), 'box');
  assert.equal(breathOf('help me relax'), 'box');
  assert.equal(breathOf('calm me down'), 'box');
  assert.equal(breathOf("i can't sleep"), '478');
  assert.equal(breathOf('i cant fall asleep'), '478');
  assert.equal(breathOf('box breathing'), 'box');
  for (const a of ['calm down song', 'i cant sleep lyrics', 'how to relax a muscle', 'relax'])
    assert.equal(breathOf(a), null, a);
});

test('breath: a frame stamped before the start shows no rounds done (seen live as "-1 rounds done")', () => {
  for (const p of ['box', '478', 'resonance']) {
    const s = stepAt(p, -16);
    assert.equal(s.cycle, 0, p);
    assert.equal(s.phase, 0, p);
    assert.ok(s.frac >= 0 && s.frac < 1, p);
    assert.deepEqual(stepAt(p, NaN), stepAt(p, 0), p);
  }
  assert.equal(stepAt('478', 19000).cycle, 1);
  assert.equal(breath.suite().ok, true);
});
