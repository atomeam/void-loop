// flightconnections.com's two journeys on /flights/routes/ (lists run 20): the floor had none, so both stayed INCOMPLETE and the tower
// kept filing "script the journey" jobs for it. Both are scripted now; this keeps them named for the floor's own journeys and checks
// what they assert without a browser (the browser run is tools/tower-journeys.mjs, from tower-gate.yml).
// Run: node --test tools/flights-journeys.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPTS } from './tower-journeys.mjs';
import { GATE_FLOORS } from './tower-gate.mjs';
import { journeysOf } from '../void-live-deploy/lib/tower-journeys.js';

const ID = 'travel: flightconnections.com';

test('every journey the floor must pass has a script', () => {
  const f = GATE_FLOORS.find((x) => x.id === ID);
  assert.ok(f, 'the floor is measured by the gate');
  for (const j of journeysOf(f)) assert.equal(typeof (SCRIPTS[ID] || {})[j], 'function', j);
});

test('the scripts check a real result and the shared link, not a page load', async () => {
  const calls = [];
  const page = { url: () => 'https://a-to-mind.com/flights/routes/?from=LIS' };
  const text = 'Airports with a nonstop route from Lisbon (LIS) in the June 2014 data, up to 3 h, nearest first.\nMAD Madrid Spain';
  const J = {
    page,
    open: async (p) => calls.push('open ' + p),
    fill: async (s, v) => calls.push('fill ' + s + ' ' + v),
    click: async (s) => calls.push('click ' + s),
    expect: async (t, label) => { const ok = typeof t === 'function' ? t(text) : t.test(text); if (!ok) throw new Error('expected ' + label); calls.push('sees ' + label); return text; },
    shareLink: async () => '/flights/routes/?from=LIS',
  };
  await SCRIPTS[ID]['do the main job and see the result'](J);
  await SCRIPTS[ID]['share the result and reopen it from the link'](J);
  assert.ok(calls.includes('fill #w-h 3'), 'the flight time is set');
  assert.ok(calls.some((c) => /Madrid among them/.test(c)), 'a destination is read off the list');
  assert.ok(calls.includes('open /flights/routes/?from=LIS'), 'the shared link is opened');
  // a link without the airport fails the journey
  await assert.rejects(SCRIPTS[ID]['share the result and reopen it from the link']({ ...J, shareLink: async () => '/flights/routes/' }), /does not carry the airport/);
  // a page with no destinations fails the main journey
  await assert.rejects(SCRIPTS[ID]['do the main job and see the result']({ ...J, expect: async (t, label) => { const ok = typeof t === 'function' ? t('Pick the airport you leave from') : t.test('Pick the airport you leave from'); if (!ok) throw new Error('expected ' + label); } }), /expected/);
});
