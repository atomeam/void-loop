import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { growthOf, ordered, summary, growthHtml, loadLedger, suite } from '../void-live-deploy/skills/growth.js';
import { entryProblem, ledgerProblems, appendTo, LEDGER } from './grow.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

test('"growth" and its plain phrasings summon the ledger; growth as a topic stays a topic', () => {
  for (const t of ['growth', 'Growth', 'growth?', 'void growth', "Void's growth", 'show growth', 'show me the growth ledger', 'summon growth', 'how have you grown', 'how has void grown', "what's new with void", 'your growth'])
    assert.ok(growthOf(t), t);
  for (const t of ['economic growth', 'growth rate of india', 'growth mindset', 'hair growth', 'what is growth', 'population growth', 'how do plants grow', 'growth hormone', 'grow a tree'])
    assert.equal(growthOf(t), false, t);
});

test('newest first, filtered by kind, with counts and the oldest day', () => {
  const list = [{ at: '2026-10-01T10:00:00Z', by: 'a', kind: 'grow', what: 'one' }, { at: '2026-10-03T10:00:00Z', by: 'b', kind: 'fix', what: 'two' },
    { at: 'bad', by: 'c', kind: 'grow', what: 'undated' }, { at: '2026-10-02T10:00:00Z', by: 'c', kind: 'grow', what: 'three' }, null, { kind: 'grow' }];
  assert.deepEqual(ordered(list).map((e) => e.what), ['two', 'three', 'one', 'undated']);
  assert.deepEqual(ordered(list, 'fix').map((e) => e.what), ['two']);
  assert.deepEqual(summary(list), { total: 4, since: '', byKind: { fix: 1, grow: 3 } });
  assert.equal(summary(list.slice(0, 2)).since, '2026-10-01');
  assert.deepEqual(ordered('nope'), []);
});

test('the page escapes everything from the ledger, links only https refs, and pages 40 at a time', () => {
  const list = Array.from({ length: 45 }, (_, i) => ({ at: '2026-10-0' + (1 + (i % 9)) + 'T10:00:00Z', by: 'x', kind: 'build', what: 'item ' + i }));
  list.push({ at: '2026-10-09T11:00:00Z', by: '<i>', kind: 'grow', what: '<script>alert(1)</script>', ref: 'javascript:alert(1)' });
  list.push({ at: '2026-10-09T12:00:00Z', by: 'y', kind: 'fix', what: 'linked', ref: 'https://github.com/atomeam/void-loop/pull/1' });
  const h = growthHtml(esc, list, '', 40);
  assert.ok(!h.includes('<script>') && !h.includes('<i>') && !h.includes('javascript:'));
  assert.ok(h.includes('href="https://github.com/atomeam/void-loop/pull/1"'));
  assert.ok(h.includes('47 changes') && h.includes('show 7 more') && h.includes('data-kind="grow"'));
  assert.ok(!growthHtml(esc, list, '', 80).includes('data-more'));
  assert.ok(growthHtml(esc, list, 'fix', 40).includes('linked') && !growthHtml(esc, list, 'fix', 40).includes('item 0'));
  assert.ok(growthHtml(esc, [], '', 40).includes('Nothing here yet'));
  const long = growthHtml(esc, [{ at: '2026-10-09T12:00:00Z', by: 'y', kind: 'fix', what: 'word '.repeat(100) }], '', 40);
  assert.ok(long.includes('<details>'));
});

test('loadLedger reads the list and refuses anything else', async () => {
  const ok = (body) => async () => ({ ok: true, json: async () => body });
  assert.equal((await loadLedger(ok([{ a: 1 }]))).length, 1);
  await assert.rejects(loadLedger(ok({})), /not a list/);
  await assert.rejects(loadLedger(async () => ({ ok: false, status: 404 })), /404/);
});

test('grow.mjs: entries are checked, appended one per line, and the real ledger is valid', () => {
  assert.equal(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x' }), null);
  assert.equal(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', ref: 'https://a-to-mind.com' }), null);
  assert.match(entryProblem({ at: '2026-10-09', by: 'claude', kind: 'grow', what: 'x' }), /"at"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'Claude Bot', kind: 'grow', what: 'x' }), /"by"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'shipped', what: 'x' }), /"kind"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: ' ' }), /"what"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', ref: 'http://x' }), /"ref"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', extra: 1 }), /unknown field/);
  const e = { at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'fix', what: 'y' };
  assert.equal(appendTo('[\n]\n', e), '[\n  {"at": "2026-10-09T15:00:00Z", "by": "claude", "kind": "fix", "what": "y"}\n]\n');
  assert.equal(JSON.parse(appendTo('[\n  {"a": 1}\n]\n', e)).length, 2);
  const real = JSON.parse(readFileSync(LEDGER, 'utf8'));
  assert.deepEqual(ledgerProblems(real), []);
  assert.ok(real.length >= 160);
  assert.ok(suite().ok);
});
