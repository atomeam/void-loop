import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeAsk, bodyOf, wantsOf, tally, median, TOP, ASKS } from './visitor-pass.mjs';
import { scoresAsk } from '../void-live-deploy/lib/scores.js';
import { pocketOf } from '../void-live-deploy/skills/translate.js';

test('the frame comes off and a stuck card is not an answer', () => {
  const raw = 'play music ANSWER — FROM VERSE … COPY CARD SAVE CARD SHARE ☆ SAVE COPY TEXT';
  assert.match(bodyOf(raw), /play music/);
  assert.equal(bodyOf(raw).includes('COPY CARD'), false);
  const spec = ASKS.find((a) => a.ask === 'play music');
  assert.equal(judgeAsk(spec, { note: 'short topic', text: raw, ms: 2000 }).ok, false);
});

test('a right answer from the skill that owns it passes, and a refusal does not', () => {
  const weather = ASKS.find((a) => a.ask.startsWith("what's the weather"));
  assert.equal(judgeAsk(weather, { note: 'skill:weather', text: 'Lakeland, Florida 72° Clear', ms: 1800 }).ok, true);
  assert.equal(judgeAsk(weather, { note: 'skill:weather', text: 'I couldn\'t find "Lakeland Florida".', ms: 900 }).ok, false);
  const day = ASKS.find((a) => a.ask === 'what day is it');
  assert.equal(judgeAsk(day, { note: 'today', text: 'Tuesday, November 3, 2026', ms: 400 }).ok, true);
});

test('each failed ask becomes one visible fix, and a second copy is not filed', () => {
  const jobs = wantsOf([{ ok: false, ask: 'sports scores', why: ['refused'] }, { ok: true, ask: 'news' }, { ok: false, ask: 'sports scores', why: ['refused'] }], ['visit:sports-scores']);
  assert.equal(jobs.length, 0);
  const fresh = wantsOf([{ ok: false, ask: 'map of Lakeland Florida', why: ['refused'] }]);
  assert.equal(fresh[0].target, 'visit:map-of-lakeland-florida');
  assert.equal(fresh[0].priority, 'visible');
  assert.equal(tally([{ ok: true, ms: 10 }, { ok: false, ms: 30, why: ['refused'] }]).refused, 1);
  assert.equal(median([8, 1, 3]), 3);
  assert.ok(TOP.length >= 8 && TOP.length <= 20);
});

test('sports scores names the NFL board, and hello in Spanish is kept for a slow link', () => {
  assert.equal(scoresAsk('sports scores').league, 'nfl');
  assert.equal(scoresAsk('live scores'), null);
  assert.equal(scoresAsk('nba scores').league, 'nba');
  assert.equal(pocketOf('hello', 'Spanish'), 'Hola');
  assert.equal(pocketOf('hello', 'French'), 'Bonjour');
  assert.equal(pocketOf('serendipity', 'Spanish'), '');
});
