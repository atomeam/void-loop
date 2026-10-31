// tools/verse-job.mjs: a queue job through one lap of the Verse loop, and what goes back to the queue. Run: node --test tools/verse-job.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { taskText, startHere, lastJson, settle, runJob, GUIDE, fullWhy } from './verse-job.mjs';
import { GUIDE as GUIDE_TEAM } from '../void-live-deploy/lib/job-guide.js';
import { ROUTES } from './conductor-core.mjs';

const job = (o = {}) => ({ id: 'j1', target: 'feature:dark mode', state: 'building', note: 'claimed by conductor', ask: 'add a dark mode to /notes/', at: '2026-10-20T00:00:00Z', updated: '2026-10-29T01:00:00Z', ...o });

test('every kind the conductor sends to the coder has guidance, and the task text carries the words, the note and the guidance within the cap', () => {
  for (const [kind, r] of Object.entries(ROUTES)) if (r.claims) assert.ok(GUIDE[kind], kind + ' has guidance');
  const t = taskText(job({ note: 'claimed by conductor · tries 1 · needs a test', target: 'versus:tower-x' }));
  assert.match(t, /^Queue job j1 \(versus: tower-x\): add a dark mode to \/notes\//);
  assert.match(t, /Note: needs a test/); assert.doesNotMatch(t, /claimed by|tries 1/);
  assert.match(t, /docs\/playbooks\/floor-kit\.md/);
  assert.ok(taskText(job({ ask: 'x'.repeat(5000), note: 'y'.repeat(5000) })).length <= 1800);
  assert.match(taskText(job({ target: 'mystery:1' })), /small and tested/);
});

test('a versus job with a site reaches Verse\'s own coder with its whole spec, the same guide the team agents get, never cut by a long note', () => {
  // the conductor started mvqf0fkb (versus:wheelockweb.net) on verse-job.yml at 06:03Z, 2026-10-30, with only the old one-line guide
  const PARTS = ['Target: https://wheelockweb.net/', 'What to build: ', 'Files to touch: ', 'Verify: ', 'Deliver: '];
  for (const note of ['claimed by conductor', 'claimed by conductor · ' + 'y'.repeat(5000)]) {
    const t = taskText(job({ target: 'versus:wheelockweb.net', ask: 'Versus: wheelockweb.net (Wheelock) needs a page no floor has yet: a school site', note }));
    for (const p of PARTS) assert.ok(t.includes(p), p + ' is in the task');
    assert.doesNotMatch(t, /data row on the shared page generator/, 'no longer the guide that contradicts a new page');
    assert.match(t, /The loop commits it and opens the pull request/, 'delivered the loop\'s way: the coder opens no pull request itself');
  }
  const a = taskText(job({ target: 'versus:diffuse.tools:speed', ask: 'Versus diffuse, speed: Verse loads in 2.1 s, the site in 0.9 s' }));
  assert.match(a, /fix that one aspect/); assert.match(a, /node tools\/floor-kit\.mjs diffuse\.tools/);
  assert.equal(GUIDE.versus, GUIDE_TEAM.versus, 'one table for both');
  assert.ok(taskText(job({ target: 'versus:tower-x' })).length <= 1800, 'a versus job with no site keeps the old cap');
});

test('a lap want names where its item lives and the step that counts, so the coder reads instead of searching the repo', () => {
  // the want that spent 30 turns on "search ." twice (mvpwmhl2, 2026-10-29)
  const want = job({ target: 'will:overhaul-surface-ask-persona-playtest-an', ask: 'Overhaul surface:ask: persona playtest and best-site comparison, then rebuild what is weak', note: 'tries 2 · no-change: stopped at the turn cap (30) · Verse chose this: its turn in this lap; it must end measurably better than last lap (before: skills 3, tests 0)' });
  const skills = ['ask-clipboard', 'ask-diff', 'ask-immune', 'calendar', 'home'];
  const s = startHere(want, skills);
  assert.match(s, /void-live-deploy\/skills\/ask-clipboard\.js, void-live-deploy\/skills\/ask-diff\.js, void-live-deploy\/skills\/ask-immune\.js\./);
  assert.doesNotMatch(s, /calendar|home\.js/);
  assert.match(s, /measured by: skills 3, tests 0/); assert.match(s, /tools\/ask-clipboard\.test\.mjs/);
  const t = taskText(want, skills); assert.ok(t.includes(s), 'the task carries it'); assert.ok(t.indexOf(s) < t.indexOf('Note:'), 'before the note, so a long note never cuts it');
  assert.ok(taskText(job({ ask: 'Overhaul surface:ask ' + 'x'.repeat(5000), note: '(before: skills 3, tests 0)' }), skills).includes('Start here'), 'a long ask never cuts it');
  // a skill, a tool; a tested item gets no test step; other jobs and unknown surfaces get nothing
  assert.match(startHere(job({ ask: 'Upgrade skill:calendar: more views', note: '(before: lines 90, examples 2, tests 3)' })), /void-live-deploy\/skills\/calendar\.js/);
  assert.doesNotMatch(startHere(job({ ask: 'Upgrade skill:calendar: more views', note: '(before: lines 90, tests 3)' })), /smallest step/);
  assert.match(startHere(job({ ask: 'Upgrade tool:verse-job.mjs: tests' })), /tools\/verse-job\.mjs/);
  assert.equal(startHere(job()), ''); assert.equal(startHere(job({ ask: 'Overhaul surface:nowhere: x' }), skills), '');
});

test('the lap\'s answer is the last JSON line of its output', () => {
  assert.deepEqual(lastJson('· picked\n{"a":1}\nnoise {x}\n{"outcome":"shipped","pr":"u"}\n'), { outcome: 'shipped', pr: 'u' });
  assert.equal(lastJson('no json here'), null); assert.equal(lastJson(''), null);
});

test('shipped is done; paused, skipped, idle, healed and a lap that fixed something else go back without a try; every other end costs a try', () => {
  const d = settle({ outcome: 'shipped', pr: 'https://github.com/x/pull/9' }, job());
  assert.equal(d.state, 'done'); assert.match(d.note, /PR https:\/\/github\.com\/x\/pull\/9/);
  for (const outcome of ['paused', 'skipped', 'idle', 'healed']) { const s = settle({ outcome, why: 'wait' }, job({ note: 'tries 1' })); assert.equal(s.state, 'queued'); assert.equal(s.counted, false); assert.match(s.note, /^tries 1 /); }
  const other = settle({ outcome: 'shipped', task: { kind: 'fix', check: 'guard-source' }, pr: 'u', why: 'fixed a red check' }, job());
  assert.equal(other.state, 'queued', 'the lap shipped a red check fix, not the job: the job goes back'); assert.equal(other.counted, false);
  const fixedOther = settle({ outcome: 'no-change', task: { kind: 'fix' } }, job());
  assert.equal(fixedOther.counted, false, 'the lap went to a red check first: the job was not tried');
  for (const outcome of ['dropped', 'rejected', 'refused', 'no-change', 'pushed', 'error', undefined]) { const s = settle(outcome ? { outcome, why: 'because' } : null, job({ note: 'claimed by conductor · tries 1' })); assert.equal(s.state, 'queued'); assert.equal(s.counted, true); assert.match(s.note, /^tries 2 /, String(outcome)); }
});

test('end to end against a fake queue and a stub lap: the job is read, the lap gets its words, the result is written back', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vj-')), seen = { patches: [], gets: 0 }, stub = join(dir, 'lap.mjs');
  writeFileSync(stub, "console.log('noise');\nconsole.log(JSON.stringify({ outcome: process.env.STUB_OUTCOME, why: 'stub', pr: process.env.STUB_OUTCOME === 'shipped' ? 'https://x/pull/1' : undefined, task: { kind: 'next' }, args: process.argv.slice(2).join(' ').slice(0, 60) }));\n");
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer tkn') { res.statusCode = 401; return res.end('no'); }
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET') { seen.gets++; return res.end(JSON.stringify({ items: [job(), job({ id: 'j2', state: 'queued' })] })); }
      seen.patches.push(JSON.parse(body)); res.end('{}');
    });
  }).listen(0);
  try {
    const env = { ...process.env, VOID_OWNER_TOKEN: 'tkn', VOID_API: 'http://127.0.0.1:' + server.address().port + '/api/queue', VERSE_LOOP_BIN: stub };
    let r = await runJob('j1', { env: { ...env, STUB_OUTCOME: 'shipped' } });
    assert.equal(r.patch.state, 'done'); assert.deepEqual(seen.patches[0], { id: 'j1', state: 'done', note: 'verse-job: PR https://x/pull/1' });
    r = await runJob('j1', { env: { ...env, STUB_OUTCOME: 'dropped' } });
    assert.equal(seen.patches[1].state, 'queued'); assert.match(seen.patches[1].note, /^tries 1 · dropped: stub/);
    r = await runJob('j1', { env: { ...env, STUB_OUTCOME: 'shipped' }, dry: true });
    assert.equal(seen.patches.length, 2, 'a dry run writes nothing back');
    r = await runJob('j2', { env }); assert.match(r.error, /queued, not claimed/);
    r = await runJob('nope', { env }); assert.match(r.error, /not open/);
    r = await runJob('j1', { env: { ...env, VOID_OWNER_TOKEN: '' } }); assert.match(r.error, /VOID_OWNER_TOKEN/);
  } finally { server.close(); }
});

test('the job log keeps the whole why, one line, with key-like runs masked', () => {
  const why = 'no model answered (verse 429, workers-ai 401, openrouter 200 text/html 1234B not JSON)\n and more';
  assert.equal(fullWhy({ why }), why.replace(/\s+/g, ' '));
  assert.ok(fullWhy({ why }).length > 90, 'longer than the queue note');
  assert.equal(fullWhy({ why: 'token ' + 'a'.repeat(40) + ' refused' }), 'token [masked] refused');
  assert.equal(fullWhy({ why: 'x'.repeat(5000).replace(/x/g, 'ab ') }).length, 600);
  assert.equal(fullWhy(null), '');
});
