import test from 'node:test';
import assert from 'node:assert/strict';
import { skillStatus, statusHtml, familyMapHtml, promotedRows, promotedHtml, bloomPlan, bloomHtml, diverge, divergences, divergenceHtml } from '../void-live-deploy/lib/inbox-health.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fam = { smoke_at: '2026-10-16', families: [
  { id: 'a', name: 'Al<pha>', skills: [
    { name: 'p', tier: 'proven', promoted: '2026-10-14', streak: 5 },
    { name: 'q', tier: 'tested', smoke: ['"rain later" -> place', 'suite got x'] },
    { name: 'r', tier: 'checked', smoke: ['re-test: suite got y'] } ] },
  { id: 'b', name: 'Beta', skills: [{ name: 's', tier: 'experiment' }, { name: 't', tier: 'proven', promoted: '2026-06-01', streak: 9 }] },
] };
test('a registered skill failing its router test is flagged (asked by Verse)', () => {
  const st = skillStatus(fam);
  assert.equal(st.total, 5); assert.equal(st.clean, 3); assert.deepEqual(st.failing.map((f) => f.name), ['q', 'r']);
  assert.deepEqual(st.failing[0].router, ['"rain later" -> place']); assert.deepEqual(st.failing[1].router, []);
  const h = statusHtml(esc, st);
  assert.ok(h.includes('2 of 5 registered skills failing') && h.includes('registered but failing its router test: &quot;rain later&quot; -&gt; place') && h.includes('failing its own test: suite got y') && h.includes('Al&lt;pha&gt;') && !h.includes('<pha>'));
  assert.ok(statusHtml(esc, skillStatus({ families: [{ name: 'x', skills: [{ name: 'p', tier: 'proven' }] }] })).includes('all 1 registered skills pass the router test'));
  assert.equal(statusHtml(esc, skillStatus(null)), '');
});
test('the family map draws every family from the health file', () => {
  const h = familyMapHtml(esc, fam);
  assert.ok(h.includes('data-fam-map="2"') && h.includes('data-fam="a"') && h.includes('aria-label="Al&lt;pha&gt;: 1 proven, 1 checked, 1 tested, 0 experiment, 2 failing"') && h.includes('2 failing') && h.includes('1/2'));
  assert.ok(!h.includes('<pha>')); assert.equal(familyMapHtml(esc, { families: [] }), '');
});
test('newly promoted skills carry their clean runs in a row (asked by Verse)', () => {
  const rows = promotedRows(fam, 30, '2026-10-16');
  assert.deepEqual(rows, [{ name: 'p', tier: 'proven', promoted: '2026-10-14', streak: 5 }], 'a promotion from June is not new');
  const h = promotedHtml(esc, rows);
  assert.ok(h.includes('1 skill promoted lately, 1 with 3 or more clean runs in a row') && h.includes('p</b> to proven 2026-10-14, 5 clean runs in a row'));
  assert.equal(promotedHtml(esc, []), '');
});
test('a significant new skill calls a growth animation (asked by Verse)', () => {
  assert.equal(bloomPlan([], []).kind, 'none');
  assert.equal(bloomPlan(['clock'], []).kind, 'bloom');
  assert.equal(bloomPlan(['a', 'b', 'c'], []).kind, 'burst');
  assert.equal(bloomPlan(['x', 'y', 'z'], [{ facts: { skills: 150 } }, { facts: { skills: 150 } }]).kind, 'none', 'two days with the same count: nothing new');
  const p = bloomPlan([], [{ facts: { skills: 150 } }, { facts: { skills: 153 } }]);
  assert.equal(p.kind, 'burst'); assert.equal(p.delta, 3);
  assert.equal(bloomPlan([], [{ facts: { skills: 150 } }, { facts: { skills: 150 } }]).kind, 'none');
  assert.ok(bloomHtml(esc, bloomPlan(['<b>x</b>'], [])).includes('&lt;b&gt;x') && bloomHtml(esc, bloomPlan([], [])) === '');
});
test('the divergence tracker shows the words of an ask the build never says (asked by Verse)', () => {
  const d = diverge('Link the fringe ledger entries to the near-miss router data so every novelty is tagged', 'fringe near tag built');
  assert.deepEqual(d.said, ['fringe', 'near']); assert.ok(d.left.includes('router') && d.left.includes('novelty') && d.share <= 0.3);
  assert.equal(diverge('too short', 'x'), null);
  const recent = [{ ask: 'Add a skill-health dashboard mapping the health file onto the families', what: 'skill-health dashboard maps the health file onto every family', at: '2026-10-16' },
    { ask: 'Create a novelty score proposing growth inbox rows <b>whenever</b> ledger behavior unmatched', what: 'something else entirely', at: '2026-10-15' }];
  const rows = divergences(recent); assert.equal(rows.length, 1); assert.equal(rows[0].what, 'something else entirely');
  const h = divergenceHtml(esc, recent);
  assert.ok(h.includes('1 of the last 2 built asks') && h.includes('<mark') && h.includes('&lt;b&gt;whenever') && !h.includes('<b>whenever'));
  assert.ok(divergenceHtml(esc, [recent[0]]).includes('each echoed') && divergenceHtml(esc, []) === '');
});
