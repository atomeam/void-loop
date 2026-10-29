// tools/verse-job.mjs: a queue job through one lap of the Verse loop, and what goes back to the queue. Run: node --test tools/verse-job.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { taskText, lastJson, settle, runJob, GUIDE } from './verse-job.mjs';
import { ROUTES } from './conductor-core.mjs';

const job = (o = {}) => ({ id: 'j1', target: 'feature:dark mode', state: 'building', note: 'claimed by conductor', ask: 'add a dark mode to /notes/', at: '2026-10-20T00:00:00Z', updated: '2026-10-29T01:00:00Z', ...o });

test('every kind the conductor sends to the coder has guidance, and the task text carries the words, the note and the guidance within the cap', () => {
  for (const [kind, r] of Object.entries(ROUTES)) if (r.claims) assert.ok(GUIDE[kind], kind + ' has guidance');
  const t = taskText(job({ note: 'claimed by conductor · tries 1 · needs a test', target: 'versus:tower-x' }));
  assert.match(t, /^Queue job j1 \(versus: tower-x\): add a dark mode to \/notes\//);
  assert.match(t, /Note: needs a test/); assert.doesNotMatch(t, /claimed by|tries 1/);
  assert.match(t, /docs\/playbooks\/tower-self\.md/);
  assert.ok(taskText(job({ ask: 'x'.repeat(5000), note: 'y'.repeat(5000) })).length <= 1800);
  assert.match(taskText(job({ target: 'mystery:1' })), /small and tested/);
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
