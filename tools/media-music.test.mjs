// The music lookup (functions/api/media.js, lib/media.js): iTunes first, Deezer when iTunes is away or does not know the song, and an answer from
// no reachable source is "unreachable", sent as a 503 the edge never keeps (owner, 2026-10-19: "I could not reach the music source just now").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickDeezerSong } from '../void-live-deploy/lib/media.js';
import { music, onRequestGet } from '../void-live-deploy/functions/api/media.js';

const deezer = { data: [
  { type: 'track', title: 'Hey Jude (Remastered 2015)', title_short: 'Hey Jude', duration: 431, preview: 'https://cdnt-preview.dzcdn.net/api/1/1/a.mp3', artist: { name: 'The Beatles' }, album: { title: '1', cover_xl: 'https://cdn-images.dzcdn.net/images/cover/x/1000x1000.jpg' } },
] };
const itunes = { results: [{ kind: 'song', trackName: 'Hey Jude', artistName: 'The Beatles', collectionName: '1', primaryGenreName: 'Rock', releaseDate: '1968-08-26', artworkUrl100: 'https://is1.mzstatic.com/a/100x100bb.jpg', previewUrl: 'https://audio.mzstatic.com/a.m4a', trackViewUrl: 'https://music.apple.com/x', trackTimeMillis: 431000 }] };
const fake = (map) => async (u) => { for (const [k, v] of Object.entries(map)) if (u.includes(k)) { if (v instanceof Error) throw v; return v; } throw new Error('no route ' + u); };

test('pickDeezerSong matches on the short title and the artist, keeps only Deezer hosts, and finds nothing for another song', () => {
  const s = pickDeezerSong(deezer.data, 'Hey Jude', 'The Beatles');
  assert.equal(s.title, 'Hey Jude'); assert.equal(s.artist, 'The Beatles'); assert.equal(s.seconds, 431);
  assert.match(s.preview, /dzcdn\.net/); assert.match(s.poster, /dzcdn\.net/);
  assert.equal(pickDeezerSong(deezer.data, 'Let It Be', 'The Beatles'), null);
  assert.equal(pickDeezerSong([{ ...deezer.data[0], preview: 'https://evil.example/a.mp3' }], 'Hey Jude', '').preview, '');
});

test('music: iTunes first; Deezer when iTunes is away; not found when a source answered; unreachable only when none could be reached', async () => {
  assert.deepEqual((await music('Hey Jude', 'The Beatles', fake({ itunes: itunes }))).sources, ['iTunes Search API']);
  const viaDeezer = await music('Hey Jude', 'The Beatles', fake({ itunes: new Error('upstream 403'), deezer: deezer }));
  assert.equal(viaDeezer.verified, true); assert.deepEqual(viaDeezer.sources, ['Deezer API']);
  const missing = await music('No Such Song Here', 'Nobody', fake({ itunes: { results: [] }, deezer: { data: [] } }));
  assert.equal(missing.verified, false); assert.equal(missing.unreachable, undefined);
  const down = await music('Hey Jude', 'The Beatles', fake({ itunes: new Error('upstream 429'), deezer: new Error('timeout') }));
  assert.equal(down.verified, false); assert.equal(down.unreachable, true);
});

test('the endpoint sends an unreachable answer as a 503 marked no-store, so the edge never keeps a failure for a day', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('busy', { status: 429 });
  try {
    const r = await onRequestGet({ request: new Request('https://example.test/api/media?kind=music&title=Hey+Jude&artist=The+Beatles') });
    assert.equal(r.status, 503); assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal((await r.json()).unreachable, true);
  } finally { globalThis.fetch = realFetch; }
});
