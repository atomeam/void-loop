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

// a card with a box: querySelector finds the parts run() wires up, and typing fires their input and click handlers
const liveCard = async (text) => {
  const parts = {}, part = (cls) => (parts[cls] = parts[cls] || { value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, on: {}, addEventListener(ev, f) { this.on[ev] = f; } });
  const buttons = ['uppercase', 'lowercase', 'title case', 'capitalize words', 'reverse'].map((how) => ({ dataset: { how }, on: {}, addEventListener(ev, f) { this.on[ev] = f; } }));
  const el = { innerHTML: '', dataset: {}, addEventListener() {}, querySelector: (sel) => part(sel.slice(1)), querySelectorAll: (sel) => (sel === '.util-case' ? buttons : []) };
  const said = await skill.run(text, { showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), _pageStill: () => true });
  const type = (s) => { parts['util-in'].value = s; parts['util-in'].on.input(); };
  return { said, h: el.innerHTML, parts, buttons, type };
};

test('the tool asked for by its name: "qr code generator", "case converter", "lorem ipsum generator" (2026-10-30: these fell to an article)', () => {
  for (const a of ['qr code generator', 'QR code maker', 'free qr code generator', 'qr generator', 'make a qr code', 'create a QR code', 'generate qr code']) assert.deepEqual(utilOf(a), { kind: 'qrmaker' }, a);
  for (const a of ['case converter', 'text case converter', 'online case converter', 'convert case', 'uppercase converter', 'title case converter', 'upper case to lower case']) assert.deepEqual(utilOf(a), { kind: 'casemaker' }, a);
  assert.deepEqual(utilOf('lorem ipsum generator'), { kind: 'lorem', n: 1 });
  assert.deepEqual(utilOf('placeholder text generator'), { kind: 'lorem', n: 1 });
  for (const a of ['qr code scanner', 'what is a qr code', 'what is a case converter', 'qr code', 'case']) assert.equal(utilOf(a), null, a);
  assert.deepEqual(utilOf('qr code for hello'), { kind: 'qr', data: 'hello' }, 'a code with its text still draws at once');
});

test('the QR maker draws the code as you type, here, and says when the box is empty or too full', async () => {
  const c = await liveCard('qr code generator');
  assert.equal(c.said, 'util');
  assert.ok(c.h.includes('<h2>QR code maker</h2>') && c.h.includes('<textarea class="util-in"'), c.h);
  assert.ok(!/<img\b/.test(c.h) && !/qrserver|goqr/.test(c.h), 'nothing fetched');
  c.type('hello world');
  const n = qrMatrix('hello world', { ecl: 'M' }).size + 8;
  assert.ok(c.parts['util-qr'].innerHTML.includes('viewBox="0 0 ' + n + ' ' + n + '"'), c.parts['util-qr'].innerHTML);
  assert.equal(c.parts['util-qr'].style.display, '');
  assert.match(c.parts['util-qr-say'].textContent, /^Scan it/);
  c.type('   ');
  assert.equal(c.parts['util-qr'].innerHTML, ''); assert.equal(c.parts['util-qr'].style.display, 'none');
  c.type('x'.repeat(5000));
  assert.match(c.parts['util-qr-say'].textContent, /too long/);
});

test('the case converter changes the text as you type, in the case picked', async () => {
  const c = await liveCard('case converter');
  assert.equal(c.said, 'util');
  assert.ok(c.h.includes('<h2>Case converter</h2>') && c.h.includes('data-how="title case"'), c.h);
  c.type('the lord of the rings');
  assert.equal(c.parts['util-out'].textContent, 'THE LORD OF THE RINGS', 'uppercase first');
  c.buttons.find((b) => b.dataset.how === 'title case').on.click();
  assert.equal(c.parts['util-out'].textContent, 'The Lord of the Rings');
  c.buttons.find((b) => b.dataset.how === 'reverse').on.click();
  assert.equal(c.parts['util-out'].textContent, 'sgnir eht fo drol eht');
});
