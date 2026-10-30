// Subscribing to a calendar by address: lib/icsfeed.js (the rules) and functions/api/icsfeed.js (the route, with a fake fetch). Run: node --test tools/icsfeed.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as route from '../void-live-deploy/functions/api/icsfeed.js';
import { feedUrl, calNameOf, hostName, FEED } from '../void-live-deploy/lib/icsfeed.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const mem = new Map();
globalThis.caches = { default: { match: async (q) => (mem.has(q.url) ? new Response(mem.get(q.url)) : undefined), put: async (q, r) => { mem.set(q.url, await r.text()); } } };
const env = { SALT: 'test-salt' }; // secret-scan: ok (a made-up salt for the test)
const ICS = 'BEGIN:VCALENDAR\r\nX-WR-CALNAME:School terms\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Half term\r\nDTSTART;VALUE=DATE:' + (new Date().getFullYear() + 1) + '0216\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:b\r\nSUMMARY:Old\r\nDTSTART;VALUE=DATE:20100101\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const get = (url, fetchFn) => { mem.clear(); resetGuard(); return route.onRequestGet({ env, fetchFn, request: new Request('https://verse.test/api/icsfeed?url=' + encodeURIComponent(url), { headers: { 'cf-connecting-ip': '203.0.113.9' } }) }).then(async (r) => ({ status: r.status, j: await r.json() })); };
const answer = (body, init = {}) => async () => new Response(body, { status: 200, ...init });

test('feedUrl: https and webcal on a public name; nothing local, no IP, no port, no credentials, nothing on Verse', () => {
  assert.equal(feedUrl('webcal://calendar.google.com/calendar/ical/x/basic.ics'), 'https://calendar.google.com/calendar/ical/x/basic.ics');
  assert.equal(feedUrl('http://fixtures.club.co.uk/feed.ics#x'), 'https://fixtures.club.co.uk/feed.ics');
  for (const bad of ['', 'ftp://a.b/c', 'https://localhost/x', 'https://10.0.0.1/x', 'https://[::1]/x', 'https://a.b:8443/x', 'https://u:p@a.b/x', 'https://intranet/x', 'https://printer.local/x', 'https://a-to-mind.com/api/x', 'https://x.a-to-mind.com/', 'javascript:alert(1)']) assert.equal(feedUrl(bad), null, bad);
});
test('calNameOf and hostName', () => { assert.equal(calNameOf(ICS), 'School terms'); assert.equal(hostName('https://calendar.google.com/x'), 'google.com'); });
test('the route: events parsed out (old one-offs left behind), the file never returned; a page that is not a calendar is refused', async () => {
  const r = await get('https://school.example.ac.uk/terms.ics', answer(ICS));
  assert.equal(r.status, 200); assert.equal(r.j.name, 'School terms'); assert.deepEqual(r.j.events.map((e) => e.title), ['Half term']); assert.ok(!JSON.stringify(r.j).includes('BEGIN:VCALENDAR'));
  const html = await get('https://news.site.org/', answer('<html>secret words</html>')); assert.equal(html.status, 422); assert.ok(!JSON.stringify(html.j).includes('secret'));
  assert.equal((await get('https://10.0.0.1/x', answer(ICS))).status, 400);
});
test('redirects are checked hop by hop; too big and too slow are refused', async () => {
  const hop = (to) => async (u) => (u.includes('start') ? new Response('', { status: 302, headers: { location: to } }) : new Response(ICS));
  assert.equal((await get('https://a.org.uk/start.ics', hop('https://b.org.uk/cal.ics'))).status, 200);
  assert.equal((await get('https://a.org.uk/start.ics', hop('http://127.0.0.1/admin'))).status, 422);
  assert.equal((await get('https://a.org.uk/big.ics', answer('BEGIN:VCALENDAR\r\n' + 'X'.repeat(FEED.bytes + 10)))).status, 413);
  assert.equal((await get('https://a.org.uk/slow.ics', async () => { throw new DOMException('timeout', 'TimeoutError'); })).status, 504);
});
test('off without the salt; 20 addresses a minute from one connection', async () => {
  const r = await route.onRequestGet({ env: {}, fetchFn: answer(ICS), request: new Request('https://verse.test/api/icsfeed?url=' + encodeURIComponent('https://a.org.uk/x.ics')) }); assert.equal(r.status, 503);
  mem.clear(); resetGuard(); let last;
  for (let i = 0; i < FEED.perMinute + 1; i++) last = await route.onRequestGet({ env, fetchFn: answer(ICS), request: new Request('https://verse.test/api/icsfeed?url=' + encodeURIComponent('https://a.org.uk/' + i + '.ics'), { headers: { 'cf-connecting-ip': '198.51.100.3' } }) });
  assert.equal(last.status, 429);
});
