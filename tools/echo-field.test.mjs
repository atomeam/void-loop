// echo-field (skills/echo-field.js): Mind Field's Echo Field mode. Its asks, what run() summons, and its card mounted on a stub DOM through
// lib/field-stage.js: the Listen button moved up front (off without a microphone), word orbs, and every 120 ms the orbs drift toward the
// field's brightest cell at a rate set by the sound level, saying loud words above a level of 0.25 and quiet ones below.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/echo-field.js';
import * as D from '../void-live-deploy/lib/field-doodle.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, m + ': ' + a + ' vs ' + b);
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.kids = []; this.parent = null; this.on = {}; this.dataset = {}; this.attrs = {}; this.className = ''; this.title = ''; this._t = ''; this.isConnected = true;
    this.style = { cssText: '', setProperty(k, v) { this[k] = v; } }; this.classList = { add: (c) => { this.className += ' ' + c; } }; }
  get textContent() { return this._t + this.kids.map((k) => k.textContent).join(''); } set textContent(v) { this._t = String(v); this.kids = []; }
  set innerHTML(v) { this._t = ''; this.kids = []; } get firstChild() { return this.kids[0]; } get children() { return this.kids.filter((k) => k.tagName !== '#TEXT'); }
  setAttribute(k, v) { this.attrs[k] = v; } addEventListener(t, f) { (this.on[t] ||= []).push(f); } removeEventListener() {}
  getContext() { return null; } getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 270 }; }
  is(sel) { return sel.startsWith('.') ? this.className.split(/\s+/).includes(sel.slice(1)) : this.tagName === sel.toUpperCase(); }
  all(sels, out = []) { for (const k of this.kids) { if (sels.some((s) => k.is(s))) out.push(k); k.all(sels, out); } return out; }
  querySelectorAll(s) { return this.all(s.split(',').map((x) => x.trim())); }
  querySelector(s) { const f = this.all([s])[0]; if (f || !/^\.[\w-]+$/.test(s)) return f || null; const n = new El('div'); n.className = s.slice(1); return this.appendChild(n); }
  detach(c) { if (c.parent) c.parent.kids = c.parent.kids.filter((k) => k !== c); c.parent = this; return c; }
  appendChild(c) { this.kids.push(this.detach(c)); return c; } append(...cs) { cs.forEach((c) => this.appendChild(typeof c === 'string' ? Object.assign(new El('#text'), { _t: c }) : c)); }
  prepend(c) { this.detach(c); this.kids.unshift(c); } insertBefore(c, ref) { this.detach(c); const i = this.kids.indexOf(ref); this.kids.splice(i < 0 ? this.kids.length : i, 0, c); return c; }
  before(c) { this.parent.insertBefore(c, this); } after(c) { const p = this.parent; p.detach(c); p.kids.splice(p.kids.indexOf(this) + 1, 0, c); }
}
globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
globalThis.document = { createElement: (t) => new El(t), addEventListener() {}, documentElement: { dataset: {} }, hidden: false, activeElement: null };
globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {}; // no frame loop: the test drives the card's timers itself
globalThis.innerWidth = 900;

function mountCard() {
  const shown = [], th = { id: 'e1', kind: 'echo-field', x: 3, y: 4 };
  const r = sk.stageKinds['echo-field'].mount(th, { bindDrag() {}, stage: { appendChild: (el) => shown.push(el) } });
  return { r, th, el: shown[0], orbs: shown[0].querySelectorAll('.mf-orb') };
}

test('the asks: examples, near misses and the wrappers', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['mind field that listens', 'a field which hears', 'sound mind field', 'acoustic causal lattice mind', 'open the voice field please', 'Echo field?']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['echo', 'mind field', 'echo field recordings', 'voice memo']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
});
test('run summons one Echo Field card and says the microphone is only a level', async () => {
  const got = [], said = []; const api = { stage: { things: () => ({}) }, summon: (k, o) => got.push([k, o]), say: (s) => said.push(s) };
  assert.equal(await sk.run('echo orbs', api), 'echo-field'); assert.deepEqual(got, [['echo-field', { x: 270, y: 50 }]]); assert.match(said[0], /only a sound level, nothing recorded/);
  assert.equal(await sk.run('echo this back', api), 'none'); assert.equal(got.length, 1); assert.deepEqual(Object.keys(sk.stageKinds), ['echo-field']);
});
test('the card: Echo Field idea, Listen moved into the buttons (off with no microphone), four word orbs', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { el, orbs, th } = mountCard();
    assert.equal(el.dataset.field, 'echo-field'); assert.ok(el.className.includes('ff-echo-field')); assert.equal(el.dataset.mode, 'echo-field');
    assert.match(el.querySelector('.ff-why').textContent, /^Press Listen: the sound level around you feeds the field/);
    assert.match(el.querySelector('.g-sub').textContent, /^Echo Field · your voice moves it/);
    const listen = el.querySelector('.mf-listen'); assert.ok(listen.className.includes('ef-listen')); assert.equal(listen.parent, el.querySelector('.ff-btns'));
    assert.equal(listen.disabled, true); assert.equal(listen.textContent, 'Listen unavailable');
    assert.equal(orbs.length, D.ORBS); assert.equal(th.state.orbs.length, D.ORBS);
    for (const o of orbs) { assert.equal(o.style.width, 'auto'); assert.equal(o.style.borderRadius, '9px'); assert.equal(o.style.padding, '1px 6px'); }
  } finally { mock.timers.reset(); }
});
test('every 120 ms the orbs drift to the loudest cell, faster and with loud words when the level is high', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { r, el, orbs, th } = mountCard(), s = th.state;
    s.a.fill(0); s.a[10 * D.GW + 30] = 1; const px = 30.5 / D.GW, py = 10.5 / D.GH; // the peak cell's centre
    s.orbs[2].held = true; const was = s.orbs.map((o) => ({ x: o.x, y: o.y }));
    r.input.audio = 0.5; mock.timers.tick(120);
    const k = 0.04 + 0.5 * 0.12;
    s.orbs.forEach((o, i) => { if (i === 2) { assert.deepEqual({ x: o.x, y: o.y }, was[2], 'a held orb stays'); return; }
      near(o.x, was[i].x + (px + (i - 1.5) * 0.06 - was[i].x) * k, 'orb ' + i + ' x'); near(o.y, was[i].y + (py - was[i].y) * k, 'orb ' + i + ' y'); });
    assert.deepEqual(orbs.map((o) => o.textContent), ['echo', 'ring', '', 'roar'], 'a held orb keeps its word too'); assert.equal(el.dataset.echo, '0.50');
    s.orbs[2].held = false; const mid = s.orbs.map((o) => ({ x: o.x, y: o.y })); r.input.audio = 0.1; mock.timers.tick(120);
    near(s.orbs[0].x, mid[0].x + (px - 0.09 - mid[0].x) * (0.04 + 0.1 * 0.12), 'quiet: slower drift');
    assert.deepEqual(orbs.map((o) => o.textContent), ['still', 'calm', 'soft', 'hush'], 'quiet words, turning one step each tick'); assert.equal(el.dataset.echo, '0.10');
    r.input.audio = 0.26; mock.timers.tick(120); assert.deepEqual(orbs.map((o) => o.textContent), ['boom', 'roar', 'echo', 'ring']);
    el.isConnected = false; const gone = s.orbs[0].x; r.input.audio = 1; mock.timers.tick(240); assert.equal(s.orbs[0].x, gone, 'off the page it stops'); assert.equal(el.dataset.echo, '0.26');
  } finally { mock.timers.reset(); }
});
