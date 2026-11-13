import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { factorialOf } from '../void-live-deploy/lib/factorials.js';
import { onRequestGet } from '../void-live-deploy/functions/factorials/index.js';

test('0! is 1 and 5! is 120', () => {
  assert.deepEqual(factorialOf('0'), { ok: true, n: 0, value: '1' });
  assert.deepEqual(factorialOf('1'), { ok: true, n: 1, value: '1' });
  assert.equal(factorialOf('5').value, '120');
  assert.equal(factorialOf('20').ok, true);
  assert.equal(factorialOf('21').reason, 'big');
  assert.equal(factorialOf('-1').ok, false);
  assert.equal(factorialOf('1.5').ok, false);
});

test('a query fills the page when scripts are off', async () => {
  const html = readFileSync(new URL('../void-live-deploy/factorials/index.html', import.meta.url), 'utf8');
  const res = await onRequestGet({
    request: new Request('https://a-to-mind.com/factorials/?n=0'),
    next: async () => new Response(html),
  });
  const body = await res.text();
  assert.match(body, /0! = 1/);
  assert.match(body, /0! is 1/);
  assert.match(body, /value="0"/);
});
