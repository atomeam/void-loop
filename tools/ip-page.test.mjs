// a-to-mind.com/ip, assimilated from icanhazip.com (2026-11-06): plain text for curl, a page for a browser, JSON on ask, never cached.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { onRequestGet, formatOf, page } from '../void-live-deploy/functions/ip/index.js';

const req = (ip, accept = '*/*', url = 'https://a-to-mind.com/ip') => ({ url, headers: new Headers({ ...(ip ? { 'cf-connecting-ip': ip } : {}), accept }) });
test('curl gets the address and a newline, like icanhazip.com; nothing is cached', async () => {
  const r = onRequestGet({ request: req('34.67.187.248') });
  assert.equal(await r.text(), '34.67.187.248\n'); assert.match(r.headers.get('content-type'), /^text\/plain/); assert.equal(r.headers.get('cache-control'), 'private, no-store');
});
test('a browser gets a page with the address, its family and the terminal line, and no script or form', async () => {
  const t = await onRequestGet({ request: req('2001:db8::1', 'text/html,application/xhtml+xml') }).text();
  assert.match(t, /<output>2001:db8::1<\/output>/); assert.match(t, /IPv6/); assert.match(t, /curl a-to-mind\.com\/ip/);
  assert.doesNotMatch(t, /<(button|input|select|textarea|script|form)\b/i, 'no control and no script'); assert.ok(t.length < 3000);
});
// owner, 2026-11-06: "our ip page should still have links back to other pages usable with and back to the hompage"
test('the page links to the tools it goes with, All tools and the home page, each a real Verse page', async () => {
  const t = await onRequestGet({ request: req('1.2.3.4', 'text/html') }).text();
  const hrefs = [...t.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.match(t, /<nav id="related" aria-label="Use with">/);
  for (const h of ['/', '/tools/', '/local/', '/time/', '/base64/bases/', '/password/', '/?q=what%20is%20my%20ip']) assert.ok(hrefs.includes(h), h);
  for (const h of hrefs.filter((x) => !x.startsWith('/?'))) assert.ok(h === '/' || existsSync(new URL('../void-live-deploy' + h + 'index.html', import.meta.url)), h + ' is a page in the site');
});
test('JSON on ask; a bad header is never echoed', async () => {
  assert.deepEqual(await onRequestGet({ request: req('1.2.3.4', '*/*', 'https://a-to-mind.com/ip?format=json') }).json(), { ok: true, ip: '1.2.3.4', v6: false });
  assert.equal(formatOf('https://a-to-mind.com/ip', 'application/json'), 'json');
  const bad = onRequestGet({ request: req('<script>') }); assert.equal(bad.status, 503); assert.equal(await bad.text(), 'unknown\n');
  assert.doesNotMatch(page(null), /<script/i);
});
