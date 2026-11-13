import test from 'node:test';
import assert from 'node:assert/strict';
import { modeOf, heatAdvice, celsiusOf } from '../void-live-deploy/lib/watched-modes.js';

test('each watched idea is a mode of the page that already covers it', () => {
  assert.equal(modeOf('/notes/', '?mode=relationship'), 'relationship');
  assert.equal(modeOf('/notes/', '?mode=devotion'), 'devotion');
  assert.equal(modeOf('/photos/exif/', '?mode=provenance'), 'provenance');
  assert.equal(modeOf('/weather/', '?mode=hvac'), 'hvac');
  assert.equal(modeOf('/weather/', ''), '');
  assert.equal(modeOf('/store/', '?mode=hvac'), '');
});

test('the heat line follows the temperature on the page', () => {
  assert.equal(celsiusOf('68 °F / 20 °C'), 20);
  assert.equal(heatAdvice(16, 20), 'It is 16°C. Set the heat to 20°C.');
  assert.equal(heatAdvice(24, 20), 'It is 24°C. Leave the heat off. It is already above 20°C.');
  assert.match(heatAdvice(null, 20), /Look up a place/);
});
