// stage pack E, the Opposite Era (asked by the owner, 2026-10-18): riot, mutation chamber, sudden death, overload, mass extinction.
// The pure parts on fakes: each skill's match (its asks in, its look-alikes out), the riot's physics, the genome's steps, the picks,
// the overload's spawn, drop target and merge, and the extinction's confirmation and plan. node --test tools/stage-pack-e.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { isSafe, removable, pickOne, nameOf, esc, rng } from '../void-live-deploy/lib/opposite-era.js';
import { riotOf, step, seedBodies, transformOf, BOUNCE, MAX } from '../void-live-deploy/skills/riot.js';
import { mutateOf, stepGenome, genomeAt, styleOf, tagOf, LIMITS } from '../void-live-deploy/skills/mutate.js';
import { suddenOf, victimOf, faceOf, DEFAULT_S } from '../void-live-deploy/skills/sudden-death.js';
import { overloadOf, spawnCards, dropTarget, merge, COUNT, FALLBACK } from '../void-live-deploy/skills/overload.js';
import { extinctionOf, confirmed, plan } from '../void-live-deploy/skills/extinction.js';

const things = { a: { id: 'a', kind: 'sticky' }, k: { id: 'k', kind: 'kept' }, p: { id: 'p', kind: 'clock', pinned: true }, m: { id: 'm', kind: 'counter', keep: true }, b: { id: 'b', kind: 'timer' }, sd: { id: 'sd', kind: 'sudden-death' } };

test('opposite-era: kept, marked and hand-placed things are safe; the banner is never taken; picks and escaping', () => {
  assert.equal(isSafe(things.k), true); assert.equal(isSafe(things.p), true); assert.equal(isSafe(things.m), true); assert.equal(isSafe(things.a), false); assert.equal(isSafe(null), false);
  assert.deepEqual(removable(things), ['a', 'b']);
  assert.deepEqual(removable({}), []);
  assert.equal(pickOne(['x', 'y', 'z'], () => 0), 'x'); assert.equal(pickOne(['x', 'y', 'z'], () => 0.999), 'z'); assert.equal(pickOne([], () => 0), null);
  assert.equal(nameOf({ kind: 'sticky', name: 'pasta' }), 'pasta'); assert.equal(nameOf({ kind: 'clock' }), 'clock'); assert.equal(nameOf(null), 'thing');
  assert.equal(esc('<b a="1">&\'</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
  const r1 = rng(7), r2 = rng(7); assert.equal(r1(), r2()); // seeded
});

test('riot: match is tight, bodies get a speed, a step keeps every body inside, bounces and pushes overlaps apart; positions are only drawn', () => {
  for (const a of ['start the riot', 'Start a riot!', 'let the riot begin', 'riot on the stage']) assert.equal(riotOf(a), 'start', a);
  for (const a of ['end the riot', 'stop the riot', 'riot over', 'the riot is over']) assert.equal(riotOf(a), 'end', a);
  for (const a of ['riot games', 'riot in paris today', 'what causes a riot', 'riot', 'start the party']) assert.equal(riotOf(a), null, a);
  const bodies = seedBodies([{ id: 'a', x: 10, y: 10, w: 50, h: 30 }, { id: 'b', x: 300, y: 200, w: 60, h: 40 }], 5);
  assert.equal(bodies.length, 2);
  for (const b of bodies) { const s = Math.hypot(b.vx, b.vy); assert.ok(s >= 2 && s <= 5.01, 'speed ' + s); assert.equal(b.ox, b.x); assert.equal(b.oy, b.y); }
  assert.deepEqual(seedBodies(bodies, 5).map((b) => b.vx), bodies.map((b) => b.vx)); // the same seed, the same riot
  // a wall: a body headed left past the edge comes back at BOUNCE of its speed, inside
  const [w] = step([{ id: 'w', x: 1, y: 50, w: 20, h: 20, ox: 1, oy: 50, vx: -4, vy: 0, rot: 0 }], { w: 400, h: 300 }, 1, () => 0.5);
  assert.equal(w.x, 0); assert.ok(Math.abs(w.vx - 4 * BOUNCE) < 1e-9, 'bounced ' + w.vx);
  // the far wall too, and the bottom
  const [f] = step([{ id: 'f', x: 390, y: 290, w: 20, h: 20, ox: 0, oy: 0, vx: 5, vy: 5, rot: 0 }], { w: 400, h: 300 }, 1, () => 0.5);
  assert.equal(f.x, 380); assert.equal(f.y, 280); assert.ok(f.vx < 0 && f.vy < 0);
  // two overlapping bodies are pushed apart (never closer) and swap their velocities' direction
  const [p, q] = step([{ id: 'p', x: 100, y: 100, w: 40, h: 40, ox: 0, oy: 0, vx: 3, vy: 0, rot: 0 }, { id: 'q', x: 120, y: 100, w: 40, h: 40, ox: 0, oy: 0, vx: -3, vy: 0, rot: 0 }], { w: 400, h: 300 }, 1, () => 0.5);
  assert.ok(q.x - p.x > 20, 'apart ' + (q.x - p.x)); assert.ok(p.vx < 0 && q.vx > 0, 'swapped');
  // the input is never changed, speed is capped, and many frames stay inside
  const start = [{ id: 'z', x: 5, y: 5, w: 30, h: 30, ox: 5, oy: 5, vx: 50, vy: -50, rot: 0 }]; const copy = JSON.stringify(start);
  let cur = start; const r = rng(3); for (let i = 0; i < 400; i++) { cur = step(cur, { w: 200, h: 150 }, 1.3, r); const [z] = cur; assert.ok(z.x >= 0 && z.x + z.w <= 200 && z.y >= 0 && z.y + z.h <= 150, 'inside at ' + i); assert.ok(Math.hypot(z.vx, z.vy) <= MAX + 1e-9); }
  assert.equal(JSON.stringify(start), copy);
  assert.equal(transformOf({ x: 15, y: 9, ox: 5, oy: 5, rot: 3.14 }), 'translate(10px, 4px) rotate(3.1deg)');
});

test('mutate: match (this, a named thing, lock, stop; not genes), the genome steps within limits and replays from its seed', () => {
  assert.deepEqual(mutateOf('mutate this card'), { act: 'start', target: 'this' });
  assert.deepEqual(mutateOf('mutate it'), { act: 'start', target: 'this' });
  assert.deepEqual(mutateOf('mutate the selected card'), { act: 'start', target: 'this' });
  assert.deepEqual(mutateOf('Mutate the sticky!'), { act: 'start', target: 'sticky' });
  assert.deepEqual(mutateOf('mutate the clock'), { act: 'start', target: 'clock' });
  assert.deepEqual(mutateOf('lock generation 7'), { act: 'lock', gen: 7 });
  assert.deepEqual(mutateOf('freeze at gen 12'), { act: 'lock', gen: 12 });
  assert.deepEqual(mutateOf('stop mutating'), { act: 'stop' });
  assert.deepEqual(mutateOf('stop the mutation'), { act: 'stop' });
  for (const a of ['mutate a gene', 'what is a mutation', 'genetic mutation in fruit flies', 'lock the door', 'stop']) assert.equal(mutateOf(a), null, a);
  const g7 = genomeAt(42, 7), again = genomeAt(42, 7), g8 = genomeAt(42, 8);
  assert.deepEqual(g7, again); assert.notDeepEqual(g7, g8);
  assert.deepEqual(genomeAt(42, 0), { hue: 0, scale: 1, border: 0, radius: 0, tilt: 0 });
  let g = genomeAt(9, 0); const r = rng(9);
  for (let i = 0; i < 200; i++) { g = stepGenome(g, r); for (const k of Object.keys(LIMITS)) assert.ok(g[k] >= LIMITS[k][0] && g[k] <= LIMITS[k][1], k + ' at ' + i + ' = ' + g[k]); }
  const s = styleOf({ hue: 120.4, scale: 1.25, border: 4, radius: 12, tilt: -3 });
  assert.equal(s.filter, 'hue-rotate(120deg) saturate(1.50)'); assert.equal(s.transform, 'scale(1.250) rotate(-3.0deg)'); assert.equal(s.border, '4px solid hsl(120 80% 60%)'); assert.equal(s.borderRadius, '12px');
  assert.deepEqual(styleOf(genomeAt(1, 0)), { filter: 'hue-rotate(0deg) saturate(1.00)', transform: 'scale(1.000) rotate(0.0deg)', border: '', borderRadius: '' });
  assert.equal(tagOf(7, true), 'gen 7 · locked'); assert.equal(tagOf(3, false), 'gen 3');
});

test('sudden death: match (seconds, the default, cancel; not overtime rules), the victim is never kept, the face counts down', () => {
  assert.deepEqual(suddenOf('sudden death in 60 seconds'), { act: 'start', seconds: 60 });
  assert.deepEqual(suddenOf('Sudden death in 5s'), { act: 'start', seconds: 5 });
  assert.deepEqual(suddenOf('sudden death'), { act: 'start', seconds: DEFAULT_S });
  assert.deepEqual(suddenOf('sudden death in a minute'), { act: 'start', seconds: 60 });
  assert.deepEqual(suddenOf('sudden death in 0 seconds'), { act: 'start', seconds: 1 });
  assert.deepEqual(suddenOf('cancel sudden death'), { act: 'cancel' }); assert.deepEqual(suddenOf('call off the sudden death'), { act: 'cancel' });
  for (const a of ['sudden death overtime rules', 'sudden cardiac death causes', 'sudden death in hockey', 'death', 'sudden']) assert.equal(suddenOf(a), null, a);
  const seen = new Set(); for (let i = 0; i < 40; i++) seen.add(victimOf(things, Math.random));
  assert.deepEqual([...seen].sort(), ['a', 'b']); // never k (kept), p (pinned), m (marked keep) or the banner
  assert.equal(victimOf({ k: things.k }, Math.random), null);
  assert.deepEqual(faceOf(60000), { num: '60', sub: '60 seconds' }); assert.deepEqual(faceOf(900), { num: '1', sub: 'one second' }); assert.deepEqual(faceOf(-5), { num: '0', sub: 'now' });
});

test('overload: match (spawn, purge; not circuits), 24 seeded cards inside the stage with labels from the names, the drop target and the merge', () => {
  for (const a of ['overload me', 'Overload!', 'overload the stage', 'flood the stage']) assert.equal(overloadOf(a), 'spawn', a);
  for (const a of ['purge the overload', 'clear the overload', 'overload off']) assert.equal(overloadOf(a), 'purge', a);
  for (const a of ['overload a circuit', 'sensory overload symptoms', 'information overload meaning', 'purge']) assert.equal(overloadOf(a), null, a);
  const cards = spawnCards(11, ['sticky', 'clock', 'chess'], { w: 800, h: 600 });
  assert.equal(cards.length, COUNT);
  assert.equal(new Set(cards.map((c) => c.id)).size, COUNT);
  for (const c of cards) { assert.ok(['sticky', 'clock', 'chess'].includes(c.label)); assert.ok(c.x >= 8 && c.x <= 800 - 78 - 8 && c.y >= 8 && c.y <= 600 - 30 - 62, 'inside ' + c.x + ',' + c.y); assert.ok(c.glitch >= 0 && c.glitch <= 2); assert.equal(c.kind, 'overload'); assert.equal(c.size, 1); }
  assert.deepEqual(spawnCards(11, ['sticky', 'clock', 'chess'], { w: 800, h: 600 }), cards); // seeded
  assert.ok(spawnCards(2, [], { w: 800, h: 600 }).every((c) => FALLBACK.includes(c.label))); // no names: the built-in list
  const boxes = { a: { x: 0, y: 0, w: 80, h: 30 }, b: { x: 100, y: 0, w: 80, h: 30 }, c: { x: 300, y: 300, w: 80, h: 30 }, d: { x: 110, y: 10, w: 80, h: 30 } };
  assert.equal(dropTarget('d', boxes), 'b'); // its centre is inside b
  assert.equal(dropTarget('c', boxes), null); // alone
  assert.equal(dropTarget('a', { a: { x: 0, y: 0, w: 80, h: 30 }, e: { x: 70, y: 20, w: 80, h: 30 } }), 'e'); // overlaps the corner only: the most overlapped
  assert.equal(dropTarget('zz', boxes), null);
  const m = merge({ id: 'b', label: 'clock', size: 2, x: 1, y: 2 }, { id: 'd', label: 'chess', size: 1 });
  assert.deepEqual(m, { keep: { id: 'b', label: 'clock+chess', size: 3, x: 1, y: 2 }, drop: 'd' });
});

test('extinction: match (not the dinosaurs), only the exact word confirms, the plan spares one survivor and never a kept thing', () => {
  for (const a of ['mass extinction', 'Mass extinction!', 'trigger a mass extinction', 'start the mass extinction now']) assert.equal(extinctionOf(a), true, a);
  for (const a of ['mass extinction event dinosaurs', 'when was the last mass extinction', 'extinction rebellion', 'extinction', 'mass']) assert.equal(extinctionOf(a), false, a);
  assert.equal(confirmed('extinct'), true); assert.equal(confirmed('  Extinct '), true);
  for (const w of ['', 'extinc', 'extinction', 'yes', 'EXTINCT!']) assert.equal(confirmed(w), false, w);
  const p = plan(things, () => 0);
  assert.deepEqual(p, { survivor: 'a', doomed: ['b'] });
  const p2 = plan(things, () => 0.99); assert.deepEqual(p2, { survivor: 'b', doomed: ['a'] });
  assert.deepEqual(plan({ k: things.k, p: things.p }, Math.random), { survivor: null, doomed: [] });
  assert.deepEqual(plan({}, Math.random), { survivor: null, doomed: [] });
  const one = plan({ a: things.a }, Math.random); assert.deepEqual(one, { survivor: 'a', doomed: [] }); // one thing: it survives, nothing goes
});
