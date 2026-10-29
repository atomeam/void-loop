// tilt-arena-mode (skills/tilt-arena-mode.js): the words that reach a Tilt Arena mode by name. Which asks it takes (and which it leaves to the
// modes' own skills), what run() does with each: the list page, a mode opened by its own ask, "show me an arena", and "save the arena" sealing
// the arena on the stage or opening Tilt Arena when there is none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/tilt-arena-mode.js';
import { MODES } from '../void-live-deploy/lib/tilt-arena-modes.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function apiOf(things = {}) {
  const log = { summoned: [], said: [], pages: [] };
  return { log, api: { esc, stage: { things: () => things, render() {} }, summon: (k, o) => log.summoned.push(k), say: (s) => log.said.push(s),
    showPage: (fill) => { const p = { innerHTML: '' }; fill(p); log.pages.push(p.innerHTML); } } };
}

test('the asks: examples, near misses, and a mode\'s own words stay that mode\'s', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['what modes does tilt arena have', 'list the arena modes', 'switch tilt arena to gpu', 'tilt arena in the finger mode', 'play the arena', 'let us an arena', 'seal the arena leader', 'keep my tilt arena', 'Save this arena!']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['tilt arena', 'gaze chase', 'gaze arena', 'gpu swarm', 'hand arena', 'tilt arena dance', 'save the world', 'show me an arena of lions']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
});
test('"tilt arena modes" lists the four modes, each with its own ask and its "tilt arena <mode>" ask', async () => {
  globalThis.innerWidth = 1000; const { log, api } = apiOf();
  assert.equal(await sk.run('tilt arena modes', api), 'tilt-arena-mode'); assert.equal(log.pages.length, 1); assert.equal(log.summoned.length, 0);
  const h = log.pages[0]; assert.match(h, /^<h2>Tilt Arena modes<\/h2><p>Tilt Arena is one game with 4 ways to steer\./);
  assert.equal((h.match(/<li>/g) || []).length, 4);
  for (const m of MODES) { assert.ok(h.includes('<b>' + m.title + '</b>'), m.title); assert.ok(h.includes('data-ask="' + m.ask + '"'), m.ask); assert.ok(h.includes('data-ask="tilt arena ' + m.name.toLowerCase() + '"'), m.name); }
  assert.ok(h.includes('where that isn&#39;t available') && !h.includes("isn't"), 'text goes through the page escaper, not raw');
});
test('a mode by name opens that mode exactly as its own ask does', async () => {
  globalThis.innerWidth = 1000;
  for (const [ask, kind] of [['tilt arena gaze', 'gaze-chase'], ['tilt arena in hand mode', 'hand-arena'], ['swarm arena', 'gpu-swarm'], ['tilt arena gpu swarm', 'gpu-swarm'], ['switch tilt arena to classic', 'tilt-mode'], ['open the tilt arena on eyes mode', 'gaze-chase']]) {
    const { log, api } = apiOf(); assert.equal(await sk.run(ask, api), kind, ask); assert.deepEqual(log.summoned, [kind], ask);
  }
  const { log, api } = apiOf(); assert.equal(await sk.run('tilt arena dance', api), 'none'); assert.equal(log.summoned.length, 0);
});
test('"show me an arena" opens Tilt Arena', async () => {
  for (const ask of ['show me an arena', 'give us the agent arena', 'start an arena']) { const { log, api } = apiOf(); assert.equal(await sk.run(ask, api), 'tilt-mode', ask); assert.deepEqual(log.summoned, ['tilt-mode']); }
});
test('"save the arena" presses Seal on the arena card on the stage, and opens one when there is none', async () => {
  const pressed = [], asked = []; globalThis.CSS = { escape: (s) => s.replace(/"/g, '\\"') };
  globalThis.document = { querySelector: (sel) => { asked.push(sel); return { click: () => pressed.push(sel) }; } };
  let { log, api } = apiOf({ a: { id: 'c1', kind: 'chess' }, b: { id: 'g"2', kind: 'gpu-swarm' } });
  assert.equal(await sk.run('save the arena', api), 'tilt-arena-mode');
  assert.deepEqual(asked, ['.field-card[data-id="g\\"2"] .ff-seal']); assert.deepEqual(pressed, asked); assert.equal(log.summoned.length, 0);
  assert.equal(log.said[0], "Saving the arena's leader: only its genome's numbers are sealed on this device.");
  globalThis.document = { querySelector: () => null }; ({ log, api } = apiOf({ b: { id: 'g2', kind: 'hand-arena' } }));
  assert.equal(await sk.run('seal the arena leader', api), 'tilt-arena-mode'); assert.deepEqual(log.summoned, ['tilt-mode'], 'the card was not on the page: a fresh Tilt Arena');
  ({ log, api } = apiOf({ a: { id: 'c1', kind: 'chess' } }));
  assert.equal(await sk.run('keep my arena', api), 'tilt-arena-mode'); assert.deepEqual(log.summoned, ['tilt-mode']);
  assert.match(log.said.at(-1), /^There was no arena on the stage, so here is Tilt Arena\./);
});
