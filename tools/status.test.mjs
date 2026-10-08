import test from 'node:test';
import assert from 'node:assert/strict';
import { statusOf, ping, checkSkills, checkBrowser, statusHtml, SOURCES } from '../void-live-deploy/skills/status.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');

test('status asks open the check; other "status" phrases stay with their own answers', () => {
  for (const t of ['void status', 'system status', 'status', 'is void working', 'Is Void down?', 'health check', 'are the sources up', 'check yourself']) assert.ok(statusOf(t), t);
  for (const t of ['what is my status', 'status of my order', 'relationship status', 'flight status', 'status quo', 'check the weather']) assert.ok(!statusOf(t), t);
});

test('a source is up when it answers 2xx, down on an HTTP error, a network error or a timeout; the time is measured', async () => {
  let clock = 0; const now = () => (clock += 40);
  const up = await ping(SOURCES[0], async () => ({ ok: true, status: 200 }), 6000, now);
  assert.deepEqual([up.ok, up.ms, up.note], [true, 40, '']);
  const err = await ping(SOURCES[1], async () => ({ ok: false, status: 503 }), 6000, now);
  assert.deepEqual([err.ok, err.note], [false, 'answered HTTP 503']);
  const blocked = await ping(SOURCES[2], async () => { throw new TypeError('Failed to fetch'); }, 6000, now);
  assert.deepEqual([blocked.ok, blocked.note], [false, 'could not be reached from this browser']);
  const slow = await ping(SOURCES[3], (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))), 20, now);
  assert.deepEqual([slow.ok, slow.note], [false, 'no answer in 0.02 s']);
});

test('the skills check counts what loads and names what does not; a broken index says so', async () => {
  const fetchFn = async () => ({ ok: true, json: async () => ['a', 'b', 'c'] });
  const good = { default: { name: 'a', match() {}, run() {} } };
  const r = await checkSkills(fetchFn, async (n) => (n === 'b' ? Promise.reject(new Error('404')) : n === 'c' ? { default: { name: 'c' } } : good));
  assert.deepEqual(r, { total: 3, ok: 1, missing: ['b', 'c'], error: null });
  const bad = await checkSkills(async () => ({ ok: false, status: 500 }));
  assert.match(bad.error, /index could not be read \(HTTP 500\)/);
});

test('the browser checks read storage, WebGL, the offline layer and the connection, and leave nothing in storage', () => {
  const kept = {};
  const w = { localStorage: { setItem: (k, v) => { kept[k] = v; }, getItem: (k) => kept[k] ?? null, removeItem: (k) => { delete kept[k]; } },
    document: { createElement: () => ({ getContext: () => null }) }, navigator: { onLine: false, serviceWorker: { controller: {} } } };
  assert.deepEqual(checkBrowser(w).map((b) => [b.name, b.ok]), [['Storage in this browser', true], ['3D', false], ['Works offline', true], ['Online', false]]);
  assert.deepEqual(kept, {});
  const html = statusHtml(esc, { total: 3, ok: 2, missing: ['b'], error: null }, checkBrowser(w), null, '12:00');
  assert.match(html, /2 of 3 load; not loading: b/); assert.match(html, /Not checked: this browser is offline/);
});
