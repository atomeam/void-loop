// tools/lab-use.mjs and lib/used.js: real opens of the lab's experiments decide what becomes a core skill and what is shelved.
import assert from 'node:assert/strict';
import { judge, selfTestedIds, COUNT_FROM } from './lab-use.mjs';
import { onRequestPost } from '../void-live-deploy/functions/api/miss.js';
import { onRequestGet } from '../void-live-deploy/functions/api/misses.js';
import { noteUse } from '../void-live-deploy/skills/make.js';

// the judge
const tools = [{ id: 'a-1', label: 'A' }, { id: 'b-2', label: 'B' }, { id: 'c-3', label: 'C' }, { id: 'd-4', label: 'D' }];
const vs = judge({ tools, used: [{ id: 'a-1', days: 3, opens: 7 }, { id: 'b-2', days: 5, opens: 5 }, { id: 'd-4', days: 1, opens: 1 }],
  live: { 'c-3': '2026-10-01', 'd-4': '2026-10-01' }, selfTested: new Set(['a-1']), now: '2026-10-30T00:00:00Z' });
assert.deepEqual(vs.map((v) => [v.verdict, v.id]), [['promote', 'a-1'], ['test first', 'b-2'], ['retire', 'c-3']], 'opened on 3+ days and self-tested: promote; without a self-test on main: test first; never opened for 14+ days: retire; opened once: nothing');
// counting began on COUNT_FROM: an experiment live long before it is not unused until 14 days of counting have passed
assert.equal(judge({ tools, used: [], live: { 'c-3': '2026-10-01' }, now: '2026-10-20T00:00:00Z' }).length, 0, 'six days of counting is too soon to call it unused');
assert.equal(COUNT_FROM, '2026-10-14');
assert.equal(judge({ tools, used: [], live: {} , now: '2027-01-01T00:00:00Z' }).length, 0, 'not known to be live: never retired');
// self-tested: in the suite's lab list and the page defines selftest()
const suite = "const lab = [['test my attention', 'a-1'], ['b', 'b-2']];";
assert.deepEqual([...selfTestedIds(suite, (id) => (id === 'a-1' ? 'window.__a = { selftest() { return true; } }' : '<p>no test</p>'))], ['a-1']);

// the page: one send per browser per experiment per day, never the owner's
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const sent = [], send = (b) => sent.push(b), st = mem(), day1 = new Date('2026-10-20T10:00:00Z');
assert.equal(noteUse('a-1', { store: st, send, now: day1 }), true);
assert.equal(noteUse('a-1', { store: st, send, now: day1 }), false, 'second open the same day is not sent');
assert.equal(noteUse('a-1', { store: st, send, now: new Date('2026-10-21T10:00:00Z') }), true, 'next day counts again');
assert.deepEqual(sent, [{ kind: 'used', id: 'a-1' }, { kind: 'used', id: 'a-1' }], 'only the id is sent');
const owner = mem(); owner.setItem('a2m.void.owner.v1', 'k');
assert.equal(noteUse('a-1', { store: owner, send, now: day1 }), false, "the owner's own opens are not counted");

// the endpoint: only an id naming a live /fringe/ page is counted; rows are per day; the owner reads them
const rows = new Map();
const DB = { prepare: (q) => ({ bind: (...a) => ({
  run: async () => { if (/INSERT INTO void_used/.test(q)) { const k = a[0] + '|' + a[1]; rows.set(k, (rows.get(k) || 0) + 1); } },
  all: async () => ({ results: [...new Set([...rows.keys()].map((k) => k.split('|')[0]))].map((id) => ({ id, days: [...rows.keys()].filter((k) => k.startsWith(id + '|') && k.split('|')[1] >= a[0]).length })) }) }),
  run: async () => {} }) };
const ASSETS = { fetch: async (r) => new Response('', { status: /\/fringe\/attention-7\.html$/.test(r.url) ? 200 : 404 }) };
const env = { DB, ASSETS, READ_TOKEN: 'owner' };
const post = (b) => onRequestPost({ request: new Request('https://x.test/api/miss', { method: 'POST', body: JSON.stringify(b) }), env });
assert.equal((await post({ kind: 'used', id: 'attention-7' })).status, 204);
assert.equal((await post({ kind: 'used', id: 'nope-1' })).status, 400, 'not a page under /fringe/');
assert.equal((await post({ kind: 'used', id: '../void' })).status, 400, 'not an id');
assert.equal((await post({ kind: 'used', id: 'attention-7', ask: 'my secret words' })).status, 204);
assert.deepEqual([...rows.keys()].map((k) => k.split('|')[0]), ['attention-7'], 'one row per experiment per day; nothing typed stored');
assert.equal((await onRequestGet({ request: new Request('https://x.test/api/misses?used=1'), env })).status, 401, 'owner only');
const got = await (await onRequestGet({ request: new Request('https://x.test/api/misses?used=1', { headers: { authorization: 'Bearer owner' } }), env })).json();
assert.deepEqual(got.used.map((u) => u.id), ['attention-7']);
console.log('lab-use: ok');
