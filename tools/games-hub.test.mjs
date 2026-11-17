// games-hub: broad game asks reach one launcher, named games keep their own route.
//   node --test tools/games-hub.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import hubSkill, { hubOf, gamesOf } from '../void-live-deploy/skills/games-hub.js';
import { FAMILIES } from './families.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'void-live-deploy', 'skills');
const NAME = /^(\d+)-([a-z0-9][a-z0-9-]*)$/;
const names = readdirSync(resolve(dir, 'order')).filter((f) => !f.startsWith('.')).map((f) => { const m = NAME.exec(f); return m ? m[2] : null; }).filter(Boolean);
const mods = [];
for (const n of names) { try { mods.push((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default); } catch (_) { /* a skill that cannot load is not the one under test */ } }
const first = (a) => { const k = mods.find((s) => { try { return s.match(a.toLowerCase(), a); } catch (_) { return false; } }); return k ? k.name : null; };

const BROAD = ['games', 'game', 'board games', 'board game', 'arcade', 'play', 'rpg', 'adventure', 'play something', 'what games', 'all games'];

test('hubOf takes the broad game asks and leaves named games alone', () => {
  for (const a of BROAD) assert.equal(hubOf(a), true, a + ' should open the hub');
  for (const a of ['games on tv tonight', 'olympic games', 'box office', 'connect 4', 'debris field', 'the chrono signal', 'chess', 'play chess', 'what is game theory', 'hunger games']) assert.equal(hubOf(a), false, a + ' is not a broad games ask');
  assert.equal(hubOf('  GAMES? '), true);
  assert.equal(hubOf('show me games'), true);
  assert.equal(hubOf('show me the games'), false); // the Game Box keeps its own "show me the games" ask
});

test('the broad asks all route to games-hub in the real order', () => {
  for (const a of BROAD) assert.equal(first(a), 'games-hub', a + ' routed to ' + first(a));
});

test('named game asks keep their own route without collision', () => {
  assert.equal(first('connect 4'), 'games');
  assert.equal(first('debris field'), 'debris-field');
  assert.equal(first('chrono-signal'), 'adventure');
  assert.equal(first('the chrono signal'), 'adventure');
  assert.equal(first('play chess'), 'games');
  assert.equal(first('game box'), 'gamebox');
});

test('the hub reads the generated games family, not a list in the file', () => {
  const src = readFileSync(resolve(dir, 'games-hub.js'), 'utf8');
  assert.match(src, /families\.json/);
  assert.match(src, /guide\.json/);
  for (const pinned of ['connect4', 'debris-field', 'chrono-signal']) assert.equal(src.includes(pinned), false, pinned + ' must not be hardcoded in the hub');
  const fam = { families: [{ id: 'games', skills: [{ name: 'alpha' }, { name: 'beta' }] }] };
  const book = { pages: [{ name: 'alpha', kind: 'skill', chapter: 'games', title: 'Alpha', line: 'A short line', examples: ['play alpha'] }] };
  assert.deepEqual(gamesOf(fam, book), [
    { name: 'alpha', title: 'Alpha', line: 'A short line', say: 'play alpha' },
    { name: 'beta', title: 'beta', line: '', say: 'beta' },
  ]);
});

test('games-hub is in the games family and has a routing-order file', () => {
  const games = FAMILIES.find((f) => f.id === 'games');
  assert.ok(games && games.skills.includes('games-hub'));
  for (const n of ['connect4', 'debris-field', 'adventure', 'games-hub']) assert.ok(games.skills.includes(n), n + ' is missing from the games family');
  assert.ok(readdirSync(resolve(dir, 'order')).includes('0008-games-hub'));
  assert.equal(hubSkill.name, 'games-hub');
});
