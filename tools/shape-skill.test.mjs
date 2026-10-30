// The shape skill (void-live-deploy/skills/shape.js): which asks draw, which remove, and which are left to the page's own targeting.
import test from 'node:test';
import assert from 'node:assert/strict';
import shape, { typeOf, shapeIntent, plainShape } from '../void-live-deploy/skills/shape.js';

test('typeOf names the shape an ask asks for, a rectangle when it names none', () => {
  assert.equal(typeOf('draw a circle'), 'circle');
  assert.equal(typeOf('draw a line'), 'line');
  assert.equal(typeOf('make a square'), 'rect');
  assert.equal(typeOf('shape: circle', 'shape: Circle'), 'circle');
  assert.equal(typeOf('shape: square', 'Shape: square'), 'rect');
  assert.equal(typeOf('draw a shape'), 'rect');
});

test('shapeIntent: create, remove, or nothing', () => {
  assert.deepEqual(shapeIntent('draw a circle'), { act: 'create', type: 'circle' });
  assert.deepEqual(shapeIntent('make a square'), { act: 'create', type: 'rect' });
  assert.deepEqual(shapeIntent('a line please'), { act: 'create', type: 'line' });
  assert.deepEqual(shapeIntent('remove the shape'), { act: 'remove' });
  assert.deepEqual(shapeIntent('circle go away'), { act: 'remove' });
  assert.deepEqual(shapeIntent('delete it', 'delete it', { picked: true }), { act: 'remove' });
  assert.equal(shapeIntent('delete it'), null, '"delete it" with nothing picked is not about the shape');
  assert.equal(shapeIntent('what time is it'), null);
  assert.equal(shapeIntent('weather in london'), null);
});

test('plainShape takes only the plain asks; a coloured or resized shape goes on to the page', () => {
  for (const a of ['draw a circle', 'make a square', 'a line please', 'please draw me a new rectangle', 'circle']) assert.equal(plainShape(a), true, a);
  for (const a of ['draw a red square', 'make the shape bigger', 'line up the cards', 'circle back to me tomorrow']) assert.equal(plainShape(a), false, a);
});

test('the skill is named and its examples are asks it would take', () => {
  assert.equal(shape.name, 'shape');
  assert.ok(Array.isArray(shape.examples) && shape.examples.length > 0);
  for (const e of shape.examples) assert.ok(shapeIntent(String(e).toLowerCase()), 'example taken: ' + e);
});
