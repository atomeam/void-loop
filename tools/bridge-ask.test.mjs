// "bridge these inputs" asked by name (site-test issue #2721, lists run 22): with fewer than two staged inputs the skill
// returned 'none' and the visitor saw only "waking up". Now it opens a Bridge card that says how to stage inputs and bridges
// two samples on a tap, with the same local analyzer showBridge uses.
// Run: node --test tools/bridge-ask.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import bridge, { runBridge, SAMPLES, analyzeBridge } from '../void-live-deploy/skills/bridge.js';

function fakeApi() {
  let handler = null;
  const btn = { addEventListener: (_, f) => { handler = f; } };
  const el = { innerHTML: '', querySelector: (s) => (s === '.bridge-sample' && /bridge-sample/.test(el.innerHTML) ? btn : null), querySelectorAll: () => [] };
  return { el, click: () => handler && handler(), api: { showPage: (fn) => { fn(el); return el; }, say: () => {} } };
}

test('asked by name with nothing staged, the skill answers with a card, never none', async () => {
  const f = fakeApi();
  assert.ok(bridge.match('bridge these inputs'));
  assert.equal(await bridge.run('bridge these inputs', f.api), 'bridge');
  assert.match(f.el.innerHTML, /<h2>Bridge<\/h2>/);
  assert.match(f.el.innerHTML, /two or three snippets/);
  assert.match(f.el.innerHTML, /Bridge two samples/);
});
test('the sample button bridges the two samples: user_id meets userId', () => {
  const f = fakeApi();
  runBridge('bridge these inputs', f.api);
  f.click();
  assert.match(f.el.innerHTML, /class="bridge-connections"/);
  const c = analyzeBridge(SAMPLES, 'Bridge two samples');
  assert.equal(c.kind, 'bridge');
  assert.ok(c.connections.length >= 1, 'at least one connection between the samples');
});
test('without a page api it still says none (the router can try the next skill)', () => {
  assert.equal(runBridge('bridge these inputs', null), 'none');
});
