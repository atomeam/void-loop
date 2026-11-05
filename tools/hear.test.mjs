// node --test tools/hear.test.mjs — a named song is a recording, picked from an iTunes-shaped reply, and a video ask is not one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import hearSkill from '../void-live-deploy/skills/hear.js';
import { songAskOf, pickTrack, covers, findTrack } from '../void-live-deploy/lib/hear.js';
import { videoAskOf } from '../void-live-deploy/lib/video.js';

const HIT = { trackName: 'Bohemian Rhapsody', artistName: 'Queen', collectionName: 'A Night at the Opera', previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/v4/x/mzaf_1.plus.aac.p.m4a' };

test('only a title with an artist is a song ask', () => {
  assert.deepEqual(songAskOf('play bohemian rhapsody by queen'), { title: 'bohemian rhapsody', artist: 'queen' });
  assert.deepEqual(songAskOf('Play the song Hey Jude by The Beatles'), { title: 'Hey Jude', artist: 'The Beatles' });
  assert.equal(songAskOf('play despacito'), null);
  assert.equal(songAskOf('make me a song'), null);
  assert.equal(songAskOf('play a video of the moon landing'), null);
  assert.equal(songAskOf('play the latest episode of radiolab'), null);
  assert.equal(songAskOf('play chess'), null);
});

test('the preview has to be an Apple preview, and the names have to cover the ask', () => {
  assert.equal(covers('Queen', 'queen'), true);
  assert.ok(pickTrack([HIT], 'bohemian rhapsody', 'queen'));
  assert.equal(pickTrack([{ ...HIT, previewUrl: 'https://evil.example/a.mp3' }], 'bohemian rhapsody', 'queen'), null);
  assert.equal(pickTrack([HIT], 'bohemian rhapsody', 'abba'), null);
  assert.equal(pickTrack([HIT], 'yesterday', 'queen'), null);
});

test('findTrack reads the search JSON and nothing else', async () => {
  const fetchFn = async (url) => {
    assert.match(url, /^https:\/\/itunes\.apple\.com\/search\?/);
    return { ok: true, json: async () => ({ results: [HIT] }) };
  };
  const t = await findTrack('bohemian rhapsody', 'queen', fetchFn);
  assert.equal(t.title, 'Bohemian Rhapsody');
  assert.equal(t.artist, 'Queen');
  assert.match(t.preview, /^https:\/\/audio-ssl\.itunes\.apple\.com\//);
});

test('a song with an artist is no longer a late video search', () => {
  assert.equal(videoAskOf('play bohemian rhapsody by queen', { late: true }), null);
  const v = videoAskOf('play despacito', { late: true });
  assert.equal(v && v.kind, 'play');
  assert.equal(videoAskOf('play a video of the moon landing', { late: true }).kind, 'play');
});

test("hear skill is registered and matches song asks", () => {
  assert.equal(hearSkill.name, "hear");
  assert.ok(hearSkill.match("play bohemian rhapsody by queen", "play bohemian rhapsody by queen"));
  assert.ok(hearSkill.examples.length > 0);
});

test('a song title is escaped before it is written into the card', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/hear.js', import.meta.url), 'utf8');
  assert.match(src, /'&': '&amp;'/);
  assert.match(src, /'<': '&lt;'/);
  assert.match(src, /'>': '&gt;'/);
  assert.match(src, /'"': '&quot;'/);
});
