// veto-council (skills/veto-council.js): which asks convene a council, the question it reads from the ask, and the card on a stub page: five masses
// summing to 100, one proposal surviving whole, only an agent with 30+ blocking, and moving one mass moving the others while the total stays 100.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/veto-council.js';
import * as C from '../void-live-deploy/lib/council-law.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function card(ask) {
  const nodes = {}, el = { innerHTML: '', dataset: {}, cls: [], classList: { add: (c) => el.cls.push(c) } };
  el.querySelector = (sel) => nodes[sel] || (nodes[sel] = { textContent: '', innerHTML: '', on: {}, addEventListener(t, f) { this.on[t] = f; } });
  assert.equal(sk.run(ask, { showPage: (f) => f(el), esc }), 'veto-council');
  const props = () => [...nodes['.vc-out'].innerHTML.matchAll(/data-by="(\w+)" data-status="(\w+)"[^>]*>(.*?)<\/div>/g)].map((x) => ({ by: x[1], status: x[2], body: x[3] }));
  const masses = () => Object.fromEntries([...nodes['.vc-masses'].innerHTML.matchAll(/data-agent="(\w+)" value="(\d+)"/g)].map((x) => [x[1], +x[2]]));
  return { el, nodes, props, masses, set: (agent, value) => nodes['.vc-masses'].on.change({ target: { dataset: { agent }, value } }) };
}

test('examples in, near misses out, and the asks the pattern names', () => {
  const m = (t) => sk.match(t.toLowerCase(), t);
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['Hold the veto council over the budget', 'call a council about hiring', 'run a council for the launch date']) assert.ok(m(a), a);
  for (const a of ['convene a council', 'council on foreign relations', 'call the city council about potholes', 'convene the board on pricing', 'a council on moving offices']) assert.ok(!m(a), a);
});
test('the question and the starting council', () => {
  const c = card('convene a council on moving offices?');
  assert.deepEqual(c.el.cls, ['veto-council']);
  assert.equal(c.nodes['.vc-q'].textContent, 'Question: moving offices');
  assert.deepEqual(c.masses(), { Skeptic: 30, Builder: 20, Archivist: 20, Economist: 15, Wanderer: 15 });
  assert.equal(c.el.dataset.total, '100');
  assert.equal(c.nodes['.vc-total'].textContent, 'Veto mass: 100 of 100 (moving one moves the others). A single agent with 30+ can block.');
  const ps = c.props();
  assert.deepEqual(ps.map((p) => p.by), ['Skeptic', 'Builder', 'Archivist', 'Economist', 'Wanderer']);
  assert.equal(ps.filter((p) => p.status === 'survived').length, 1);
  assert.equal(c.el.dataset.survivor, ps.find((p) => p.status === 'survived').by);
  for (const p of ps) { const bl = /blocked by ([^<·]*)/.exec(p.body); if (bl) assert.equal(bl[1].trim(), 'Skeptic (30)', p.by); assert.equal(p.status === 'blocked', !!bl, p.by); }
  assert.match(c.nodes['.vc-out'].innerHTML, new RegExp('Survivor: ' + c.el.dataset.survivor + '’s proposal, unmerged\\. Now move the mass and convene again\\.'));
  assert.equal(C.convene('moving offices', C.startMasses()).survivor, c.el.dataset.survivor); // the same question convenes the same council
  assert.equal(c.el.dataset.survivor, 'Economist');
});
test('moving one mass moves the others; the total stays 100', () => {
  const c = card('convene a council on moving offices');
  c.set('Skeptic', '60');
  assert.deepEqual(c.masses(), { Skeptic: 60, Builder: 11, Archivist: 11, Economist: 9, Wanderer: 9 });
  assert.equal(c.el.dataset.total, '100');
  for (const p of c.props()) { const bl = /blocked by ([^<·]*)/.exec(p.body); if (bl) assert.equal(bl[1].trim(), 'Skeptic (60)'); }
  c.set('Skeptic', '0');
  assert.equal(c.masses().Skeptic, 0); assert.equal(Object.values(c.masses()).reduce((a, v) => a + v, 0), 100);
  assert.ok(!c.props().some((p) => p.status === 'blocked')); // nobody holds 30 any more, so nothing is blocked
  c.set('Nobody', '90'); assert.equal(c.masses().Skeptic, 0);
});
test('a question that someone with mass blocks everywhere but one', () => {
  const ps = card('convene a council on whether to rewrite the app').props();
  assert.deepEqual(ps.map((p) => p.status), ['survived', 'blocked', 'blocked', 'blocked', 'blocked']);
});
