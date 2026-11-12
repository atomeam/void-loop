// A podcast enclosure behind a tracking prefix the browser refuses (lists run 16 found Hardcore History on dts.podtrac.com and Science Vs
// on chrt.fm): untracked() gives the host's own file after the prefix, chained prefixes too, so the player and the stage card retry once.
// Run: node --test tools/podcast-untracked.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { untracked } from '../void-live-deploy/lib/podcasts.js';

test('known tracking prefixes are stripped to the host file, https', () => {
  assert.equal(untracked('https://dts.podtrac.com/redirect.mp3/traffic.libsyn.com/dancarlinhh/dchha70.mp3'), 'https://traffic.libsyn.com/dancarlinhh/dchha70.mp3');
  assert.equal(untracked('https://chrt.fm/track/ABC123/traffic.megaphone.fm/GLT1.mp3?updated=1'), 'https://traffic.megaphone.fm/GLT1.mp3?updated=1');
  assert.equal(untracked('https://pdst.fm/e/chrt.fm/track/X1/dts.podtrac.com/redirect.mp3/media.example.com/ep.mp3'), 'https://media.example.com/ep.mp3');
  assert.equal(untracked('https://op3.dev/e,pg=abc/https://cdn.example.org/a.m4a'), 'https://cdn.example.org/a.m4a');
  assert.equal(untracked('http://www.podtrac.com/pts/redirect.mp3/feeds.example.net/x.mp3'), 'https://feeds.example.net/x.mp3');
});
test('an address with no tracking prefix, a blob and nonsense stay as they are', () => {
  for (const u of ['https://traffic.libsyn.com/a.mp3', 'blob:https://a-to-mind.com/123', '', 'https://chrt.fm/track/ABC/', 'not a url'])
    assert.equal(untracked(u), u);
});
test('the podcasts page and the stage card retry once with untracked()', () => {
  const page = readFileSync(new URL('../void-live-deploy/podcasts/index.html', import.meta.url), 'utf8');
  assert.match(page, /P\.untracked\(au\.currentSrc \|\| au\.src\)/); assert.match(page, /au\.dataset\.untracked = '1'/);
  const skill = readFileSync(new URL('../void-live-deploy/skills/podcast.js', import.meta.url), 'utf8');
  assert.match(skill, /untracked\(audio\.currentSrc \|\| audio\.src\)/); assert.match(skill, /audio\.dataset\.untracked = '1'/);
});
