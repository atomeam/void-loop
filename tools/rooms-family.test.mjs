// The rooms family (skills/rooms.js, lists run 5, 2026-10-22): room, walls and home are one routing entry, each old ask still reaches the
// member that answered it before, and the three old names stay as parts (aliases). Run: node --test tools/rooms-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/rooms.js';
import room from '../void-live-deploy/skills/room.js';
import walls from '../void-live-deploy/skills/walls.js';
import home from '../void-live-deploy/skills/home.js';

const before = (a) => [room, walls, home].find((m) => m.match(a.toLowerCase(), a))?.name || null; // the old order: 0370, 0380, 0390
test('every example of the three old skills lands on the same member as before the merge', () => {
  const asks = [...room.examples, ...walls.examples, ...home.examples, 'paint and carpet a 12x14 room', 'how much paint do i need for a 12x14 room', 'how many rolls of wallpaper for a 12x14 room'];
  assert.ok(asks.length >= 20);
  for (const a of asks) { assert.ok(before(a), 'still answered: ' + a); assert.equal(fam.part(a.toLowerCase(), a), before(a), a); }
  assert.equal(fam.part('paint and carpet a 12x14 room', 'paint and carpet a 12x14 room'), 'room', 'the whole-room card keeps the ask both took');
});
test('the old names are kept as parts, the family takes one place in the index and the order', () => {
  assert.deepEqual(fam.parts, ['room', 'walls', 'home']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('rooms')); for (const n of ['room', 'walls', 'home']) assert.ok(!index.includes(n), n + ' should be inside the family');
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/0370-rooms', import.meta.url)));
  for (const f of ['0370-room', '0380-walls', '0390-home']) assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/' + f, import.meta.url)), f);
});
test('near misses of the members that no sibling answers still miss the family', () => {
  assert.ok(fam.nearMisses.length >= 5);
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  assert.ok(!fam.nearMisses.includes('how much paint do i need for a 12x14 room'), 'home answers it, inside the family');
});
