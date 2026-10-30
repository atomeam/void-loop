// lib/load-later.js and skills/grip.js: a skill's heavy helpers load on its first run or card, not with the routing order (owner, 2026-10-30).
// loadLater loads once and tries a failed load again; ready.mount draws at once when the helpers are in, and otherwise loads them and
// redraws the stage once for every card that waited; the games and time families load none of the helpers before a game or a sky answer;
// the board's grip lives in its own file and side-card hands on the same function. Run: node --test tools/load-later.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLater } from '../void-live-deploy/lib/load-later.js';
import { grip } from '../void-live-deploy/skills/grip.js';
import { grip as sideGrip } from '../void-live-deploy/skills/side-card.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

test('loadLater: one load for any number of calls, done once it is in, and a failed load is tried again on the next call', async () => {
  let n = 0;
  const ready = loadLater(() => { n++; });
  assert.equal(ready.done, false);
  await Promise.all([ready(), ready(), ready()]);
  assert.equal(n, 1); assert.equal(ready.done, true);
  await ready(); assert.equal(n, 1, 'loaded once');

  let tries = 0;
  const flaky = loadLater(() => { tries++; if (tries === 1) throw new Error('offline'); });
  await assert.rejects(flaky(), /offline/);
  assert.equal(flaky.done, false);
  await flaky(); assert.equal(tries, 2); assert.equal(flaky.done, true);
});

test('ready.mount: draws at once when the helpers are in; before that it loads them and redraws the stage once for all the cards', async () => {
  const drawn = [];
  const mount = (th) => drawn.push(th.id);

  const warm = loadLater(() => {}); await warm();
  warm.mount(mount)({ id: 'a' }, {});
  assert.deepEqual(drawn, ['a'], 'helpers in: the card is drawn in the same call');

  const cold = loadLater(() => tick());
  const things = { b: { id: 'b' }, c: { id: 'c' } };
  let renders = 0;
  const stage = { things: () => things, render: () => { renders++; } };
  const m = cold.mount(mount);
  m(things.b, stage); m(things.c, stage);
  assert.deepEqual(drawn, ['a'], 'nothing is drawn before the helpers are in');
  await cold(); await tick();
  assert.equal(renders, 1, 'one redraw of the stage for the two cards that waited');
  assert.deepEqual(drawn, ['a'], 'the redraw is the page\'s own (placement, tucks, layout), not a second draw here');
  m(things.b, stage);
  assert.deepEqual(drawn, ['a', 'b'], 'after the load the next draw is direct');

  const gone = loadLater(() => tick());
  let renders2 = 0;
  gone.mount(mount)({ id: 'x' }, { things: () => ({}), render: () => { renders2++; } });
  await gone(); await tick();
  assert.equal(renders2, 0, 'a card thrown off the stage meanwhile is not drawn back');

  const bare = loadLater(() => tick());
  bare.mount(mount)({ id: 'd' }, {});
  await bare(); await tick();
  assert.deepEqual(drawn, ['a', 'b', 'd'], 'a stage with no redraw of its own gets the card drawn once the helpers are in');
});

test('the games and time families load no rules engine, 3D lift, almanac or place lookup before a game or a sky answer', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
  const re = /^\s*(?:import|export)\s+(?:[^'"]*?from\s+)?['"](\.{1,2}\/[^'"]+)['"]/mg; // static imports only: import('./x.js') loads later
  const chain = (f, seen = new Set()) => { if (seen.has(f)) return seen; seen.add(f); for (const m of fs.readFileSync(f, 'utf8').matchAll(re)) chain(path.resolve(path.dirname(f), m[1]), seen); return seen; };
  const of = (fam) => new Set([...chain(path.join(root, 'skills', fam + '.js'))].map((x) => path.relative(root, x)));
  const games = of('games'), time = of('time');
  for (const f of ['skills/connect4-rules.js', 'skills/chess-rules.js', 'skills/sorry-rules.js', 'skills/ringer-rules.js', 'skills/monopoly-rules.js', 'skills/lift3d.js',
    'skills/figures.js', 'skills/side-card.js', 'skills/game-level.js', 'skills/game-rules-line.js', 'lib/match-history.js', 'lib/arena-say.js', 'lib/go-ai.js'])
    assert.ok(!games.has(f), 'games loads ' + f + ' with the routing order');
  for (const f of ['lib/astro.js', 'lib/skyfacts.js', 'lib/where.js', 'lib/eclipses.js', 'lib/sky-math.js', 'lib/practice.js', 'skills/live.js'])
    assert.ok(!time.has(f), 'time loads ' + f + ' with the routing order');
  assert.ok(games.has('skills/eightball.js') && games.has('skills/grip.js'), 'the 8 ball card still draws at once: its grip comes with it');
});

test('grip: the board handle from its own file, and side-card hands on the same function', () => {
  const saved = globalThis.document;
  globalThis.document = { createElement: (tag) => ({ tagName: tag, style: {} }) };
  try {
    const g = grip('chess');
    assert.equal(g.className, 'board-grip'); assert.equal(g.textContent, '⠿ chess'); assert.equal(g.title, 'drag to move the board');
    assert.equal(sideGrip, grip, 'one function, two ways in');
  } finally { globalThis.document = saved; }
});
