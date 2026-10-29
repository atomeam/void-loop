// Service Health (lib/service-health.js, skills/service-health.js; asked by Verse): every adapter and public API gets a row, a check is
// graded up / slow / down by its answer and time, and the card says how many are up. Run: node --test tools/service-health.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../void-live-deploy/lib/service-health.js';
import { PROVIDERS } from '../void-live-deploy/skills/providers.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
test('every provider adapter and every public API is a service, each with a site to reach', () => {
  const s = S.servicesOf(PROVIDERS);
  assert.deepEqual(s.map((x) => x.id), [...Object.keys(PROVIDERS), 'coingecko', 'bluesky']);
  for (const x of s) assert.match(x.url, /^https:\/\/[^/]+\//, x.id);
  assert.equal(s.find((x) => x.id === 'waymo').how, 'link'); assert.equal(s.find((x) => x.id === 'coingecko').how, 'api');
});
test('a check: a link answers at all, an API must answer ok, a hang or a refusal is down; the time is measured', async () => {
  let t = 0; const now = () => t;
  const ok = await S.check({ url: 'https://a/', how: 'link' }, { fetch: async () => { t += 300; return { ok: false, status: 0 }; }, now });
  assert.deepEqual(ok, { ok: true, ms: 300 }, 'an opaque no-cors answer means the site is reachable');
  t = 0; const bad = await S.check({ url: 'https://b/', how: 'api' }, { fetch: async () => { t += 90; return { ok: false, status: 503 }; }, now });
  assert.equal(bad.ok, false); assert.equal(bad.error, 'answered 503');
  t = 0; const gone = await S.check({ url: 'https://c/', how: 'api' }, { fetch: async () => { t += 20; throw new TypeError('Failed to fetch'); }, now });
  assert.deepEqual(gone, { ok: false, ms: 20, error: 'could not be reached' });
  const hung = await S.check({ url: 'https://d/', how: 'link' }, { fetch: (u, o) => new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('aborted')))), timeout: 60 });
  assert.equal(hung.ok, false); assert.match(hung.error, /^no answer in/);
});
test('grading and the card: up under 1.5 s, slow over it, down when it failed; the summary counts them and every value is escaped', () => {
  assert.equal(S.grade({ ok: true, ms: 200 }), 'up'); assert.equal(S.grade({ ok: true, ms: 2400 }), 'slow'); assert.equal(S.grade({ ok: false, ms: 10 }), 'down');
  const svc = [{ id: 'a', name: 'A<b>', kind: 'ride', how: 'link' }, { id: 'b', name: 'B', kind: 'crypto', how: 'api' }, { id: 'c', name: 'C', kind: 'social', how: 'api' }];
  const html = S.healthHtml(esc, svc, [{ ok: true, ms: 312 }, { ok: true, ms: 2400 }, { ok: false, ms: 5, error: 'could not be reached' }]);
  assert.match(html, /1 of 3 up, 1 slow, 1 down/); assert.match(html, /up · 312 ms/); assert.match(html, /slow · 2\.4 s/); assert.match(html, /down · could not be reached/);
  assert.ok(html.includes('A&lt;b&gt;') && !html.includes('A<b>'), 'names are escaped');
  assert.match(S.healthHtml(esc, svc, []), /checking 3 services/);
});
test('the skill (skills/service-health.js) takes its asks and leaves the look-alikes', async () => {
  const skill = (await import('../void-live-deploy/skills/service-health.js')).default;
  for (const a of [...skill.examples, 'is waymo up right now?', 'adapter status', 'are your services working']) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of [...skill.nearMisses, 'order pizza to 1 main st', 'bitcoin price']) assert.ok(!skill.match(a.toLowerCase(), a), a);
});

test('the stability dial (asked by Verse): the needle turns with the score, the label and counts are shown, none recorded rests at the top, everything escaped', () => {
  assert.equal(S.needleOf(0), -90); assert.equal(S.needleOf(100), 90); assert.equal(S.needleOf(50), 0); assert.equal(S.needleOf(76), 47); assert.equal(S.needleOf(-5), -90); assert.equal(S.needleOf('x'), -90);
  const steady = S.gaugeHtml(esc, { score: 100, label: 'steady', week: 0, day: 0, known: 3 });
  assert.match(steady, /data-stability="steady" data-score="100"/); assert.match(steady, /rotate\(90deg\)/); assert.match(steady, /steady · 100\/100/); assert.match(steady, /0 red suites on main in 7 days/);
  const shaky = S.gaugeHtml(esc, { score: 28, label: 'shaky', week: 6, day: 2, known: 9 });
  assert.match(shaky, /data-stability="shaky" data-score="28"/); assert.match(shaky, /rotate\(-40deg\)/); assert.match(shaky, /6 red suites on main in 7 days, 2 in the last day/); assert.match(shaky, /stroke-dasharray="44 157"/);
  assert.match(S.gaugeHtml(esc, { score: 0, label: 'shaky', week: 30, day: 22, known: 30, capped: true }), /at least 30 red suites on main in 7 days, 22 in the last day/, 'a full incidents.json says at least');
  const none = S.gaugeHtml(esc, { score: 100, label: 'steady', week: 0, day: 0, known: 0 });
  assert.match(none, /data-stability="none"/); assert.match(none, /nothing to gauge/); assert.match(none, /no red suite recorded yet/); assert.match(none, /rotate\(90deg\)/);
  const odd = S.gaugeHtml(esc, { score: 64, label: '<b>', week: 1, day: 0, known: 1 });
  assert.ok(odd.includes('&lt;b&gt;') && !odd.includes('data-stability="<b>"'), 'a label is escaped');
  assert.equal(S.GAUGE_EVERY_MS, 60000);
});
