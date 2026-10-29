// Who visits Verse: lib/visits.js (the classes and the cleaning), functions/api/visit.js (the route, with a FAKE D1) and tools/traffic.mjs (the
// Cloudflare split and the daily file). Run: node --test tools/traffic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/visit.js';
import { classify, cleanPage, refHost, parseBeacon, summarize, peopleLine, countryOf, GATE_UA, LIMITS } from '../void-live-deploy/lib/visits.js';
import { splitGroups, fromVisits, build, fromCloudflare } from './traffic.mjs';
import { resetGuard } from '../void-live-deploy/lib/guard.js';
import { peopleHtml } from '../void-live-deploy/skills/growth.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...a) || null,
    all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
function world(extra = {}) { store.clear(); resetGuard(); route.resetReady(); return { DB: d1(), SALT: 'test-salt', ...extra }; } // secret-scan: ok (a made-up salt for the test)
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const post = (env, body, { ip = '203.0.113.7', ua = PHONE, type = 'text/plain;charset=UTF-8', headers = {}, cf = { country: 'NZ' } } = {}) => {
  const request = new Request('https://a-to-mind.com/api/visit', { method: 'POST', headers: { 'content-type': type, 'cf-connecting-ip': ip, 'user-agent': ua, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  Object.defineProperty(request, 'cf', { value: cf });
  return route.onRequestPost({ env, request });
};
const read = async (env, days = 7) => (await route.onRequestGet({ env, request: new Request('https://a-to-mind.com/api/visit?days=' + days) })).json();

test('classify: our automation, bots and people, from the request alone', () => {
  for (const ua of ['a2m-traffic/1.0', 'Mozilla/5.0 HeadlessChrome/130.0', GATE_UA]) assert.equal(classify({ ua }), 'ours', ua);
  assert.equal(classify({ ua: PHONE, test: 'site-test' }), 'ours');
  assert.equal(classify({ ua: PHONE, webdriver: true }), 'ours');
  for (const ua of ['', 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.4.0', 'python-requests/2.31', 'facebookexternalhit/1.1', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'Chrome-Lighthouse']) assert.equal(classify({ ua }), 'bot', ua);
  assert.equal(classify({ ua: PHONE }), 'person');
  assert.equal(classify({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' }), 'person');
});

test('cleanPage, refHost, countryOf: only the first path segment, a public host name, a two-letter code', () => {
  assert.equal(cleanPage('/'), '/'); assert.equal(cleanPage('/index.html?q=x'), '/'); assert.equal(cleanPage('/markets/aapl?x=1'), '/markets/');
  assert.equal(cleanPage('/base64'), '/base64/'); assert.equal(cleanPage('/Some Name/'), 'other'); assert.equal(cleanPage('/a@b.com'), 'other'); assert.equal(cleanPage(null), '/');
  assert.equal(refHost('https://www.Reddit.com/r/x?u=bob'), 'reddit.com'); assert.equal(refHost('news.ycombinator.com'), 'news.ycombinator.com');
  for (const r of ['', 'https://a-to-mind.com/x', 'https://www.a-to-mind.com/', 'https://a-to-mind.pages.dev/', 'http://192.168.1.4/', 'http://bobs-laptop/', 'javascript://x.com', 'file://x.com/a', 'x'.repeat(90) + '.com']) assert.equal(refHost(r), '', r);
  assert.equal(countryOf('NZ'), 'NZ'); assert.equal(countryOf('XX'), ''); assert.equal(countryOf('nz'), ''); assert.equal(countryOf(undefined), '');
});

test('parseBeacon: text/plain or JSON, size cap, fixed errors that echo nothing', () => {
  assert.deepEqual(parseBeacon('text/plain;charset=UTF-8', JSON.stringify({ p: '/markets/x', r: 'https://t.co/abc', w: 0, extra: '<b>' })), { ok: true, page: '/markets/', ref: 't.co', webdriver: false });
  assert.equal(parseBeacon('application/json', '{"w":1}').webdriver, true);
  assert.equal(parseBeacon('text/html', '{}').status, 415);
  assert.equal(parseBeacon('text/plain', JSON.stringify({ p: 'x'.repeat(400) })).status, 413);
  const bad = parseBeacon('text/plain', '{<script>'); assert.equal(bad.status, 400); assert.doesNotMatch(bad.error, /script/);
  assert.equal(parseBeacon('text/plain', '[1]').status, 400);
});

test('summarize: classes per day, tops with rare keys folded into other', () => {
  const s = summarize([
    { day: '2026-10-25', kind: 'views', k: 'person', n: 3 }, { day: '2026-10-25', kind: 'uniq', k: 'person', n: 2 }, { day: '2026-10-25', kind: 'views', k: 'bot', n: 5 },
    { day: '2026-10-26', kind: 'views', k: 'ours', n: 4 }, { day: '2026-10-26', kind: 'views', k: 'hacker', n: 9 }, { day: 'bad', kind: 'views', k: 'person', n: 1 },
    { day: '2026-10-25', kind: 'ref', k: 'reddit.com', n: 2 }, { day: '2026-10-26', kind: 'ref', k: 'reddit.com', n: 1 }, { day: '2026-10-26', kind: 'ref', k: 'one-off.example', n: 1 },
    { day: '2026-10-26', kind: 'page', k: '/', n: 3 }, { day: '2026-10-26', kind: 'page', k: 'other', n: 4 },
  ]);
  assert.deepEqual(s.days.map((d) => d.day), ['2026-10-25', '2026-10-26']);
  assert.deepEqual(s.days[0].views, { person: 3, ours: 0, bot: 5 }); assert.equal(s.days[0].uniq.person, 2); assert.deepEqual(s.days[1].views, { person: 0, ours: 4, bot: 0 });
  assert.deepEqual(s.referrers, { top: [{ k: 'reddit.com', n: 3 }], other: 1 });
  assert.deepEqual(s.pages, { top: [{ k: '/', n: 3 }], other: 4 });
});

test('the route: a person is counted once a day as unique, ours and bots apart, nothing identifying kept', async () => {
  const env = world();
  assert.equal((await post(env, { p: '/', r: 'https://www.reddit.com/r/x' })).status, 204);
  assert.equal((await post(env, { p: '/', r: 'https://www.reddit.com/r/y' })).status, 204); // the same person again: a view, not a new unique
  assert.equal((await post(env, { p: '/', r: '' }, { ip: '198.51.100.2' })).status, 204);
  assert.equal((await post(env, { p: '/', w: 0 }, { ua: 'a2m-probe-asks/1.0' })).status, 204);
  assert.equal((await post(env, { p: '/' }, { headers: { 'x-void-test': 'site-test' } })).status, 204);
  assert.equal((await post(env, { p: '/', w: 1 }, { ip: '198.51.100.9' })).status, 204);
  assert.equal((await post(env, { p: '/' }, { ua: 'Googlebot/2.1' })).status, 204);
  const j = await read(env);
  assert.equal(j.ok, true); assert.equal(j.days.length, 1);
  assert.deepEqual(j.days[0].views, { person: 3, ours: 3, bot: 1 });
  assert.equal(j.days[0].uniq.person, 2);
  assert.deepEqual(j.referrers.top, [{ k: 'reddit.com', n: 2 }]);
  assert.deepEqual(j.countries.top, [{ k: 'NZ', n: 3 }]);
  const dump = JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_visits').all()) + JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_visit_seen').all());
  assert.doesNotMatch(dump, /203\.0\.113|198\.51|iPhone|Googlebot|a2m-probe/);
});

test('the route: off without D1 or SALT, refuses other origins and wrong bodies, rate-limits', async () => {
  assert.equal((await post({ DB: d1() }, { p: '/' })).status, 503);
  const env = world();
  assert.equal((await post(env, { p: '/' }, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await post(env, { p: '/' }, { type: 'text/html' })).status, 415);
  assert.equal((await post(env, '{nope')).status, 400);
  let last = 0; for (let i = 0; i < LIMITS.perMinute + 2; i++) last = (await post(env, { p: '/' }, { ip: '192.0.2.50' })).status;
  assert.equal(last, 429);
  const g = await route.onRequestGet({ env: {}, request: new Request('https://a-to-mind.com/api/visit') }); assert.equal(g.status, 503);
});

test('the route: past 50 pages in a day, a new page counts as other', async () => {
  const env = world(), today = new Date().toISOString().slice(0, 10);
  await post(env, { p: '/' }, { ip: '192.0.2.1' }); // makes the tables and the first page, "/"
  for (let i = 1; i < LIMITS.keysPerDay; i++) env.DB.raw.prepare("INSERT INTO void_visits (day, kind, k, n) VALUES (?, 'page', ?, 2)").run(today, '/p' + i + '/');
  await post(env, { p: '/brand-new/' }, { ip: '192.0.2.2' });
  await post(env, { p: '/' }, { ip: '192.0.2.3' }); // a page already kept today still counts as itself
  const rows = Object.fromEntries(env.DB.raw.prepare("SELECT k, n FROM void_visits WHERE kind = 'page'").all().map((r) => [r.k, r.n]));
  assert.equal(rows['/brand-new/'], undefined); assert.equal(rows.other, 1); assert.equal(rows['/'], 2);
});

test('splitGroups: Cloudflare groups split by user agent, which is then dropped', () => {
  const g = (date, userAgent, count, path = '/', ref = '', country = 'NZ') => ({ count, dimensions: { date, userAgent, clientRequestPath: path, clientRefererHost: ref, clientCountryName: country } });
  const s = splitGroups([g('2026-10-25', PHONE, 5, '/markets/x', 'www.reddit.com'), g('2026-10-25', GATE_UA, 7), g('2026-10-25', 'Googlebot/2.1', 3), g('2026-10-26', PHONE, 1, '/', 'a-to-mind.com')]);
  assert.deepEqual(s.days, [{ day: '2026-10-25', all: 15, people: 5, ours: 7, bots: 3 }, { day: '2026-10-26', all: 1, people: 1, ours: 0, bots: 0 }]);
  assert.deepEqual(s.pages, [{ k: '/markets/', n: 5 }]); assert.deepEqual(s.referrers, [{ k: 'reddit.com', n: 5 }]); assert.deepEqual(s.countries, [{ k: 'NZ', n: 6 }]);
  assert.doesNotMatch(JSON.stringify(s), /Mozilla|Googlebot/);
});

test('fromVisits, build and the line: unique people when the source has them, visits said as visits when it does not', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const parts = fromVisits({ ok: true, days: [{ day: '2026-10-18', views: { person: 50, ours: 0, bot: 0 }, uniq: { person: 40, ours: 0, bot: 0 } }, { day: '2026-10-25', views: { person: 9, ours: 30, bot: 2 }, uniq: { person: 4, ours: 3, bot: 1 } }, { day: '2026-10-26', views: { person: 3, ours: 5, bot: 0 }, uniq: { person: 2, ours: 1, bot: 0 } }], pages: { top: [{ k: '/', n: 12 }] }, referrers: { top: [] }, countries: { top: [] } });
  const t = build('verse', parts, now);
  assert.equal(t.week.since, '2026-10-20'); assert.equal(t.week.people, 6); assert.equal(t.week.views, 12); assert.equal(t.week.ours, 35); assert.equal(t.week.bots, 2);
  assert.match(t.line, /^People this week: 6 \(12 visits; counted by Verse itself/);
  const c = build('cloudflare', splitGroups([{ count: 4, dimensions: { date: '2026-10-26', userAgent: PHONE, clientRequestPath: '/' } }]), now);
  assert.equal(c.week.unique, false); assert.match(c.line, /^Visits by people this week: 4 \(from Cloudflare's counts, our own runs taken out\)/);
  assert.equal(peopleLine(null), ''); assert.equal(fromVisits({ ok: false }), null);
});

test('fromCloudflare: says per token what is missing and never prints a token', async () => {
  const fake = async (url) => ({ status: 403, json: async () => ({ success: false, errors: [{ code: 9109, message: 'Unauthorized to access requested resource' }] }) });
  const r = await fromCloudflare({ CLOUDFLARE_API_TOKEN: 'made-up-token-value' }, fake); // secret-scan: ok (a made-up token for the test)
  assert.equal(r.ok, false); assert.match(r.why[0], /CLOUDFLARE_API_TOKEN: cannot look up the zone/); assert.doesNotMatch(r.why.join(' '), /made-up-token-value/);
  assert.deepEqual((await fromCloudflare({}, fake)).why, ['no Cloudflare token in this environment']);
  const ok = async (url, o) => ({ status: 200, json: async () => (/zones\?/.test(url) ? { success: true, result: [{ id: 'z1' }] } : /httpRequestsAdaptiveGroups/.test(o.body) ? { data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: [{ count: 2, dimensions: { date: '2026-10-26', userAgent: PHONE, clientRequestPath: '/' } }] }] } } } : { data: { viewer: { zones: [{ httpRequests1dGroups: [{ dimensions: { date: '2026-10-26' }, sum: { requests: 9, pageViews: 5 }, uniq: { uniques: 3 } }] }] } } }) });
  const y = await fromCloudflare({ CLOUDFLARE_ANALYTICS_TOKEN: 'made-up' }, ok, Date.parse('2026-10-26T12:00:00Z')); // secret-scan: ok (made up)
  assert.equal(y.ok, true); assert.equal(y.token, 'CLOUDFLARE_ANALYTICS_TOKEN'); assert.deepEqual(y.parts.days[0], { day: '2026-10-26', all: 2, people: 2, ours: 0, bots: 0, pageViews: 5, uniquesAll: 3 });
});

test('the growth card line: escaped, and nothing without a count', () => {
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  assert.equal(peopleHtml(esc, { line: 'People this week: 3 <b>' }), '<div class="sub growth-people">People this week: 3 &lt;b></div>');
  assert.equal(peopleHtml(esc, null), ''); assert.equal(peopleHtml(esc, { line: '' }), '');
});
