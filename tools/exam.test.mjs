// node --test tools/exam.test.mjs — an ask's score is the checks it passed, a drop is a regression, the will takes the lowest domain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, domainScore, lowestDomain, compareRuns, examWants, holdoutSlice, isoWeek, askId, skillName } from '../void-live-deploy/lib/exam.js';
import { examBoost, score } from './conductor-core.mjs';
import { songAskOf } from '../void-live-deploy/lib/hear.js';
import { vatStateOf } from '../void-live-deploy/lib/vat-ask.js';
import { compute } from '../void-live-deploy/lib/vat.js';
import { readFileSync } from 'node:fs';

const seen = (over) => ({ text: 'x'.repeat(80), note: 'skill:hear', ms: 3000, overflow: false, ...over });

test('a song scores only on a real preview that names the track', () => {
  const audio = { src: 'https://audio-ssl.itunes.apple.com/a.m4a', status: 200, type: 'audio/x-m4p', currentTime: 1.2 };
  const good = judge('songs', seen({ text: 'Bohemian Rhapsody Queen A Night at the Opera ' + 'x'.repeat(40), audio }), { track: 'Bohemian Rhapsody', artist: 'Queen' });
  assert.equal(good.checks.audio, true);
  assert.equal(good.checks.title, true);
  assert.equal(good.checks.artist, true);
  assert.ok(good.score > 80);
  const fake = judge('songs', seen({ text: 'Cartoon Lump ' + 'x'.repeat(40), note: 'skill:music' }), { track: 'Bohemian Rhapsody', artist: 'Queen' });
  assert.equal(fake.checks.audio, false);
  assert.equal(fake.checks.skill, false);
  assert.ok(fake.score < 50);
});

test('a calculator scores on the number, and a refusal is not an answer', () => {
  const hit = judge('calculator', { text: 'Calculated 40.8 which is 17% of 240 and the working is shown here in full.', note: 'calc', ms: 800, overflow: false }, { numbers: ['40.8'] });
  assert.equal(hit.checks.number, true);
  assert.equal(hit.checks.skill, true);
  const no = judge('calculator', { text: "I don't know this yet, but I wrote it down for later and that is all.", note: 'calc', ms: 800, overflow: false }, { numbers: ['40.8'] });
  assert.equal(no.checks.answered, false);
});

test('an outage is left out of the score, not counted as a miss', () => {
  const j = judge('songs', seen({ audio: { src: 'https://audio-ssl.itunes.apple.com/a.m4a', status: 200, type: 'audio/mpeg', currentTime: 1 } }), {});
  assert.equal(j.checks.title, null);
  assert.equal(j.failed.includes('title'), false);
});

test('the lowest domain, a tie, and a regression', () => {
  assert.equal(lowestDomain({ songs: 10, podcasts: 10, videos: 40 }).domain, 'songs');
  assert.equal(lowestDomain({ songs: 40, podcasts: 0, videos: 10 }).domain, 'podcasts');
  const prev = { domains: { songs: { score: 20 }, weather: { score: 80 } } };
  const next = { domains: { songs: { score: 70 }, weather: { score: 74 } } };
  assert.equal(compareRuns(prev, next).ok, false);
  assert.equal(compareRuns(prev, next).drops[0].domain, 'weather');
  assert.equal(compareRuns(prev, { domains: { songs: { score: 70 }, weather: { score: 78 } } }).ok, true);
});

test('the conductor lifts a job that names the lowest domain', () => {
  const exam = { lowest: { domain: 'songs', score: 10 }, domains: { songs: { fails: [{ ask: 'play hey jude by the beatles' }] } } };
  const job = { target: 'will:fix-the-songs-exam', ask: 'fix the songs exam: "play hey jude by the beatles"', note: '', at: new Date().toISOString() };
  const other = { target: 'will:something-else', ask: 'paint a picture', note: '', at: job.at };
  assert.ok(examBoost(job, exam) > examBoost(other, exam));
  assert.ok(score(job, Date.now(), exam) > score(other, Date.now(), exam));
});

test('the will is handed the failing asks of the lowest domain, and not the holdout text', () => {
  const wants = examWants({ lowest: { domain: 'songs', score: 12 }, domains: { songs: { fails: [{ ask: 'play hey jude by the beatles', failed: ['audio'] }] } } });
  assert.equal(wants.length, 1);
  assert.match(wants[0].title, /songs exam/);
  assert.match(wants[0].title, /hey jude/);
  assert.ok(wants[0].weight >= 120);
  assert.equal(wants[0].source, 'exam:songs');
});

test('the holdout rotates by week and never repeats a public ask', () => {
  const pool = [1, 2, 3, 4, 5, 6].map((n) => ({ ask: 'ask ' + n }));
  const a = holdoutSlice(pool, '2026-W44', 4).map((x) => x.ask).join();
  const b = holdoutSlice(pool, '2026-W45', 4).map((x) => x.ask).join();
  assert.notEqual(a, b);
  assert.equal(holdoutSlice(pool, '2026-W44', 4).map((x) => x.ask).join(), a);
  assert.match(isoWeek(new Date('2026-11-04T00:00:00Z')), /^2026-W\d{2}$/);
  assert.equal(askId('same'), askId('same'));
  assert.notEqual(askId('same'), askId('other'));
  assert.equal(skillName('skill:hear'), 'hear');
  assert.equal(skillName('calc'), 'calc');
});

test('the mean ignores an unmeasured ask', () => {
  assert.equal(domainScore([{ score: 50 }, { score: null }, { score: 100 }]), 75);
});

test('every public calculator ask has a number the engine itself would show', () => {
  const pub = JSON.parse(readFileSync(new URL('./exam-public.json', import.meta.url), 'utf8'));
  assert.equal(pub.calculator.length, 16);
  for (const a of pub.calculator) {
    const vat = vatStateOf(a.ask);
    if (vat) {
      const r = compute(vat);
      assert.ok(r && r.ok, a.ask);
      assert.ok(String(r.vat).length > 0);
    } else {
      const m = a.ask.match(/(\d+(?:\.\d+)?)%\s*of\s+(\d+(?:\.\d+)?)/);
      assert.ok(m, a.ask);
      const n = Math.round((Number(m[1]) / 100) * Number(m[2]) * 100) / 100;
      assert.ok(Number.isFinite(n));
    }
  }
  for (const d of ['videos', 'podcasts', 'songs', 'weather', 'directions', 'recipes', 'news', 'sports']) {
    assert.equal(pub[d].length, 16, d);
    const asks = new Set();
    for (const a of pub[d]) { assert.ok(!asks.has(a.ask.toLowerCase()), a.ask); asks.add(a.ask.toLowerCase()); }
  }
  for (const a of pub.songs) assert.ok(songAskOf(a.ask), a.ask);
});
