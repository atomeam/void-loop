// The two objects the will hands across its two seams (lib/will-schema.js): a CANDIDATE the ranking layer may promote, and a BRIEF a
// builder may work from. The point of each assertion: a want that needs a key is never queued for a builder, and a brief always names
// paths and an assertion a builder can be held to, without any of them being invented about the want.
// Run: node --test tools/will-schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHAPES, shapeOf, validateCandidate, fits, promotable, briefOf, validateBrief, outOfScope, audienceOf, DEFAULT_ALLOWED, DEFAULT_TESTS, CORE, shipPolicy, SOURCES, sourceOf, knowledgeOf, validateKnowledge, mergeKnowledge, EARN_KIND, MONEY_BOOST, MONEY_TESTS, moneyCandidate, revenueOf } from '../void-live-deploy/lib/will-schema.js';

test('a want with no shape named is promoted like any other; only a key it named holds it back (2026-10-30)', () => {
  assert.deepEqual(SHAPES, ['edge', 'card', 'keyed', 'unknown']);
  assert.equal(shapeOf(undefined), 'unknown');
  assert.equal(shapeOf(null), 'unknown');
  assert.equal(shapeOf('CARD'), 'card', 'the writer may shout');
  assert.equal(shapeOf('keyed '), 'unknown', 'a shape is a word, not a word with a space in it');
  assert.equal(shapeOf('nonsense'), 'unknown');
  for (const shape of ['edge', 'card', 'unknown', undefined, null]) assert.equal(fits({ shape }).ok, true, 'an unnamed shape is never a reason to hold a want back');
  const k = fits({ shape: 'keyed' });
  assert.equal(k.ok, false);
  assert.equal(k.shape, 'keyed');
  assert.match(k.why, /spend decision/, 'the reason says what the want is waiting for');
  assert.match(fits({ shape: 'edge' }).why, /zero-key/);
  assert.match(fits({ shape: 'card' }).why, /runs in the page/);
});

test('a candidate is ranked only when it carries the fields the ranking layer reads', () => {
  const good = { kind: 'frontier', title: 'answer tide questions', why: 'on the frontier', weight: 40, source: 'frontier' };
  assert.deepEqual(validateCandidate(good), []);
  assert.deepEqual(validateCandidate({ ...good, title: '' }).map((p) => p.field), ['title']);
  assert.deepEqual(validateCandidate({}).map((p) => p.field).sort(), ['kind', 'title', 'weight', 'why']);
  assert.deepEqual(validateCandidate({ ...good, weight: 'heavy' }).map((p) => p.field), ['weight']);
  assert.deepEqual(validateCandidate({ ...good, weight: -1 }).map((p) => p.field), ['weight']);
  assert.deepEqual(validateCandidate({ ...good, cost_cents: -5 }).map((p) => p.field), ['cost_cents']);
  assert.deepEqual(validateCandidate({ ...good, shape: 'keyed-hybrid' }).map((p) => p.field), ['shape']);
  assert.deepEqual(validateCandidate({ ...good, title: 'x'.repeat(161) }).map((p) => p.problem), ['longer than 160']);
  assert.deepEqual(validateCandidate({ ...good, why: 'w'.repeat(241) }).map((p) => p.problem), ['longer than 240']);
  assert.ok(validateCandidate(null).length, 'nothing at all is every field missing');
});

test('the will queues the wants a builder may take and names the ones it held back, in the will own order', () => {
  const wants = [{ title: 'tides', shape: 'edge' }, { title: 'a paid plan', shape: 'keyed' }, { title: 'moons' }];
  const g = promotable(wants);
  assert.deepEqual(g.promote.map((w) => w.title), ['tides', 'moons']);
  assert.deepEqual(g.gated.map((w) => w.title), ['a paid plan']);
  assert.deepEqual(promotable(undefined), { promote: [], gated: [] });
  assert.deepEqual(promotable([{ title: 'only', shape: 'keyed' }]).promote, []);
});

test('a brief names who it is for, the paths a builder may change and the assertion it must pass, all from this repository own policy', () => {
  const w = { title: 'learn to handle "tides"', why: 'asked 3 times, last 2026-10-29', kind: 'people asked', source: 'router' };
  const b = briefOf(w);
  assert.equal(b.want, 'learn to handle "tides"');
  assert.match(b.problem, /^learn to handle "tides" — asked 3 times/, 'the problem is the want and the evidence behind it');
  assert.equal(b.for, 'people asking Verse for this');
  assert.deepEqual(b.allowed, DEFAULT_ALLOWED, 'the non-core write surface');
  assert.deepEqual(b.tests, DEFAULT_TESTS, 'the fast checks every change passes');
  assert.equal(b.station, 'router', 'attribution survives: where the want came in');
  assert.equal(b.v1, 'the smallest change that makes the want true, tested the way it will be used');
  assert.match(b.not_building, /^anything outside the paths below/);
  assert.equal(b.fit.ok, true);
  assert.equal(b.complete, true);
  assert.deepEqual(validateBrief(b), []);
  assert.equal(audienceOf('fix myself'), 'Verse itself');
  assert.equal(audienceOf('frontier'), 'the build order (domains/void.frontier.md)');
  assert.equal(audienceOf('a kind nobody wrote'), 'whoever the want names');
});

test('a want that needs a key gets a brief a builder may not work from yet, and a planner that reaches core files gets the same answer', () => {
  const k = briefOf({ title: 'move to a paid plan', why: 'the free limits are the first wall', kind: 'upgrade myself', shape: 'keyed' });
  assert.equal(k.fit.ok, false);
  assert.equal(k.complete, false, 'a brief nobody may build yet is not a complete one');
  assert.ok(validateBrief(k).some((p) => p.field === 'fit'));

  const core = briefOf({ title: 'a want', why: 'because' }, { allowed: ['void.html'] });
  assert.equal(core.complete, false);
  assert.match(validateBrief(core)[0].problem, /^void\.html: core/);

  const ok = briefOf({ title: 'a want', why: 'because', kind: 'frontier' }, { for: 'the owner', allowed: ['void-live-deploy/skills/tide.js'], tests: ['node --test tools/tide.test.mjs'] });
  assert.equal(ok.for, 'the owner', 'a planner overrides what it knows');
  assert.deepEqual(ok.allowed, ['void-live-deploy/skills/tide.js']);
  assert.equal(ok.complete, true);
});

test('a brief never names a core file, a local path, or nothing at all', () => {
  assert.deepEqual(outOfScope(DEFAULT_ALLOWED), [], 'the defaults sit inside the write surface');
  assert.equal(outOfScope(['void.html']).length, 1);
  assert.equal(outOfScope(['void-live-deploy/functions/api/will.js'])[0].why, 'core: a builder does not change it');
  assert.equal(outOfScope(['void-live-deploy/index.html'])[0].why, 'core: a builder does not change it');
  assert.equal(outOfScope(['.github/workflows/will.yml'])[0].why, 'core: a builder does not change it');
  assert.equal(outOfScope(['AGENTS.md'])[0].why, 'core: a builder does not change it');
  assert.equal(outOfScope(['C:\\Users\\adam\\notes.md'])[0].why, 'not a plain relative path');
  assert.equal(outOfScope(['../outside.md'])[0].why, 'not a plain relative path');
  assert.equal(outOfScope([''])[0].why, 'empty');
  assert.ok(CORE.includes('docs/RULES.md'), 'the rules themselves are core');
  assert.ok(validateBrief({ want: 'w', problem: 'p', for: 'f', station: 's', fit: { ok: true }, allowed: [], tests: DEFAULT_TESTS }).some((p) => p.field === 'allowed'));
  assert.ok(validateBrief({ want: 'w', problem: 'p', for: 'f', station: 's', fit: { ok: true }, allowed: DEFAULT_ALLOWED, tests: [] }).some((p) => p.field === 'tests'));
});

test('the guard and the will agree on what an ended job is, so an abandoned pull request actually waits (owner, 2026-10-30)', () => {
  const guard = readFileSync(new URL('../void-live-deploy/lib/will-guard.js', import.meta.url), 'utf8');
  assert.match(guard, /export const TERMINAL = \[[^\]]*'declined'/, 'a declined job is a terminal state the guard counts');
  const api = readFileSync(new URL('../void-live-deploy/functions/api/will.js', import.meta.url), 'utf8');
  assert.match(api, /state IN \('set aside','failed','declined','deferred'\)/, 'and the will reads the rows the outcome hook writes');
  const checks = readFileSync(new URL('./checks.mjs', import.meta.url), 'utf8');
  assert.match(checks, /\['will-schema', 'will-schema\.test\.mjs'\]/, 'checks.mjs runs this test');
});

test('a complete brief that needs no key of its own goes straight to the site, and one that does not waits (owner, 2026-10-30)', () => {
  const straight = briefOf({ title: 'learn to handle "tides"', why: 'asked 3 times', kind: 'people asked', shape: 'edge' });
  assert.deepEqual(straight.ship, shipPolicy(straight));
  assert.equal(straight.ship.straight, true, 'bounded, tested, key-free and declared edge: nothing to wait for');
  assert.match(straight.ship.why, /straight to the site/);

  const unnamed = briefOf({ title: 'learn to handle "tides"', why: 'asked 3 times', kind: 'people asked' });
  assert.equal(unnamed.ship.straight, false, 'a brief nobody gave a shape does not ship itself: not asked is not yes');
  assert.match(unnamed.ship.why, /shape is unknown/);
  assert.equal(briefOf({ title: 'a card that runs in the page', why: 'because', kind: 'frontier', shape: 'card' }).ship.straight, true, 'a card ships itself too');

  const keyed = briefOf({ title: 'a paid plan', why: 'the free limits', kind: 'upgrade myself', shape: 'keyed' });
  assert.equal(keyed.ship.straight, false);
  assert.match(keyed.ship.why, /spend decision before a build/);

  const core = briefOf({ title: 'a want', why: 'because' }, { allowed: ['void.html'] });
  assert.equal(core.ship.straight, false);
  assert.match(core.ship.why, /not complete/);

  const noTest = briefOf({ title: 'a want', why: 'because' }, { tests: [] });
  assert.equal(noTest.ship.straight, false, 'a change nothing checks does not ship itself');

  assert.deepEqual(shipPolicy(null).straight, false);
  assert.deepEqual(shipPolicy({}).straight, false);
});

test('everything Verse consumes keeps one shape of lesson, a commercial beside an ask, and a thing watched twice is one lesson', () => {
  assert.ok(SOURCES.includes('commercial'), 'a commercial is a source, not a special case');
  assert.ok(SOURCES.includes('video') && SOURCES.includes('page') && SOURCES.includes('image'));
  assert.equal(sourceOf('COMMERCIAL'), 'commercial');
  assert.equal(sourceOf('a kind nobody wrote'), 'other', 'a new kind of thing is kept as other, never dropped');
  assert.equal(sourceOf(undefined), 'other');

  const k = knowledgeOf('a 30 second ad for a tide clock', { from: 'commercial', learned: 'people buy a clock that shows the tide', retain: 'tide clocks sell on a single clear dial', at: '2026-10-30T09:00:00Z' });
  assert.equal(k.id, 'commercial:a-30-second-ad-for-a-tide-clock');
  assert.equal(k.from, 'commercial');
  assert.equal(k.seen, 1);
  assert.deepEqual(validateKnowledge(k), [], 'a lesson is kept when it says what it came from and what it taught');

  assert.ok(validateKnowledge({ ...k, from: 'nonsense' }).some((p) => p.field === 'from'));
  assert.ok(validateKnowledge({ ...k, learned: '' }).some((p) => p.field === 'learned'));
  assert.ok(validateKnowledge({ ...k, at: 'yesterday' }).some((p) => p.field === 'at'));
  assert.ok(validateKnowledge({ ...k, seen: 0 }).some((p) => p.field === 'seen'));
  assert.ok(validateKnowledge({}).length >= 3, 'nothing at all is every field missing');

  const first = mergeKnowledge([], k);
  assert.equal(first.length, 1);
  const again = mergeKnowledge(first, knowledgeOf('a 30 second ad for a tide clock', { from: 'commercial', learned: 'tide clocks sell on a single clear dial', at: '2026-10-31T09:00:00Z' }));
  assert.equal(again.length, 1, 'the same thing consumed again is not a second lesson');
  assert.equal(again[0].seen, 2);
  assert.equal(again[0].at, '2026-10-31T09:00:00Z', 'the newest time is kept');
  assert.equal(again[0].retain, 'tide clocks sell on a single clear dial', 'the lesson already kept is never dropped');

  const two = mergeKnowledge(again, knowledgeOf('a poster in a shop window', { from: 'image', learned: 'tide tables are posted weekly' }));
  assert.equal(two.length, 2);
  assert.equal(two[1].from, 'image');
  assert.deepEqual(mergeKnowledge(null, k), [k], 'an unreadable file starts a new one');
});
test('a want that sells something comes from what Verse consumed, carries its price, and is held to the money path (owner, 2026-10-30)', () => {
  const c = moneyCandidate({ idea: 'a tide clock card people can buy', from: 'commercial', why: 'the ad sold one clear dial', cents: 300, for: 'the tide clock', how: 'one card, one price' });
  assert.equal(c.kind, EARN_KIND);
  assert.equal(EARN_KIND, 'make money');
  assert.equal(c.weight, 12 + MONEY_BOOST, 'worth more than a plain idea of the same evidence');
  assert.ok(c.weight < 40, 'and never above the frontier first item on its own');
  assert.equal(c.source, 'commercial', 'station attribution rides with it');
  assert.equal(c.shape, 'unknown', 'a shape is declared, never assumed by the shaper');
  assert.equal(fits(c).ok, true, 'an unnamed shape is still promotable');
  assert.deepEqual(c.revenue, { cents: 300, for: 'the tide clock', how: 'one card, one price' });
  assert.deepEqual(validateCandidate(c), []);

  const b = briefOf(c);
  assert.equal(b.for, 'people who would pay for it');
  assert.match(b.v1, /someone can pay for/, 'the smallest thing someone can pay for');
  assert.deepEqual(b.tests, MONEY_TESTS, 'a sale that does not land is not done');
  assert.ok(b.tests.includes('node --test tools/sale-e2e.test.mjs'), 'the existing end-to-end sale proof');
  assert.deepEqual(b.price, c.revenue);
  assert.equal(b.complete, true);
  assert.equal(b.ship.straight, false, 'a money want with no declared shape does not ship itself');
  assert.match(b.ship.why, /shape is unknown/);
  assert.equal(briefOf({ ...c, shape: 'card' }).ship.straight, true, 'declared as a card, a money want ships itself');

  assert.equal(revenueOf(null), null);
  assert.equal(revenueOf({ cents: -5 }).cents, 0, 'a price is never below nothing');
  assert.equal(briefOf({ title: 'a plain app idea', why: 'because', kind: 'frontier' }).price, null, 'an idea that sells nothing carries no price');
  assert.deepEqual(briefOf({ title: 'a plain app idea', why: 'because', kind: 'frontier' }).tests, DEFAULT_TESTS);

  const keyed = moneyCandidate({ idea: 'a paid api people subscribe to', from: 'video', cents: 900 });
  const keyedBrief = briefOf({ ...keyed, shape: 'keyed' });
  assert.equal(keyedBrief.ship.straight, false, 'selling something still is not a licence to spend');
  assert.match(keyedBrief.ship.why, /spend decision/);
  assert.ok(validateCandidate({ ...c, revenue: { cents: 'free' } }).some((p) => p.field === 'revenue'));
});