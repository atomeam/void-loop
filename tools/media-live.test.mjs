// node --test tools/media-live.test.mjs: the films and podcast checks a live run makes, on fixtures, plus what keeps the old ones off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filmListIssues, episodeIssues } from './media-live.mjs';
import { RETIRED } from '../void-live-deploy/lib/films-retired.js';
import { rss, loadEpisodes } from './podcast.mjs';
import { verseShow } from '../void-live-deploy/lib/podcasts.js';
const read = (f) => readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8');
test('a retired or unlisted film shown to a visitor is a failure; a listed film with a play link is fine', () => {
  const old = [...RETIRED][0];
  assert.deepEqual(filmListIssues([{ id: 'studio-20261120-x', src: '/api/films?id=studio-20261120-x&exp=1&sig=a' }]), []);
  assert.match(filmListIssues([{ id: old, src: '/api/films?id=' + old }]).join(), /retired/);
  assert.match(filmListIssues([{ id: 'x-1', unlisted: true, src: '/api/films?id=x-1' }]).join(), /unlisted/);
});
test('the old trending-keyword films stay stored but off the public list', () => {
  assert.equal(RETIRED.size, 24);
  assert.match(read('functions/api/films.js'), /w\.gate === 'pass' && !isRetired\(id\)/);
});
test('hidden episodes are off the show, the feed and the card; their files stay', () => {
  const j = loadEpisodes();
  assert.deepEqual(episodeIssues(j, rss(j.episodes)), []);
  for (const e of j.episodes.filter((x) => x.hidden)) assert.ok(!verseShow(j).episodes.some((v) => v.id === 'ep' + e.n));
  assert.match(read('skills/podcast.js'), /filter\(\(e\) => e && !e\.hidden\)/);
});
test('/podcasts/ carries no stray markup', () => {
  assert.doesNotMatch(read('podcasts/index.html'), /rse">Open the show/);
  assert.equal((read('podcasts/index.html').match(/id="peoplePane"/g) || []).length, 1);
});
