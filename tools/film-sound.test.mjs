// The films' own score (tools/film-sound.mjs): one per film id, the same every time, never silent, faded to the film's length.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { scoreOf, channel, ffmpegArgs, PROGRESSIONS } from './film-sound.mjs';

test('a film id always gives the same score, and different films get different ones', () => {
  assert.deepEqual(scoreOf('attention-7'), scoreOf('attention-7'));
  const many = new Set(['attention-7', 'interval-timing', 'miss-board-4', 'ship-1', 'correlation-view'].map((id) => JSON.stringify(scoreOf(id))));
  assert.ok(many.size >= 4, 'five films, at least four scores');
  const s = scoreOf('x'); assert.equal(s.chords.length, 4); assert.ok(s.bpm >= 76 && s.bpm <= 100); assert.ok(s.chords.every((c) => c.length === 3 && c.every((f) => f > 100 && f < 1200)));
  assert.equal(PROGRESSIONS.length, 4);
});

test('the score is a pad, a bass and a pulse with no hard edges, faded in and out to the film\'s length', () => {
  const c = channel(scoreOf('attention-7'));
  assert.match(c, /sin\(2\*PI\*/); assert.match(c, /exp\(-mod\(t,/); assert.match(c, /\*40\)\)/, 'each bar fades at its ends');
  const a = ffmpegArgs('o.m4a', 17.4, 'attention-7'), src = a[a.indexOf('-i') + 1], af = a[a.indexOf('-af') + 1];
  assert.match(src, /^aevalsrc=exprs='.+\|.+':s=44100:d=17\.40$/);
  assert.match(af, /afade=t=in/); assert.match(af, /afade=t=out:st=15\.80:d=1\.6/); assert.match(af, /alimiter/);
  assert.deepEqual(a.slice(-5), ['-c:a', 'aac', '-b:a', '160k', 'o.m4a']);
  assert.match(ffmpegArgs('o.m4a', 9999, 's')[7], /d=180\.00$/, 'never longer than three minutes');
});

// with a real ffmpeg (FFMPEG or one on PATH) the file is written and has sound; CI's record workflow installs ffmpeg
const ff = process.env.FFMPEG || 'ffmpeg', has = spawnSync(ff, ['-version']).status === 0;
test('ffmpeg writes the score as an .m4a with sound in it', { skip: !has && 'no ffmpeg here' }, () => {
  const out = '/tmp/film-sound-test.m4a'; rmSync(out, { force: true });
  assert.equal(spawnSync(ff, ffmpegArgs(out, 3, 'attention-7')).status, 0);
  assert.ok(existsSync(out) && statSync(out).size > 20000);
  const v = spawnSync(ff, ['-hide_banner', '-i', out, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const mean = Number((/mean_volume: (-?[\d.]+) dB/.exec(v) || [])[1]), max = Number((/max_volume: (-?[\d.]+) dB/.exec(v) || [])[1]);
  assert.ok(mean > -30 && mean < -8, 'heard, not loud: ' + mean); assert.ok(max < -0.5, 'never clips: ' + max);
});
