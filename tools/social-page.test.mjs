// Verse's social page (/social/): lib/social-core.js (hot, new and top, the comment tree, RSS, the Reddit links) and functions/api/social.js on a
// FAKE D1 (node:sqlite) holding real boards tables (made by functions/api/boards/). Run: node --test tools/social-page.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../void-live-deploy/lib/social-core.js';
import * as route from '../void-live-deploy/functions/api/social.js';
import { seeded } from './social-seed.mjs';

const H = 3600e3, NOW = Date.UTC(2026, 9, 26, 12);
test('hot: a newer post outranks an older one of the same score; ten times the score is worth 12.5 hours', () => {
  const a = { no: 1, at: NOW - 2 * H, votes: 0 }, b = { no: 2, at: NOW, votes: 0 }, c = { no: 3, at: NOW - 12 * H, votes: 9 };
  assert.ok(S.hot(b) > S.hot(a));
  assert.ok(Math.abs(S.hot(c) - S.hot({ at: NOW - 12 * H + 12.5 * H, votes: 0 })) < 1e-6);
  assert.deepEqual(S.sortPosts([a, b, c], 'new').map((p) => p.no), [2, 1, 3]);
  assert.deepEqual(S.sortPosts([a, b, c], 'top').map((p) => p.no), [3, 2, 1]);
  assert.deepEqual(S.sortPosts([a, b, { no: 4, at: NOW - 10 * 864e5, votes: 50 }], 'top', 'week', NOW).map((p) => p.no), [2, 1], 'top of the week leaves out older posts');
  assert.ok(S.hot({ at: NOW, votes: -5 }) < S.hot({ at: NOW, votes: 0 }), 'a down-voted post sinks');
});
test('the comment tree: a reply hangs under the first earlier post it quotes; the post itself or nothing makes it top level; best, new and old', () => {
  const op = { no: 10, body: 'post' };
  const posts = [op, { no: 11, body: 'first', votes: 0 }, { no: 12, body: '>>11\nagree', votes: 3 }, { no: 13, body: '>>10 hi op', votes: 1 }, { no: 14, body: '>>12\n>>11 both', votes: 0 }, { no: 15, body: '>>99 nowhere', votes: 0 }, { no: 16, body: '>>17 later', votes: 0 }, { no: 17, body: 'x', votes: 0 }];
  const t = S.tree(op, posts, 'old');
  assert.deepEqual(t.map((n) => n.post.no), [11, 13, 15, 16, 17]);
  assert.deepEqual(t[0].kids.map((n) => n.post.no), [12]); assert.deepEqual(t[0].kids[0].kids.map((n) => n.post.no), [14]);
  assert.deepEqual(S.tree(op, posts, 'new').map((n) => n.post.no), [17, 16, 15, 13, 11]);
  assert.equal(S.tree(op, posts, 'best')[0].post.no, 13, 'best: the higher score first');
  assert.equal(S.withoutLead('>>11\nagree'), 'agree'); assert.equal(S.withoutLead('agree >>11'), 'agree >>11');
});
test('RSS escapes every title and word; the Reddit links are Reddit\'s own public search and submit pages', () => {
  const x = S.rss('https://a-to-mind.com', { code: 'tech', title: 'Tech & <stuff>', about: 'a' }, [{ board: 'tech', no: 3, at: NOW, sub: '<script>alert(1)</script>', body: 'a & b' }]);
  assert.match(x, /^<\?xml/); assert.ok(!x.includes('<script>')); assert.match(x, /&lt;script&gt;/); assert.match(x, /\/social\/\?b=tech&amp;t=3/); assert.match(x, /Tech &amp; &lt;stuff&gt;/);
  assert.equal(S.redditSearch('home server', 'communities'), 'https://www.reddit.com/search/?q=home%20server&type=communities');
  assert.match(S.redditSubmit('https://a-to-mind.com/social/?b=tech&t=3', 'Hi'), /^https:\/\/www\.reddit\.com\/submit\?url=https%3A%2F%2Fa-to-mind\.com/);
  assert.equal(S.ago(NOW - 3 * H, 'en', NOW), '3 h ago'); assert.equal(S.ago(NOW - 3 * H, 'de', NOW), 'vor 3 Std.');
  assert.equal(S.voteOf(2), null); assert.equal(S.voteOf('1'), null); assert.equal(S.voteOf(-1), -1);
});

const get = (env, qs) => route.onRequestGet({ env, request: new Request('https://a-to-mind.com/api/social?' + qs) });
const vote = (env, body, ip = '1.2.3.4', origin = 'https://a-to-mind.com') => route.onRequestPost({ env, request: new Request('https://a-to-mind.com/api/social', { method: 'POST', headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': ip }, body: JSON.stringify(body) }) });

test('the feed: live, shown posts only, no 18+ unless asked, a community filter, and votes reorder it', async () => {
  const env = await seeded(NOW);
  let j = await (await get(env, 'feed=new')).json();
  assert.deepEqual(j.posts.map((p) => p.board + '/' + p.no), ['tech/1', 'cooking/1']);
  assert.ok(j.posts.every((p) => !('ip' in p)), 'no address hash goes out');
  j = await (await get(env, 'feed=new&adult=1')).json(); assert.ok(j.posts.some((p) => p.board === 'late'));
  j = await (await get(env, 'feed=hot&b=cooking')).json(); assert.deepEqual(j.posts.map((p) => p.board), ['cooking']);
  for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) assert.equal((await vote(env, { do: 'vote', b: 'cooking', no: 1, v: 1 }, ip)).status, 200);
  j = await (await get(env, 'feed=top')).json(); assert.equal(j.posts[0].board, 'cooking'); assert.equal(j.posts[0].votes, 3);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_social_votes WHERE voter LIKE ?').get('%1.1.1.1%').n, 0, 'no address is kept');
});
test('a vote: one per post per connection, changed or taken back; refused on a hidden post, a bad value or a foreign page', async () => {
  const env = await seeded(NOW);
  let j = await (await vote(env, { do: 'vote', b: 'tech', no: 3, v: 1 })).json(); assert.equal(j.votes, 1);
  j = await (await vote(env, { do: 'vote', b: 'tech', no: 3, v: 1 })).json(); assert.equal(j.votes, 1, 'the same vote twice counts once');
  j = await (await vote(env, { do: 'vote', b: 'tech', no: 3, v: -1 })).json(); assert.equal(j.votes, -1, 'changed to down');
  j = await (await vote(env, { do: 'vote', b: 'tech', no: 3, v: 0 })).json(); assert.equal(j.votes, 0, 'taken back');
  await vote(env, { do: 'vote', b: 'tech', no: 3, v: 1 }, '5.5.5.5');
  j = await (await get(env, 'votes=tech&t=1')).json(); assert.deepEqual(j.votes, { 3: 1 });
  assert.equal((await vote(env, { do: 'vote', b: 'tech', no: 5, v: 1 })).status, 404, 'a hidden post takes no votes');
  assert.equal((await vote(env, { do: 'vote', b: 'tech', no: 3, v: 5 })).status, 400);
  assert.equal((await vote(env, { do: 'vote', b: 'TECH;', no: 3, v: 1 })).status, 400);
  assert.equal((await vote(env, { do: 'vote', b: 'tech', no: 3, v: 1 }, '1.2.3.4', 'https://evil.example')).status, 403);
  assert.equal((await route.onRequestPost({ env: { DB: env.DB }, request: new Request('https://a-to-mind.com/api/social', { method: 'POST', body: '{}' }) })).status, 503);
});
test('votes are limited: 60 an hour from one connection', async () => {
  const env = await seeded(NOW), now = Date.now(), r = env.DB.raw;
  await vote(env, { do: 'vote', b: 'tech', no: 1, v: 1 }, '6.6.6.6');
  const voter = r.prepare('SELECT voter FROM void_social_votes').get().voter;
  for (let i = 0; i < route.RATES.hour; i++) r.prepare('INSERT INTO void_social_votes (board, no, voter, v, at) VALUES (?, ?, ?, 1, ?)').run('x', 1000 + i, voter, now);
  assert.equal((await vote(env, { do: 'vote', b: 'tech', no: 2, v: 1 }, '6.6.6.6')).status, 429);
  assert.equal((await vote(env, { do: 'vote', b: 'tech', no: 2, v: 1 }, '7.7.7.7')).status, 200);
});
test('RSS per community: the newest posts, hidden ones and 18+ communities left out of "all"', async () => {
  const env = await seeded(NOW);
  const res = await get(env, 'rss=tech'); assert.match(res.headers.get('content-type'), /rss\+xml/);
  const x = await res.text(); assert.match(x, /Which home server\?/); assert.ok(!/Hidden one/.test(x));
  const a = await (await get(env, 'rss=all')).text(); assert.match(a, /Best pancakes/); assert.ok(!/After dark/.test(a));
  assert.equal((await get(env, 'rss=nope')).status, 404); assert.equal((await get(env, 'rss=../x')).status, 400);
});
