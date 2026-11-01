/** promote watch-along idea notes onto the build path */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ideaAskFromNote, promoteIdeas } from '../void-live-deploy/lib/watch-along.js';

test('ideaAskFromNote builds a short ask', () => {
  assert.equal(ideaAskFromNote({ kind: 'fact', note: 'something' }), '');
  const ask = ideaAskFromNote({
    kind: 'idea',
    topic: 'invoice follow-up',
    note: 'Verse could build a card that chases late invoices on a schedule.',
  });
  assert.match(ask, /invoice/i);
  assert.ok(ask.length >= 8);
});

test('promoteIdeas dedupes and skips non-ideas', () => {
  const notes = [
    { kind: 'idea', topic: 'late pay', note: 'A tool that lists overdue invoices and drafts a polite chase.', station: 'WXYZ', day: '2026-11-01' },
    { kind: 'fact', topic: 'rates', note: 'The Fed held rates steady at the meeting.' },
    { kind: 'idea', topic: 'late pay', note: 'A tool that lists overdue invoices and drafts a polite chase.', station: 'WXYZ', day: '2026-11-01' },
  ];
  const out = promoteIdeas(notes, { limit: 5, have: [] });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'watch-along');
  assert.match(out[0].ask, /late|invoice|pay/i);
});

test('promoteIdeas respects have list', () => {
  const notes = [
    { kind: 'idea', topic: 'sync sheet', note: 'Sync closed deals from the CRM into the finance sheet nightly.' },
  ];
  const out = promoteIdeas(notes, { have: ['sync sheet'] });
  assert.equal(out.length, 0);
});
