// The router keeps corrections to Verse out of the look skill (asked by Verse: its probe of "open the self card and tell void ... wrong" came within
// 0.02 of look, which shares the word "void"). Run: node --test tools/router-self.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../void-live-deploy/lib/router.js';
const CORRECT = ['tell void what it got wrong', 'open your self card, I want to correct you', 'correct void on its self card',
  // Verse's will, 2026-10-18, its top two wants: the look skill must never take these (people typed them and look answered)
  'open the self card and tell void what it got wrong', 'open the self card and tell Verse what it got wrong', 'show the self card and correct it'];
test('corrections are examples of the self card and near misses of look, never the other way round', () => {
  for (const q of CORRECT) {
    assert.ok(SKILLS.self.examples.includes(q), 'self has: ' + q);
    assert.ok(SKILLS.look.near.includes(q), 'look keeps away from: ' + q);
    assert.ok(!SKILLS.look.examples.includes(q), q);
  }
  assert.ok(SKILLS.look.near.includes('void got this wrong'));
});
test('no example is also a near miss of the same skill, and no two skills share an example', () => {
  const seen = new Map();
  for (const [name, s] of Object.entries(SKILLS)) for (const e of s.examples) {
    assert.ok(!(s.near || []).includes(e), name + ': ' + e);
    assert.ok(!seen.has(e.toLowerCase()), e + ' is an example of both ' + seen.get(e.toLowerCase()) + ' and ' + name);
    seen.set(e.toLowerCase(), name);
  }
});
