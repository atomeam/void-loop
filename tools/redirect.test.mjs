import test from 'node:test';
import assert from 'node:assert/strict';
import { lowValue, redirectTo, offerCard } from '../void-live-deploy/lib/team.js';

const queued = [
  { id: 'flake1', kind: 'flake', ask: 'make a test robust: fix the test or the code' },
  { id: 'bad', kind: 'versus', ask: 'Versus: example.com needs a page' },
  { id: 'port', kind: 'versus', ask: 'Versus: portchecker.co (Port Checker) needs a page' },
  { id: 'speed', kind: 'versus', ask: 'Versus: speedtest.sg needs a page' },
];

test('a score or a placeholder is low value, and the offer names a visitor page', () => {
  assert.equal(lowValue({ target: 'heal:x', ask: 'Repair helper/foo until it lands' }), true);
  assert.equal(lowValue({ kind: 'versus', ask: 'Versus: portchecker.co needs a page' }), false);
  const first = redirectTo({ id: 'old', ask: 'Repair helper/handoff-checklist until it lands', target: 'heal:x' }, queued);
  assert.equal(first.id, 'port');
  const second = redirectTo({ id: 'old2', ask: 'lift-summary bookkeeping', kind: 'feature' }, queued, ['port']);
  assert.equal(second.id, 'speed');
  assert.equal(redirectTo({ id: 'port', ask: 'Versus: portchecker.co needs a page', kind: 'versus' }, queued), null);
  const card = offerCard('openhands', { id: 'old' }, first);
  assert.match(card, /Better job port/);
  assert.match(card, /void-live-deploy\/port-check\/index\.html/);
  assert.match(card, /"do":"switch"/);
  assert.match(card, /stays open/);
});
