// tools/film-grade.mjs (frontier #26 step 2): each film grades itself from ffmpeg's freezedetect, the taps it showed and whether the
// hook and ending cards rendered; a film under the bar is re-shot once with another path through the page and the better take kept.
// Run: node --test tools/film-grade.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stillsOf, durationOf, scorecard, summaryLine, gradeAndKeep, tapOrder, keepBetter } from './film-grade.mjs';

const LOG = `Input #0, matroska,webm, from 'f.webm':
  Duration: 00:00:21.48, start: 0.000000, bitrate: 300 kb/s
[Parsed_metadata_1 @ 0x1] lavfi.freezedetect.freeze_start: 3.2
[Parsed_metadata_1 @ 0x1] lavfi.freezedetect.freeze_duration: 1.3
[Parsed_metadata_1 @ 0x1] lavfi.freezedetect.freeze_end: 4.5
[Parsed_metadata_1 @ 0x1] lavfi.freezedetect.freeze_start: 19.9`;

test('reads the duration and the still stretches, closing one still running at the end', () => {
  assert.equal(durationOf(LOG), 21.48);
  assert.equal(durationOf('no duration here'), 0);
  const s = stillsOf(LOG, 21.48);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], { start: 3.2, end: 4.5 });
  assert.ok(Math.abs(s[1].end - 21.48) < 1e-9);
  assert.deepEqual(stillsOf(''), []);
});
test('a lively film clears the bar; a still quarter, a long still or no tap does not', () => {
  assert.equal(scorecard({ seconds: 20, stills: [{ start: 2, end: 3 }], taps: 4 }).pass, true);
  const share = scorecard({ seconds: 20, stills: [{ start: 0, end: 2.5 }, { start: 5, end: 7.6 }, { start: 9, end: 10 }], taps: 3 });
  assert.equal(share.pass, false); assert.match(share.why.join(), /31% of the film is still/);
  const long = scorecard({ seconds: 40, stills: [{ start: 10, end: 14 }], taps: 3 });
  assert.equal(long.pass, false); assert.match(long.why.join(), /one still stretch of 4\.0 s/);
  assert.match(scorecard({ seconds: 20, stills: [], taps: 0 }).why.join(), /no tap shown/);
  assert.equal(scorecard({ seconds: 20, stills: [], taps: null }).pass, true, 'a film with no tap count (a shipped ask) is not failed for it');
});
test('the summary line says the verdict and the numbers', () => {
  assert.equal(summaryLine('demo-1', scorecard({ seconds: 20, stills: [{ start: 1, end: 2 }], taps: 1 })), '- demo-1: clears the bar · 20 s, 1 s still, longest 1 s, 1 tap');
});
test('a real film: half of it still is under the bar, the scorecard lands in its .json (needs ffmpeg)', { skip: spawnSync('ffmpeg', ['-version']).status !== 0 && 'no ffmpeg' }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'film-grade-')), video = path.join(dir, 'f.webm'), meta = path.join(dir, 'f.json');
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=160x120:rate=10', '-f', 'lavfi', '-i', 'color=c=black:duration=3:size=160x120:rate=10', '-filter_complex', '[0][1]concat=n=2:v=1[v]', '-map', '[v]', '-c:v', 'libvpx', video]);
  assert.equal(r.status, 0, String(r.stderr));
  writeFileSync(meta, JSON.stringify({ id: 'f', taps: 2 }));
  const g = gradeAndKeep('f', video, meta);
  assert.equal(g.pass, false);
  assert.ok(g.stillSeconds >= 2.5 && g.stillSeconds <= 3.1, String(g.stillSeconds));
  assert.deepEqual(JSON.parse(readFileSync(meta, 'utf8')).grade, g);
});
test('grading never throws: a film that cannot be read is still kept', () => {
  assert.equal(gradeAndKeep('missing', '/nonexistent/film.webm', ''), null);
});
test('a hook or ending card that did not render puts the film under the bar', () => {
  const ok = scorecard({ seconds: 20, stills: [], taps: 2, cards: { hook: true, ending: true } });
  assert.equal(ok.pass, true); assert.deepEqual(ok.cards, { hook: true, ending: true });
  const bad = scorecard({ seconds: 20, stills: [], taps: 2, cards: { hook: true, ending: false } });
  assert.equal(bad.pass, false); assert.deepEqual(bad.why, ['the ending card did not render']);
  assert.equal(scorecard({ seconds: 20, stills: [], taps: 2 }).cards, undefined, 'an older film with no card check is not marked down');
});
test('the re-shoot takes another path through the page', () => {
  assert.deepEqual(tapOrder(['start'], ['a', 'b', 'c']), ['start', 'a', 'b', 'c']);
  assert.deepEqual(tapOrder(['start'], ['a', 'b', 'c'], true), ['c', 'b', 'a', 'start']);
  const rest = ['a', 'b']; tapOrder([], rest, true); assert.deepEqual(rest, ['a', 'b'], 'the page order is not changed in place');
});
test('the better take is kept: clears the bar, then fewer reasons, less still, more taps; a tie keeps the first', () => {
  const g = (pass, why, stillShare, taps) => ({ pass, why, stillShare, taps });
  assert.equal(keepBetter(g(false, ['x'], 0.4, 1), g(true, [], 0.1, 3)), 'second');
  assert.equal(keepBetter(g(true, [], 0.1, 3), g(false, ['x'], 0, 9)), 'first');
  assert.equal(keepBetter(g(false, ['x', 'y'], 0.4, 1), g(false, ['x'], 0.5, 1)), 'second');
  assert.equal(keepBetter(g(false, ['x'], 0.4, 1), g(false, ['x'], 0.3, 1)), 'second');
  assert.equal(keepBetter(g(false, ['x'], 0.4, 1), g(false, ['x'], 0.4, 2)), 'second');
  assert.equal(keepBetter(g(false, ['x'], 0.4, 1), g(false, ['x'], 0.4, 1)), 'first');
  assert.equal(keepBetter(g(false, ['x'], 0.4, 1), null), 'first');
  assert.equal(keepBetter(null, g(false, ['x'], 0.4, 1)), 'second');
});
test('record.mjs checks the hook and ending cards and re-shoots a film under the bar once', () => {
  const src = readFileSync(new URL('./record.mjs', import.meta.url), 'utf8');
  assert.match(src, /cards\.hook = !!\(await fx\('shown'\)\)/);
  assert.match(src, /cards\.ending = !!\(await fx\('shown'\)\)/);
  assert.match(src, /tapOrder\(starts, .*alt\)/);
  assert.match(src, /alt: true/); assert.match(src, /keepBetter\(r\.grade, again\.grade\)/);
});
