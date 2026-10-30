// The chat-fill skills (skills/notes-fill.js, calendar-fill.js, recipes-fill.js, generators-fill.js) and their card (lib/fill-card.js): each takes its examples and
// none of its near misses on an empty device, and the card module loads.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
for (const name of ['notes-fill', 'calendar-fill', 'recipes-fill', 'generators-fill']) {
  test(name + ' takes its examples and not its near misses', async () => {
    const sk = (await import('../void-live-deploy/skills/' + name + '.js')).default;
    for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), 'example: ' + e);
    for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), 'near miss: ' + n);
    assert.equal(typeof sk.run, 'function');
  });
}
test('the shared card module loads and exports its drawing', async () => { assert.equal(typeof (await import('../void-live-deploy/lib/fill-card.js')).drawFill, 'function'); });
