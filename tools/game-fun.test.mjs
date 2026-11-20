import test from 'node:test';
import assert from 'node:assert/strict';
import { funChecks, withResult, BAR } from './game-fun.mjs';
import { checkShelf } from './game-audit.mjs';
import { SHELF, MIN, listed } from '../void-live-deploy/lib/game-shelf.js';

const good = { hook: true, readyMs: 200, startMs: 120, keys: true, touch: true, rises: 30, deadMs: 2000, speedStart: 300, speedEnd: 450, levelStart: 1, levelEnd: 1, failMs: 20000, again: true, audio: true, sounds: 150, fps: 60, errors: 0 };

test('a game that plays well passes; each missing piece of fun is named in plain words', () => {
  assert.deepEqual(funChecks(good), []);
  assert.match(funChecks({ hook: false })[0], /no window.__game/);
  const cases = { keys: false, touch: false, rises: 1, deadMs: 20000, speedEnd: 300, failMs: 99999, again: false, sounds: 2, fps: 30, errors: 1, startMs: 99999 };
  for (const [k, v] of Object.entries(cases)) assert.equal(funChecks({ ...good, [k]: v }).length, 1, k);
  assert.deepEqual(funChecks({ ...good, speedEnd: 300, levelEnd: 2 }), [], 'a new level is getting harder too');
  assert.ok(BAR.fps >= 50 && BAR.rises >= 5);
});

test('the record keeps one result per game with its update', () => {
  const r = withResult({ games: { pong: { pass: false } } }, 'void-breaker', 3, good, [], '2026-11-20');
  assert.equal(r.games['void-breaker'].pass, true); assert.equal(r.games['void-breaker'].update, 3); assert.equal(r.games.pong.pass, false);
});

test('the shelf lists only games marked at least MIN, and the gate wants a passing probe for the current update', () => {
  for (const [id, row] of Object.entries(SHELF)) assert.equal(listed(id), row.score >= MIN, id);
  const man = { games: Object.fromEntries(Object.entries(SHELF).map(([id, r]) => [id, { version: r.update }])) };
  const top = Object.keys(SHELF).filter(listed);
  assert.ok(top.length >= 1 && top.length < Object.keys(SHELF).length, 'some games are held back');
  const pass = { games: Object.fromEntries(top.map((id) => [id, { pass: true, update: SHELF[id].update }])) };
  assert.deepEqual(checkShelf(man, pass), []);
  assert.match(checkShelf(man, {}).join(' '), /without a passing fun probe/);
  assert.match(checkShelf(man, { games: Object.fromEntries(top.map((id) => [id, { pass: false, update: SHELF[id].update }])) }).join(' '), /fun probe/);
  const moved = { games: { ...man.games, [top[0]]: { version: SHELF[top[0]].update + 1 } } };
  assert.match(checkShelf(moved, pass).join(' '), /mark it again/);
});
