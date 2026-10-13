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

test('Void\'s own build: the newest checks and deploy on main, from GitHub\'s public API; failed, passed, running or unknown', async () => {
  const { buildRun, buildState, buildFailed, BUILD, REPO } = await import('../void-live-deploy/skills/status.js');
  const runs = (r) => async (u) => ({ ok: true, status: 200, json: async () => ({ workflow_runs: r ? [r] : [] }), url: u });
  const seen = [];
  const failed = await buildRun(BUILD[0], async (u, o) => { seen.push([u, o]); return runs({ status: 'completed', conclusion: 'failure', head_sha: 'abcdef1234', created_at: '2026-10-13T16:20:00Z', html_url: 'https://github.com/atomeam/void-loop/actions/runs/1' })(u); });
  assert.equal(seen[0][0], 'https://api.github.com/repos/' + REPO + '/actions/workflows/verify.yml/runs?branch=main&per_page=1&exclude_pull_requests=true');
  assert.deepEqual([failed.state, failed.note, failed.url], ['failed', 'failed (failure) on abcdef1 · 2026-10-13 16:20 UTC', 'https://github.com/atomeam/void-loop/actions/runs/1']);
  assert.equal((await buildRun(BUILD[1], runs({ status: 'completed', conclusion: 'success', head_sha: 'x' }))).state, 'passed');
  assert.equal((await buildRun(BUILD[1], runs({ status: 'in_progress', conclusion: null, head_sha: 'x' }))).state, 'running');
  assert.equal((await buildRun(BUILD[1], runs({ status: 'completed', conclusion: 'cancelled', head_sha: 'x' }))).state, 'unknown', 'a cancelled run is not a failure');
  assert.equal((await buildRun(BUILD[1], runs(null))).state, 'unknown');
  assert.match((await buildRun(BUILD[1], async () => ({ ok: false, status: 403 }))).note, /HTTP 403/);
  assert.match((await buildRun(BUILD[1], async () => { throw new TypeError('Failed to fetch'); })).note, /could not be reached/);
  assert.equal((await buildRun(BUILD[1], runs({ status: 'completed', conclusion: 'failure', html_url: 'javascript:alert(1)' }))).url, null, 'only a github.com link');
  assert.ok(buildFailed(await buildState(runs({ status: 'completed', conclusion: 'failure' })))); assert.ok(!buildFailed(await buildState(runs({ status: 'completed', conclusion: 'success' }))));
});

test('for the owner, the card opens by itself only when a run on main failed; the build is read at most once in ten minutes', async () => {
  const { autoOpen } = await import('../void-live-deploy/skills/status.js');
  const store = new Map(), S = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let reads = 0, opened = 0; const open = async () => { opened++; };
  const gh = (conclusion) => async () => { reads++; return { ok: true, status: 200, json: async () => ({ workflow_runs: [{ status: 'completed', conclusion }] }) }; };
  assert.equal(await autoOpen(open, { fetchFn: gh('success'), store: S, now: 0 }), false); assert.equal(opened, 0); assert.equal(reads, 2);
  assert.equal(await autoOpen(open, { fetchFn: gh('failure'), store: S, now: 60000 }), false, 'within ten minutes the cached green is used'); assert.equal(reads, 2);
  assert.equal(await autoOpen(open, { fetchFn: gh('failure'), store: S, now: 700000 }), true); assert.equal(opened, 1); assert.equal(reads, 4);
});

test('the card shows Void\'s own build with a link to a failed run, escaped', async () => {
  const { statusHtml } = await import('../void-live-deploy/skills/status.js');
  const h = statusHtml(esc, { ok: 1, total: 1, missing: [] }, [{ name: 'Online', ok: true, note: '' }], null, '', [{ name: 'Checks on main', state: 'failed', note: 'failed (failure) on <b>', url: 'https://github.com/x' }, { name: 'Deploy', state: 'passed', note: 'passed' }]);
  assert.match(h, /Void’s own build · <span style="color:#e0584a">something on main failed<\/span>/);
  assert.match(h, /Checks on main<\/td><td[^>]*>failed \(failure\) on &#60;b&#62; · <a href="https:\/\/github.com\/x"/);
  assert.ok(!/Void’s own build/.test(statusHtml(esc, { ok: 1, total: 1, missing: [] }, [{ name: 'Online', ok: true, note: '' }], null, '')), 'no build, no section');
});
