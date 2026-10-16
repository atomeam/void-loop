import test from 'node:test';
import assert from 'node:assert/strict';
import { stale, retestOne, plan, summary, RETEST_DAYS } from './retest.mjs';

test('the skills due a re-test: no last_tested, or one older than 7 days; the never-tested first, then the oldest', () => {
  const fam = { families: [{ skills: [{ name: 'a', last_tested: '2026-10-16' }, { name: 'b', last_tested: '2026-10-08' }, { name: 'c' }, { name: 'd', last_tested: '2026-10-09' }, { name: 'e', last_tested: 'soon' }] }] };
  assert.deepEqual(stale(fam, '2026-10-16').map((s) => s.name), ['c', 'e', 'b'], 'd is exactly 7 days old: not yet; a bad date is as good as none');
  assert.deepEqual(stale(fam, '2026-10-16')[2], { name: 'b', last_tested: '2026-10-08', days: 8 });
  assert.equal(RETEST_DAYS, 7);
  assert.deepEqual(stale(null, '2026-10-16'), []);
});

test('one re-test: examples must route to the skill, near misses must not, its unit test must pass; everything that failed is said', () => {
  const mod = { name: 'tide', examples: ['tide tables', 'high tide'], nearMisses: ['tide pod'] };
  const first = (a) => (a === 'high tide' ? 'weather' : a === 'tide pod' ? 'tide' : 'tide');
  const r = retestOne(mod, first, () => ({ file: 'tide.test.mjs', ok: false, out: 'not ok 1 - the moon' }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.failing, ['"high tide" -> weather', 'near miss "tide pod" taken', 'tools/tide.test.mjs failed: not ok 1 - the moon']);
  assert.deepEqual(retestOne(mod, () => 'tide', () => null), { ok: false, failing: ['near miss "tide pod" taken'], test: null });
  assert.deepEqual(retestOne({ name: 'x', examples: ['y'] }, () => 'x', () => ({ file: 'x.test.mjs', ok: true, out: '' })), { ok: true, failing: [], test: 'x.test.mjs' });
});

test('a failed re-test becomes one retest:<skill> job with the skill\'s own failing example as the ask; none while one is open; never twice', () => {
  const results = { tide: { ok: false, failing: ['"high tide" -> weather'], test: null }, clock: { ok: true, failing: [], test: null }, moon: { ok: false, failing: ['tools/moon.test.mjs failed: x'], test: 'moon.test.mjs' } };
  const mods = { tide: { examples: ['tide tables', 'high tide'] }, moon: { examples: ['moon tonight'] } };
  const p = plan(results, { items: [] }, mods);
  assert.deepEqual(p.queue.map((j) => [j.target, j.ask]), [['retest:tide', 'high tide']], 'one at a time, the failing example as the ask');
  assert.deepEqual(p.later.map((j) => [j.target, j.ask]), [['retest:moon', 'moon tonight']], 'no routing failure: the first example');
  assert.match(p.queue[0].note, /daily re-test failed/);
  assert.deepEqual(plan(results, { items: [{ target: 'retest:clock', state: 'building', ask: 'x' }] }, mods).queue, [], 'a retest job is open');
  assert.deepEqual(plan(results, { items: [{ target: 'retest:tide', state: 'live', ask: 'high tide' }] }, mods).queue.map((j) => j.target), ['retest:moon'], 'a job already made for the skill is not repeated');
  assert.deepEqual(plan({}, { items: [] }), { open: 0, queue: [], later: [] });
  assert.match(summary({ due: [{ name: 'tide' }], results, queued: p.queue, dry: false }), /`retest:tide`/);
  assert.match(summary({ due: [], results: {}, queued: [], dry: true }), /none \(dry\)/);
});
