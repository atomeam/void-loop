// The naming audit's check fails only on drift: a feature the gate's last measurement credits the page with, now unnamed. A feature
// the gate already records as lacking is a known gap, and a file never measured credits nothing. Run: node --test tools/naming-audit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { lackingBySlug, splitByCredit } from './naming-audit.mjs';

const ev = (floor, text) => ({ [floor]: { completeness: { verdict: 'worse', evidence: 'Verse (/x/) 4 of 6 things a full answer shows vs the bar ' + text } } });

test('the lacking list is read from each floor completeness row, keyed by its features file', () => {
  const l = lackingBySlug({ floors: { ...ev('coin flip', '6 of 6 (Verse lacks: a flip counter, sound)'), ...ev('word count', '5 of 6 (Verse lacks: none)'), speedy: { speed: { evidence: 'x' } } } });
  assert.deepEqual(Object.keys(l).sort(), ['coin-flip', 'word-count']);
  assert.equal(l['word-count'].size, 0, 'measured, lacking nothing: an empty list');
  assert.ok([...l['coin-flip']][0].includes(', sound, '));
});

test('a name with commas or brackets in it, and a site-lacks part, are read whole', () => {
  const l = lackingBySlug({ floors: ev('weather', '9 of 9 (Verse lacks: Hazard alerts (watches, warnings), a share link; site lacks: wind)') });
  const rows = splitByCredit([{ floor: 'weather', unnamed: [{ feature: 'Hazard alerts (watches, warnings)' }, { feature: 'a share link' }, { feature: 'wind' }] }], l);
  assert.deepEqual(rows[0].known.map((u) => u.feature), ['Hazard alerts (watches, warnings)', 'a share link']);
  assert.deepEqual(rows[0].drift.map((u) => u.feature), ['wind'], 'what only the other site lacks is still credited to Verse');
});

test('a known gap is not drift; a credited feature gone unnamed is; a file never measured fails on nothing', () => {
  const l = lackingBySlug({ floors: { ...ev('coin flip', '6 of 6 (Verse lacks: sound)'), ...ev('word count', '6 of 6 (Verse lacks: none)') } });
  const rows = splitByCredit([
    { floor: 'coin-flip', unnamed: [{ feature: 'Sound' }, { feature: 'a flip counter' }] },
    { floor: 'word-count', unnamed: [{ feature: 'reading time' }] },
    { floor: 'prizes', unnamed: [{ feature: 'a draw date' }] },
  ], l);
  assert.deepEqual(rows[0].known.map((u) => u.feature), ['Sound'], 'case does not matter');
  assert.deepEqual(rows[0].drift.map((u) => u.feature), ['a flip counter']);
  assert.deepEqual(rows[1].drift.map((u) => u.feature), ['reading time'], 'measured with nothing lacking: every unnamed feature is drift');
  assert.deepEqual([rows[2].drift, rows[2].unmeasured.map((u) => u.feature)], [[], ['a draw date']]);
});

test('a feature name that is only part of a lacking name is not taken for it', () => {
  const rows = splitByCredit([{ floor: 'news', unnamed: [{ feature: 'story ages' }] }], lackingBySlug({ floors: ev('news', '4 of 6 (Verse lacks: live story ages)') }));
  assert.deepEqual(rows[0].drift.map((u) => u.feature), ['story ages']);
});

test('the rendered audit waits for a page\'s own fetch to answer, so a page that draws its rows from it (weather) is read drawn', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./naming-audit.mjs', import.meta.url), 'utf8');
  assert.match(src, /waitForLoadState\('networkidle', \{ timeout: \d+ \}\)\.catch\(/, 'waits for the network to go quiet, and never fails the read on it');
  assert.doesNotMatch(src, /waitForTimeout\(1600\)/, 'not the fixed 1.6 s that read /weather/ before its forecast came');
});
