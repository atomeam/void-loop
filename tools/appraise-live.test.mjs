// node --test tools/appraise-live.test.mjs: the live appraiser check reads the route's answers right and never prints an image.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAppraise, table, TEST_PNG } from './appraise-live.mjs';

const reply = (status, body) => ({ status, ok: status === 200, json: async () => body, text: async () => JSON.stringify(body) });
test('appraise-live: a valuing deploy passes every row; a deploy with no vision model fails the model row and says so', async () => {
  const good = async (u, o) => /skills\/appraise\.js/.test(u) ? reply(200, {}) : JSON.parse(o.body).note === 'what am I worth'
    ? reply(200, { value: { person: true }, text: 'Priceless.' }) : reply(200, { seen: 'a blank square', value: { kind: 'object', cents: 1500, text: '$15', person: false }, text: 'Verse values this at $15. Why: what I see: an everyday object.' });
  const rows = await checkAppraise('https://example.org/', good);
  assert.ok(rows.every((r) => r.ok), JSON.stringify(rows)); assert.equal(rows.length, 5);
  const t = table(rows); assert.ok(!t.includes(TEST_PNG.slice(30, 60)), 'no image bytes in the summary'); assert.match(t, /kind object, one number/);
  const none = await checkAppraise('https://example.org/', async (u) => /skills/.test(u) ? reply(200, {}) : reply(503, { error: 'no vision model bound' }));
  assert.equal(none.find((r) => /vision model/.test(r.what)).ok, false); assert.match(none.find((r) => /answers/.test(r.what)).saw, /no vision model bound/);
});
