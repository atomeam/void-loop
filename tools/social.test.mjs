import test from 'node:test';
import assert from 'node:assert/strict';
import { bskyRows, mastoRows } from '../void-live-deploy/skills/social.js';

test('a Bluesky repost is labelled with who reposted it and keeps its real author (owner, 2026-10-21)', () => {
  const own = { post: { uri: 'at://did/app.bsky.feed.post/aaa', author: { handle: 'me.bsky.social', displayName: 'Me' }, record: { text: 'mine' }, indexedAt: '2026-10-21T00:00:00Z' } };
  const rp = { post: { uri: 'at://did2/app.bsky.feed.post/bbb', author: { handle: 'other.bsky.social' }, record: { text: 'theirs' } }, reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: { handle: 'me.bsky.social' } } };
  const r = bskyRows([own, rp, { post: null }]);
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].repost, r[1].repost, r[1].by, r[1].who], [false, true, 'me.bsky.social', 'other.bsky.social']);
  assert.equal(r[1].link, 'https://bsky.app/profile/other.bsky.social/post/bbb');
});
test('a Mastodon boost is labelled the same way', () => {
  const acct = { acct: 'me', username: 'me', display_name: 'Me' };
  const r = mastoRows([{ content: '<p>hi</p>', url: 'u1', created_at: 'x' }, { reblog: { content: '<p>yo</p>', url: 'u2', account: { acct: 'you@x', display_name: 'You' } } }], acct);
  assert.deepEqual(r.map((x) => [x.who, x.text, x.repost, x.by]), [['Me', 'hi', false, ''], ['You', 'yo', true, 'me']]);
});
