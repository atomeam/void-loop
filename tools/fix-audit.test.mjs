import test from 'node:test';
import assert from 'node:assert/strict';
import { auditOf, auditHtml, named, table } from '../void-live-deploy/lib/fix-audit.js';
import skill from '../void-live-deploy/skills/fix-audit.js';
const fam = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'calendar', tier: 'tested', last_tested: '2026-10-10' }] }, { id: 'decide', name: 'Deciding', skills: [{ name: 'decision-matrix', tier: 'proven', last_tested: '2026-10-20' }, { name: 'place', tier: 'tested' }] }] };
const now = Date.parse('2026-10-21T12:00:00Z');
test('fix audit: rating current or predating the fix, a failing check in another family within 48 h, generic words not skills (asked by Verse)', () => {
  const ledger = [{ at: '2026-10-20T10:00:00Z', by: 'verse', kind: 'fix', what: 'fixed decision-matrix weights' }, { at: '2026-10-19T10:00:00Z', by: 'claude', kind: 'fix', what: 'calendar keeps the date, a place for it' }, { at: '2026-10-19T10:00:00Z', by: 'x', kind: 'grow', what: 'calendar' }];
  const inc = { incidents: [{ at: '2026-10-20T20:00:00Z', sha: 'abc12345ff', suite: 's', checks: ['calendar: the date moved'] }] };
  const r = auditOf(ledger, fam, inc, { now });
  assert.equal(r.total, 2); assert.equal(r.fixes[0].what, 'fixed decision-matrix weights');
  assert.deepEqual(r.fixes[0].broke.map((b) => [b.family, b.sha]), [['time', 'abc12345ff']]);
  assert.equal(r.fixes[0].skills[0].current, true); assert.equal(r.fixes[1].skills[0].current, false); assert.equal(r.stale, 1);
  assert.deepEqual(r.fixes[1].broke, [], 'a failing check in the fix\'s own family is not a cross-family break');
  assert.deepEqual(named('a place to sit', table(fam)), []);
  const h = auditHtml(r, (s) => String(s), { fixPages: 18 });
  assert.ok(h.includes('data-stale="1"') && h.includes('Then broke elsewhere') && h.includes('18 /fix/ pages'));
});
test('fix audit phrases', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
