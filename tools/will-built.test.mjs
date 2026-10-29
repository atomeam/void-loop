// the wants card never lists a want the ledger already names as built (owner, 2026-10-21; lib/voice.js splitBuilt)
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { splitBuilt } from '../void-live-deploy/lib/voice.js';
const ledger = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url)));
const links = (JSON.parse(fs.readFileSync(new URL('../void-live-deploy/void.asks.json', import.meta.url))).links) || [];
test('built wants move to got; a new one stays', () => {
  const wants = [
    { title: "Fix the router so 'open the self card' triggers the look skill instead of a text answer", i_want: 'I want to fix the router' },
    { title: "Add a 'velocity' indicator to the wants card to show progress from 'want' to 'skill'", i_want: 'I want a velocity indicator' },
    { title: 'A tide chart for coastal towns with hourly heights and moon phase', i_want: 'I want a tide chart' },
  ];
  const s = splitBuilt(wants, ledger, links);
  assert.deepEqual(s.open.map((w) => w.i_want), ['I want a tide chart']);
  assert.equal(s.got.length, 2); assert.ok(s.got.every((g) => /^\d{4}-\d\d-\d\d$/.test(g.builtAt)));
});
