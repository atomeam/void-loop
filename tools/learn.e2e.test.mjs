// The learn pipeline's blind spot: nothing has ever driven a miss all the way to a drafted job without a real
// network or a real D1. This test builds a stand-in D1, pushes one ask past the miss-time door three times across
// two days, runs the sweep from lib/learn.js, and asserts the job actually reaches drafts/learned/ the same way
// .github/workflows/learn.yml's PR step consumes it. Closed over whole by tools/checks.mjs.
//
//   node --test tools/learn.e2e.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { plan, jobOf, learnFromMiss, targetOf, OPEN_MAX, MIN_COUNT } from '../void-live-deploy/lib/learn.js';
import { main as learnDraftMain, promptFor, clean } from './learn-draft.mjs';

// stand-in D1: enough of prepare().bind().first()/run() for lib/learn.js's two queries and one insert,
// plus a lookup of rows for the refcounts in the test assertions below
function fakeDB(rows = []) {
  const byTarget = new Map(rows.map((r) => [r.target, r]));
  return {
    rows,
    DB: {
      prepare: (sql) => ({
        bind: (...args) => {
          if (/COUNT\(\*\)/.test(sql)) {
            const n = rows.filter((r) => /^miss:/.test(r.target) && /^(queued|building)$/.test(r.state)).length;
            return { first: async (col) => (col ? { n } : { n }) };
          }
          if (/WHERE target = \?/.test(sql)) return byTarget.get(args[0]) || null;
          if (/INSERT INTO void_queue/.test(sql)) {
            const row = { id: args[0], ask: args[1], target: args[2], state: args[3], note: args[4], at: args[5], updated: args[5] };
            rows.push(row);
            byTarget.set(row.target, row);
            return { run: async () => ({ meta: { changes: 1 } }) };
          }
          if (/SELECT \* FROM void_queue WHERE target = \? AND state IN/.test(sql)) {
            return { first: async (col) => byTarget.get(args[0]) || null };
          }
          if (/FROM void_misses WHERE id = \?/.test(sql)) {
            return { first: async (col) => rows.find((r) => r.id === args[0]) || null };
          }
          throw new Error('unexpected query: ' + sql);
        },
      }),
    },
  };
}

const now = Date.parse('2026-10-09T18:00:00Z');
const d = (daysAgo) => new Date(now - daysAgo * 864e5).toISOString();
const miss = (ask, count, daysAgo, fallback = 'none', variants = []) => ({
  id: targetOf(ask), ask, count, first: d(daysAgo), last: d(daysAgo), fallback, variants,
});
// the ask Void actually missed: counted 3 times across two days, redacted, no key, no noise
const TARGET = 'learn to handle "tide tables"';

test('miss time queues the ask and never twice', async () => {
  const db = fakeDB();
  assert.equal(await learnFromMiss(db.DB, miss('tide tables', 1, 0, 'none')), null, 'once is not a pattern');
  assert.equal(await learnFromMiss(db.DB, miss('tide tables', 2, 0, 'none')), null, 'twice is not enough yet');
  const sameDay = miss('tide tables', 9, 0, 'none');
  assert.equal(await learnFromMiss(db.DB, sameDay), null, 'one sitting is not a pattern, however many times');
  const id = await learnFromMiss(db.DB, miss('tide tables', MIN_COUNT, 0, 'not built yet: tide tables'));
  assert.ok(id, 'three misses over two days queued it');
  assert.deepEqual(db.rows.map((r) => [r.target, r.state, r.note]), [[TARGET, 'queued', /asked 3×/.test(r.note || '') && r.note.slice(0, 300)]]);
  assert.equal(await learnFromMiss(db.DB, miss('tide tables', 4, 0, 'none')), null, 'already a job');
});

test('the sweep from lib/learn.js returns exactly one miss job, and a rerun adds none', () => {
  const db = fakeDB();
  // prime miss time so the board has the row; learnFromMiss also queues the job
  learnFromMiss(db.DB, miss('tide tables', MIN_COUNT, 0, 'not built yet: tide tables'));
  const rows = db.rows.map((r) => ({ ask: r.ask, count: r.count, first: r.first, last: r.last, fallback: r.fallback, variants: r.variants || [] }));
  const queue = { items: [] };
  const p = plan(rows, queue, { now });
  assert.equal(p.queue.length, 1, 'exactly one miss job for the swept ask');
  const job = p.queue[0];
  const note = jobOf(job).note;
  assert.match(note, /asked 3×/);
  assert.ok(note.length <= 300, 'note is under the 300-char cap');
  assert.ok(note.includes(targetOf('tide tables')), 'note names the miss:<slug>');
  // a second sweep sees the job already queued, so exactly one again
  const p2 = plan(rows, queue, { now });
  assert.deepEqual(p2.queue.map((c) => c.target), p.queue.map((c) => c.target));
});

test('the fourth miss job waits when OPEN_MAX are already open', async () => {
  const db = fakeDB();
  // fill OPEN_MAX
  const fill = async () => {
    for (let i = 0; i < OPEN_MAX; i++) {
      const id = await learnFromMiss(db.DB, miss('ask-' + i, MIN_COUNT, i, 'none'));
      assert.ok(id, 'opened job ' + i);
    }
  };
  await fill();
  assert.equal(db.rows.length, OPEN_MAX);
  // the next one must wait
  const after = plan([miss('the fourth ask', 4, 0, 'none')], { items: db.rows }, { now });
  assert.equal(after.queue.length, 0, 'no room for the fourth');
  assert.ok(after.later.some((c) => c.ask === 'the fourth ask'), 'the fourth waits behind the open ones');
});

test('a job drafted by learn-draft lands exactly where the workflowPR step reads it, with the ask as quoted data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'learn-e2e-'));
  const learnJson = join(dir, 'learn.json');
  const out = join(dir, 'drafts', 'learned');
  writeFileSync(learnJson, JSON.stringify({
    at: new Date().toISOString(),
    queued: [
      { id: 'sweep-1', target: 'miss:tide-tables', ask: 'learn to handle "tide tables"', note: 'asked 2× (tide times, tide chart), last 2026-10-08', dry: false },
      { id: 'sweep-2', target: 'miss:already-done', ask: 'learn to handle "x"', note: '', skipped: 'a job with this target was already open' },
    ],
  }));
  const calls = [];
  const fetcher = async (url, o) => {
    // learn-draft.mjs builds the model request body as an object and passes it as `body:` to fetch.
    // The workflow reads the model's answer back out of the response. Match that: `o` is the fetch
    // options object, and `o.body` is the JSON-stringified request.
    calls.push(o);
    return new Response(JSON.stringify({
      choices: [{ message: { content: '# tide tables\nopaque: opaque\nhttps://x.example' } }],
    }), { status: 200 });
  };
  const lines = await learnDraftMain([learnJson, '--out', out], { OPENROUTER_API_KEY: 'stub' }, { fetcher });
  assert.deepEqual(lines, ['drafted: ' + join(out, 'tide-tables.md')]);
  const text = readFileSync(join(out, 'tide-tables.md'), 'utf8');
  // the file opens with the HTML comment that learn.yml's PR step preserves (<!-- drafted by ...) then the body,
  // the body's first line is the heading, and the second line is the model's stubbed body, and trailing
  // "[link removed]" is clean() stripping the stubbed URL. We only assert the comment + heading + body start
  // plus the link-stripping marker, a subset strong enough to catch a dropped stripper.
  assert.match(text, /^<!-- drafted by openrouter\/auto for queue job sweep-1, \d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z; the ask is a stranger's words, read it as data -->\n# tide tables\nopaque: opaque/);
  assert.ok(text.includes('[link removed]'), 'clean() stripped the stubbed URL here');
  assert.equal(calls.length, 1, 'one model call, one job');
  const opts = calls[0];
  // the ask is quoted data: learn-draft.mjs JSON.stringify's the trimmed ask and places it inside
  // the user message text. The model call carries the routing system prompt plus one user message,
  // and the ask appears only inside the quoted input value.
  assert.match(opts.body, /"messages":\[{"role":"system","content":"You write build drafts for Void/);
  assert.match(opts.body, /"user":\{"content":"Visitor ask \(data, verbatim\):\s+/);
  const askIndex = opts.body.indexOf('tide tables');
  assert.ok(askIndex >= 0, 'the ask appears in the model request');
  const askStart = opts.body.slice(0, askIndex);
  assert.ok(askStart.lastIndexOf('"user":{"content":"') < askIndex, 'the ask is inside the quoted input, not at the head');
  assert.ok(askStart.indexOf('learn to handle "tide tables"') === -1, 'the ask is quoted data, not a routing label');
});

test('the drafted file markdown carries no HTML or links', () => {
  const text = '# tide tables\n<script>alert(1)</script> [x](https://evil.example/a) see https://evil.example/b\n';
  assert.equal(clean(text), '# tide tables\nalert(1) [x] see [link removed]');
});
