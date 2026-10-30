// live-cards: a live card (a field mind: the memory orbs, Swarm, Verse Brain) keeps running when the stage redraws
// (void-live-deploy/lib/live-cards.js, render() in void.html; asked 2026-10-29: a new card restarted every mind on the stage).
// The stage's own render() is taken from void.html and run on a small stand-in stage, so this fails on a render() that mounts
// every card again. Run: node --test tools/live-cards.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveSig, keepWhile } from '../void-live-deploy/lib/live-cards.js';

const page = process.env.LIVE_CARDS_PAGE || new URL('../void.html', import.meta.url);

/** render() from the page, run against a stand-in stage: { render, stage, things, mounts } */
function stageFrom(html) {
  const at = html.indexOf('    function render() {'); assert.ok(at > 0, 'void.html has render()');
  let i = html.indexOf('{', at), depth = 0, end = -1;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) { end = i + 1; break; } }
  const src = html.slice(at, end);
  const kids = [], stage = {
    querySelectorAll: (sel) => (/data-id/.test(sel) ? kids.slice() : []),
    appendChild: (el) => { el.isConnected = true; kids.push(el); return el; },
    set innerHTML(_) { for (const el of kids) el.isConnected = false; kids.length = 0; },
    children: kids
  };
  const things = {}, mounts = [];
  const mount = (th, api, live) => { const el = { dataset: { id: th.id }, style: {}, isConnected: false, kind: th.kind }; if (live) keepWhile(el, th); mounts.push(th.id); api.stage.appendChild(el); };
  const stageKinds = { field: { mount: (th, api) => mount(th, api, true) }, note: { mount: (th, api) => mount(th, api, false) } };
  const stageApi = { stage };
  const noop = () => {};
  const render = new Function('stage', 'things', 'stageKinds', 'stageApi', 'placeThing', 'decorate', 'tuckApply', 'syncFigures', 'announceNew', 'requestAnimationFrame', 'layoutStage', 'clearUnderPage', 'vpageEl',
    src + '\nreturn render;')(stage, things, stageKinds, stageApi, noop, noop, noop, noop, noop, noop, noop, noop, null);
  return { render, stage, things, mounts };
}

test('a card says it can stay only while it is the same thing with the same look', () => {
  const th = { id: 'a', kind: 'field', x: 10, y: 20 }, el = keepWhile({}, th);
  assert.equal(el._liveKeep(th), true);
  th.x = 300; th.y = 9; th.card = { x: 1, y: 2 }; th.scale = 0.5;
  assert.equal(el._liveKeep(th), true, 'moving it, or its board shrinking, keeps it');
  Object.defineProperty(th, 'state', { value: { gen: 40 }, writable: true, enumerable: false, configurable: true });
  assert.equal(el._liveKeep(th), true, 'its own live state keeps it');
  assert.equal(el._liveKeep({ ...th }), false, 'another object (a reload, an undo) mounts again');
  th.color = '#f00'; assert.equal(el._liveKeep(th), false, 'a new look mounts again');
  assert.equal(liveSig(null), null);
  const loop = { id: 'b' }; loop.self = loop; assert.equal(liveSig(loop), null); assert.equal(keepWhile({}, loop)._liveKeep(loop), false, 'unreadable: never kept');
});

test('the stage\'s render() puts a live card back as the same element when another card opens', () => {
  const S = stageFrom(readFileSync(page, 'utf8'));
  S.things.f = { id: 'f', kind: 'field', x: 10, y: 10 }; S.render();
  const first = S.stage.children[0];
  S.things.n = { id: 'n', kind: 'note', x: 400, y: 10 }; S.render(); // a new card opens
  assert.equal(S.stage.children.length, 2);
  assert.equal(S.stage.children[0], first, 'the field card is the same element, still running');
  assert.equal(first.isConnected, true);
  assert.deepEqual(S.mounts, ['f', 'n'], 'it was mounted once');
  S.things.f.x = 77; S.render();
  assert.equal(S.stage.children[0], first); assert.equal(first.style.left, '77px', 'it goes where its thing stands');
  assert.equal(S.mounts.filter((m) => m === 'n').length, 2, 'a card that is not live mounts as before');
});

test('render() mounts a live card again when it changed, and lets it go when it is gone', () => {
  const S = stageFrom(readFileSync(page, 'utf8'));
  S.things.f = { id: 'f', kind: 'field', x: 0, y: 0 }; S.render(); const first = S.stage.children[0];
  S.things.f.color = '#3d7af5'; S.render();
  assert.notEqual(S.stage.children[0], first, 'a new look: a new mount'); assert.equal(first.isConnected, false);
  const second = S.stage.children[0]; S.things.f = { ...S.things.f }; S.render();
  assert.notEqual(S.stage.children[0], second, 'a new thing object (a reload, an undo): a new mount');
  const third = S.stage.children[0]; delete S.things.f; S.render();
  assert.equal(S.stage.children.length, 0); assert.equal(third.isConnected, false, 'thrown off: gone, so its loop ends');
});
