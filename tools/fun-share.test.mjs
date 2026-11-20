import test from 'node:test';
import assert from 'node:assert/strict';
import { share, isBusiness, skillNames, TOTAL_AT, BUSINESS_AT } from './fun-share.mjs';

test('fun first: business-tool skills stay at one in five of the new skills', () => {
  assert.ok(isBusiness('runbook-pack') && isBusiness('client-weekly') && isBusiness('full-lift-plan'));
  assert.ok(!isBusiness('chess') && !isBusiness('daily-puzzle') && !isBusiness('card-art'));
  const base = Array.from({ length: TOTAL_AT - BUSINESS_AT }, (_, i) => 'game-' + i).concat(Array.from({ length: BUSINESS_AT }, (_, i) => 'client-' + i));
  assert.equal(share(base).over, 0);
  assert.equal(share(base.concat(['runbook-pack'])).over, 1, 'one more business tool with nothing fun beside it is over');
  assert.equal(share(base.concat(['a', 'b', 'c', 'd', 'runbook-pack'])).over, 0, 'four fun skills earn one business tool');
});

test('main holds the fun-first share (a new business-tool pack needs four fun skills beside it)', () => {
  const s = share(skillNames());
  assert.equal(s.over, 0, s.business + ' business tools, ' + s.allowed + ' allowed: build a game, card, daily challenge or creative tool instead. ' + s.names.slice(-5).join(', '));
});
