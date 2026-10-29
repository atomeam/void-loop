// The inventory knows what Verse can make in the world (Verse's ask, 2026-10-10: "a feedback loop between print-file and
// inventory so I know exactly what physical assets exist"): "what can you print" lists every forge thing whose file passes
// the same check "print it" runs (forge-rules.js verifyStl), with its size and weight, and holds back any that fails with
// the reason. Nothing about any visitor is kept: the list is computed from the recipes on each ask.
// Run: node --test tools/inventory.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import inventory, { inventoryOf, printable, printableHtml, SKILLS_BUILT, TOOLS_BUILT, groupsOf, groupsHtml } from '../void-live-deploy/skills/inventory.js';
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
  assert.match(html, /Printable now · (\d+) of \1 checked/); assert.match(html, /Rocket/); assert.match(html, /export a print file/);
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

test('inventory: no skill row just repeats its own name, and no row carries the old brand name', () => {
  const bare = SKILLS_BUILT.filter((r) => r.what === r.id).map((r) => r.id);
  assert.ok(bare.length <= 5, bare.length + ' skills have no description at all (a new skill needs a line in its card or in WHAT): ' + bare.join(', '));
  for (const r of [...SKILLS_BUILT, ...TOOLS_BUILT]) assert.doesNotMatch(r.id + ' ' + r.what, /\bV01D\b|\bVoid\b/, r.id);
});

test('inventory: the built skills are combined by family, every skill in exactly one group, and the card draws them collapsible with their words', () => {
  const rows = [{ id: 'b', what: 'bee' }, { id: 'a', what: 'ant' }, { id: 'z', what: 'zebra' }, { id: 'q', what: 'quail' }];
  const fam = [{ id: 'f1', name: 'Animals', for: 'creatures', skills: [{ name: 'b' }, { name: 'a' }] }, { id: 'f2', name: 'Empty', skills: [{ name: 'nope' }] }, { id: 'f3', name: 'Dup', skills: [{ name: 'a' }, { name: 'z' }] }];
  const g = groupsOf(rows, fam);
  assert.deepEqual(g.map((x) => x.id), ['f1', 'f3', 'other']);
  assert.deepEqual(g[0].rows.map((r) => r.id), ['a', 'b']);
  assert.deepEqual(g[2].rows.map((r) => r.id), ['q']);
  assert.equal(g.reduce((n, x) => n + x.rows.length, 0), rows.length);
  const html = groupsHtml((x) => String(x).replace(/</g, '&lt;'), g);
  assert.match(html, /<details class="inv-family" data-family="f1"><summary><b>Animals<\/b> · 2 skills/);
  assert.match(html, /<li><b>a<\/b> — ant<\/li>/);
  const real = groupsOf(SKILLS_BUILT);
  assert.equal(real.reduce((n, x) => n + x.rows.length, 0), SKILLS_BUILT.length, 'every real skill is in exactly one group');
  assert.ok(real.length >= 5 && real.length < 20, real.length + ' groups');
});
