// pulse (skills/pulse.js): which asks open the pulse card (and the medical and electronics ones it leaves), the card markup pulseHtml() draws for a
// steady, a stalled and a too-short rhythm (the twelve 5-second bars, the count, the verdict), and run(): summon once, then centre the card already there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pulse, { pulseOf, pulseHtml } from '../void-live-deploy/skills/pulse.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const every5s = (from, n) => Array.from({ length: n }, (_, i) => ({ at: from + i * 5000, from: 'timer', to: 'note' }));
const aria = (h) => (h.match(/aria-label="pulses per 5 seconds over the last minute: ([^"]+)"/) || [])[1];
const line = (h) => (h.match(/<div class="pulse-line" data-pulse="([^"]+)">([^<]+)<\/div>/) || []).slice(1);

test('examples taken, near misses refused, and a few more asks', () => {
  for (const e of pulse.examples) assert.ok(pulse.match(e.toLowerCase(), e), e);
  for (const n of pulse.nearMisses) assert.ok(!pulse.match(n.toLowerCase(), n), n);
  for (const a of ['Open the pulse card!', 'give me the rhythm of my arrows', 'arrow pulse', 'add a pulse card']) assert.ok(pulseOf(a), a);
  for (const a of ['pulse rate', 'show the pulse of the market', 'what is my pulse', 'pulse check on the team']) assert.ok(!pulseOf(a), a);
});

test('a steady rhythm: six pulses 5 s apart fill six bars and read steady', () => {
  const now = 100000, h = pulseHtml(esc, every5s(70000, 6), now);
  assert.equal(aria(h), '0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0');
  assert.deepEqual(line(h), ['steady', '6 in the last minute · steady']);
  assert.equal((h.match(/<rect /g) || []).length, 12);
  assert.equal((h.match(/height="38"/g) || []).length, 6); // the full bars, each the tallest
});

test('a stall: the same pulses 35 s later read irregular, with why', () => {
  const h = pulseHtml(esc, every5s(70000, 6), 130000);
  assert.deepEqual(line(h), ['stall', '5 in the last minute · irregular (stall): no pulse for 35 s, when they usually come every 5 s']);
  assert.equal(aria(h), '1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0');
});

test('too few to call, and none at all', () => {
  assert.deepEqual(line(pulseHtml(esc, every5s(90000, 3), 100000)), ['few', '3 in the last minute · too few to call the rhythm yet (needs 5)']);
  const h = pulseHtml(esc, [], 100000);
  assert.deepEqual(line(h), ['few', '0 in the last minute · too few to call the rhythm yet (needs 5)']);
  assert.equal(aria(h), '0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0');
});

test('run: summons the card once and says so; a second ask centres the one already on the stage; other asks do nothing', async () => {
  const calls = [], things = {};
  const api = { stage: { things: () => things, center: (id) => calls.push(['center', id]), render: () => calls.push(['render']) }, summon: (k, at) => calls.push(['summon', k, at]), say: (t) => calls.push(['say', t]) };
  assert.equal(await pulse.run('show the pulse', api), 'pulse');
  assert.deepEqual(calls, [['summon', 'pulse', { x: 40, y: 80 }], ['say', 'the pulse of your living arrows · it fills as things hand values along arrows']]);
  things.p1 = { id: 'p1', kind: 'pulse' }; calls.length = 0;
  assert.equal(await pulse.run('pulse card', api), 'pulse'); assert.deepEqual(calls, [['center', 'p1']]);
  calls.length = 0; assert.equal(await pulse.run('take my pulse', api), 'none'); assert.deepEqual(calls, []);
});
