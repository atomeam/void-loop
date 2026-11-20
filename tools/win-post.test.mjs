import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from './win-post.mjs';
import assert from 'node:assert/strict';
import { oauth1Header, rivalWords, namesRival, worthy, caption, allowed, nextPost, reachTotals } from '../void-live-deploy/lib/win-post.js';

const win = (gain, at = '2026-11-19T10:00:00Z') => ({ at, kept: true, gain, results: [{ id: '/a/', kept: true, before: 43, after: 43 + gain }] });
test('oauth header: a known signature shape and no secrets in it', () => {
  const h = oauth1Header('POST', 'https://api.x.com/2/tweets', { key: 'k', secret: 's', token: 't', tokenSecret: 'ts' }, { nonce: 'n', ts: 1 });
  assert.match(h, /^OAuth /); assert.match(h, /oauth_signature="[^"]+"/); assert.ok(!h.includes('"ts"') && !/oauth_token_secret/.test(h));
});
test('only big, kept, measured wins are worth a post', () => {
  assert.ok(worthy(win(10))); assert.ok(!worthy(win(3))); assert.ok(!worthy({ ...win(10), kept: false })); assert.ok(!worthy(null));
});
test('caption: numbers and a link, no page names', () => {
  const t = caption(win(12), 'https://a-to-mind.com/scoreboard/'); assert.match(t, /43 to 55 out of 100/); assert.ok(!t.includes('/a/')); assert.ok(t.length <= 280); assert.match(t, /blub/); assert.match(t, /A-to-Mind Verse/); assert.match(t, /a-to-mind\.com/); assert.match(caption(win(12), 'https://x.test/'), /a-to-mind\.com/);
});
test('rival names come from the tower and are caught', () => {
  const w = rivalWords([{ sites: [{ site: 'acmemaps.com' }, 'https://www.bigweather.io/x'] }]);
  assert.ok(w.includes('acmemaps') && w.includes('bigweather'));
  assert.equal(namesRival('we beat BigWeather today', w), 'bigweather'); assert.equal(namesRival('Verse got better', w), null);
});
test('few posts: a gap, one a day, three a week', () => {
  const now = Date.parse('2026-11-19T20:00:00Z');
  assert.equal(allowed([], now).ok, true);
  assert.equal(allowed([{ at: '2026-11-19T15:00:00Z' }], now).ok, false);
  assert.equal(allowed([{ at: '2026-11-19T01:00:00Z' }], now).ok, false);
  assert.equal(allowed([{ at: '2026-11-17T01:00:00Z' }, { at: '2026-11-16T01:00:00Z' }, { at: '2026-11-15T01:00:00Z' }], now).ok, false);
  assert.equal(allowed([{ at: '2026-11-17T01:00:00Z' }], now).ok, true);
});
test('next post skips what was posted; reach adds up', () => {
  const cs = [win(9, 'a'), win(12, 'b')]; assert.equal(nextPost(cs, [{ cycle: 'b' }]).at, 'a'); assert.equal(nextPost(cs, [{ cycle: 'a' }, { cycle: 'b' }]), null);
  assert.deepEqual(reachTotals([{ reach: { impression_count: 5, like_count: 1 } }, {}]), { posts: 2, views: 5, likes: 1, reposts: 0, replies: 0 });
});

const env = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' };
function setup(user) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-')), boardFile = path.join(dir, 'board.json'), file = path.join(dir, 'posts.json');
  fs.writeFileSync(boardFile, JSON.stringify({ cycles: [win(12)] }));
  const calls = [];
  const fetchFn = async (url, o) => { calls.push(o.method + ' ' + url); const me = /users\/me/.test(url); return { ok: true, status: 200, json: async () => (me ? { data: { username: user } } : { data: { id: '77' } }) }; };
  return { boardFile, file, fetchFn, calls };
}
test('it posts once to @addumm when a judge liked the picture', async () => {
  const s = setup('addumm'), r = await run({ env, ...s, judge: async () => 82, now: Date.parse('2026-11-19T22:00:00Z') });
  assert.match(r.note, /posted: https:\/\/x.com\/addumm\/status\/77/); assert.equal(s.calls.length, 2);
  const again = await run({ env, ...s, judge: async () => 82, now: Date.parse('2026-11-19T23:00:00Z') }); assert.match(again.note, /no verified live win/);
});
test('it refuses another account, an unjudged or weak picture, and missing secrets', async () => {
  let s = setup('someoneelse'); assert.match((await run({ env, ...s, judge: async () => 90 })).note, /not @addumm/); assert.deepEqual(s.calls, ['GET https://api.x.com/2/users/me']);
  s = setup('addumm'); assert.match((await run({ env, ...s, judge: async () => null })).note, /no judge/); assert.match((await run({ env, ...s, judge: async () => 40 })).note, /under 70/); assert.equal(s.calls.length, 0);
  s = setup('addumm'); const q = await run({ env: {}, ...s, judge: async () => 90 }); assert.match(q.note, /queued, nothing posted yet/); assert.equal(JSON.parse(fs.readFileSync(s.file, 'utf8')).queued.cycle, win(12).at); assert.equal(JSON.parse(fs.readFileSync(s.file, 'utf8')).posts.length, 0);
  const sent = await run({ env, ...s, judge: async () => 90 }); assert.match(sent.note, /posted:/); assert.equal(JSON.parse(fs.readFileSync(s.file, 'utf8')).queued, null);
});
