import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { plan, words, deepLink, filterGraph, TRICKS, MOMENTS, PLATFORMS } from './clips.mjs';
import { landing, onRequestGet } from '../void-live-deploy/functions/c/[clip].js';

test('the day plan: 3 different moments, every trick known, every platform worded with a tracked link', () => {
  const d = plan('2026-10-15');
  assert.equal(d.length, 3); assert.equal(new Set(d.map((x) => x.moment)).size, 3);
  for (const c of d) { for (const t of c.tricks) assert.ok(TRICKS[t], t); for (const p of Object.keys(PLATFORMS)) { assert.ok(c.platforms[p].description.includes('/c/' + c.id + '?p=' + p)); assert.ok(c.platforms[p].title.length <= 100); } }
  assert.equal(d[0].platforms.tiktok.post, 'draft');
});
test('performance steers the plan', () => { assert.equal(plan('2026-10-15', { voidquest: 50 })[0].moment, 'voidquest'); });
test('every moment builds a filter graph with hook, captions and end card', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-'));
  for (const m of MOMENTS) { const g = filterGraph(m, plan('2026-10-15', { [m.id]: 1e9 }, 1)[0].tricks, { dur: 18, dir, beat: 0.5 }); assert.match(g, /\[v\]$/); assert.match(g, /drawtext/); }
});
test('landing: counts only well-formed clips, lands on the ask', () => {
  const u = new URL(deepLink('20261015-clock-mini', 'tiktok', 'what time is it'));
  assert.deepEqual(landing('20261015-clock-mini', u), { ok: true, clip: '20261015-clock-mini', platform: 'tiktok', to: '/?q=what+time+is+it&src=clip' });
  assert.equal(landing('../x', new URL('https://a-to-mind.com/c/x?p=evil')).ok, false);
  assert.equal(landing('20261015-a', new URL('https://a-to-mind.com/c/x?p=evil')).platform, 'other');
});
test('the redirect writes one visit and 302s', async () => {
  const rows = []; const DB = { prepare: (s) => ({ run: async () => {}, bind: (...a) => ({ run: async () => rows.push(a) }) }) };
  const r = await onRequestGet({ request: new Request('https://a-to-mind.com/c/20261015-clock-mini?p=youtube&q=clock'), env: { DB }, params: { clip: '20261015-clock-mini' } });
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/?q=clock&src=clip'); assert.equal(rows.length, 1);
});
