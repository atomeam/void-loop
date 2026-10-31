import test from 'node:test';
import assert from 'node:assert/strict';
import { heroKind, heroView, inspectPrompt, HERO } from '../void-live-deploy/lib/hero-view.js';

test('the kind of thing from its size: a book is flat, a figure is tall, a teapot is an object', () => {
  assert.equal(heroKind({ x: 0.24, y: 0.035, z: 0.17 }), 'flat', 'the Book of Verse');
  assert.equal(heroKind({ x: 0.4, y: 0.02, z: 0.4 }), 'flat', 'a board');
  assert.equal(heroKind({ x: 0.05, y: 0.18, z: 0.05 }), 'tall', 'a figure');
  assert.equal(heroKind({ x: 0.06, y: 0.3, z: 0.06 }), 'tall', 'a lighthouse');
  assert.equal(heroKind({ x: 0.14, y: 0.11, z: 0.1 }), 'object', 'a teapot');
  assert.equal(heroKind({ x: 1, y: 1, z: 1 }), 'object', 'a cube');
  assert.equal(heroKind(null), 'object'); assert.equal(heroKind({}), 'object'); assert.equal(heroKind({ x: -1, y: 'nope' }), 'object');
});

test('each kind has its own angle and framing, and the view handed out is a copy', () => {
  for (const k of ['flat', 'tall', 'object']) { const v = heroView({ flat: { x: 1, y: 0.1, z: 1 }, tall: { x: 1, y: 3, z: 1 }, object: { x: 1, y: 1, z: 1 } }[k]); assert.equal(v.kind, k); assert.deepEqual(v.view, HERO[k].view); assert.ok(v.pad > 0.5 && v.pad < 1); v.view[1] = 99; assert.notEqual(HERO[k].view[1], 99); }
  assert.ok(HERO.flat.view[1] > HERO.object.view[1] && HERO.object.view[1] > HERO.tall.view[1], 'a flat thing is seen from higher up, a tall one from lower');
  assert.ok(HERO.flat.view[0] < 0.2, 'a flat thing is seen from the front, not from a corner');
});

test('the examine prompt says what a hand can do', () => {
  assert.equal(inspectPrompt(), 'Drag to turn · Wheel to zoom · Esc puts it back');
  assert.equal(inspectPrompt({ turn: false, zoom: false, back: 'Esc closes the book' }), 'Esc closes the book');
});
