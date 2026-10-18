// Verse's video skill (skills/video.js, lib/video.js, functions/api/video.js): links from every platform become official embeds,
// the asks route, the watch tools parse, and the search route keeps to fixed hosts and needs no KV or model. Run: node --test tools/video.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseVideoUrl, embedUrl, watchUrl, videoAskOf, secondsOf, clockOf, hitsOf, isoSeconds } from '../void-live-deploy/lib/video.js';

test('video: a link from each platform becomes its official embed', () => {
  const e = (u, o) => embedUrl(parseVideoUrl(u), o);
  assert.match(e('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=1m30s'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ\?.*start=90/);
  assert.match(e('https://youtu.be/aqz-KE-bpKQ'), /youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/);
  assert.match(e('https://www.youtube.com/shorts/aqz-KE-bpKQ'), /embed\/aqz-KE-bpKQ/);
  assert.match(e('https://www.youtube.com/watch?v=aqz-KE-bpKQ', { captions: true }), /cc_load_policy=1/);
  assert.equal(e('https://rumble.com/embed/v75qyv0/'), 'https://rumble.com/embed/v75qyv0/?pub=4');
  assert.deepEqual(parseVideoUrl('https://rumble.com/v77xmv8-nasas-artemis-ii-launch.html'), { platform: 'rumble', page: 'https://rumble.com/v77xmv8-nasas-artemis-ii-launch.html', id: null, needsOembed: true });
  assert.match(e('https://vimeo.com/1084537'), /^https:\/\/player\.vimeo\.com\/video\/1084537\?dnt=1/);
  assert.match(e('https://www.dailymotion.com/video/x85fzwv'), /dailymotion\.com\/embed\/video\/x85fzwv/);
  assert.match(e('https://archive.org/details/Apollo11Launch'), /archive\.org\/embed\/Apollo11Launch/);
  assert.match(e('https://spectra.video/w/sXGnj113k5GYzdzzYmr4cY'), /spectra\.video\/videos\/embed\/sXGnj113k5GYzdzzYmr4cY/);
  assert.match(e('https://odysee.com/@veritasium:f/the-video:3'), /odysee\.com\/\$\/embed\/@veritasium:f\/the-video:3/);
  assert.match(e('https://clips.twitch.tv/FunnyClipName', { parent: 'a-to-mind.com' }), /clips\.twitch\.tv\/embed\?clip=FunnyClipName&parent=a-to-mind\.com/);
  assert.match(e('https://www.twitch.tv/videos/123456789'), /player\.twitch\.tv\/\?video=v123456789/);
  assert.equal(watchUrl(parseVideoUrl('https://youtu.be/aqz-KE-bpKQ')), 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  for (const bad of ['https://example.org/guides/getting-started', 'javascript:alert(1)', 'https://www.youtube.com/watch?v=short', 'https://rumble.com/c/whitehouse']) assert.equal(parseVideoUrl(bad), null, bad);
});

test('video: the asks it takes, and the ones it leaves to the games and the page', () => {
  const k = (a, o) => { const q = videoAskOf(a, o); return q && [q.kind, q.query || (q.video && q.video.platform) || '', q.platform || ''].join('|'); };
  assert.equal(k('show me the video of the moon landing'), 'play|the moon landing|');
  assert.equal(k('find a rumble video about bitcoin'), 'search|bitcoin|rumble');
  assert.equal(k('search vimeo for big buck bunny'), 'search|big buck bunny|vimeo');
  assert.equal(k('play the dune trailer'), 'play|dune trailer|');
  assert.equal(k('play cats on youtube'), 'play|cats|youtube');
  assert.equal(k('https://rumble.com/v77xmv8-nasas-artemis-ii-launch.html'), 'play|rumble|');
  assert.equal(k('queue https://youtu.be/aqz-KE-bpKQ'), 'queue|youtube|');
  assert.equal(k('play despacito', { late: true }), 'play|despacito|');
  for (const a of ['play chess', 'play tic tac toe', 'play music', 'play a game', 'play with me', 'play again']) assert.equal(videoAskOf(a, { late: true }), null, a);
  for (const a of ['play despacito', 'https://example.org/x', 'what is a video codec', 'next', 'skip to 2:30 please now']) assert.equal(videoAskOf(a), null, a);
  // the watch tools, while a video is up
  const c = { hasCard: true };
  assert.deepEqual(videoAskOf('skip to 2:30', c), { kind: 'seek', at: 150 });
  assert.deepEqual(videoAskOf('jump to 1:02:03', c), { kind: 'seek', at: 3723 });
  assert.deepEqual(videoAskOf('speed 1.5x', c), { kind: 'speed', rate: 1.5 });
  assert.deepEqual(videoAskOf('play at 2x speed', c), { kind: 'speed', rate: 2 });
  assert.deepEqual(videoAskOf('captions on', c), { kind: 'captions', on: true });
  assert.deepEqual(videoAskOf('turn off subtitles', c), { kind: 'captions', on: false });
  assert.equal(videoAskOf('next', c).kind, 'next');
  assert.equal(videoAskOf('recently watched').kind, 'recent');
  assert.equal(videoAskOf('my queue').kind, 'list');
  assert.equal(videoAskOf('close the video').kind, 'close');
  assert.equal(videoAskOf('switch to dailymotion', c).platform, 'dailymotion');
});

test('video: times and search hits', () => {
  assert.equal(secondsOf('2:30'), 150); assert.equal(secondsOf('1h2m3s'), 3723); assert.equal(secondsOf('90'), 90); assert.equal(secondsOf('soon'), null);
  assert.equal(clockOf(3723), '1:02:03'); assert.equal(clockOf(150), '2:30'); assert.equal(isoSeconds('PT4M13S'), 253);
  assert.deepEqual(hitsOf('dailymotion', { list: [{ id: 'x85fzwv', title: 'MOON LANDING', 'owner.screenname': 'NBC', duration: 124, thumbnail_360_url: 'https://s1.dmcdn.net/x' }, { id: '../evil' }] }),
    [{ platform: 'dailymotion', id: 'x85fzwv', title: 'MOON LANDING', channel: 'NBC', seconds: 124, thumb: 'https://s1.dmcdn.net/x' }]);
  assert.equal(hitsOf('youtube', { items: [{ id: 'aqz-KE-bpKQ', snippet: { title: 'B', channelTitle: 'Blender', thumbnails: { medium: { url: 'u' } } }, contentDetails: { duration: 'PT10M' } }] })[0].seconds, 600);
  assert.deepEqual(hitsOf('archive', null), []);
});

test('video: the route is free-tier safe, fixed hosts, embed only', () => {
  const src = readFileSync(new URL('../void-live-deploy/functions/api/video.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/\.(?:put|get)\(\s*['"`]?void|env\.(?:KV|VOID_KV|DB|AI)\b|\.run\(|gpt-oss/.test(src.replace(/cache\.put/g, '')), 'no KV, D1 or model in /api/video');
  assert.ok(!/fetch\(\s*(?:q|link|url)\b/.test(src), 'the ask never picks the host');
  const skill = readFileSync(new URL('../void-live-deploy/skills/video.js', import.meta.url), 'utf8');
  assert.ok(!/\/api\/(?:memory|mine|watch)|\.mp4|download\(/.test(skill), 'a play writes nothing to the server and downloads nothing');
  const guard = readFileSync(new URL('../void-live-deploy/lib/guard.js', import.meta.url), 'utf8');
  assert.match(guard, /\bvideo: \{ rpm: \d+, body: 0 \}/);
});

test('video: keyless YouTube search reads Piped items into embeddable YouTube hits and falls through to the key notice', async () => {
  const { pipedHits, keylessYouTube, PIPED } = await import('../void-live-deploy/functions/api/video.js');
  const h = pipedHits({ items: [{ type: 'stream', url: '/watch?v=e-P5IFTqB98', title: 'Black Holes', uploaderName: 'Sci', duration: 600 }, { type: 'channel', url: '/channel/x' }, { type: 'stream', url: '/watch?v=bad' }, { type: 'stream', isShort: true, url: '/watch?v=aqz-KE-bpKQ' }] });
  assert.deepEqual(h.map((x) => x.id), ['e-P5IFTqB98']);
  assert.equal(h[0].platform, 'youtube'); assert.equal(h[0].seconds, 600); assert.match(h[0].thumb, /^https:\/\/i\.ytimg\.com\/vi\/e-P5IFTqB98\//);
  assert.ok(PIPED.every((u) => /^https:\/\/[a-z0-9.-]+$/.test(u)));
  const real = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  try { const r = await keylessYouTube('black holes', 'https://www.youtube.com/results?search_query=black+holes'); assert.equal(r.hits.length, 0); assert.equal(r.need, 'YOUTUBE_API_KEY'); } finally { globalThis.fetch = real; }
  const src = readFileSync(new URL('../void-live-deploy/functions/api/video.js', import.meta.url), 'utf8');
  assert.match(src, /env\.YOUTUBE_API_KEY\) return keylessYouTube/); assert.match(src, /!out\.need/); assert.doesNotMatch(src, /duckduckgo\.com\/|env\.\w*KV|gpt-oss/i);
});
