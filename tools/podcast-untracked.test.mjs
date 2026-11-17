// A podcast enclosure behind a tracking prefix the browser refuses (lists run 16 found Hardcore History on dts.podtrac.com and Science Vs
// on chrt.fm; This American Life chains four: pfx.vpixl.com → dts.podtrac.com → pdst.fm → prefix.up.audio): untracked() gives the host's
// own file after the prefixes, so the stage card plays that file first and keeps the feed's address as its one retry.
// Run: node --test tools/podcast-untracked.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { untracked } from '../void-live-deploy/lib/podcasts.js';
import { judge } from '../void-live-deploy/lib/exam.js';

const TAL = 'https://pfx.vpixl.com/6qj4J/dts.podtrac.com/redirect.mp/pdst.fm/e/prefix.up.audio/s/npr.simplecastaudio.com/d3081dd9-fcaf-445a-977c-4f56c28f5a6e/episodes/86cdb257-086f-434a-b0a1-2e41f02fb2f5/audio/128/default.mp3?awCollectionId=d3081dd9-fcaf-445a-977c-4f56c28f5a6e&awEpisodeId=86cdb257-086f-434a-b0a1-2e41f02fb2f5&nocache';
const TAL_PLAIN = 'https://npr.simplecastaudio.com/d3081dd9-fcaf-445a-977c-4f56c28f5a6e/episodes/86cdb257-086f-434a-b0a1-2e41f02fb2f5/audio/128/default.mp3?awCollectionId=d3081dd9-fcaf-445a-977c-4f56c28f5a6e&awEpisodeId=86cdb257-086f-434a-b0a1-2e41f02fb2f5&nocache';

test('known tracking prefixes are stripped to the host file, https', () => {
  assert.equal(untracked('https://dts.podtrac.com/redirect.mp3/traffic.libsyn.com/dancarlinhh/dchha70.mp3'), 'https://traffic.libsyn.com/dancarlinhh/dchha70.mp3');
  assert.equal(untracked('https://chrt.fm/track/ABC123/traffic.megaphone.fm/GLT1.mp3?updated=1'), 'https://traffic.megaphone.fm/GLT1.mp3?updated=1');
  assert.equal(untracked('https://pdst.fm/e/chrt.fm/track/X1/dts.podtrac.com/redirect.mp3/media.example.com/ep.mp3'), 'https://media.example.com/ep.mp3');
  assert.equal(untracked('https://op3.dev/e,pg=abc/https://cdn.example.org/a.m4a'), 'https://cdn.example.org/a.m4a');
  assert.equal(untracked('http://www.podtrac.com/pts/redirect.mp3/feeds.example.net/x.mp3'), 'https://feeds.example.net/x.mp3');
  // This American Life's own chain, every hop (redirect.mp/ has no digit, prefix.up.audio carries the /s/ segment)
  assert.equal(untracked(TAL), TAL_PLAIN);
  assert.equal(untracked('https://dts.podtrac.com/redirect.mp/pdst.fm/e/prefix.up.audio/s/npr.simplecastaudio.com/x/audio/128/default.mp3'), 'https://npr.simplecastaudio.com/x/audio/128/default.mp3');
});
test('an address with no tracking prefix, a blob and nonsense stay as they are', () => {
  for (const u of ['https://traffic.libsyn.com/a.mp3', 'blob:https://a-to-mind.com/123', '', 'https://chrt.fm/track/ABC/', 'not a url'])
    assert.equal(untracked(u), u);
});
test('the stage card plays the host file first and retries the feed address once', () => {
  const skill = readFileSync(new URL('../void-live-deploy/skills/podcast.js', import.meta.url), 'utf8');
  assert.match(skill, /const direct = untracked\(ep\.audio\)/);
  assert.match(skill, /escH\(direct\)/);
  assert.match(skill, /audio\.dataset\.feedAddress = '1'/);
  assert.match(skill, /audio\.src = ep\.audio/);
  assert.doesNotMatch(skill, /audio\.dataset\.untracked/);
  const page = readFileSync(new URL('../void-live-deploy/podcasts/index.html', import.meta.url), 'utf8');
  assert.match(page, /P\.untracked\(au\.currentSrc \|\| au\.src\)/); assert.match(page, /au\.dataset\.untracked = '1'/);
});
test('the exam counts the host file the card plays as the episode the feed lists', () => {
  const text = 'This American Life 902: The Missing Minutes, the newest episode of the show, ready to play.';
  const base = { text, note: 'skill:podcast', ms: 3000, overflow: false };
  const truth = { show: 'This American Life', enclosures: [TAL] };
  const played = (src) => ({ src, status: 206, type: 'audio/mpeg', currentTime: 0.6 });
  const plain = judge('podcasts', { ...base, audio: played(untracked(TAL)) }, truth);
  assert.equal(plain.checks.show, true);
  assert.equal(plain.checks.audio, true);
  assert.equal(plain.checks.episode, true);
  // the feed's own address on the card still counts (the direction the card used to take)
  assert.equal(judge('podcasts', { ...base, audio: played(TAL) }, truth).checks.episode, true);
  // another episode of the same show is not this episode, tracked or plain
  const other = TAL.replace('86cdb257-086f-434a-b0a1-2e41f02fb2f5', '495d4996-9361-47bf-89f5-3fb3e6ce33b7');
  assert.equal(judge('podcasts', { ...base, audio: played(untracked(other)) }, truth).checks.episode, false);
  // and a silent card is still a failed audio check
  assert.equal(judge('podcasts', { ...base, audio: { ...played(untracked(TAL)), currentTime: 0 } }, truth).checks.audio, false);
});
