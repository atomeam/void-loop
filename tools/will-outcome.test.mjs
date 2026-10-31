// The feedback loop's write side (tools/will-outcome.mjs): a closed pull request settles the queue job it came from, so an abandoned
// PR becomes `declined` and the will stops reopening the same want. The assertions that matter: a PR with no job line writes nothing,
// and a PR that failed its checks and was then closed unmerged uses ONE try, not two. Run: node --test tools/will-outcome.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lf, prOf, plan, parseArgs, prFrom, EVENTS } from './will-outcome.mjs';
import { moveJob } from './job-link.mjs';
import { triesOf } from '../void-live-deploy/lib/will-guard.js';

const PR_URL = 'https://github.com/atomeam/void-loop/pull/7';
const body = (id) => 'Some change.\n\nJob: ' + id;

test('merged is live, closed unmerged is declined, a failed check is deferred, and no job line is nothing at all', () => {
  assert.deepEqual(EVENTS, ['closed', 'failed']);
  assert.equal(plan({ event: 'closed', merged: true, body: body('mk2p1a') }).state, 'live');
  assert.equal(plan({ event: 'closed', merged: false, body: body('mk2p1a') }).state, 'declined');
  assert.equal(plan({ event: 'failed', merged: false, body: body('mk2p1a') }).state, 'deferred');
  assert.equal(plan({ event: 'closed', merged: false, body: body('mk2p1a') }).jobId, 'mk2p1a');
  assert.match(plan({ event: 'closed', merged: false, body: body('mk2p1a') }).why, /waits instead of coming back/);

  // a manual or maintenance PR: nothing to settle, nothing written, and the caller exits 0
  assert.equal(plan({ event: 'closed', merged: true, body: 'A maintenance change with no job line.' }), null);
  assert.equal(plan({ event: 'closed', merged: false, body: '' }), null);
  assert.equal(plan({ event: 'closed', merged: false, body: 'Job: not-an-id' }), null, 'a line that is not a queue id is not a job');
  assert.equal(plan({ event: 'closed', merged: false, body: 'the text mentions Job: mk2p1a inside a sentence' }), null, 'only a whole line counts');
});

test('a CRLF pull request body and event payload parse exactly as Linux CI parses them (owner, 2026-10-30)', () => {
  assert.equal(lf('a\r\nb\rc\n'), 'a\nb\nc\n');
  const crlfBody = 'Some change.\r\n\r\nJob: mk2p1a\r\n';
  assert.equal(plan({ event: 'closed', merged: false, body: crlfBody }).jobId, 'mk2p1a');
  const payload = { pull_request: { number: 7, merged: false, html_url: PR_URL, body: crlfBody } };
  assert.deepEqual(prOf(JSON.parse(lf(JSON.stringify(payload, null, 2).replace(/\n/g, '\r\n')))), { number: 7, merged: false, body: 'Some change.\n\nJob: mk2p1a\n', url: PR_URL });
  assert.equal(prOf({}), null);
  assert.equal(prOf(null), null);

  const dir = mkdtempSync(join(tmpdir(), 'wo-'));
  try {
    const p = join(dir, 'event.json');
    writeFileSync(p, JSON.stringify(payload).replace(/,/g, ',\r\n').replace(/\{/g, '{\r\n'));
    assert.equal(prFrom({ payloadPath: p, bodyFile: '' }).number, 7, 'a CRLF payload file yields the pull request');
    assert.equal(prFrom({ payloadPath: join(dir, 'missing.json'), bodyFile: '' }), null);
    const b = join(dir, 'pr.md');
    writeFileSync(b, crlfBody);
    assert.equal(prFrom({ payloadPath: '', bodyFile: b }).body, 'Some change.\n\nJob: mk2p1a\n', 'a --body-file is read as CI text too');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the argument line refuses an outcome it cannot write and defaults to a close', () => {
  assert.deepEqual(parseArgs(['--event', 'closed']), { event: 'closed', bodyFile: '', merged: false, dry: false });
  assert.equal(parseArgs([]).event, 'closed');
  assert.equal(parseArgs(['--event', 'merged']).error, '--event is closed or failed');
  assert.equal(parseArgs(['--event', 'failed', '--merged', '--dry']).merged, true);
});

test('one pull request is one try: deferred then declined moves the SAME job, and the will counts it once (owner, 2026-10-30)', async () => {
  const rows = [{ id: 'mk2p1a', target: 'will:tides', state: 'building', note: 'Verse chose this: tides' }];
  const calls = [];
  // the queue as /api/queue answers it: GET -> the newest rows, PATCH -> the row updated in place
  const fetcher = async (url, init = {}) => {
    if ((init.method || 'GET') === 'GET') return { ok: true, json: async () => ({ items: rows }) };
    const b = JSON.parse(init.body || '{}');
    calls.push(b);
    const row = rows.find((r) => r.id === b.id);
    if (row) { if (b.state) row.state = b.state; if (b.note) row.note = b.note; }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const move = (state, label) => moveJob({ id: 'mk2p1a', state, label, url: PR_URL, site: 'https://a-to-mind.com', token: 'test', fetcher });

  assert.match(await move('deferred', 'checks'), /-> deferred/);
  assert.match(await move('declined', 'PR'), /-> declined/);
  assert.equal(rows.length, 1, 'no second job row was created');
  assert.equal(rows[0].state, 'declined', 'the row carries the last state');
  assert.deepEqual(calls.map((c) => c.id), ['mk2p1a', 'mk2p1a'], 'both writes name the same job');
  assert.equal(triesOf(rows, 'tides'), 1, 'two endings on one pull request still count as one try');
  assert.match(rows[0].note, /tides/, 'the note keeps what the will said, and adds where it went');

  // running the same close twice (a re-run) is idempotent: no third write
  await move('declined', 'PR');
  assert.equal(calls.length, 2, 'a re-run of the same close writes nothing');
});

test('the workflow that runs it watches closed pull requests and passes no write token to anything a model wrote', () => {
  const wf = lf(readFileSync(new URL('../.github/workflows/will-outcome.yml', import.meta.url), 'utf8'));
  assert.match(wf, /types: \[closed\]/);
  assert.match(wf, /run: node tools\/will-outcome\.mjs --event closed/);
  assert.match(wf, /VOID_OWNER_TOKEN: \$\{\{ secrets\.VOID_OWNER_TOKEN \}\}/);
  assert.doesNotMatch(wf, /pull_request_target/, 'never the target trigger: this runs on our own branches only');
  assert.doesNotMatch(wf, /contents: write|pull-requests: write/, 'settling a job needs read only');
});
