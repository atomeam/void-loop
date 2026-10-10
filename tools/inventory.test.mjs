// The inventory knows what Void can make in the world (Void's ask, 2026-10-10: "a feedback loop between print-file and
// inventory so I know exactly what physical assets exist"): "what can you print" lists every forge thing whose file passes
// the same check "print it" runs (forge-rules.js verifyStl), with its size and weight, and holds back any that fails with
// the reason. Nothing about any visitor is kept: the list is computed from the recipes on each ask.
// Run: node --test tools/inventory.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import inventory, { inventoryOf, printable, printableHtml } from '../void-live-deploy/skills/inventory.js';
import * as F from '../void-live-deploy/skills/forge-rules.js';
import fs from 'node:fs';

test('inventory: "what can you print" and its kin ask for the printable things; look-alikes and the old asks keep their place', () => {
  for (const a of ['what can you print', 'what can you 3d print?', 'what can I print', 'what can the forge make', 'list printable things', 'show me what you can print', 'what physical things can you make']) assert.deepEqual(inventoryOf(a), { kind: 'printable' }, a);
  for (const a of ['print it', 'print the page', 'what can you do', 'make me a rocket', 'export a print file', 'what is a 3d printer']) assert.notEqual((inventoryOf(a) || {}).kind, 'printable', a);
  assert.deepEqual(inventoryOf("what's already built"), { kind: 'all' });
});

test('inventory: every printable thing is one whose file passed the print check now, with its size and weight; the stage export is listed too', async () => {
  const p = await printable();
  assert.equal(p.ready.length + p.held.length, Object.keys(F.THINGS).length);
  assert.equal(p.held.length, 0, JSON.stringify(p.held));
  for (const r of p.ready) {
    const m = F.build(r.key);
    assert.ok(F.verifyStl(F.stl(m), m).ok, r.key);
    assert.match(r.size, /^\d+ × \d+ × \d+ mm$/); assert.ok(r.grams > 0); assert.equal(r.ask, 'make me a ' + r.label.toLowerCase());
  }
  const esc = (s) => String(s).replace(/</g, '&lt;');
  const html = printableHtml(esc, p);
  assert.match(html, /Printable now · 10 of 10 checked/); assert.match(html, /Rocket/); assert.match(html, /export a print file/);
});

test('inventory: a thing whose file fails the check is held back, with the reason', async () => {
  const p = await printable(() => ({ ok: false, problems: ['open edges: 3 (a slicer may need to mend it)'] }));
  assert.equal(p.ready.length, 0); assert.equal(p.held.length, Object.keys(F.THINGS).length);
  assert.match(printableHtml((s) => s, p), /Held back[\s\S]*open edges: 3/);
});

test('inventory: the skill keeps no record of anyone: the module writes no storage and makes no request', () => {
  const src = fs.readFileSync(new URL('../void-live-deploy/skills/inventory.js', import.meta.url), 'utf8');
  assert.ok(!/localStorage|sessionStorage|indexedDB|fetch\(|sendBeacon|XMLHttpRequest/.test(src));
  assert.ok(inventory.examples.includes('what can you print'));
});
