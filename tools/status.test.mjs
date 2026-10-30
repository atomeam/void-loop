import test from 'node:test';
import assert from 'node:assert/strict';
import { statusOf, ping, checkSkills, checkBrowser, statusHtml, SOURCES } from '../void-live-deploy/skills/status.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');

test('status asks open the check; other "status" phrases stay with their own answers', () => {
  for (const t of ['void status', 'system status', 'status', 'is void working', 'Is Verse down?', 'health check', 'are the sources up', 'check yourself']) assert.ok(statusOf(t), t);
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

test('Verse\'s own build: the newest checks and deploy on main, from GitHub\'s public API; failed, passed, running or unknown', async () => {
  const { buildRun, buildState, buildFailed, BUILD, REPO } = await import('../void-live-deploy/skills/status.js');
  const runs = (r) => async (u) => ({ ok: true, status: 200, json: async () => ({ workflow_runs: r ? [r] : [] }), url: u });
  const seen = [];
  const failed = await buildRun(BUILD[0], async (u, o) => { seen.push([u, o]); return runs({ status: 'completed', conclusion: 'failure', head_sha: 'abcdef1234', created_at: '2026-10-13T16:20:00Z', html_url: 'https://github.com/atomeam/void-loop/actions/runs/1' })(u); });
  assert.equal(seen[0][0], 'https://api.github.com/repos/' + REPO + '/actions/workflows/verify.yml/runs?branch=main&per_page=10&exclude_pull_requests=true');
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
  assert.equal(await autoOpen(open, { fetchFn: gh('success'), store: S, now: 0 }), false); assert.equal(opened, 0); assert.equal(reads, 3, 'the checks, the deploy and the live check');
  assert.equal(await autoOpen(open, { fetchFn: gh('failure'), store: S, now: 60000 }), false, 'within ten minutes the cached green is used'); assert.equal(reads, 3);
  assert.equal(await autoOpen(open, { fetchFn: gh('failure'), store: S, now: 700000 }), true); assert.equal(opened, 1); assert.equal(reads, 6);
});

test('the card shows Verse\'s own build with a link to a failed run, escaped', async () => {
  const { statusHtml } = await import('../void-live-deploy/skills/status.js');
  const h = statusHtml(esc, { ok: 1, total: 1, missing: [] }, [{ name: 'Online', ok: true, note: '' }], null, '', [{ name: 'Checks on main', state: 'failed', note: 'failed (failure) on <b>', url: 'https://github.com/x' }, { name: 'Deploy', state: 'passed', note: 'passed' }]);
  assert.match(h, /Verse’s own build · <span style="color:#e0584a">something on main failed<\/span>/);
  assert.match(h, /Checks on main<\/td><td[^>]*>failed \(failure\) on &#60;b&#62; · <a href="https:\/\/github.com\/x"/);
  assert.ok(!/Verse’s own build/.test(statusHtml(esc, { ok: 1, total: 1, missing: [] }, [{ name: 'Online', ok: true, note: '' }], null, '')), 'no build, no section');
});

test('paying users who said it broke: read with the owner key only, shown on the card, and they open it', async () => {
  const { supportState, statusHtml, autoOpen } = await import('../void-live-deploy/skills/status.js');
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const fetchFn = async (u) => u === '/api/support' ? new Response(JSON.stringify({ open: 1, tickets: [{ id: 'S-1A2B3C4D', status: 'open', where: 'action', at: '2026-10-14T03:00:00Z', what: '<img src=x> broke' }] })) : new Response(JSON.stringify({ workflow_runs: [{ status: 'completed', conclusion: 'success', head_sha: 'abc' }] }));
  assert.equal(await supportState(fetchFn, ''), null, 'no owner key, nothing read');
  const s = await supportState(fetchFn, 'owner');
  assert.equal(s.open, 1);
  const h = statusHtml(esc, { ok: 1, total: 1, missing: [] }, [{ name: 'Online', ok: true, note: '' }], null, '', null, s);
  assert.match(h, /1 waiting on you/); assert.ok(!h.includes('<img'), 'a report is escaped');
  // the build passed, but a report waits: the card opens (the owner's key comes from localStorage in a browser)
  globalThis.localStorage = { getItem: () => 'owner' };
  try { let opened = false; assert.equal(await autoOpen(async () => { opened = true; }, { fetchFn, store: null }), true); assert.ok(opened); }
  finally { delete globalThis.localStorage; }
});

// news about Verse's own systems, pasted in (tester's weak-answer queue, paraphrased): the substance first, the time math as an aside
test('a pasted update about my own routine is news about me, not a time list', async () => {
  const { newsOf, takeOf } = await import('../void-live-deploy/skills/status.js');
  const paste = 'update for you: a new routine now runs every 3 hours from 3:17 AM ET and clears every list';
  assert.equal(newsOf(paste), true);
  const n = takeOf(paste); assert.equal(n.part, 'routine'); assert.ok(n.take.some((x) => /piles up/.test(x)));
  assert.match(n.aside, /^That is 8 runs a day: 3:17 AM, 6:17 AM/);
  for (const not of ['what routine runs every 3 hours at 3:17 am for void', 'add milk to my list', 'a new routine: i run every day at 6, can you track it', 'set a new routine for my mornings every day', 'void status', 'flight status'])
    assert.equal(newsOf(not), false, not);
  let html = ''; const out = await (await import('../void-live-deploy/skills/status.js')).default.run(paste, { showPage: (b) => { const p = {}; b(p); html = p.innerHTML; return p; }, esc: (s) => String(s) });
  assert.equal(out, 'self-news'); assert.match(html, /News about me/); assert.ok(html.indexOf('My take') < html.indexOf('runs a day'));
});

// the other half of Verse's ask (five times): an action Verse took for the owner that failed opens the status card by itself
test('a failed action in the last day opens the status card for the owner and is listed on it; old or done ones are not', async () => {
  const { failedActions, autoOpen, statusHtml } = await import('../void-live-deploy/skills/status.js');
  const now = Date.parse('2026-10-15T12:00:00Z');
  const rows = [{ id: 'a1', kind: 'email.send', ref: 'to jane', state: 'failed', error: 'SMTP refused', started: '2026-10-15T11:00:00Z', finished: '2026-10-15T11:00:02Z' },
    { id: 'a2', kind: 'order.place', ref: '', state: 'done', result: 'ok', started: '2026-10-15T10:00:00Z', finished: '2026-10-15T10:00:01Z' },
    { id: 'a3', kind: 'watch.check', ref: 'Oslo', state: 'failed', error: 'old', started: '2026-10-13T10:00:00Z', finished: '2026-10-13T10:00:01Z' }];
  const fetchFn = async (u) => /\/api\/actions/.test(String(u)) ? new Response(JSON.stringify({ actions: rows }), { status: 200 })
    : /api\.github\.com/.test(String(u)) ? new Response(JSON.stringify({ workflow_runs: [{ status: 'completed', conclusion: 'success', head_sha: 'abc1234', created_at: '2026-10-15T11:50:00Z', html_url: 'https://github.com/atomeam/void-loop/actions/runs/7' }] }), { status: 200 })
    : new Response(JSON.stringify({ open: 0, tickets: [] }), { status: 200 });
  const f = await failedActions(fetchFn, 'owner', now);
  assert.deepEqual(f.map((a) => a.id), ['a1']); assert.equal(f[0].error, 'SMTP refused'); assert.equal(f[0].at, '2026-10-15 11:00');
  assert.equal(await failedActions(fetchFn, '', now), null, 'a visitor has no key and sees nothing');
  assert.equal(await failedActions(async () => new Response('no', { status: 401 }), 'owner', now), null);
  const h = statusHtml((x) => String(x), { ok: 1, total: 1, missing: [] }, [{ name: 'Online', ok: true, note: '' }], null, '', null, null, f);
  assert.match(h, /1 failed in the last day/); assert.match(h, /email\.send/); assert.match(h, /SMTP refused/);
  assert.match(statusHtml((x) => String(x), { ok: 1, total: 1, missing: [] }, [], null, '', null, null, []), /none failed in the last day/);
  globalThis.localStorage = { getItem: () => 'owner' };
  try { let opened = false; assert.equal(await autoOpen(async () => { opened = true; }, { fetchFn, store: null, now }), true); assert.ok(opened, 'a green build, no report, one failed action: the card opens'); }
  finally { delete globalThis.localStorage; }
});

test('status: a red check on main names what failed (asked by Verse: the root cause, from incidents.json), and only a red one', async () => {
  const { causesOf, withCauses } = await import('../void-live-deploy/skills/status.js');
  const rows = [{ name: 'Checks on main', state: 'failed', sha: '60e2e47', note: 'failed' }, { name: 'Deploy', state: 'passed', sha: '60e2e47', note: 'passed' }];
  const inc = [{ sha: '60e2e47f458e', suite: 'browser suite on main', checks: ['Four in a Row on a phone: the 3D frame fits'] }, { sha: 'ad536f3', checks: ['other'] }];
  const out = causesOf(rows, inc);
  assert.deepEqual(out[0].checks, ['Four in a Row on a phone: the 3D frame fits']); assert.equal(out[0].suite, 'browser suite on main'); assert.equal(out[1].checks, undefined);
  assert.equal(causesOf(rows, [])[0].checks, undefined, 'no incident for that sha: no cause claimed');
  const got = await withCauses(rows, async (u) => { assert.equal(u, '/incidents.json'); return Response.json(inc); });
  assert.equal(got[0].checks.length, 1);
  assert.deepEqual(await withCauses([{ state: 'passed' }], async () => { throw new Error('never called'); }), [{ state: 'passed' }], 'nothing red, nothing fetched');
  const esc = (x) => String(x);
  const { statusHtml } = await import('../void-live-deploy/skills/status.js');
  assert.match(statusHtml(esc, { ok: 1, total: 1, missing: [], error: null }, [], [], '', out, null, null), /What failed:<\/b> Four in a Row on a phone/);
});

// Evidence only (2026-10-29): every commit the card reports stands at exactly one of implemented, merged, deploy running, deployed,
// verified live; "verified live" needs the live check (mcp-live.yml) passed on that same commit, and a running run never stands alone.
test('the build card: each commit at exactly one stage, on evidence; a running run shows the last finished one; no live check, no "verified live"', async () => {
  const { stageOf, STAGES, buildState, statusHtml: html } = await import('../void-live-deploy/skills/status.js');
  const d = (sha, state) => ({ sha, state });
  assert.deepEqual(STAGES, ['implemented', 'merged', 'deploy running', 'deployed', 'verified live']);
  assert.equal(stageOf('aaaaaaa', { onMain: false, deploys: [d('aaaaaaa', 'passed')], lives: [d('aaaaaaa', 'passed')] }), 'implemented', 'off main it is only implemented');
  assert.equal(stageOf('aaaaaaa', { deploys: [], lives: [] }), 'merged');
  assert.equal(stageOf('aaaaaaa', { deploys: [d('aaaaaaa', 'running')] }), 'deploy running');
  assert.equal(stageOf('aaaaaaa', { deploys: [d('aaaaaaa', 'failed')] }), 'merged', 'a failed deploy leaves it merged');
  assert.equal(stageOf('aaaaaaa', { deploys: [d('aaaaaaa', 'passed')] }), 'deployed', 'deployed with no live check stops at deployed');
  assert.equal(stageOf('aaaaaaa', { deploys: [d('aaaaaaa', 'passed')], lives: [d('aaaaaaa', 'failed')] }), 'deployed', 'a red live check is not verified');
  assert.equal(stageOf('aaaaaaa', { deploys: [d('aaaaaaa', 'passed')], lives: [d('bbbbbbb', 'passed')] }), 'deployed', 'a live check of another commit says nothing about this one');
  assert.equal(stageOf('aaaaaaa', { deploys: [d('aaaaaaa', 'running')], lives: [d('aaaaaaa', 'passed')] }), 'deploy running', 'a live check without a passed deploy of the commit is not verified');
  assert.equal(stageOf('aaaaaaa', { deploys: [d('aaaaaaa', 'passed')], lives: [d('aaaaaaa', 'passed')] }), 'verified live');
  assert.equal(stageOf('aaaaaaabcdef', { deploys: [d('aaaaaaa', 'passed')], lives: [d('aaaaaaa', 'passed')] }), 'verified live', 'a full sha matches its short one');
  // GitHub stubbed per workflow: the checks and the deploy of the newest commit are still running; the ones before finished
  const run = (sha, status, conclusion, at) => ({ head_sha: sha + '000000000', status, conclusion, created_at: at, html_url: 'https://github.com/atomeam/void-loop/actions/runs/' + sha });
  const gh = (by) => async (u) => { const f = /workflows\/([\w-]+)\.yml/.exec(String(u))[1]; return { ok: true, status: 200, json: async () => ({ workflow_runs: by[f] || [] }) }; };
  const now = { verify: [run('ac07cc0', 'in_progress', null, '2026-10-29T14:57:00Z'), run('1111111', 'completed', 'success', '2026-10-29T14:20:00Z')],
    deploy: [run('80767cd', 'in_progress', null, '2026-10-29T15:00:00Z'), run('1111111', 'completed', 'success', '2026-10-29T14:22:00Z')] };
  const rows = await buildState(gh(now));
  assert.deepEqual(rows.map((r) => [r.name, r.state, r.sha, r.stage]), [['Checks on main', 'running', 'ac07cc0', 'merged'], ['Deploy', 'running', '80767cd', 'deploy running']]);
  assert.deepEqual(rows.map((r) => r.last && [r.last.state, r.last.sha, r.last.stage]), [['passed', '1111111', 'deployed'], ['passed', '1111111', 'deployed']], 'no live check read: deployed, never verified live');
  for (const r of rows) { assert.ok(STAGES.includes(r.stage), r.name); assert.ok(r.stage !== 'verified live' && r.stage !== 'deployed', 'a running run alone is never deployed or verified'); }
  const h = html(esc, { ok: 1, total: 1, missing: [] }, [], null, '', rows);
  assert.match(h, /running now on ac07cc0 · 2026-10-29 14:57 UTC · <a /, 'a running row says running and nothing more (owner, 2026-10-30: "show running or passed, not both")');
  assert.doesNotMatch(h, /running now on ac07cc0[^<]*<b class="status-stage">/);
  assert.match(h, /last finished: passed on 1111111 · 2026-10-29 14:20 UTC · <b class="status-stage">deployed<\/b>/);
  assert.ok(!/verified live/.test(h), 'no live check, so the card never says verified live');
  for (const n of ['Checks on main', 'Deploy']) assert.match(h, new RegExp('background:#8a8a92"></span>' + n + '<'), n + ' running: a grey dot, never the green of passed');
  assert.ok(!/(?<!last finished: )passed on (ac07cc0|80767cd)/.test(h), 'the running commits never read as passed');
  // the live check passed on the deployed commit: that commit, and only it, reads verified live
  const lived = await buildState(gh({ ...now, 'mcp-live': [run('1111111', 'completed', 'success', '2026-10-29T14:30:00Z')] }));
  assert.deepEqual(lived.map((r) => [r.stage, r.last.stage]), [['merged', 'verified live'], ['deploy running', 'verified live']]);
  // a newest run that finished has no "last finished" line; a cancelled newest one shows the last that finished
  const done = await buildState(gh({ verify: [run('2222222', 'completed', 'failure', '2026-10-29T15:10:00Z')], deploy: [run('2222222', 'completed', 'cancelled', '2026-10-29T15:12:00Z'), run('1111111', 'completed', 'success', '2026-10-29T14:22:00Z')] }));
  assert.equal(done[0].last, null); assert.equal(done[0].stage, 'merged'); assert.deepEqual([done[1].state, done[1].last.sha, done[1].last.stage], ['unknown', '1111111', 'deployed']);
});

test('a rate-limited action is not counted as failed and does not open the card; the card names it in a muted line of its own', async () => {
  const { recentActions, failedActions, autoOpen, statusHtml: html } = await import('../void-live-deploy/skills/status.js');
  const now = Date.parse('2026-10-29T15:00:00Z');
  const rows = [1, 2, 3].map((i) => ({ id: 'w' + i, kind: 'watch.check', ref: 'hourly-store', state: 'deferred', result: 'rate limited, retry later · the page answered 429 · next try after 2026-10-29 16:36 UTC', started: '2026-10-29T1' + (1 + i) + ':36:00Z', finished: '2026-10-29T1' + (1 + i) + ':36:01Z' }));
  const fetchFn = async (u) => /\/api\/actions/.test(String(u)) ? new Response(JSON.stringify({ actions: rows }), { status: 200 })
    : /api\.github\.com/.test(String(u)) ? new Response(JSON.stringify({ workflow_runs: [{ status: 'completed', conclusion: 'success', head_sha: 'abc1234' }] }), { status: 200 })
    : new Response(JSON.stringify({ open: 0, tickets: [] }), { status: 200 });
  assert.deepEqual(await failedActions(fetchFn, 'owner', now), [], 'three 429s are not three failures');
  const got = await recentActions(fetchFn, 'owner', now);
  assert.equal(got.waiting.length, 3);
  const h = html(esc, { ok: 1, total: 1, missing: [] }, [], null, '', null, null, got.failed, null, got.waiting);
  assert.match(h, /Actions Verse took for you · none failed in the last day/);
  assert.ok(!/failed in the last day<\/span>/.test(h), 'nothing red');
  assert.match(h, /class="status-waiting"[^>]*>◷ 3 rate limited, not failed: a site asked Verse to slow down/);
  globalThis.localStorage = { getItem: () => 'owner' };
  try { let opened = false; assert.equal(await autoOpen(async () => { opened = true; }, { fetchFn, store: null, now }), false); assert.ok(!opened, 'a rate limit does not open the card'); }
  finally { delete globalThis.localStorage; }
});
