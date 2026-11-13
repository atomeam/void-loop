import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qrPageText } from '../void-live-deploy/lib/qr-page.js';
import { qrMatrix } from '../void-live-deploy/lib/qr.js';
import { onRequestGet } from '../void-live-deploy/functions/qr/index.js';

test('a short line is kept and a long one is refused', () => {
  assert.deepEqual(qrPageText('  hello  '), { ok: true, text: 'hello' });
  assert.equal(qrPageText('').ok, false);
  assert.equal(qrPageText('x'.repeat(501)).reason, 'long');
  assert.equal(qrPageText('x'.repeat(500)).ok, true);
});

test('hello is a version 1 code', () => {
  const code = qrMatrix(qrPageText('hello').text);
  assert.equal(code.version, 1);
  assert.equal(code.size, 21);
});

test('a query fills the page when scripts are off', async () => {
  const html = readFileSync(new URL('../void-live-deploy/qr/index.html', import.meta.url), 'utf8');
  const res = await onRequestGet({
    request: new Request('https://a-to-mind.com/qr/?text=hello'),
    next: async () => new Response(html),
  });
  const body = await res.text();
  assert.match(body, /<svg /);
  assert.match(body, /Version 1, level H/);
  assert.match(body, />hello</);
  assert.doesNotMatch(body, /<script[^>]*>[\s\S]*hello/);
});
