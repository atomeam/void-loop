// tools/job-link.mjs: a queue job follows its pull request through one `Job: <id>` line. node --test tools/job-link.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { jobLine, jobOfBody, noteWith, patchJob, findJob, moveJob, parseArgs, NOTE_MAX } from './job-link.mjs';

const URL_PR = 'https://github.com/atomeam/void-loop/pull/1080';
const fake = (items, calls = []) => async (url, o = {}) => { calls.push({ url, method: o.method || 'GET', headers: o.headers, body: o.body ? JSON.parse(o.body) : null }); return new Response(JSON.stringify({ items }), { status: 200 }); };

test('the body line and reading it back: the last whole Job: line, never one inside prose', () => {
  assert.equal(jobLine('mgw1x2y3'), 'Job: mgw1x2y3');
  assert.equal(jobOfBody('## Brief\nthe Job: abcd1234 in this sentence is prose\n\nJob: mgw1x2y3\n'), 'mgw1x2y3');
  assert.equal(jobOfBody('Job: first001\nmore\nJob: last0002  \r\n'), 'last0002', 'the last one, trailing spaces and CR allowed');
  assert.equal(jobOfBody('see Job: abcd1234'), null, 'not a whole line');
  assert.equal(jobOfBody('Job: ABCD1234'), null, 'ids are lowercase base36');
  assert.equal(jobOfBody('Job: abc'), null, 'too short'); assert.equal(jobOfBody('Job: ' + 'a'.repeat(17)), null, 'too long');
  assert.equal(jobOfBody(''), null); assert.equal(jobOfBody(null), null);
});

test('the note says where the job went, keeps what it said, and never grows past what the queue keeps', () => {
  assert.equal(noteWith('claimed by claude · lane: new skill', 'PR', URL_PR), 'claimed by claude · lane: new skill · PR: ' + URL_PR);
  assert.equal(noteWith('', 'live', URL_PR), 'live: ' + URL_PR, 'an empty note gets no leading separator');
  assert.equal(noteWith(undefined, 'live', URL_PR), 'live: ' + URL_PR);
  assert.equal(noteWith('x'.repeat(400), 'PR', URL_PR).length, NOTE_MAX);
});

test('patchJob and findJob talk to /api/queue with the owner token', async () => {
  const calls = [], f = fake([{ id: 'mgw1x2y3', state: 'queued', note: 'lane: new skill' }], calls);
  assert.deepEqual(await findJob({ token: 't', id: 'mgw1x2y3', fetcher: f }), { id: 'mgw1x2y3', state: 'queued', note: 'lane: new skill' });
  assert.equal(await findJob({ token: 't', id: 'nope0000', fetcher: f }), null);
  await patchJob({ token: 't', id: 'mgw1x2y3', state: 'building', note: 'n', fetcher: f });
  assert.equal(calls[2].method, 'PATCH'); assert.equal(calls[2].url, 'https://a-to-mind.com/api/queue');
  assert.equal(calls[2].headers.authorization, 'Bearer t'); assert.deepEqual(calls[2].body, { id: 'mgw1x2y3', state: 'building', note: 'n' });
  await assert.rejects(patchJob({ token: 't', id: 'x', fetcher: async () => new Response('no', { status: 401 }) }), /HTTP 401/);
});

test('moveJob: no token says so and moves nothing; a move keeps the note; a second run is idempotent; an error never throws', async () => {
  assert.equal(await moveJob({ id: 'mgw1x2y3', state: 'live', label: 'live', url: URL_PR, token: '' }), 'job mgw1x2y3 not moved: no VOID_OWNER_TOKEN');
  assert.equal(await moveJob({ id: 'bad id', state: 'live', label: 'live', url: URL_PR, token: 't' }), 'job not moved: no job id');
  const calls = [];
  assert.equal(await moveJob({ id: 'mgw1x2y3', state: 'building', label: 'PR', url: URL_PR, token: 't', fetcher: fake([{ id: 'mgw1x2y3', state: 'queued', note: 'lane: new skill' }], calls) }), 'job mgw1x2y3 -> building (PR: ' + URL_PR + ')');
  assert.deepEqual(calls[1].body, { id: 'mgw1x2y3', state: 'building', note: 'lane: new skill · PR: ' + URL_PR });
  const again = [];
  assert.match(await moveJob({ id: 'mgw1x2y3', state: 'live', label: 'live', url: URL_PR, token: 't', fetcher: fake([{ id: 'mgw1x2y3', state: 'live', note: 'x · live: ' + URL_PR }], again) }), /already live/);
  assert.equal(again.length, 1, 'read once, written never');
  assert.match(await moveJob({ id: 'mgw1x2y3', state: 'live', label: 'live', url: URL_PR, token: 't', fetcher: async () => { throw new Error('ECONNRESET'); } }), /not moved: ECONNRESET/);
});

test('the command line: live reads the body from an environment variable, building takes an id; both need the PR address', () => {
  assert.deepEqual(parseArgs(['live', '--body-env', 'PR_BODY', '--url', URL_PR], { PR_BODY: 'x\nJob: mgw1x2y3\n' }), { cmd: 'live', id: 'mgw1x2y3', url: URL_PR });
  assert.equal(parseArgs(['live', '--body-env', 'PR_BODY', '--url', URL_PR], { PR_BODY: 'no line' }).id, null);
  assert.deepEqual(parseArgs(['building', '--id', 'mgw1x2y3', '--url', URL_PR]), { cmd: 'building', id: 'mgw1x2y3', url: URL_PR });
  assert.match(parseArgs(['building', '--id', '../x', '--url', URL_PR]).error, /--id/);
  assert.match(parseArgs(['live', '--body-env', 'B', '--url', 'https://evil.example/x']).error, /pull request address/);
  assert.match(parseArgs(['nope', '--url', URL_PR]).error, /usage/);
  // run for real with no token: it says so and exits 0, so a merge step with `|| true` never hides a real stop
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./job-link.mjs', import.meta.url)), 'live', '--body-env', 'PR_BODY', '--url', URL_PR],
    { encoding: 'utf8', env: { PATH: process.env.PATH, PR_BODY: 'body\nJob: mgw1x2y3' } });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /job mgw1x2y3 not moved: no VOID_OWNER_TOKEN/);
  const none = spawnSync(process.execPath, [fileURLToPath(new URL('./job-link.mjs', import.meta.url)), 'live', '--body-env', 'PR_BODY', '--url', URL_PR], { encoding: 'utf8', env: { PATH: process.env.PATH, PR_BODY: 'no job here' } });
  assert.equal(none.status, 0); assert.match(none.stdout, /nothing to move/);
});
