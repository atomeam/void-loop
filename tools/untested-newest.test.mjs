// Small real tests for lib/skills files that had none (docs/multipliers.md #3 ratchet): lib/noise.js, lib/shortfall.js, lib/pages.js,
// skills/dismiss.js, skills/fact.js, skills/scores.js and the calendar hand-off to it (skills/calendar.js).
import test from 'node:test';
import assert from 'node:assert/strict';
const L = '../void-live-deploy/lib/', S = '../void-live-deploy/skills/';

test('lib/noise.js: probes are noise, real asks are not', async () => {
  const { isNoise } = await import(L + 'noise.js');
  for (const a of ['test', 'ping', 'asdfff', 'health check', '/status']) assert.ok(isNoise(a), a);
  for (const a of ['make a timer', 'draw a cat', '']) assert.ok(!isNoise(a) || a === '', a);
});
test('lib/shortfall.js: reasons and the summary line', async () => {
  const { reasonOf, shortfallLine } = await import(L + 'shortfall.js');
  assert.equal(reasonOf(new Error('4006: daily free allocation used')), 'free limit');
  assert.equal(reasonOf('429 too many requests'), 'busy');
  assert.equal(reasonOf(null), 'error');
  assert.match(shortfallLine({ total: 1, by: [{ n: 1, place: 'build', reason: 'busy' }] }), /fell short 1 time in 7 days \(1 build busy\)/);
});
test('lib/pages.js: handles and a cleaned page', async () => {
  const { HANDLE_RE, RESERVED, cleanPage } = await import(L + 'pages.js');
  assert.ok(HANDLE_RE.test('my_page1') && !HANDLE_RE.test('ab') && !HANDLE_RE.test('Bad-Name'));
  assert.ok(RESERVED.has('admin') && RESERVED.has('api'));
  const p = cleanPage({ look: { stars: 'bogus', fx: 'swarm' }, cards: Array.from({ length: 20 }, (_, i) => ({ name: 'c' + i })) });
  assert.equal(p.look.stars, 'off'); assert.equal(p.look.fx, 'swarm'); assert.equal(p.cards.length, 12);
});
test('skills/dismiss.js: only the selected thing goes', async () => {
  const { dismissOf, dismissSelected } = await import(S + 'dismiss.js');
  assert.deepEqual(dismissOf('dismiss this'), { what: 'selected' });
  assert.equal(dismissOf('dismiss the moon'), null);
  assert.equal(dismissSelected({ things: { a: 1 }, selected: null }).removed, false);
  const r = dismissSelected({ things: { a: 1, b: 2 }, selected: 'a' });
  assert.ok(r.removed && !('a' in r.things) && 'b' in r.things);
});
test('skills/fact.js: matches its examples, not its near misses', async () => {
  const f = (await import(S + 'fact.js')).default;
  for (const e of f.examples) assert.ok(f.match(e.toLowerCase(), e), e);
  for (const e of f.nearMisses) assert.ok(!f.match(e.toLowerCase(), e), e);
});
test('skills/scores.js owns score asks; skills/calendar.js leaves them alone but keeps its own', async () => {
  const sc = (await import(S + 'scores.js')).default, cal = (await import(S + 'calendar.js')).default;
  for (const e of sc.examples) { assert.ok(sc.match(e.toLowerCase(), e), e); assert.ok(!cal.match(e.toLowerCase(), e), 'calendar claims ' + e); }
  for (const e of sc.nearMisses) assert.ok(!sc.match(e.toLowerCase(), e), e);
  for (const e of ['call Sam next Tuesday at 4', 'dentist October 12 at 3pm', 'my calendar']) assert.ok(cal.match(e.toLowerCase(), e), e);
});

// the skill contract on more untested skills: each example is taken by its own skill, no near miss is
for (const f of ['skills/pick-for-me.js', 'skills/eat.js', 'skills/automations.js', 'skills/part.js', 'skills/quote.js', 'skills/holidays.js', 'skills/today.js', 'skills/wheel.js', 'skills/pollen.js', 'skills/loan.js']) {
  test(f + ': examples match, near misses do not', async () => {
    const d = (await import(S + f.slice('skills/'.length))).default;
    for (const e of d.examples || []) assert.ok(d.match(e.toLowerCase(), e), 'example not matched: ' + e);
    for (const e of d.nearMisses || []) assert.ok(!d.match(e.toLowerCase(), e), 'near miss matched: ' + e);
  });
}
