// skills/eat.js: the restaurant search keeps the town the ask names (2026-10-30: "order food from lovebird in lakeland" showed a Lovebird in Pennsylvania)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eatOf, townOf, findPlace, orderLinks } from '../void-live-deploy/skills/eat.js';

const LAKELAND = { boundingbox: ['27.9', '28.2', '-82.1', '-81.8'], lat: '28.04', lon: '-81.95' };
const place = (name, town) => ({ name, type: 'fast_food', lat: '1', lon: '1', address: { city: town } });

// a stand-in for Nominatim: answers by the words searched and records each url
function stub(answer) {
  const urls = [];
  globalThis.fetch = async (u) => { urls.push(String(u)); const q = new URL(String(u)).searchParams; return { json: async () => answer(q) }; };
  return urls;
}

test('the town is the words after in, near, at or on', () => {
  assert.equal(townOf('lovebird in lakeland'), 'lakeland');
  assert.equal(townOf('pizza place near tampa'), 'tampa');
  assert.equal(townOf('lovebird lakeland'), '');
  assert.ok(eatOf('order food from lovebird in lakeland'));
});

test('name and town found together: that place, one search', async () => {
  const urls = stub((q) => (q.get('q') === 'lovebird lakeland' ? [place('Lovebird', 'Lakeland')] : []));
  const rs = await findPlace('lovebird in lakeland', null);
  assert.equal(rs[0].address.city, 'Lakeland');
  assert.equal(urls.length, 1);
});

test('name and town find nothing: the name is looked for inside the town only, never in another state', async () => {
  const urls = stub((q) => {
    if (q.get('q') === 'lakeland') return [LAKELAND];
    if (q.get('q') === 'lovebird') return q.get('bounded') === '1' ? [place('Lovebird Almost Famous Chicken', 'Lakeland')] : [place('Lovebird', 'Doylestown')];
    return [];
  });
  const rs = await findPlace('lovebird in lakeland', null);
  assert.equal(rs[0].address.city, 'Lakeland');
  const last = new URL(urls[urls.length - 1]).searchParams;
  assert.equal(last.get('bounded'), '1');
  assert.deepEqual(last.get('viewbox').split(',').map((x) => +(+x).toFixed(3)), [-82.2, 28.3, -81.7, 27.8]); // the town's box, widened by 0.1
  assert.ok(!urls.some((u) => new URL(u).searchParams.get('q') === 'lovebird' && !new URL(u).searchParams.get('bounded')));
});

test('nothing in the town: no place at all, not one from somewhere else', async () => {
  stub((q) => (q.get('q') === 'lakeland' ? [LAKELAND] : q.get('q') === 'lovebird' && !q.get('bounded') ? [place('Lovebird', 'Doylestown')] : []));
  assert.deepEqual(await findPlace('lovebird in lakeland', null), []);
});

test('no town said: one search, near the visitor when Verse knows where they are', async () => {
  const urls = stub(() => [place('Lovebird', 'Lakeland')]);
  await findPlace('lovebird', { lat: 28, lon: -82 });
  assert.equal(urls.length, 1);
  assert.equal(new URL(urls[0]).searchParams.get('viewbox'), '-82.6,28.6,-81.4,27.4');
});

test('the order links name the town when there is one', () => {
  const maps = orderLinks('Lovebird', 'lakeland', null).find(([l]) => l === 'Google Maps');
  assert.match(maps[1], /Lovebird%20lakeland$/);
});
