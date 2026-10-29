// The pure part of /video/ (lib/video-hub.js): the open sources read into items with their licences, chapters, captions, recommendations from the
// viewer's own history, keys, playlists by link, and that every English sentence of the screen has its German.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../void-live-deploy/lib/video-hub.js';
import { DE } from '../void-live-deploy/lib/video-hub-de.js';
import { VIDEO_SITES } from '../void-live-deploy/lib/video-sites.js';

test('Commons search and file addresses stay on the Commons API with CORS open', () => {
  const u = new URL(H.commonsSearchUrl('moon landing'));
  assert.equal(u.origin + u.pathname, 'https://commons.wikimedia.org/w/api.php'); assert.equal(u.searchParams.get('origin'), '*'); assert.equal(u.searchParams.get('gsrsearch'), 'filetype:video moon landing'); assert.match(u.searchParams.get('viprop'), /derivatives/);
  assert.equal(new URL(H.commonsFilesUrl(['File:A b.webm'])).searchParams.get('titles'), 'File:A_b.webm');
  assert.equal(new URL(H.commonsCaptionsUrl('A.webm', 'de')).searchParams.get('trackformat'), 'vtt');
});
test('a Commons answer becomes items with the licence, the credit, the qualities and nothing off its hosts', () => {
  const j = { query: { pages: {
    1: { index: 2, title: 'File:B.webm', videoinfo: [{ url: 'https://upload.wikimedia.org/b.webm', mime: 'video/webm', mediatype: 'VIDEO', height: 720, duration: 61.4, size: 9e6, thumburl: 'https://upload.wikimedia.org/b.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:B.webm',
      extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' }, Artist: { value: '<a href="x">Ann</a>' }, ImageDescription: { value: 'Intro<br>0:00 Start<br>0:30 Middle' }, Categories: { value: 'Cats|Videos of cats' } },
      derivatives: [{ src: 'https://upload.wikimedia.org/b.360p.webm', type: 'video/webm; codecs="vp9"', height: 360 }, { src: 'https://evil.example/x.webm', type: 'video/webm', height: 480 }] }] },
    2: { index: 1, title: 'File:A.ogv', videoinfo: [{ url: 'https://upload.wikimedia.org/a.ogv', mime: 'video/ogg', extmetadata: {} }] },
    3: { index: 3, title: 'File:C.jpg', videoinfo: [{ url: 'https://upload.wikimedia.org/c.jpg', mime: 'image/jpeg' }] } } } };
  const items = H.commonsItems(j);
  assert.deepEqual(items.map((x) => x.id), ['A.ogv', 'B.webm']);
  const b = items[1]; assert.equal(b.licence, 'CC BY-SA 4.0'); assert.equal(b.by, 'Ann'); assert.equal(b.seconds, 61); assert.ok(b.download);
  assert.deepEqual(b.quality.map((q) => q.label), ['360p', 'Original (720p)']); assert.ok(b.quality.every((q) => q.src.startsWith('https://upload.wikimedia.org/')));
  assert.deepEqual(H.chaptersOf(b.description), [{ t: 0, title: 'Start' }, { t: 30, title: 'Middle' }]);
  assert.equal(items[0].licence, 'Free licence');
});
test('the Archive: only public domain or Creative Commons items, read with their files and captions', () => {
  assert.equal(H.archiveLicence({ licenseurl: 'http://creativecommons.org/licenses/by-nc/3.0/' }), 'CC BY-NC 3.0');
  assert.equal(H.archiveLicence({ licenseurl: 'https://creativecommons.org/publicdomain/mark/1.0/' }), 'Public domain');
  assert.equal(H.archiveLicence({ collection: ['prelinger', 'movies'] }), 'Public domain');
  assert.equal(H.archiveLicence({ collection: ['opensource_movies'] }), '');
  const items = H.archiveItems({ response: { docs: [{ identifier: 'free_one', title: 'Free', collection: ['feature_films'], year: '1950', runtime: '1:02:03' }, { identifier: 'not_free', title: 'Shut', collection: ['opensource_movies'] }, { identifier: 'bad id!', collection: ['prelinger'] }] } });
  assert.deepEqual(items.map((x) => [x.id, x.licence, x.seconds, x.year]), [['free_one', 'Public domain', 3723, 1950]]);
  assert.match(H.archiveSearchUrl('cats'), /^https:\/\/archive\.org\/advancedsearch\.php\?q=\(cats\)%20AND%20mediatype%3A\(movies\)/);
  const p = H.archivePlayable({ metadata: { identifier: 'x1', title: 'X', licenseurl: 'http://creativecommons.org/licenses/by/4.0/' }, files: [{ name: 'x.mp4', size: '90000000', format: 'h.264' }, { name: 'x_512kb.mp4', size: '20000000', format: '512Kb MPEG4' }, { name: 'x.en.srt', size: '100' }, { name: 'x.png', size: '5' }] });
  assert.deepEqual(p.quality.map((q) => q.src), ['https://archive.org/download/x1/x_512kb.mp4', 'https://archive.org/download/x1/x.mp4']); assert.equal(p.licence, 'CC BY 4.0'); assert.equal(p.captions.length, 1); assert.ok(p.captions[0].srt);
});
test('a Commons link names its file', () => {
  assert.equal(H.commonsFileOf('https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_4K.webm'), 'Big_Buck_Bunny_4K.webm');
  assert.equal(H.commonsFileOf('https://upload.wikimedia.org/wikipedia/commons/c/c0/Big_Buck_Bunny_4K.webm'), 'Big_Buck_Bunny_4K.webm');
  assert.equal(H.commonsFileOf('https://example.com/x.webm'), '');
});
test('chapters need two times in order; SubRip becomes WebVTT', () => {
  assert.deepEqual(H.chaptersOf('Watch this\n0:00 Intro\n1:05 The idea\n1:02:03 End'), [{ t: 0, title: 'Intro' }, { t: 65, title: 'The idea' }, { t: 3723, title: 'End' }]);
  assert.deepEqual(H.chaptersOf('only 0:10 one'), []);
  assert.equal(H.chapterAt([{ t: 0 }, { t: 60 }], 59), 0); assert.equal(H.chapterAt([{ t: 0 }, { t: 60 }], 61), 1);
  assert.equal(H.srtToVtt('1\n00:00:01,000 --> 00:00:02,500\nHello\n'), 'WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello\n');
});
test('recommendations learn from what this viewer watched, and never offer what they finished', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const hist = [{ source: 'commons', id: 'cat1', title: 'Cat plays piano', tags: ['cats'], at: now - 864e5, done: true }];
  const pool = [{ source: 'commons', id: 'cat1', title: 'Cat plays piano' }, { source: 'archive', id: 'dog', title: 'Dog park' }, { source: 'commons', id: 'cat2', title: 'Cats in Lisbon', tags: ['cats'] }];
  const r = H.recommend(hist, pool, 5, now);
  assert.deepEqual(r.map((x) => x.item.id), ['cat2']); assert.equal(r[0].why, 'Cat plays piano');
  assert.equal(H.recommend([], pool, 2).length, 2, 'with no history the shelf still shows something');
});
test('keys: the ones people know', () => {
  assert.equal(H.keyAction('k'), 'play'); assert.equal(H.keyAction(' '), 'play'); assert.equal(H.keyAction('J'), 'back10'); assert.equal(H.keyAction('ArrowRight'), 'fwd5'); assert.equal(H.keyAction('5'), 'seek:5');
  assert.equal(H.keyAction('N', { shift: true }), 'next'); assert.equal(H.keyAction('>'), 'faster'); assert.equal(H.keyAction('i'), 'pip'); assert.equal(H.keyAction('q'), '');
  assert.equal(H.stepSpeed(1, 1), 1.25); assert.equal(H.stepSpeed(0.25, -1), 0.25); assert.equal(H.stepSpeed(3, 1), 3);
});
test('a quality fits the screen and the connection', () => {
  const q = [{ src: 'a', height: 240 }, { src: 'b', height: 480 }, { src: 'c', height: 1080 }];
  assert.equal(H.pickQuality(q, { width: 390 }).src, 'b'); assert.equal(H.pickQuality(q, { width: 2000 }).src, 'c'); assert.equal(H.pickQuality(q, { width: 2000, saveData: true }).src, 'a');
  assert.equal(H.pickQuality([{ src: 's', size: 2e6 }, { src: 'm', size: 2e7 }], {}).src, 'm');
});
test('a playlist travels in a link and comes back checked', () => {
  const items = [{ source: 'commons', id: 'Big_Buck_Bunny_4K.webm', title: 'Big Buck Bunny' }, { source: 'peertube', id: 'abcdef12', host: 'tilvids.com', title: 'A talk' }];
  const link = H.playlistLink('Sunday', items), back = H.playlistFrom(link);
  assert.equal(back.name, 'Sunday'); assert.deepEqual(back.items, items);
  assert.equal(H.playlistFrom('#pl=' + Buffer.from(JSON.stringify({ n: 'x', i: [['evil', 'x'], ['youtube', '<script>']] })).toString('base64url')).items.length, 0);
  assert.equal(H.playlistFrom('#nope'), null);
  assert.deepEqual(H.moveItem([1, 2, 3], 0, 2), [2, 3, 1]); assert.equal(H.nextIn(items, 'commons:Big_Buck_Bunny_4K.webm').id, 'abcdef12'); assert.equal(H.nextIn(items, 'peertube:abcdef12'), null);
  assert.deepEqual(H.itemFromQuery(new URL(H.itemLink('https://a-to-mind.com/video/', items[1], 42.7)).search), { source: 'peertube', id: 'abcdef12', host: 'tilvids.com', t: 42 });
  assert.equal(H.itemFromQuery('?v=javascript:alert(1)'), null);
});
test('every sentence the video screen says in English has its German', () => {
  const src = fs.readFileSync(new URL('../void-live-deploy/lib/video-hub-ui.js', import.meta.url), 'utf8'), missing = [];
  for (const m of src.matchAll(/\bt\('((?:\\'|[^'])*)'\)/g)) { const k = m[1].replace(/\\'/g, "'"); if (!(k in DE) && !/^(?:en|de)$/.test(k)) missing.push(k); }
  for (const r of VIDEO_SITES) for (const k of [r.shelfTitle, r.shelfNote, r.searchTitle].filter(Boolean)) if (!(k in DE)) missing.push(k);
  assert.deepEqual([...new Set(missing)], []);
});
