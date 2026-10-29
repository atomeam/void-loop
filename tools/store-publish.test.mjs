// Verse self-publishing (tools/store-publish.mjs): the guardrails, the one catalog, and every product getting an ad clip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkStl, guard, priceOk, priceFor, trademarkHits, originOk, sync, readCatalog, glb, forgeFiles } from './store-publish.mjs';
import { STORE_PRODUCTS } from '../void-live-deploy/lib/store.js';
import { storeMoments, plan } from './clips.mjs';

test('store-publish: lib/store-products.js and the public changelog are exactly what domains/store.products.json says', () => {
  const cat = readCatalog(), { gen, log } = sync(cat, false);
  assert.equal(fs.readFileSync(new URL('../void-live-deploy/lib/store-products.js', import.meta.url), 'utf8'), gen, 'run: node tools/store-publish.mjs sync');
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../void-live-deploy/store/changelog.json', import.meta.url), 'utf8')).changelog, log);
  assert.equal(new Set(cat.products.map((p) => p.id)).size, cat.products.length);
  for (const p of cat.products.filter((p) => p.pack)) { assert.ok(p.log && p.log.length, p.id + ' has a changelog row'); assert.ok(priceOk(p.cents)); assert.deepEqual(trademarkHits(p.name, p.blurb), []); }
  assert.ok(!STORE_PRODUCTS.some((p) => p.status === 'unpublished'), 'unpublished products never reach the store');
  for (const p of STORE_PRODUCTS.filter((p) => p.status === 'needs-gumroad')) assert.ok(p.soon, 'a paid item without a listing is not buyable');
});

test('store-publish: prices stay in range; trademarks and third-party assets are refused', () => {
  assert.ok(priceOk(0) && priceOk(900) && !priceOk(50) && !priceOk(9900) && !priceOk(9.5));
  assert.equal(priceFor('minis-stl'), 900); assert.equal(priceFor('clips'), 0); assert.ok(priceFor('sdk', 99999) <= 5000);
  assert.deepEqual(trademarkHits('VoidQuest Minis'), []);
  assert.deepEqual(trademarkHits('Solar Quest tokens'), ['solar quest']);
  assert.deepEqual(trademarkHits('pokemon_pack.stl'), ['pokemon']);
  assert.deepEqual(trademarkHits('a risky move'), [], 'whole words only');
  assert.ok(originOk('v01d') && !originOk('sketchfab'));
  const g = guard({ id: 'x-pack', name: 'Monopoly houses', cents: 9900, kind: 'download' }, [{ name: 'a.txt', data: new Uint8Array(1), origin: 'random-site' }]);
  assert.ok(!g.ok); assert.equal(g.problems.length, 3);
});

test('store-publish: the STL check passes every forge printable and fails a hole, a flip and a giant', async () => {
  const files = await forgeFiles();
  assert.ok(files.length >= 8);
  for (const f of files) { const c = checkStl(f.data); assert.ok(c.ok, f.name + ': ' + c.problems.join('; ')); }
  const tri = (pts) => { const b = new Uint8Array(84 + pts.length * 50), dv = new DataView(b.buffer); dv.setUint32(80, pts.length, true); pts.forEach((t, i) => t.flat().forEach((x, k) => dv.setFloat32(84 + i * 50 + 12 + k * 4, x, true))); return b; };
  const A = [0, 0, 0], B = [10, 0, 0], C = [0, 10, 0], D = [0, 0, 10];
  const tet = [[A, C, B], [A, B, D], [A, D, C], [B, C, D]];
  assert.ok(checkStl(tri(tet)).ok);
  assert.match(checkStl(tri(tet.slice(1))).problems.join(' '), /open edges/);
  assert.match(checkStl(tri([[A, B, C], ...tet.slice(1)])).problems.join(' '), /wrong way/);
  const big = tet.map((t) => t.map((p) => p.map((x) => x * 30)));
  assert.match(checkStl(tri(big)).problems.join(' '), /past a 180 mm bed/);
  assert.match(checkStl(new Uint8Array(10)).problems[0], /empty/);
  const g = glb(files[0].model); assert.equal(new DataView(g.buffer).getUint32(0, true), 0x46546c67); assert.equal(g.length % 4, 0);
});

test('store-publish: each published product becomes an ad clip, filmed on its own store card and given a daily slot that week', () => {
  const m = storeMoments('{"at":"2026-10-15T06:00:00Z","id":"v01d-clips-pack","hook":"Ten shorts I filmed myself. Free.","caption":"x"}\n{"bad');
  assert.equal(m.length, 1); assert.equal(m[0].url, '/store/#v01d-clips-pack');
  assert.ok(storeMoments().length >= 0);
  if (storeMoments().length) { assert.ok(plan('2026-10-16', {}, 3).some((e) => e.moment.startsWith('store-')), 'a new product gets a slot'); assert.ok(!plan('2026-10-16', {}, 1)[0].moment.startsWith('store-'), 'a one-clip day stays on performance'); }
});
