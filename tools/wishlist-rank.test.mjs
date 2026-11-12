// The daily wishlist re-rank (tools/wishlist-rank.mjs, lists run 21): value, then free ahead of paid, then blocked last, then the old order;
// only the # column moves, and a second run changes nothing. Reinvest still finds its rows after they move.
// Run: node --test tools/wishlist-rank.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rerank, valueOf, isFree, FILE } from './wishlist-rank.mjs';
import { readWishlist, withWishlist } from '../void-live-deploy/lib/reinvest.js';

const T = ['# list', '', '| # | Item | Free path | Paid cost | Value | Why | From |', '| --- | --- | --- | --- | --- | --- | --- |',
  '| 1 | Crypto data | keyless | $35/mo | medium | why a | Adam |',
  '| 2 | Rides | deep links | no public API at any price | high if it existed | blocked by the providers, not by money | Adam |',
  '| 3 | Workers Paid | items 1 and 2 first | $5/mo | high: lifts caps | why c | builders |',
  '| 4 | Email | routing | none needed | medium: $3/mo | why d | Adam |',
  '| 5 | Wallets | key | paid at scale | low–medium | why e | builders |', '', 'after the table'].join('\n');

test('value first, free before paid, blocked last, old order breaks ties; only the # moves', () => {
  const { md, order } = rerank(T);
  assert.deepEqual(order.map((o) => o.item), ['Workers Paid', 'Email', 'Crypto data', 'Wallets', 'Rides']);
  assert.match(md, /^\| 1 \| Workers Paid \| items 1 and 2 first \| \$5\/mo \| high: lifts caps \| why c \| builders \|$/m);
  assert.ok(md.startsWith('# list\n') && md.endsWith('after the table'));
  assert.equal(rerank(md).md, md, 'a second run changes nothing');
});
test('the value and cost words', () => {
  assert.equal(valueOf('high: answers stop failing'), 3); assert.equal(valueOf('high but risky'), 2); assert.equal(valueOf('medium, once'), 2); assert.equal(valueOf('low now'), 1);
  assert.ok(isFree('$0') && isFree('none needed') && isFree("quota raise is free via Google's audit form")); assert.ok(!isFree('$5/mo min'));
});
test('docs/wishlist.md is kept in that order', () => { const md = readFileSync(FILE, 'utf8'); assert.equal(rerank(md).md, md); });
test('reinvest finds a candidate row after the row moved', () => {
  const w = readWishlist(rerank(T).md);
  assert.equal(withWishlist([{ id: 'w', item: 'Workers Paid', match: 'Workers', wishlist: 6, impact: 0.1 }], w)[0].impact, 0.9);
  assert.equal(withWishlist([{ id: 'c', item: 'CoinGecko Basic', match: 'Crypto', wishlist: 1, impact: 0.1 }], w)[0].impact, 0.5);
});
