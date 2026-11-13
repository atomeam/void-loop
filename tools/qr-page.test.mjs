import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qrPageText, qrWifi, qrContact } from '../void-live-deploy/lib/qr-page.js';
import { qrMatrix } from '../void-live-deploy/lib/qr.js';
import { onRequestGet } from '../void-live-deploy/functions/qr/index.js';

test('a short line is kept and a long one is refused', () => {
  assert.deepEqual(qrPageText('  hello  '), { ok: true, text: 'hello' });
  assert.equal(qrPageText('').ok, false);
  assert.equal(qrPageText('x'.repeat(501)).reason, 'long');
  assert.equal(qrPageText('x'.repeat(500)).ok, true);
});

test('a network and a contact become the text a phone expects', () => {
  assert.equal(qrWifi('Cafe', 'a;b', 'WPA'), 'WIFI:T:WPA;S:Cafe;P:a\\;b;;');
  assert.equal(qrWifi('Cafe', 'secret', 'nope').startsWith('WIFI:T:WPA;'), true);
  assert.equal(qrWifi('Cafe', 'secret', 'nopass'), 'WIFI:T:nopass;S:Cafe;P:;;');
  assert.equal(qrContact('Ada', '555', 'ada@example.com'), 'BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nTEL:555\nEMAIL:ada@example.com\nEND:VCARD');
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
