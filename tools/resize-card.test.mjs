// The Resize image page's stage card (lib/resize-card.js) and the imgfit card's link back to the page: the size goes both ways, the picture never.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardAsk } from '../void-live-deploy/lib/resize-card.js';
import imgfit from '../void-live-deploy/skills/imgfit.js';
import { sizeIn } from '../void-live-deploy/lib/imgfit.js';
import { pageOfCard } from '../void-live-deploy/lib/card-frame.js';

test('the page card asks for the size on the form, and the skill reads the same size back', () => {
  for (const [f, w, h, u, kb] of [[{ w: '3.5', h: '2.5', u: 'cm', kb: '50' }, 3.5, 2.5, 'cm', 50], [{ w: '600', h: '600', u: 'px', kb: '' }, 600, 600, 'px', undefined],
    [{ w: '35', h: '45', u: 'mm', kb: '20' }, 35, 45, 'mm', 20], [{ w: '2', h: '2', u: 'in', kb: '240' }, 2, 2, 'in', 240]]) {
    const ask = cardAsk(f); assert.ok(ask, JSON.stringify(f));
    assert.ok(imgfit.match(ask.toLowerCase(), ask), ask + ' reaches the resizer skill');
    assert.deepEqual(sizeIn(ask), kb ? { w, h, unit: u, kb } : { w, h, unit: u }, ask);
  }
  assert.equal(cardAsk({ w: '', h: '', u: 'cm', kb: '100' }), 'compress a photo to 100 kb');
  assert.ok(imgfit.match('compress a photo to 100 kb', 'compress a photo to 100 kb'));
});

test('a size the skill would read differently, or none, keeps the example ask', () => {
  for (const f of [null, {}, { w: '0', h: '2', u: 'cm' }, { w: '9000', h: '2', u: 'px' }, { w: '2', h: '2', u: 'ft' }, { w: '2', h: '2', u: 'in', kb: '49.5' },
    { w: '1e3', h: '2', u: 'px' }, { w: '-3', h: '2', u: 'cm' }, { w: '3 cm" onmouseover="x', h: '2', u: 'cm' }]) assert.equal(cardAsk(f), '', JSON.stringify(f));
});

test('the stage card opens the page at the same size, and the page passes only the form values', async () => {
  const el = { dataset: {}, innerHTML: '' };
  imgfit.run('resize a photo to 3.5 x 2.5 cm under 50 kb', { showPage: (fn) => { fn(el); return el; }, esc: (s) => String(s) });
  assert.equal(el.dataset.page, '/resize-image/?w=3.5&h=2.5&u=cm&kb=50');
  assert.deepEqual(pageOfCard('imgfit', el.dataset.page), [el.dataset.page, 'Resize an image']);
  const bare = { dataset: {}, innerHTML: '' }; imgfit.run('image resizer', { showPage: (fn) => { fn(bare); return bare; }, esc: (s) => String(s) });
  assert.equal(bare.dataset.page, undefined, 'no size: the card keeps the plain page link');
  const html = readFileSync(new URL('../void-live-deploy/resize-image/index.html', import.meta.url), 'utf8');
  assert.match(html, /import\('\/lib\/resize-card\.js'\)/);
  assert.match(html, /cardAsk\(\{ w: \$\('w'\)\.value, h: \$\('h'\)\.value, u: \$\('u'\)\.value, kb: \$\('kb'\)\.value \}\)/, 'only the size fields, never the file');
});
