import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fromMisses, fromGaps, rank, mostWanted, publicForm } from '../void-live-deploy/lib/demand.js';
import { next } from './quality-create.mjs';

const pages = [{ path: '/bestiary/', title: 'Animal guide', about: 'Pictures and facts about animals like the snail' }];
test('the same ask typed by many people adds up, and a secret-looking ask is dropped', () => {
  const items = fromMisses([{ ask: 'Snail animal facts', count: 2 }, { ask: 'snail   animal facts!', count: 3 }, { ask: 'quantum chess', count: 1 }, { ask: 'unlock abc', count: 9 }], (a) => (/^unlock/.test(a) ? null : a));
  assert.equal(items.length, 2); assert.equal(rank(items)[0].count, 5);
});
test('only open rows of the gaps list count, as one person each', () => {
  const md = '| # | Ask | Seen | Done when | State |\n| 1 | remove duplicate lines | seen | done | verified live |\n| 2 | what is my bmi | seen | card | open |';
  const g = fromGaps(md); assert.equal(g.length, 1); assert.equal(g[0].ask, 'what is my bmi');
});
test('the most wanted is next, a page that already does it is extended, and the public form hides rare asks', () => {
  const p = mostWanted(fromMisses([{ ask: 'snail animal facts', count: 6 }, { ask: 'quantum chess', count: 3 }]), pages);
  assert.equal(p.ask, 'snail animal facts'); assert.equal(p.extend, '/bestiary/');
  assert.equal(mostWanted(fromMisses([{ ask: 'quantum chess', count: 3 }]), pages).extend, null);
  assert.equal(publicForm({ ask: 'quantum chess', count: 3, source: 's', extend: null }).want, 'quantum chess');
  assert.match(publicForm({ ask: 'my private thing', count: 1, source: 's', extend: null }).want, /typed 1 time$/);
  assert.equal(mostWanted([], pages), null);
});
test('next reads the misses and the gaps, records the pick, and says plainly when the board is unreadable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qc-')), boardFile = path.join(dir, 'b.json'); fs.writeFileSync(boardFile, JSON.stringify({ id: 'quality' }));
  const md = '| 1 | what is my bmi | s | d | open |';
  const ok = await next({ env: { VOID_MISSES_TOKEN: 't' }, fetchFn: async () => ({ ok: true, json: async () => [{ ask: 'quantum chess', count: 4 }] }), pages, gapsMd: md, boardFile });
  assert.equal(ok.pick.want, 'quantum chess'); assert.equal(JSON.parse(fs.readFileSync(boardFile, 'utf8')).next.pick.count, 4);
  const none = await next({ env: {}, pages, gapsMd: md, boardFile }); assert.match(none.note, /no VOID_MISSES_TOKEN/); assert.equal(none.pick.count, 1); assert.equal(none.pick.source, 'gaps list');
});
