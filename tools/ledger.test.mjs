// the repo activity ledger (/ledger/, lib/ledger.js): Verse taking over the two Zaps that logged atomeam/void-loop's issues and pull requests
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../void-live-deploy/lib/ledger.js';

const issue = { number: 7, title: 'Login bug', html_url: 'https://github.com/o/r/issues/7', user: { login: 'ann', type: 'User' }, state: 'open', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-02T10:00:00Z', closed_at: null, labels: [{ name: 'bug' }], comments: 3 };
const pr = { number: 9, title: '=HYPERLINK("x")', html_url: 'https://github.com/o/r/pull/9', user: { login: 'dependabot[bot]', type: 'Bot' }, state: 'closed', created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-06T10:00:00Z', closed_at: '2026-10-06T10:00:00Z', labels: [], comments: 0, pull_request: { merged_at: '2026-10-06T10:00:00Z' } };
const shut = { number: 8, title: 'Old idea, "maybe"', html_url: 'https://github.com/o/r/pull/8', user: { login: 'bob' }, state: 'closed', created_at: '2026-09-20T10:00:00Z', updated_at: '2026-09-21T10:00:00Z', closed_at: '2026-09-21T10:00:00Z', labels: ['idea'], comments: 1, pull_request: { merged_at: null } };
const rows = L.mergeRows([], [issue, pr, shut].map(L.rowOf));

test('a repo name is read from what people paste, and anything else is refused', () => {
  for (const s of ['atomeam/void-loop', ' https://github.com/atomeam/void-loop/pulls?q=1 ', 'github.com/atomeam/void-loop.git', 'git@github.com:atomeam/void-loop.git', 'https://www.github.com/atomeam/void-loop#readme']) assert.equal(L.parseRepo(s), 'atomeam/void-loop', s);
  for (const s of ['', 'void-loop', 'a b/c', '../x', '../..', 'https://gitlab.com/a/b', 'o/' + 'x'.repeat(101)]) assert.equal(L.parseRepo(s), null, s);
});

test('a pull request is the item with pull_request, merged told apart from closed, bots marked', () => {
  const [p9, p8, i7] = rows;
  assert.deepEqual([p9.number, p8.number, i7.number], [9, 8, 7], 'newest first');
  assert.equal(L.kindOf(issue), 'issue'); assert.equal(L.kindOf(pr), 'pr');
  assert.equal(p9.state, 'merged'); assert.equal(p9.merged_at, '2026-10-06T10:00:00Z'); assert.ok(p9.bot);
  assert.equal(p8.state, 'closed'); assert.equal(p8.merged_at, null); assert.deepEqual(p8.labels, ['idea']);
  assert.equal(i7.state, 'open'); assert.equal(i7.author, 'ann'); assert.equal(i7.url, 'https://github.com/o/r/issues/7');
});

test('a newer copy of an item replaces the older one, an older one does not', () => {
  const later = L.rowOf({ ...issue, state: 'closed', closed_at: '2026-10-09T00:00:00Z', updated_at: '2026-10-09T00:00:00Z' });
  const back = L.rowOf({ ...issue, title: 'stale', updated_at: '2026-09-01T00:00:00Z' });
  const m = L.mergeRows(rows, [later, back]);
  assert.equal(m.length, 3); assert.equal(m.find((r) => r.number === 7).state, 'closed');
  assert.equal(L.lastUpdated(m), '2026-10-09T00:00:00Z');
});

test('filters: tab, strict state, author, label, bots, dates and every-word search', () => {
  const n = (f) => L.filterRows(rows, f).map((r) => r.number);
  assert.deepEqual(n({ tab: 'issue' }), [7]); assert.deepEqual(n({ tab: 'pr' }), [9, 8]);
  assert.deepEqual(n({ tab: 'pr', state: 'closed' }), [8], 'closed means closed without a merge'); assert.deepEqual(n({ tab: 'pr', state: 'merged' }), [9]);
  assert.deepEqual(n({ tab: 'all', author: 'ANN' }), [7]); assert.deepEqual(n({ tab: 'all', label: 'Idea' }), [8]);
  assert.deepEqual(n({ tab: 'pr', bots: '0' }), [8]); assert.deepEqual(n({ tab: 'all', from: '2026-10-01', to: '2026-10-01' }), [7]);
  assert.deepEqual(n({ tab: 'all', q: 'login bug' }), [7]); assert.deepEqual(n({ tab: 'all', q: '#8' }), [8]); assert.deepEqual(n({ tab: 'all', q: 'login nothing' }), []);
  assert.deepEqual(n({ tab: 'all', sort: 'old' }), [7, 8, 9]); assert.deepEqual(n({ tab: 'all', sort: 'comments' }), [7, 8, 9]);
  assert.deepEqual(L.counts(rows), { issue: 1, pr: 2, open: 1, closed: 1, merged: 1 });
  assert.deepEqual(L.facets(rows).labels, ['bug', 'idea']);
});

test('CSV is RFC 4180 with CRLF and never runs a formula; JSON says where it came from', () => {
  const csv = L.toCSV(rows), lines = csv.split('\r\n');
  assert.equal(lines[0], L.COLUMNS.join(',')); assert.equal(lines.length, 5); assert.ok(csv.endsWith('\r\n'));
  assert.ok(lines[1].startsWith('pr,9,"\'=HYPERLINK(""x"")",'), lines[1]);
  assert.ok(lines[2].includes('"Old idea, ""maybe"""'));
  const j = JSON.parse(L.toJSON(rows, { repo: 'o/r', fetchedAt: 'T', view: { tab: 'pr' } }));
  assert.equal(j.source, 'https://api.github.com/repos/o/r/issues'); assert.equal(j.count, 3); assert.deepEqual(Object.keys(j.rows[0]), L.COLUMNS);
});

test('the link carries only what differs from the defaults, and a bad link falls back to them', () => {
  assert.equal(L.encodeView(L.DEFAULTS), '');
  const v = { ...L.DEFAULTS, repo: 'jellyfin/jellyfin', tab: 'pr', state: 'merged', q: 'fix' };
  assert.deepEqual(L.decodeView(L.encodeView(v)), v);
  const bad = L.decodeView('?tab=zzz&state=nope&from=yesterday&sort=x&bots=2');
  assert.deepEqual(bad, { ...L.DEFAULTS });
  assert.equal(L.decodeView('?tab=pulls').tab, 'pr'); assert.equal(L.decodeView('?r=a/b').repo, 'a/b');
});

test('addresses, pages and the rate limit', () => {
  assert.equal(L.listUrl('o/r'), 'https://api.github.com/repos/o/r/issues?state=all&per_page=100&sort=created&direction=desc');
  assert.ok(L.listUrl('o/r', { since: '2026-10-09T00:00:00Z' }).includes('since=2026-10-09T00%3A00%3A00Z&sort=updated&direction=asc'));
  assert.equal(L.nextLink('<https://api.github.com/x?after=Y2>; rel="next", <https://api.github.com/x?page=1>; rel="first"'), 'https://api.github.com/x?after=Y2');
  assert.equal(L.nextLink('<https://api.github.com/x>; rel="prev"'), null); assert.equal(L.nextLink(null), null);
  const h = { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' };
  const r = L.rateOf((k) => h[k]); assert.deepEqual(r, { limit: 60, remaining: 0, reset: 1800000000000, retryAfter: null });
  assert.ok(L.isRateLimited(403, r)); assert.ok(!L.isRateLimited(403, { remaining: 12, retryAfter: null }), 'a 403 with requests left is not the limit');
  assert.ok(L.isRateLimited(429, { remaining: null, retryAfter: 30 })); assert.ok(!L.isRateLimited(200, r));
});

test('the device copy: per repo, capped, the least recently opened dropped first; new since the last look', () => {
  let s = null;
  for (let i = 0; i < L.MAX_REPOS + 2; i++) s = L.putCache(s, 'o/r' + i, { rows }, 1000 + i);
  assert.equal(Object.keys(s.repos).length, L.MAX_REPOS); assert.equal(L.cached(s, 'o/r0'), null); assert.ok(L.cached(s, 'O/R7'));
  const big = L.putCache(null, 'o/r', { rows: Array.from({ length: L.MAX_ROWS + 5 }, (_, i) => ({ number: i })) });
  assert.equal(L.cached(big, 'o/r').rows.length, L.MAX_ROWS);
  assert.deepEqual(L.newSince(rows, '2026-10-02T00:00:00Z').map((r) => r.number), [9]); assert.deepEqual(L.newSince(rows, null), []);
});
