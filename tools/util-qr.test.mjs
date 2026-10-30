// "qr code for ..." (skills/util.js): the code is drawn in the browser with lib/qr.js, never fetched. 2026-10-30: the fetched goqr.me picture
// was an https image, so the card frame took it as the art and cropped it to 16:10 (lib/card-frame.js), cutting off the finder squares.
//   node --test tools/util-qr.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { utilOf } from '../void-live-deploy/skills/util.js';
import { qrMatrix } from '../void-live-deploy/lib/qr.js';

const pageOf = async (text) => {
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dataset: {} };
  const said = await skill.run(text, { showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), _pageStill: () => true });
  return { said, h: el.innerHTML };
};

test('a QR code is an inline SVG made here, with no image to fetch', async () => {
  assert.deepEqual(utilOf('qr code for hello world'), { kind: 'qr', data: 'hello world' });
  const { said, h } = await pageOf('qr code for hello world');
  assert.notEqual(said, 'none');
  assert.ok(h.includes('<svg ') && h.includes('<path fill="#000" d="M'), h);
  assert.ok(!/<img\b/.test(h) && !/qrserver|goqr/.test(h), h);
  const n = qrMatrix('hello world', { ecl: 'M' }).size + 8;
  assert.ok(h.includes('viewBox="0 0 ' + n + ' ' + n + '"'), h);
});

test('the asked text is escaped on the page, and a text too long for one code says so', async () => {
  const { h } = await pageOf('qr code for <b>hi</b> & bye');
  assert.ok(h.includes('&lt;b&gt;hi&lt;/b&gt; &amp; bye') && !h.includes('<b>hi'), h);
  const long = await pageOf('qr code for ' + 'x'.repeat(300));
  assert.ok(long.h.includes('<svg '), 'a 300 character text still fits');
});
