// "where can i stream <film>" opens the film's own card, which carries the legal where-to-watch links (lib/movies.js whereAsk).
// A show, a live event, the sky or Verse's own films is not this ask, so those keep their own answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whereAsk } from '../void-live-deploy/lib/movies.js';
import movie from '../void-live-deploy/skills/movie.js';

test('a where-to-watch ask names the film and its year', () => {
  assert.deepEqual(whereAsk('where can i stream the blair witch project'), { title: 'the blair witch project', year: null, where: true });
  assert.deepEqual(whereAsk('where to watch Nosferatu (1922)?'), { title: 'Nosferatu', year: 1922, where: true });
  assert.deepEqual(whereAsk('How can I watch Talk to Me (2022) for free'), { title: 'Talk to Me', year: 2022, where: true });
  assert.equal(whereAsk('where can we stream the movie inception online').title, 'inception');
});
test('film titles with common words still open the card', () => {
  for (const t of ['the birds', 'The Truman Show', 'fight club', 'Live Free or Die Hard', 'The Game']) assert.ok(whereAsk('where can i watch ' + t), t);
});
test('shows, live events, the sky and Verse films are not this ask', () => {
  for (const a of ['where can i watch the super bowl', 'where can i watch the show severance', 'where can i watch the news', 'where can i watch your films',
    'where to watch lakers vs celtics', 'where can i watch the game live', 'where to watch the eclipse', 'where can i watch season 2 of x', 'where is dune streaming'])
    assert.equal(whereAsk(a), null, a);
});
test('the movie skill takes the ask and its suite passes', () => {
  assert.ok(movie.match('where can i stream the blair witch project', 'where can i stream the blair witch project'));
  assert.ok(!movie.match('where can i watch the super bowl', 'where can i watch the super bowl'));
  assert.equal(movie.suite().ok, true);
});
