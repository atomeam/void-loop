// The rating line on a card (lib/rating-note.js): thin ratings speak, strong ones stay quiet. Run: node --test tools/rating-note.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratingOf, noteText, THIN } from '../void-live-deploy/lib/rating-note.js';
import { readFileSync } from 'node:fs';

const fams = { families: [{ skills: [{ name: 'poster', tier: 'tested', why: 'a self-test' }, { name: 'zz', tier: 'experiment', why: '' }, { name: 'weather', tier: 'proven', why: 'a self-test, 45 real asks' }, { name: 'convert', tier: 'checked', why: '3 browser-suite mentions' }] }] };

test('ratingOf finds a skill by name and says nothing for the unknown or for junk', () => {
  assert.deepEqual(ratingOf(fams, 'poster'), { tier: 'tested', why: 'a self-test' });
  assert.equal(ratingOf(fams, 'nope'), null); assert.equal(ratingOf(null, 'poster'), null); assert.equal(ratingOf({ families: [null, { skills: [null, { name: 'x' }] }] }, 'x'), null);
});

test('only experiment and tested speak; checked and proven stay quiet', () => {
  assert.deepEqual(THIN, ['experiment', 'tested']);
  assert.match(noteText(ratingOf(fams, 'poster')), /^rated tested \(a self-test\): a young skill/);
  assert.match(noteText(ratingOf(fams, 'zz')), /^rated experiment: not checked yet/);
  assert.equal(noteText(ratingOf(fams, 'weather')), ''); assert.equal(noteText(ratingOf(fams, 'convert')), ''); assert.equal(noteText(null), '');
});

test('the real ratings file has names this can find', () => {
  const real = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8'));
  const all = real.families.flatMap((f) => f.skills);
  assert.ok(all.length > 100, 'the file lists the skills');
  // 2026-10-30: every skill reached checked or proven, so a thin one is not always there; each skill's note matches its tier
  for (const s of all) assert.equal(!!noteText(ratingOf(real, s.name)), THIN.includes(s.tier), s.name);
});
