// shape pictures (lib/shape-picture.js, shown by skills/draw.js): which asks are a coloured shape in English, French and Spanish, the
// English ask the stage shape gets, the SVG it draws, the sizes "make the picture bigger" steps through, and that plain shapes stay the shape skill's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeAsk, stageTypeOf, sideOf, pathOf, svgOf, resizeAsk, HEX, SHAPES } from '../void-live-deploy/lib/shape-picture.js';
import draw from '../void-live-deploy/skills/draw.js';
import shape, { alter, circlePaint } from '../void-live-deploy/skills/shape.js';
import cartoon from '../void-live-deploy/skills/cartoon.js';

test('a coloured shape, in three languages, reads to the same picture', () => {
  for (const t of ['draw a red circle', 'Draw me a red circle.', 'please draw a red circle', 'dessine un cercle rouge', 'dessine-moi un cercle rouge', 'dibuja un círculo rojo', 'dibújame un círculo rojo'])
    assert.deepEqual(shapeAsk(t) && [shapeAsk(t).shape, shapeAsk(t).color, shapeAsk(t).english], ['circle', 'red', 'draw a red circle'], t);
  assert.equal(shapeAsk('draw a big blue star').size, 'big'); assert.equal(shapeAsk('draw a big blue star').hex, HEX.blue);
  assert.equal(shapeAsk('dessine une étoile jaune').shape, 'star'); assert.equal(shapeAsk('draw a gray heart').color, 'grey');
  for (const t of ['draw a circle', 'draw a cat', 'draw a red', 'what is a red circle', 'draw a red circle on my wall at home', 'dessine un chat', '']) assert.equal(shapeAsk(t), null, t);
});
test('the stage gets circles and squares; the picture its outline and size', () => {
  assert.equal(stageTypeOf('circle'), 'circle'); assert.equal(stageTypeOf('square'), 'rect'); assert.equal(stageTypeOf('star'), null);
  assert.equal(sideOf('normal'), 180); assert.equal(sideOf('normal', 1), 225); assert.equal(sideOf('big', 9), 320); assert.equal(sideOf('small', -9), 80);
  for (const s of SHAPES) assert.match(pathOf(s, 180), /^M [\d.]+ [\d.]+ .* Z$/, s);
  const svg = svgOf(shapeAsk('draw a red circle'));
  assert.match(svg, /^<svg[^>]+viewBox="0 0 180 180"/); assert.match(svg, /fill="#d6402f"/); assert.match(svg, /max-width:100%/); assert.match(svg, /aria-label="a red circle"/);
});
test('"make the picture bigger" grows it; "make it bigger" stays the stage shape\'s', () => {
  assert.equal(resizeAsk('make the picture bigger'), 1); assert.equal(resizeAsk('Make the drawing smaller.'), -1); assert.equal(resizeAsk('make the circle larger'), 1);
  for (const t of ['make it bigger', 'make the shape bigger', 'bigger', 'make the picture blue']) assert.equal(resizeAsk(t), 0, t);
});
test('the draw skill takes coloured shapes; plain ones stay the shape skill\'s and none go to the cartoon', () => {
  for (const t of ['draw a red circle', 'dessine un cercle rouge', 'draw a blue star']) assert.ok(draw.match(t.toLowerCase(), t), t);
  assert.ok(!draw.match('draw a circle', 'draw a circle')); assert.ok(!draw.match('make the picture bigger', 'make the picture bigger'), 'only while its card is open');
  assert.ok(shape.match('draw a circle', 'draw a circle')); assert.ok(!cartoon.match('draw a red square', 'draw a red square'));
  assert.equal(draw.suite().ok, true);
});
test('a shape asked for by name becomes that shape (it used to stay the rect it was made as)', () => {
  const th = { shapeType: 'rect', width: 80, height: 80 };
  assert.equal(alter(th, 'draw a red circle'), true); assert.equal(th.shapeType, 'circle');
  assert.equal(circlePaint({ shapeType: 'circle' }), null);
  assert.deepEqual(circlePaint({ shapeType: 'circle', color: '#d6402f' }), { borderColor: '#d6402f', background: '#d6402f', opacity: '1' });
  assert.equal(alter(th, 'draw a square'), true); assert.equal(th.shapeType, 'rect');
  assert.equal(alter(th, 'make it bigger'), true); assert.equal(th.shapeType, 'rect');
});
test('a coloured shape in German reads to the same picture, and the draw skill takes it', () => {
  for (const t of ['zeichne einen roten kreis', 'Zeichne einen roten Kreis.', 'zeichne mir einen roten Kreis', 'bitte zeichne einen roten kreis', 'male einen roten kreis'])
    assert.deepEqual(shapeAsk(t) && [shapeAsk(t).shape, shapeAsk(t).color, shapeAsk(t).english], ['circle', 'red', 'draw a red circle'], t);
  assert.deepEqual([shapeAsk('zeichne ein blaues Quadrat').shape, shapeAsk('zeichne ein blaues Quadrat').color], ['square', 'blue']);
  assert.equal(shapeAsk('male einen großen grünen Stern').size, 'big'); assert.equal(shapeAsk('zeichne ein kleines rotes Herz').size, 'small');
  assert.equal(shapeAsk('zeichne ein orangenes Rechteck').shape, 'rectangle'); assert.equal(shapeAsk('zeichne einen weißen Kreis').color, 'white');
  for (const t of ['zeichne einen kreis', 'zeichne eine katze', 'zeichne einen roten', 'was ist ein roter kreis']) assert.equal(shapeAsk(t), null, t);
  assert.ok(draw.match('zeichne einen roten kreis', 'zeichne einen roten Kreis')); assert.ok(!cartoon.match('zeichne einen roten kreis', 'zeichne einen roten kreis'));
});
