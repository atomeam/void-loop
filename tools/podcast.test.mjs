// node tools/podcast.test.mjs: Verse Out Loud (tools/podcast.mjs, skills/podcast.js). Episodes read the record only; the feed is valid podcast RSS.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { buildEpisode, rss, firstSentence, latestDaily, loadEpisodes, DIR } from './podcast.mjs';
import skill, { wantsPodcast, episodeAsked, cardHtml } from '../void-live-deploy/skills/podcast.js';
for (const a of ['play the podcast', 'latest episode', 'verse podcast', 'verse out loud', "play verse's podcast", 'listen to your podcast', 'episode 2', 'podcast rss', 'Does Verse have a podcast?']) assert.ok(wantsPodcast(a.toLowerCase()), a);
for (const a of ['best podcasts about history', 'start a podcast', 'make me a podcast about cats', 'latest episode of the office', 'play a song']) assert.ok(!wantsPodcast(a), a);
assert.equal(episodeAsked('episode 3'), 3); assert.equal(skill.name, 'podcast');
assert.equal(firstSentence('build: one new card here. And more'), 'one new card here.'); assert.equal(firstSentence('x'.repeat(300)), '');
const md = '### 2026-10-21 21:33 UTC · daily\n\n> **Weakest operational area:** Deciding has 1 proven skill [S4].\n\nAsks: "Build a decider [S2]."; "Fix it."\n';
assert.deepEqual(latestDaily(md).asks, ['Build a decider.', 'Fix it.']); assert.equal(latestDaily(md).weakest, 'Deciding has 1 proven skill.');
const growth = [{ at: '2026-10-20T00:00:00Z', by: 'verse', kind: 'build', what: 'x', show: 'a new clock card for you', try: 'make a clock', phrases: [{ ask: 'make a clock', skill: 'clock' }, { ask: 'someone typed this secret thing', skill: 'clock' }] },
  { at: '2026-10-19T00:00:00Z', by: 'verse', kind: 'fix', what: 'Verse fixes x. Did not route: a; b' }, { at: '2026-09-01T00:00:00Z', kind: 'build', what: 'old', show: 'too old' }];
const ep = buildEpisode({ growth, claims: { ok: ['make a clock'] }, voiceMd: md, incidents: { incidents: [{ at: '2026-10-21T00:00:00Z' }] }, to: '2026-10-22T00:00:00Z', n: 1 });
const all = ep.lines.map((l) => l.text).join('\n');
assert.match(all, /A new clock card for you\. Try it: ask "make a clock"\./); assert.doesNotMatch(all, /too old|secret thing/); // the week only; only proven asks are read
assert.match(all, /2 asks this week/); assert.match(all, /went red 1 time /); assert.match(all, /Build a decider\./);
assert.ok(ep.lines.every((l) => ['Verse', 'Critic'].includes(l.who) && /[.!?:"]$/.test(l.text)), 'every line is a whole sentence');
const feed = rss([{ n: 1, title: 'Episode 1 & co', pub: '2026-10-22T00:00:00Z', file: 'verse-out-loud-001.mp3', transcript: 'verse-out-loud-001.txt', bytes: 10, seconds: 167, summary: 's' }]);
for (const re of [/^<\?xml version="1.0" encoding="UTF-8"\?>/, /xmlns:itunes="http:\/\/www\.itunes\.com\/dtds\/podcast-1\.0\.dtd"/, /<itunes:image href="https:\/\/a-to-mind\.com\/podcast\/cover\.jpg"\/>/, /<itunes:category text="Technology"\/>/, /<itunes:explicit>false<\/itunes:explicit>/, /<enclosure url="https:\/\/a-to-mind\.com\/podcast\/verse-out-loud-001\.mp3" length="10" type="audio\/mpeg"\/>/, /<itunes:duration>00:02:47<\/itunes:duration>/, /Episode 1 &amp; co/, /<pubDate>Thu, 22 Oct 2026 00:00:00 GMT<\/pubDate>/]) assert.match(feed, re);
// the committed episodes: their files exist, under the Pages size limit, and the committed feed is the one rss() writes
const E = loadEpisodes().episodes;
assert.ok(E.length >= 1, 'episode 1 is committed');
for (const e of E) { assert.ok(existsSync(DIR + '/' + e.file) && statSync(DIR + '/' + e.file).size === e.bytes && e.bytes < 25e6, e.file); assert.ok(existsSync(DIR + '/' + e.transcript), e.transcript); }
assert.equal(readFileSync(DIR + '/rss.xml', 'utf8'), rss(E), 'podcast/rss.xml is stale: node tools/podcast.mjs --rss');
const h = cardHtml(E[E.length - 1], E, (s) => String(s).replace(/[<>&"']/g, (c) => '&#' + c.charCodeAt(0) + ';'));
assert.match(h, /download/); assert.match(h, /\/podcast\/rss\.xml/); assert.match(h, /Full transcript/);
console.log('podcast: ok');
