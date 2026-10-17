import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { growthOf, ordered, summary, growthHtml, loadLedger, suite, testCandidates, unstableFamilies, heatHtml } from '../void-live-deploy/skills/growth.js';
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
  assert.equal(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', show: 'sticky notes look like real paper', try: 'sticky note buy milk' }), null);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', show: 'x'.repeat(71) }), /"show"/);
  assert.match(entryProblem({ at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'grow', what: 'x', try: 'two\nasks' }), /"try"/);
  const e = { at: '2026-10-09T15:00:00Z', by: 'claude', kind: 'fix', what: 'y' };
  assert.equal(appendTo('[\n]\n', e), '[\n  {"at": "2026-10-09T15:00:00Z", "by": "claude", "kind": "fix", "what": "y"}\n]\n');
  assert.equal(JSON.parse(appendTo('[\n  {"a": 1}\n]\n', e)).length, 2);
  const real = JSON.parse(readFileSync(LEDGER, 'utf8'));
  assert.deepEqual(ledgerProblems(real), []);
  assert.ok(real.length >= 160);
  assert.ok(suite().ok);
});

test('velocity (asked by Void, 2026-10-12): new or better changes this week against the week before, and whether that is speeding up, steady, slowing or stalled', async () => {
  const { velocity, growthHead } = await import('../void-live-deploy/skills/growth.js');
  const now = Date.parse('2026-10-12T12:00:00Z'), d = (n, kind = 'grow') => ({ at: new Date(now - n * 864e5).toISOString(), kind, what: 'x' });
  assert.deepEqual(velocity([d(1), d(2), d(3, 'build'), d(9)], now), { week: 3, before: 1, trend: 'speeding up' });
  assert.equal(velocity([d(1), d(8), d(9), d(10)], now).trend, 'slowing');
  assert.equal(velocity([d(1), d(2), d(8), d(9)], now).trend, 'steady');
  assert.equal(velocity([d(8), d(9)], now).trend, 'stalled');
  assert.equal(velocity([d(1, 'fix'), d(2, 'idea'), d(8)], now).week, 0, 'fixes and ideas are not new skills');
  assert.match(growthHead(esc, [d(1), d(9)], now), /This week 1 new or better, the week before 1: steady/);
});

test('the Site Test card suggests what to test next: the lowest-rated skills, failing first, each with its own ask (asked by Void, 2026-10-17)', () => {
  const fam = { families: [
    { name: 'Time', count: { proven: 1 }, skills: [{ name: 'timer', tier: 'proven', failing: ['set a timer'] }, { name: 'clock', tier: 'proven' }] },
    { name: 'Words and the world', count: { proven: 0 }, skills: [{ name: 'define', tier: 'experiment' }, { name: 'poster', tier: 'tested' }, { name: 'quiet', tier: 'experiment' }] },
  ] };
  const guide = { pages: [{ kind: 'skill', name: 'timer', examples: ['timer', 'set a timer for 5 minutes'] }, { kind: 'skill', name: 'define', examples: ['define hubris'] }, { kind: 'skill', name: 'poster', examples: ['make a poster'] }, { kind: 'chapter', name: 'quiet' }] };
  const c = testCandidates(fam, guide);
  assert.deepEqual(c.map((x) => x.name), ['timer', 'define', 'poster'], 'failing first, then experiment before tested; a skill with no ask in the book is left out (quiet), proven and passing ones never appear (clock)');
  assert.equal(c[0].ask, 'set a timer for 5 minutes'); assert.equal(c[0].failing, 1); assert.equal(c[1].family, 'Words and the world');
  assert.equal(testCandidates(fam, guide, 1).length, 1);
  assert.deepEqual(testCandidates(null, null), []); assert.deepEqual(testCandidates(fam, null), []);
});

test('the Site Test heat map ranks families least stable first: failing skills, then unsure ones (tested, experiment or weathered) (asked by Void)', () => {
  const today = Date.parse('2026-10-17T12:00:00Z');
  const fam = { families: [
    { name: 'Body and mind', skills: [{ name: 'heart', tier: 'proven', last_tested: '2026-10-17' }, { name: 'sleep', tier: 'proven', last_tested: '2026-10-16' }] },
    { name: 'Time', skills: [{ name: 'timer', tier: 'proven', failing: ['set a timer'], last_tested: '2026-10-17' }, { name: 'clock', tier: 'proven', last_tested: '2026-10-17' }] },
    { name: 'Words and the world', skills: [{ name: 'define', tier: 'experiment', last_tested: '2026-10-17' }, { name: 'poster', tier: 'proven', last_tested: '2026-09-01' }, { name: 'book', tier: 'proven', last_tested: '2026-10-17' }] },
    { name: 'Empty', skills: [] },
  ] };
  const r = unstableFamilies(fam, today);
  assert.deepEqual(r.map((x) => x.name), ['Time', 'Words and the world', 'Body and mind'], 'failing first, then by heat; a family with no skills is left out');
  assert.deepEqual([r[0].failing, r[0].unsure, r[0].n], [1, 0, 2]); assert.deepEqual([r[1].failing, r[1].unsure], [0, 2], 'an experiment and a skill untested since September are unsure');
  assert.equal(r[2].heat, 0); assert.ok(r[0].heat > r[1].heat);
  const esc = (s) => String(s).replace(/</g, '&lt;'), html = heatHtml(esc, [{ name: '<b>x', n: 2, failing: 1, unsure: 0, heat: 1 }]);
  assert.match(html, /data-family="&lt;b>x"/); assert.match(html, /1 failing · 0 of 2 unsure/); assert.equal(heatHtml(esc, []), '');
});
