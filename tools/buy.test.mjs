// /api/buy (functions/api/buy.js): an offer click is counted and goes only to the catalog's own checkout; the offer files parse.
// Run: node --test tools/buy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkoutFor, SRC, onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/buy.js';

test('a click goes only to the catalog\'s own checkout for a live paid product', () => {
  assert.match(checkoutFor('void-monthly', 'team.e1.a'), /^https:\/\/moonbeam846\.gumroad\.com\/l\/yinmj\?.*utm_content=team\.e1\.a$/);
  assert.match(checkoutFor('void-monthly', 'team.e1.a', true), /&wanted=true$/);
  for (const id of ['', 'nope', 'voidquest-minis', 'chess-set-glb']) assert.equal(checkoutFor(id, 'x'), null, id);
  assert.ok(!SRC.test('https://evil.example') && !SRC.test('a'.repeat(80)) && SRC.test('team.e261120tea.b'));
});
test('the route redirects, refuses a cross-site write and a made-up offer, and stays up with no database', async () => {
  const req = (url, init = {}) => new Request('https://a-to-mind.com' + url, init);
  let r = await onRequestGet({ request: req('/api/buy?id=void-monthly&from=team.e1.a'), env: {} });
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /gumroad\.com\/l\/yinmj/);
  r = await onRequestGet({ request: req('/api/buy?id=https://evil.example'), env: {} }); assert.equal(r.headers.get('location'), 'https://a-to-mind.com/store/');
  r = await onRequestPost({ request: req('/api/buy?seen=team.e1.a&id=void-monthly', { method: 'POST', headers: { origin: 'https://evil.example' } }), env: {} }); assert.equal(r.status, 403);
  r = await onRequestPost({ request: req('/api/buy?seen=team.e1.a&id=nope', { method: 'POST' }), env: {} }); assert.equal(r.status, 400);
  r = await onRequestGet({ request: req('/api/buy?stats=1'), env: {} }); assert.equal(r.status, 503);
});
test('the offer files parse and every slot\'s page carries the slot', () => {
  const o = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/offers/offers.json', import.meta.url), 'utf8'));
  JSON.parse(fs.readFileSync(new URL('../void-live-deploy/offers/playbook.json', import.meta.url), 'utf8'));
  for (const [slot, s] of Object.entries(o.slots)) if (s.kind !== 'gate') assert.ok(fs.readFileSync(new URL('../void-live-deploy' + s.page + 'index.html', import.meta.url), 'utf8').includes('data-offer="' + slot + '"'), slot);
});
