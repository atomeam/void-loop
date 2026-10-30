// lib/prizes.js: slices, odds, expected value, 1 - (1 - p)^N, the seeded 1,000-spin check and the reward drip
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSlices, parseSlice, slicesText, labelsOf, odds, atLeastOnce, spinsFor, pick, seeded, secureRandom, simulate, drip, NEVER, PRESETS, DEFAULT_PRESET, stateOf, queryOf, csvOf, pct, money } from '../void-live-deploy/lib/prizes.js';

test('slices: Label:value:weight, Label:value, wheel weights, and plain labels worth 1 with weight 1 (never NaN)', () => {
  assert.deepEqual(parseSlices('TV:500:1\nMug:5:20'), [{ label: 'TV', value: 500, weight: 1 }, { label: 'Mug', value: 5, weight: 20 }]);
  assert.deepEqual(parseSlice('Gift card:$25'), { label: 'Gift card', value: 25, weight: 1 });
  assert.deepEqual(parseSlices('Alice\nBob'), [{ label: 'Alice', value: 1, weight: 1 }, { label: 'Bob', value: 1, weight: 1 }]);
  assert.deepEqual(parseSlices('Pizza *3\nTacos x2\nRoom 101'), [{ label: 'Pizza', value: 1, weight: 3 }, { label: 'Tacos', value: 1, weight: 2 }, { label: 'Room 101', value: 1, weight: 1 }]);
  assert.deepEqual(parseSlices('a, b ,c').map((s) => s.label), ['a', 'b', 'c'], 'one line splits on commas, like the wheel');
  assert.deepEqual(parseSlice('Prize: a TV'), { label: 'Prize: a TV', value: 1, weight: 1 }, 'a colon in a label is kept');
  assert.deepEqual(parseSlice('x:abc:def'), { label: 'x:abc:def', value: 1, weight: 1 });
  assert.equal(parseSlice('  '), null);
  const o = odds(parseSlices('Alice\nBob\nCarol\nDave'));
  for (const r of o.rows) for (const v of [r.value, r.weight, r.p, r.ev]) assert.ok(Number.isFinite(v), 'no NaN: ' + JSON.stringify(r));
  assert.equal(o.ev, 1); assert.equal(o.rows[0].p, 0.25);
  assert.equal(slicesText(parseSlices('TV:500:1')), 'TV:500:1');
});

test('the labels sent on to the wheel and the roster lose their :value:weight', () => {
  assert.deepEqual(labelsOf(parseSlices('Grand prize:500:1\nTote bag:10:39\nThanks:0:950')), ['Grand prize', 'Tote bag', 'Thanks']);
});

test('odds: chance by weight, EV per slice and in all, net of the cost, the top prize by value', () => {
  const o = odds(parseSlices(PRESETS.raffle.slices), 2);
  assert.equal(o.total, 1000); assert.equal(o.rows[0].p, 0.001);
  assert.ok(Math.abs(o.ev - 1.39) < 1e-12, String(o.ev)); assert.ok(Math.abs(o.net + 0.61) < 1e-12);
  assert.equal(o.rows[o.top].label, 'Grand prize'); assert.equal(o.topP, 0.001);
  assert.equal(odds([]).ev, 0); assert.equal(odds([]).top, -1);
  assert.equal(odds(parseSlices('a:5:0\nb:1:1')).top, 1, 'a slice that can never land is not the top prize');
});

test('P(at least once in N) = 1 - (1 - p)^N, and the spins for even odds', () => {
  assert.ok(Math.abs(atLeastOnce(0.001, 1000) - (1 - 0.999 ** 1000)) < 1e-12);
  assert.ok(Math.abs(atLeastOnce(0.5, 2) - 0.75) < 1e-15);
  assert.equal(atLeastOnce(0, 1e6), 0); assert.equal(atLeastOnce(1, 1), 1); assert.equal(atLeastOnce(0.3, 0), 0);
  assert.equal(spinsFor(0.5), 1); assert.equal(spinsFor(0.001), 693); assert.equal(spinsFor(0), Infinity);
});

test('pick: each slice wins exactly its weight over an even spread', () => {
  const s = parseSlices('a:1:1\nb:1:2\nc:1:7\nz:9:0'), wins = [0, 0, 0, 0], N = 10000;
  for (let k = 0; k < N; k++) wins[pick(s, (k + 0.5) / N)]++;
  assert.deepEqual(wins, [1000, 2000, 7000, 0]);
  assert.equal(pick([], 0.5), -1); const u = secureRandom(); assert.ok(u >= 0 && u < 1);
});

test('?seed= makes the 1,000-spin check repeatable and its distribution matches the odds', () => {
  const s = parseSlices(PRESETS.loot.slices);
  const a = simulate(s, 1000, seeded('42')), b = simulate(s, 1000, seeded('42')), c = simulate(s, 1000, seeded('43'));
  assert.deepEqual(a.counts, b.counts, 'same seed, same spins'); assert.notDeepEqual(a.counts, c.counts, 'another seed, other spins');
  assert.equal(a.counts.reduce((x, y) => x + y, 0), 1000);
  assert.ok(a.chi2 < 16.27, 'chi-square on 3 df under the 0.1% line: ' + a.chi2); // a fair draw fails this one time in a thousand
  for (const r of a.rows) assert.ok(Math.abs(r.got - r.expected) < 4 * Math.sqrt(r.expected * (1 - r.p)) + 1, r.label);
  const big = simulate(parseSlices('a:1:1\nb:0:3'), 100000, seeded('x'));
  assert.ok(Math.abs(big.mean - 0.25) < 0.01, String(big.mean));
});

test('drip: spins, hours and days to the cashout; EV 0 or a cooldown of 0 or less never reaches it (no Infinity)', () => {
  const d = drip({ ev: 0.0037, cooldownMin: 60, cashout: 5 });
  assert.equal(d.spins, 1352); assert.equal(d.hours, 1352); assert.ok(Math.abs(d.days - 1352 / 24) < 1e-9);
  const r = drip({ ev: 0.0037, cooldownMin: 60, cashout: 5, referralPct: 10, referrals: 3 });
  assert.equal(r.spins, Math.ceil(5 / (0.0037 * 1.3)));
  for (const bad of [{ ev: 0, cooldownMin: 60, cashout: 5 }, { ev: 1, cooldownMin: 0, cashout: 5 }, { ev: 1, cooldownMin: -5, cashout: 5 }, { ev: -1, cooldownMin: 5, cashout: 5 }, { ev: NaN, cooldownMin: 5, cashout: 5 }]) {
    const x = drip(bad); assert.equal(x.never, true); assert.equal(x.text, 'Never reaches cashout ($0 expected value per spin)'); assert.equal(x.text, NEVER);
    assert.ok(!JSON.stringify(x).includes('Infinity') && !JSON.stringify(x).includes('null'));
  }
  assert.equal(drip({ ev: 1, cooldownMin: 5, cashout: 0 }).spins, 0);
});

test('presets: raffle by default, each one parses, the faucet audit pays a 10% referral', () => {
  assert.equal(DEFAULT_PRESET, 'raffle'); assert.deepEqual(Object.keys(PRESETS), ['raffle', 'punch', 'loot', 'faucet']);
  for (const [k, P] of Object.entries(PRESETS)) { const s = parseSlices(P.slices); assert.ok(s.length >= 2, k); assert.ok(odds(s).ev > 0, k); assert.ok(!drip({ ev: odds(s).ev, cooldownMin: P.cd, cashout: P.min }).never, k); }
  assert.equal(PRESETS.faucet.ref, 10);
  assert.equal(stateOf('').preset, 'raffle');
});

test('the link holds the state: only what differs from the preset, a clean seed, numbers kept in range', () => {
  const st = stateOf('?preset=loot&s=' + encodeURIComponent('A\nB') + '&cd=0&seed=4%3C2&n=abc');
  assert.equal(st.preset, 'loot'); assert.equal(st.slices, 'A\nB'); assert.equal(st.cd, 0); assert.equal(st.seed, '42'); assert.equal(st.n, PRESETS.loot.n);
  assert.equal(queryOf(stateOf('')), ''); assert.equal(queryOf(st), 'preset=loot&s=A%0AB&cd=0&seed=42');
  assert.deepEqual(stateOf('?' + queryOf(st)), st);
});

test('CSV: one row a slice, formula-looking cells defused; formatting', () => {
  const csv = csvOf(parseSlices('=HYPERLINK("x"):1:1\nb:1:1'), 0, 10);
  assert.match(csv, /^slice,value,weight,chance,ev_per_spin,at_least_once_in_10\n"'=HYPERLINK\(""x""\)",1,1,0\.50000000/);
  assert.equal(pct(0.001), '0.1%'); assert.equal(pct(0.5), '50%'); assert.equal(money(1.39), '$1.39'); assert.equal(money(0.0037), '$0.0037');
});
