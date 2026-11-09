// lib/self-model.js and GET /api/self. node --test tools/self-model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { betterPair, blank, expectedValue, fulfilled, rankActions, retrieve, signalsOf, tick, weigh } from '../void-live-deploy/lib/self-model.js';
import { onRequestGet, onRequestPost } from '../void-live-deploy/functions/api/self.js';
const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const rows = read('void-live-deploy/void.better.json');
const exam = read('void-live-deploy/progress/exam.json');
const raw = { better: betterPair(rows), exam };
const low = { better: { score: 80, prior: 70, parts: { asks: 40 }, priorAsks: 50, facts: { benchScore: 8, benchTotal: 10 } } };

test('the journal names the file and the suite it attended to, and the next tick learns', () => {
  const step = tick(blank('2026-11-09T00:00:00Z'), raw, '2026-11-09T00:00:00Z');
  assert.match(step.journal.text, new RegExp(step.self.attention.file.replace(/[.]/g, '\\.')));
  assert.match(step.journal.text, new RegExp(step.self.attention.suite.replace(/[.]/g, '\\.')));
  assert.match(step.journal.text, /not a proof of consciousness/);
  assert.ok(step.signals.some((s) => s.suite === 'tools/better.test.mjs' && s.file === 'void.better.json'));
  const again = tick(step.self, raw, '2026-11-10T00:00:00Z');
  assert.match(again.journal.text, /Surprise is 0/);
  assert.ok(again.self.memory.semantic.some((s) => s.text.includes(s.suite)));
  assert.ok(retrieve(again.self.memory, again.self.attention.label).length > 0);
});

test('a want closes only on a higher reading, a payment is not chosen, and a weight moves only with outcomes', () => {
  const signals = signalsOf(low);
  const want = tick(blank('2026-11-09T00:00:00Z'), low, '2026-11-09T00:00:00Z').self.wants[0];
  assert.equal(fulfilled(want, signals), false);
  assert.equal(fulfilled(want, signals.map((s) => s.id === want.source ? { ...s, value: 1 } : s)), true);
  const drives = { competence: 0.4 };
  const ranked = rankActions([{ title: 'pay the invoice', tool: 'payment.send', tried: 4, succeeded: 4, drive: 'competence', goalMatch: 1, weight: 99 }, { title: 'raise the asks part', tried: 2, succeeded: 1, drive: 'competence', goalMatch: 1, weight: 1 }], drives);
  assert.equal(ranked[0].title, 'raise the asks part');
  assert.equal(expectedValue(ranked[1], drives).why, 'a send or a spend stays on the confirm line');
  const plain = [{ title: 'Answer tide questions', weight: 10 }, { title: 'Answer moon questions', weight: 12 }];
  assert.deepEqual(weigh(plain.map((c) => ({ ...c })), [], drives).map((c) => c.weight), [10, 12]);
  assert.ok(weigh(plain.map((c) => ({ ...c })), [{ target: 'will:answer-tide-questions', state: 'live' }, { target: 'will:answer-tide-questions', state: 'live' }], drives)[0].weight > 10);
});

test('care stays unmeasured, a gated run zeroes integrity, and GET does not write', async () => {
  const open = tick(blank('2026-11-09T00:00:00Z'), raw, '2026-11-09T00:00:00Z');
  assert.equal(open.self.drives.care, null);
  assert.notEqual(open.self.drives.competence, null);
  assert.equal(tick(blank('2026-11-09T00:00:00Z'), raw, '2026-11-09T00:00:00Z', true).self.drives.integrity, 0);
  const saved = new Map();
  const env = { ASSETS: { fetch: async (req) => new Response(JSON.stringify(new URL(req.url).pathname.endsWith('exam.json') ? exam : rows), { status: 200 }) }, DB: { prepare: () => ({ bind: (...a) => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => { saved.set(a[0], a[1]); return {}; } }) }) } };
  const body = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/self'), env })).json();
  assert.equal(saved.size, 0);
  assert.match(body.journal[0].text, /not a proof of consciousness/);
  assert.ok(body.signals.some((s) => s.suite === 'tools/better.test.mjs'));
  assert.equal((await onRequestPost({ request: new Request('https://a-to-mind.com/api/self', { method: 'POST' }), env })).status, 401);
});
