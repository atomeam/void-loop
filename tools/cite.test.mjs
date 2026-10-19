// An answer's card lists only the sources the answer cited (void-live-deploy/lib/cite.js). Run: node --test tools/cite.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepCited } from '../void-live-deploy/lib/cite.js';

const songs = [{ title: 'Hate That I Made You Love Me' }, { title: 'You Look Like You Love Me' }, { title: 'Tell Me You Love Me (album)' }];

test('"do you love me?": an answer that cites nothing lists no sources', () => {
  const r = keepCited('No. I don’t feel love.', songs);
  assert.deepEqual(r.sources, []);
  assert.equal(r.answer, 'No. I don’t feel love.');
});

test('only the cited ones stay, renumbered in the order the answer first cites them', () => {
  const r = keepCited('Lisbon sits on the Tagus [3]. Its tides run about 4 m [3], and the bridge opened in 1966 [1].', ['a', 'b', 'c']);
  assert.deepEqual(r.sources, ['c', 'a']);
  assert.equal(r.answer, 'Lisbon sits on the Tagus [1]. Its tides run about 4 m [1], and the bridge opened in 1966 [2].');
});

test('a bracketed number that is no source (an array index, [0], [9] of three) is left as written', () => {
  const r = keepCited('Use a[0] or list[9]; see [2].', ['a', 'b', 'c']);
  assert.deepEqual(r.sources, ['b']);
  assert.equal(r.answer, 'Use a[0] or list[9]; see [1].');
});

test('code is never renumbered: arr[2] and a fenced block stay exactly as written', () => {
  const ans = 'Index from zero [2]. In `arr[1]` the second item; also x[3].\n```js\nconst y = list[2] + [1][0];\n```\nSee [1].';
  const r = keepCited(ans, ['a', 'b', 'c']);
  assert.deepEqual(r.sources, ['b', 'a']);
  assert.equal(r.answer, 'Index from zero [1]. In `arr[1]` the second item; also x[3].\n```js\nconst y = list[2] + [1][0];\n```\nSee [2].');
});

test('the same answer run twice keeps the same sources (a cached answer is filtered again on read)', () => {
  const once = keepCited('x [2] y [1]', ['a', 'b']);
  assert.deepEqual(keepCited(once.answer, once.sources), once);
});

test('a fullwidth 【1】 or 【1†source】 is a citation like [1]; a marker that names no source is dropped, never left bare (owner, 2026-10-19)', async () => {
  const { keepCited } = await import('../void-live-deploy/lib/cite.js');
  const src = [{ title: 'All your base are belong to us', url: 'https://en.wikipedia.org/wiki/All_your_base_are_belong_to_us' }];
  assert.deepEqual(keepCited('Engrish humor on the web【1】. It is quoted often.', src), { answer: 'Engrish humor on the web [1]. It is quoted often.', sources: src });
  assert.deepEqual(keepCited('A meme 【1†Wikipedia】 from Zero Wing.', src), { answer: 'A meme [1] from Zero Wing.', sources: src });
  assert.deepEqual(keepCited('Engrish humor on the web【1】. It is quoted often.', []), { answer: 'Engrish humor on the web. It is quoted often.', sources: [] });
  assert.deepEqual(keepCited('See [3], and arr[2] stays.', src), { answer: 'See, and arr[2] stays.', sources: [] });
});
