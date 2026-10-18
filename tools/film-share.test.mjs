// lib/film-share.js + /films/: anyone uploads any Verse film or ad clip (owner, 2026-10-15: "put an upload to youtube button in
// Verse Films so that anyone can easily uplad each vid"; every video is its own ad, with the a-to-mind.com link and a share line).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shareWords, shareLink, PLATFORMS, CTA, SHARE } from '../void-live-deploy/lib/film-share.js';
import films, { wantsUpload } from '../void-live-deploy/skills/films.js';

const clip = { id: '20261015-void-voice', title: 'I have opinions | Verse #Shorts', description: 'Try it: https://a-to-mind.com/c/20261015-void-voice?p=youtube&q=x', tags: ['#Shorts', '#AI', '#Verse'] };
const film = { id: 'lab-orbit-r3', title: 'Orbit', description: 'An orbit.', tags: 'Void, physics' };

test('every platform: tracked per-uploader link, call to action, share line, its own upload page', () => {
  for (const p of Object.keys(PLATFORMS)) {
    const w = shareWords(clip, p);
    assert.equal(w.link, `https://a-to-mind.com/c/20261015-void-voice?p=${p}&by=share`);
    assert.ok(w.description.includes(w.link), p);
    assert.ok(w.upload.startsWith('https://'), p);
    if (p !== 'x') { assert.ok(w.description.includes(CTA)); assert.ok(w.description.includes(SHARE)); }
    assert.ok(w.description.length <= PLATFORMS[p].max, p);
    assert.ok(!/q=x/.test(w.description), 'old links become the tracked link');
  }
  assert.equal(shareWords(clip, 'youtube').upload, 'https://www.youtube.com/upload');
});
test('titles: one Verse, one #Shorts on YouTube, at most 100; tags without repeats', () => {
  const w = shareWords(clip, 'youtube');
  assert.equal(w.title, 'I have opinions | Verse #Shorts');
  assert.ok(shareWords(film, 'youtube').title.endsWith('| Verse #Shorts'));
  assert.equal(shareWords({ ...film, title: 'x'.repeat(300) }, 'youtube').title.length, 100);
  assert.equal(w.tags, '#Shorts #AI #Verse');
  assert.ok(!shareWords(film, 'tiktok').title.includes('#Shorts'));
});
test('a film without a clip id links the home page, still tracked', () => {
  assert.equal(shareLink(film.id, 'tiktok'), 'https://a-to-mind.com/?p=tiktok&by=share&src=film');
  assert.equal(shareLink('20261015-x9', 'nope'), 'https://a-to-mind.com/c/20261015-x9?p=other&by=share');
});
test('/films/ gives every visitor the buttons, not just the owner', () => {
  const html = readFileSync(new URL('../void-live-deploy/films/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes("import('/lib/film-share.js')"));
  assert.ok(html.includes('shareBox(cur)'));
  assert.ok(!/if \(j\.owner\) kids\.push/.test(html));
  for (const s of ['1. Download', "'2. Copy for '", "'3. Upload to '"]) assert.ok(html.includes(s), s);
});
test('"upload this to YouTube" reaches the films skill', () => {
  for (const a of ['upload this to youtube', 'post it on tiktok', 'how do i upload your videos to youtube', 'share a clip on x']) assert.ok(films.match(a), a);
  for (const a of ['upload a file', 'youtube', 'post a tweet']) assert.ok(!wantsUpload(a), a);
});
test('clips.yml puts every ad clip in VERSE FILMS', () => {
  const y = readFileSync(new URL('../.github/workflows/clips.yml', import.meta.url), 'utf8');
  assert.match(y, /film-post\.mjs "media\/clips\/\$id\.mp4"/);
});

// Verse Tube phase 1: views in D1 (no KV), an RSS feed, a watch page per video
import { DatabaseSync } from 'node:sqlite';
import * as views from '../void-live-deploy/functions/api/film-views.js';
import { rss } from '../void-live-deploy/functions/films/rss.js';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => db.prepare(sql).run(...a), all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  return { prepare: (sql) => stmt(sql) };
}
test('views: each POST counts one, GET reads many, bad ids refused', async () => {
  const env = { DB: d1() }, U = 'https://a-to-mind.com/api/film-views';
  for (let i = 0; i < 3; i++) await views.onRequestPost({ request: new Request(U + '?id=20261015-ufo', { method: 'POST' }), env });
  assert.equal((await (await views.onRequestPost({ request: new Request(U + '?id=Bad%20id', { method: 'POST' }), env })).status), 400);
  const j = await (await views.onRequestGet({ request: new Request(U + '?ids=20261015-ufo,nope-x'), env })).json();
  assert.deepEqual(j.views, { '20261015-ufo': 3 });
});
test('RSS: escaped, each item links its watch page, never the signed play link', () => {
  const x = rss([{ id: '20261015-ufo', at: '2026-10-15T00:00:00Z', title: 'A <UFO> & me', description: 'hi', src: '/api/films?id=x&sig=y' }]);
  assert.match(x, /<link>https:\/\/a-to-mind.com\/films\/\?v=20261015-ufo<\/link>/);
  assert.match(x, /A &lt;UFO&gt; &amp; me/);
  assert.ok(!x.includes('sig='));
});
test('/films/ is Verse Tube: watch page, related, views, share-on links, RSS', () => {
  const html = readFileSync(new URL('../void-live-deploy/films/index.html', import.meta.url), 'utf8');
  for (const s of ["get('v')", 'Up next', '/api/film-views', 'x.com/intent/post', 'reddit.com/submit', '/films/rss']) assert.ok(html.includes(s), s);
});

// the download is named after the film's title, so YouTube's default title is the experiment's question, not the raw id
// (owner, 2026-10-15: titles came out as "20261015 attention 7 r19")
import { fileName } from '../void-live-deploy/lib/film-share.js';
test('download name: the title, safe on every common system, at most 100 characters, else the id', () => {
  assert.equal(fileName({ id: '20261015-attention-7-r19', title: 'How much does a hint steer you? | an AI built this itself #Shorts' }),
    'How much does a hint steer you？ - an AI built this itself #Shorts.mp4');
  assert.equal(fileName({ id: 'a-1', title: 'A <b>: "x"/y\\z*?|' }), 'A b xyz？-.mp4', 'forbidden characters dropped, ? and | kept as ？ and -');
  assert.equal(fileName({ id: 'a-1' }), 'a-1.mp4', 'no title: the id');
  assert.equal(fileName({ id: 'a-1', title: '  ' }), 'a-1.mp4');
  assert.equal(fileName({ id: 'a-1', title: '<>:"/\\*' }), 'a-1.mp4', 'nothing left of the title: the id');
  assert.equal(fileName({ id: 'a-1', title: 'x'.repeat(300) }), 'x'.repeat(100) + '.mp4', 'at most 100 before .mp4');
  assert.equal(fileName({ id: 'a-1', title: 'line\none\ttab' }), 'line one tab.mp4', 'no control characters');
  assert.equal(fileName({ id: 'a-1', title: 'Ends with a dot.' }), 'Ends with a dot.mp4', 'no trailing dot');
  const n = fileName({ id: 'x', title: 'Why? | how: <a/b> "c" \\ * ?' });
  assert.ok(!/[<>:"/\\|?*]/.test(n.slice(0, -4)), n);
  const html = readFileSync(new URL('../void-live-deploy/films/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('download: share.fileName(f)') && !html.includes("download: f.id + '.mp4'"), '/films/ downloads under the title');
});
