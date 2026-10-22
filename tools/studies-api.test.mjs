// node --test tools/studies-api.test.mjs: the owner's study panel API (void-live-deploy/functions/api/studies.js) refuses everyone but the owner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet } from '../void-live-deploy/functions/api/studies.js';

test('studies API: strangers and wrong tokens get 401; nothing is cached', async () => {
  for (const h of [{}, { authorization: 'Bearer nope' }]) {
    const r = await onRequestGet({ request: new Request('https://a-to-mind.com/api/studies', { headers: h }), env: { READ_TOKEN: 'right-one' } });
    assert.equal(r.status, 401); assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  const r = await onRequestGet({ request: new Request('https://a-to-mind.com/api/studies', { headers: { authorization: 'Bearer right-one' } }), env: { READ_TOKEN: 'right-one' } });
  assert.equal(r.status, 503, 'the owner without a database gets a plain answer');
});
test('studies page: owner token only from this site\'s storage, noindex, no studied text baked in', () => {
  const h = readFileSync(new URL('../void-live-deploy/studies.html', import.meta.url), 'utf8');
  assert.match(h, /noindex/); assert.match(h, /a2m\.void\.owner\.v1/); assert.doesNotMatch(h, /https?:\/\/(?!www\.w3)/);
});
