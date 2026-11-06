// node tools/podcast.test.mjs: Verse Out Loud (tools/podcast.mjs, skills/podcast.js). Episodes read the record only; the feed is valid podcast RSS.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { buildEpisode, rss, firstSentence, latestDaily, loadEpisodes, DIR, mainLog } from './podcast.mjs';
import skill, { wantsPodcast, episodeAsked, cardHtml, sourceLine } from '../void-live-deploy/skills/podcast.js';
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
// with the page's origin the player's address is whole (the outcome exam and a share both need https://, not a path), and it is the feed's own enclosure
const last = E[E.length - 1], whole = cardHtml(last, E, (s) => String(s), 'https://a-to-mind.com/');
assert.match(whole, new RegExp('<audio class="vpod-audio"[^>]* src="https://a-to-mind\\.com/podcast/' + last.file.replace(/\./g, '\\.') + '"'));
assert.ok(rss(E).includes('<enclosure url="https://a-to-mind.com/podcast/' + last.file + '"'), 'the card plays the address the feed lists');
// the show card names the directory that found the show: fyyd.de when Apple did not answer, never Apple then
assert.match(sourceLine('fyyd'), /fyyd\.de/); assert.doesNotMatch(sourceLine('fyyd'), /found through <a href="https:\/\/podcasts\.apple\.com/);
assert.match(sourceLine(undefined), /Apple’s podcast directory/);
console.log('podcast: ok');

// the daily episode (owner, 2026-11-06: "where is my daily verse podcast"): the last day only, in day words, with what merged on main
{
  const commits = [
    { at: '2026-10-21T20:00:00Z', author: 'atomeam', subject: 'Weather page: the newest look wins (#2432)' },
    { at: '2026-10-21T19:00:00Z', author: 'github-actions[bot]', subject: 'Site test: visitor pass 14/15' },
    { at: '2026-10-21T18:00:00Z', author: 'github-actions[bot]', subject: 'Revert "Knowledge cards: whole sentences (#2411)"' },
    { at: '2026-10-21T17:00:00Z', author: 'atomeam', subject: 'Merge pull request #2233 from atomeam/lists-run11', body: 'Lists run 11: green suite and three asks decided' },
    { at: '2026-10-19T00:00:00Z', author: 'atomeam', subject: 'Too old to be today (#2000)' },
  ];
  const m = mainLog(commits, new Date('2026-10-21T00:00:00Z'), new Date('2026-10-22T00:00:00Z'));
  assert.deepEqual(m, { total: 4, prs: ['Weather page: the newest look wins.', 'Lists run 11: green suite and three asks decided.'], records: 1, reverts: 1 });
  const d = buildEpisode({ growth, claims: { ok: ['make a clock'] }, voiceMd: md, incidents: { incidents: [{ at: '2026-10-21T00:00:00Z' }] }, commits, to: '2026-10-22T00:00:00Z', n: 3, days: 1 });
  const text = d.lines.map((l) => l.text).join('\n');
  assert.equal(d.title, 'Episode 3: the day to October 22, 2026');
  assert.match(text, /the day to October 22, 2026/); assert.match(text, /4 commits landed today: 2 pull requests merged, and 1 record written/);
  assert.match(text, /Weather page: the newest look wins\./); assert.doesNotMatch(text, /Too old to be today|\$\{|this week/);
  assert.match(text, /1 change was taken back off the site today/); assert.match(text, /tomorrow's ledger/);
  assert.ok(!/A new clock card/.test(text), 'the clock build is from October 20: not in the day to October 22');
  assert.ok(d.lines.every((l) => /[.!?:"]$/.test(l.text)), 'every daily line is a whole sentence');
  assert.equal(d.counts.merged, 2); assert.equal(d.days, 1);
}
console.log('podcast daily: ok');
