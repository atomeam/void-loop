import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyUpdate, bornFrom, decide, funOf, gamesOf, had, nextTask, scoreFrom } from '../void-live-deploy/lib/game-updates.js';
import { gameDueNow } from './game-updates.mjs';

const live = JSON.parse(readFileSync(new URL('../data/game-updates.json', import.meta.url), 'utf8'));

test('the live book keeps Debris Field and Gap Glide, and the next lap is a different game', () => {
  assert.equal(live.scores['debris-field'].update, 1);
  assert.equal(live.scores['gap-glide'].update, 1);
  const task = nextTask(live);
  assert.equal(task.kind, 'game');
  assert.equal(task.update, 1);
  assert.ok(task.game.id !== 'debris-field' && task.game.id !== 'gap-glide', task.game.id);
  assert.equal(had(live, 'debris-field'), true);
  assert.equal(had(live, task.game.id), false);
});

test('a full cycle makes one original game; it stays hidden under the Debris Field fun and joins the next walk', () => {
  let book = { ...live, scores: { ...live.scores }, picks: { ...live.picks } };
  const seen = new Set();
  while (nextTask(book).kind === 'game' && seen.size < 30) {
    const t = nextTask(book); seen.add(t.game.id);
    book = applyUpdate(book, t.game, { fun: 40, note: 'Update 1: a clearer end', at: 't' });
  }
  assert.equal(nextTask(book).kind, 'invent');
  const made = bornFrom("export const id = 'lumen-drift';\nexport const title = 'Lumen Drift';\nexport const whatsNew = 'Update 1: steer a lamp through dim rooms.';\n", 'void-live-deploy/skills/lumen-drift-rules.js', new Set(Object.keys(book.scores)));
  assert.equal(made.game.id, 'lumen-drift');
  book = applyUpdate(book, made.game, { fun: 10, note: made.note, at: 't2', born: true, cents: 1.5, paid: true });
  assert.equal(book.cycle, 2);
  assert.ok(!book.shown.includes('lumen-drift'), 'under the bar it stays hidden');
  assert.equal(book.scores['lumen-drift'].update, 1);
  assert.equal(book.log.at(-1).cents, 1.5);
  assert.equal(had(book, 'lumen-drift'), false);
  assert.ok(gamesOf(book).some((g) => g.id === 'lumen-drift'));
  book.scores['debris-field'] = { ...book.scores['debris-field'], fun: 60 };
  const shown = applyUpdate(book, made.game, { fun: 90, note: 'Update 2: the last room lights', at: 't3' });
  assert.ok(shown.shown.includes('lumen-drift'));
  assert.equal(funOf(shown, 'debris-field'), 60);
  assert.equal(decide({ before: 40, score: 40 }).ship, true);
  assert.equal(decide({ before: 40, score: 30, attempt: 2 }).retry, false);
  assert.equal(scoreFrom({ danger: 10, goal: 10, boss: 10, juice: 10, phone: 10, fair: 10, end: 10, fun: 10, polish: 10 }), 100);
  assert.match(bornFrom("export const id = 'block-fall'; export const title = 'Tetris Night'; export const whatsNew = 'Update 1: blocks fall in a well.';", 'void-live-deploy/skills/block-fall-rules.js', new Set()).why, /commercial/);
});

test('a game update is due until one has shipped within the hour', () => {
  assert.equal(gameDueNow(live, Date.now()), true);
  assert.equal(gameDueNow({ log: [{ at: new Date().toISOString() }] }, Date.now()), false);
});
