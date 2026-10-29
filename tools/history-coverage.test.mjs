// No site is skipped: every site the tower knows stays in its queue, and a site counts as beaten only with a cited history. Run: node --test tools/history-coverage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tower, frontierOf, hostOf, FLOORS } from '../void-live-deploy/lib/tower.js';
import { slugOf } from './site-history.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = (f) => path.join(root, 'void-live-deploy', f);
const rd = (f) => { try { return JSON.parse(fs.readFileSync(site(f), 'utf8')); } catch (_) { return null; } };

test('every frontier site is in the queue: none is dropped', () => {
  const t = tower([], {}, rd('tower.frontier.json'), null, rd('tower.rank.json'), rd('tower.size.json')), ids = new Set(t.floors.map((f) => f.id));
  const missing = frontierOf(rd('tower.frontier.json')).filter((x) => !ids.has(x.host));
  assert.deepEqual(missing.map((x) => x.host), [], 'a frontier site left the queue');
  assert.ok(t.floors.length >= FLOORS.length + frontierOf(rd('tower.frontier.json')).length);
});

test('a beaten floor has a cited history file', () => {
  const ev = rd('tower.evidence.json') || {}, t = tower([], ev.floors || {}, rd('tower.frontier.json'));
  const bare = t.floors.filter((f) => f.beaten).filter((f) => !fs.existsSync(path.join(root, 'docs', 'HISTORY', slugOf(f.site) + '.md')));
  assert.deepEqual(bare.map((f) => f.site), [], 'beaten without a history: run node tools/site-history.mjs <site>');
});
