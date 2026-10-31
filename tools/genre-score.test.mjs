// Verse holds its songs against real songs of their kind (tools/genre-refs.mjs measures Creative Commons tracks from the Internet Archive;
// lib/genre-score.js scores a song card's own render against them). Here: only licences that allow a paid site to measure and credit a track get
// in, the search and the file pick are the ones the tool says, a click track made here is measured at its own tempo by the same pipeline, a song
// is scored against the right reference, a kind with no reference gets no score, and the reference file, once it exists, holds only real
// tracks with their credits whose average is the average of their own profiles. Run: node --test tools/genre-score.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GENRES, OUT, licenseOk, searchUrl, pickFile, creditOf, decode, profileOf, RATE } from './genre-refs.mjs';
import { refKey, scoreOf, scoreLine, loadRefs, REFS_URL } from '../void-live-deploy/lib/genre-score.js';
import { averageOf, METRICS } from '../void-live-deploy/lib/rap-ears.js';
import { arrange } from '../void-live-deploy/lib/arrange.js';
import { compose } from '../void-live-deploy/lib/compose.js';

test('only Creative Commons licences without NonCommercial get in', () => {
  for (const u of ['https://creativecommons.org/licenses/by/3.0/', 'http://creativecommons.org/licenses/by-sa/4.0/', 'https://creativecommons.org/licenses/by-nd/2.5/',
    'https://creativecommons.org/publicdomain/zero/1.0/']) assert.ok(licenseOk(u), u);
  for (const u of ['https://creativecommons.org/licenses/by-nc/3.0/', 'http://creativecommons.org/licenses/by-nc-sa/3.0/us/', 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
    'https://example.com/licenses/by/3.0/', '', null]) assert.ok(!licenseOk(u), String(u));
});

test('the search asks the netlabels for Creative Commons audio with the genre tags, most downloaded first', () => {
  const u = new URL(searchUrl(GENRES[0])), q = u.searchParams.get('q');
  assert.equal(u.origin, 'https://archive.org'); assert.match(q, /collection:netlabels/); assert.match(q, /licenseurl:\*creativecommons\*/); assert.match(q, /subject:"heavy metal"/);
  assert.deepEqual(u.searchParams.getAll('sort[]'), ['downloads desc']); assert.ok(u.searchParams.getAll('fl[]').includes('licenseurl'));
  assert.deepEqual(new Set(GENRES.map((g) => g.id)), new Set(['heavy', 'beat', 'happy', 'rainy', 'dark', 'epic', 'lullaby']), 'every kind of song Verse writes has a genre');
});

test('the file measured is the first full MP3, never a preview or a 64 kb copy, and the credit names it', () => {
  const files = [{ name: 'cover.jpg', format: 'JPEG', size: '90000' }, { name: '01_intro_64kb.mp3', format: '64Kbps MP3', size: '900000' }, { name: '01_intro.mp3', format: 'VBR MP3', size: '300000' },
    { name: '02_song.mp3', format: 'VBR MP3', size: '6000000', title: 'Song', artist: 'Band' }, { name: '03_next.mp3', format: 'VBR MP3', size: '7000000' }];
  assert.equal(pickFile(files).name, '02_song.mp3'); assert.equal(pickFile([{ name: 'a.flac', format: 'Flac', size: '9000000' }]), null);
  const c = creditOf({ identifier: 'netlabel-001', title: 'Album', creator: ['Band'], licenseurl: 'https://creativecommons.org/licenses/by/3.0/' }, files[3]);
  assert.deepEqual(c, { id: 'netlabel-001', title: 'Song', creator: 'Band', license: 'https://creativecommons.org/licenses/by/3.0/', page: 'https://archive.org/details/netlabel-001', file: '02_song.mp3' });
});

test('a click track made here, encoded and decoded by ffmpeg, is measured at its own tempo (inside the 60 to 120 the ears fold every tempo into)', { skip: spawnSync('ffmpeg', ['-version']).status !== 0 && 'no ffmpeg here' }, () => {
  const sec = 20, n = sec * RATE, pcm = new Float32Array(n * 2), beat = Math.round(RATE * 60 / 96);
  for (let s = 0; s < n; s += beat) for (let i = 0; i < 2000 && s + i < n; i++) { const v = 0.6 * Math.exp(-i / 300) * Math.sin(i * 0.3); pcm[2 * (s + i)] = v; pcm[2 * (s + i) + 1] = v; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gref-')), raw = path.join(dir, 'c.f32'), mp3 = path.join(dir, 'c.mp3');
  fs.writeFileSync(raw, Buffer.from(pcm.buffer));
  const enc = spawnSync('ffmpeg', ['-v', 'error', '-f', 'f32le', '-ac', '2', '-ar', String(RATE), '-i', raw, '-b:a', '192k', mp3]);
  if (enc.status !== 0) { fs.rmSync(dir, { recursive: true, force: true }); return; } // an ffmpeg with no MP3 encoder: nothing to decode
  const p = profileOf(decode(mp3)); fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(p && Math.abs(p.bpm - 96) <= 1.5, 'heard ' + (p && p.bpm) + ' BPM for 96');
});

const REFS = { genres: { heavy: { label: 'metal and hard rock', tracks: [{ id: 'a' }, { id: 'b' }],
  average: { bpm: 120, swing: 0.5, tight: 10, density: 4, lufs: -9, plr: 9, bands: { sub: -20, low: -8, mid: -6, presence: -12, air: -20 }, width: 6 } } } };

test('a heavy song is held against the heavy reference, a lullaby against the lullaby one', () => {
  assert.equal(refKey(arrange('make a heavy metal song')), 'heavy'); assert.equal(refKey(compose('make me a lullaby')), 'lullaby'); assert.equal(refKey(compose('make a beat')), 'beat');
});

test('a song like the reference scores 100; a quiet, slow one scores lower and says what is furthest off', () => {
  const same = scoreOf(REFS.genres.heavy.average, REFS, 'heavy');
  assert.equal(same.score, 100); assert.deepEqual(same.gaps, []); assert.match(scoreLine(same), /^Against 2 real metal and hard rock tracks .*100 of 100 close\. No measure is far off\.$/);
  const quiet = scoreOf({ ...REFS.genres.heavy.average, lufs: -24, bpm: 90 }, REFS, 'heavy');
  assert.ok(quiet.score < 80, 'score ' + quiet.score);
  assert.ok(quiet.gaps.some((g) => g.key === 'lufs') && quiet.gaps.some((g) => g.key === 'bpm'));
  assert.match(scoreLine(quiet), /Furthest off: .*loudness \(-24 LUFS here, -9 LUFS in theirs\)/);
});

test('a kind with no reference gets no score, never a made-up one', () => {
  assert.equal(scoreOf(REFS.genres.heavy.average, REFS, 'lullaby'), null); assert.equal(scoreOf(REFS.genres.heavy.average, null, 'heavy'), null);
  assert.equal(scoreOf(REFS.genres.heavy.average, { genres: { heavy: { ...REFS.genres.heavy, tracks: [] } } }, 'heavy'), null);
  assert.match(scoreLine(null), /no real recordings of this kind of song measured yet, so it gives no score/);
});

test('the references load once a page, and a missing file is tried again next time', async () => {
  const seen = []; let ok = false;
  const fetchFn = async (u) => { seen.push(u); return ok ? { ok: true, json: async () => REFS } : { ok: false, status: 404 }; };
  assert.equal(await loadRefs(fetchFn), null); ok = true;
  assert.equal(await loadRefs(fetchFn), REFS); assert.equal(await loadRefs(fetchFn), REFS);
  assert.deepEqual(seen, [REFS_URL, REFS_URL]);
});

test('the reference file, once made, holds only real credited tracks whose average is their own', { skip: !fs.existsSync(OUT) && 'not made yet: .github/workflows/genre-refs.yml makes it' }, () => {
  const refs = JSON.parse(fs.readFileSync(OUT, 'utf8')), ids = new Set(GENRES.map((g) => g.id));
  for (const [id, g] of Object.entries(refs.genres)) {
    assert.ok(ids.has(id), id + ' is a genre Verse writes'); assert.ok(g.tracks.length > 0, id + ' has tracks');
    for (const t of g.tracks) {
      assert.ok(licenseOk(t.license), id + ': ' + t.id + ' licence ' + t.license); assert.equal(t.page, 'https://archive.org/details/' + t.id);
      assert.ok(t.title && t.creator && t.file, id + ': ' + t.id + ' is credited'); assert.ok(t.profile && t.profile.seconds >= 4, id + ': ' + t.id + ' was measured');
    }
    const avg = averageOf(g.tracks.map((t) => t.profile));
    for (const m of METRICS) { const k = m.key.split('.'), a = k.reduce((o, x) => o && o[x], g.average), b = k.reduce((o, x) => o && o[x], avg); assert.equal(a, b, id + ' ' + m.key); }
  }
});
