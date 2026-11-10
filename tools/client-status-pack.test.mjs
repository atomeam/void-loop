import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import skill, { isClientStatusPack, subjectOf, packOf, packHtml } from '../void-live-deploy/skills/client-status-pack.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('client-status-pack matches its asks and leaves the other status cards alone', () => {
  assert.equal(isClientStatusPack('status pack for onboarding'), true);
  assert.equal(isClientStatusPack('client status for the invoice bot'), true);
  assert.equal(isClientStatusPack('handoff status pack'), true);
  assert.equal(subjectOf('status pack for onboarding'), 'onboarding');
  assert.equal(subjectOf('client status for the invoice bot'), 'invoice bot');
  assert.equal(isClientStatusPack('what is the status'), false);
  assert.equal(isClientStatusPack('status of the build'), false);
  assert.equal(isClientStatusPack('system status'), false);
  assert.equal(isClientStatusPack('systems monitor'), false);
  assert.equal(isClientStatusPack('system status for the onboarding flow'), false);
  assert.equal(typeof skill.match, 'function');
  assert.equal(typeof skill.run, 'function');
  for (const a of skill.examples) assert.equal(skill.match(a.toLowerCase(), a), true, a);
  for (const a of skill.nearMisses) assert.equal(skill.match(a.toLowerCase(), a), false, a);
});

test('the card shows the status API and the incident log, and names a source that did not answer', () => {
  const live = packOf({
    subject: 'onboarding',
    statusBody: { overall: 'degraded', guards: [{ name: 'Main CI', now: 'down', what: 'the suite on main' }, { name: 'Films', now: 'up', what: 'VERSE FILMS is live' }] },
    incidentsBody: { incidents: [
      { at: '2026-11-09T19:24:57.000Z', sha: 'abcdef1234567', suite: 'verify', checks: ['one failed', 'two failed'] },
      { at: '2026-11-08T12:00:00.000Z', sha: '1234abcd5678', suite: 'browser', checks: ['old'], closedAt: '2026-11-08T13:00:00.000Z' },
    ] },
  });
  assert.equal(live.status.overall, 'degraded');
  assert.deepEqual(live.status.rows.map((r) => r.now), ['down', 'up']);
  assert.equal(live.incidents.open, 1);
  assert.equal(live.incidents.recent[0].suite, 'verify');
  assert.equal(live.incidents.recent[1].closed, true);
  assert.equal(live.named.kind, 'none');
  const html = packHtml(esc, live);
  assert.match(html, /degraded/);
  assert.match(html, /<td>down<\/td>/);
  assert.match(html, /1 open in the log/);
  assert.match(html, /verify: 2 checks, open/);
  assert.match(html, /no live signal/);
  assert.match(html, /GET \/api\/status/);
  assert.match(html, /\/incidents\.json/);
  assert.doesNotMatch(html, /green/i);
  assert.doesNotMatch(html, /all systems/i);
  assert.doesNotMatch(html, /last check today/i);

  const missing = packOf({ subject: 'onboarding', statusError: 'the status API did not answer', incidentsError: 'the incident log did not answer' });
  const gap = packHtml(esc, missing);
  assert.match(gap, /the status API did not answer/);
  assert.match(gap, /the incident log did not answer/);
  assert.doesNotMatch(gap, /<td>up<\/td>/);
  assert.doesNotMatch(gap, /green/i);
  assert.equal(missing.status.overall, 'unknown');
  assert.equal(missing.incidents.available, false);
});

test('a named address is the browser check, and text from a source is escaped', () => {
  const view = packOf({
    subject: 'https://example.com/health',
    statusBody: { overall: 'up', guards: [{ name: '<script>', now: 'up', what: 'home' }] },
    incidentsBody: [],
    pingResult: { ok: false, note: 'could not be reached from this browser' },
  });
  assert.equal(view.named.kind, 'unreachable');
  assert.match(view.named.url, /^https:\/\/example\.com\/health/);
  const html = packHtml(esc, view);
  assert.match(html, /Not reachable/);
  assert.match(html, /could not be reached from this browser/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  const nasty = packHtml(esc, packOf({ subject: '<img src=x onerror=alert(1)>', incidentsBody: { incidents: [] } }));
  assert.match(nasty, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(nasty, /<img/);
});

test('run reads /api/status and /incidents.json and does not invent a state', async () => {
  let html = '';
  const seen = [];
  const ret = await skill.run('client status for https://example.com/health', {
    esc,
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
    fetch: async (url) => {
      seen.push(url);
      if (url === '/api/status') return { ok: true, json: async () => ({ overall: 'degraded', guards: [{ name: 'Deploys', now: 'down', what: 'deploys of main' }] }) };
      if (url === '/incidents.json') return { ok: false, status: 503, json: async () => ({}) };
      throw new Error('unexpected ' + url);
    },
    reach: async () => ({ ok: true, status: 0 }),
  });
  assert.equal(ret, 'client-status-pack');
  assert.deepEqual(seen, ['/api/status', '/incidents.json']);
  assert.match(html, /Deploys/);
  assert.match(html, /<td>down<\/td>/);
  assert.match(html, /the incident log answered HTTP 503/);
  assert.match(html, /Reachable/);
  assert.match(html, /example\.com/);
  assert.doesNotMatch(html, /green/i);
  assert.doesNotMatch(html, /all systems/i);
});

test('the skill file does not hardcode a green status', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/client-status-pack.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /all systems green/i);
  assert.doesNotMatch(src, /last check today/i);
  assert.doesNotMatch(src, /green —/);
  assert.match(src, /innerHTML = packHtml\(esc,/);
});
