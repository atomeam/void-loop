// tools/site-test.mjs: the verdicts, the never-twice rules and the one-improvement-per-run choice, on fakes (no browser).
import assert from 'node:assert/strict';
import { judge, changedText, onceEach, robotsAllows, checkSteps, improve, inventory, variants, plan, remember } from './site-test.mjs';

let n = 0; const t = (name, f) => { f(); n++; };
t('a refusal fails', () => assert.equal(judge({ ask: 'x' }, { text: "I don't know this yet" }).ok, false));
t('an ask no skill caught fails', () => assert.match(judge({ ask: 'x' }, { text: 'x\nthinking…' }).why[0], /no skill/));
t('a good answer passes', () => assert.equal(judge({ ask: 'what are you?', expect: { text: 'V01D' } }, { text: 'I am V01D' }).ok, true));
t('console errors fail', () => assert.match(judge({ ask: 'x' }, { text: 'hi', errors: ['boom'] }).why[0], /console/));
t('fps floor', () => assert.equal(judge({ ask: 'x', fps: true }, { text: 'hi', fps: 12 }, { fpsMin: 20 }).ok, false));
t('missing selector', () => assert.equal(judge({ ask: 'x', expect: { selector: '.c' } }, { text: 'hi', selector: false }).ok, false));
t('same key for same failure', () => assert.equal(judge({ ask: 'x', fps: true }, { text: 'a', fps: 12 }, { fpsMin: 20 }).key, judge({ ask: 'x', fps: true }, { text: 'a', fps: 9 }, { fpsMin: 20 }).key));
t('never the same ask twice', () => assert.deepEqual(onceEach([{ ask: 'A' }, { ask: 'a ' }, { ask: 'b' }]).map((c) => c.ask), ['A', 'b']));
t('robots', () => { const r = 'User-agent: *\nDisallow: /api/\nAllow: /api/ok'; assert.equal(robotsAllows(r, '/api/x'), false); assert.equal(robotsAllows(r, '/api/ok'), true); assert.equal(robotsAllows(r, '/'), true); assert.equal(robotsAllows('', '/x'), true);
  assert.equal(robotsAllows('User-agent: other\nDisallow: /', '/'), true); });
t('steps refuse submit and unknown kinds', () => { assert.match(checkSteps([{ do: 'press' }]), /one of/); assert.match(checkSteps([{ do: 'click', selector: 'button[type=submit]' }]), /never/); assert.equal(checkSteps([{ do: 'goto', url: '/' }, { do: 'expect', text: 'hi' }]), ''); });

const suite = { limits: { fpsMin: 20, loadMs: 15000 }, cases: [{ ask: 'a' }], candidates: ['b'] };
const ok = (ask, x = {}) => ({ ask, ok: true, why: [], key: ask + ' | ', chars: 50, ...x });
t('a new failure is filed once', () => { const r = [{ ask: 'a', ok: false, why: ['refused'], key: 'a | refused' }];
  assert.equal(improve(r, suite).kind, 'file'); assert.notEqual(improve(r, suite, ['a | refused']).kind, 'file'); });
t('a missed new wording is taught first, once', () => { const r = [{ ask: 'yo calculator', ok: false, why: ['refused'], key: 'k', probe: true, variant: true, base: 'calculator', feature: 'skill:calc' }];
  const a = improve(r, suite); assert.equal(a.kind, 'teach'); assert.equal(a.suite.teach[0].means, 'calculator'); assert.notEqual(improve(r, suite, [a.key]).kind, 'teach'); });
t('a console error on a new wording is a fix, not a teach', () => assert.equal(improve([{ ask: 'yo x', ok: false, why: ['console: boom'], key: 'k2', probe: true, variant: true, base: 'x', feature: 'skill:x' }], suite).kind, 'file'));
t('new ground that passed becomes a regression case', () => { const a = improve([ok('a'), ok('pull up calculator', { probe: true, feature: 'skill:calc' })], suite); assert.equal(a.kind, 'grow'); assert.equal(a.suite.cases.at(-1).ask, 'pull up calculator'); });
t('all green grows by a candidate', () => { const a = improve([ok('a')], suite); assert.equal(a.kind, 'grow'); assert.deepEqual(a.suite.candidates, []); });
t('then tightens fps', () => { const a = improve([ok('a', { fps: 60 })], { ...suite, candidates: [] }); assert.equal(a.kind, 'tighten'); assert.equal(a.suite.limits.fpsMin, 54); });
t('then load', () => { const a = improve([ok('a', { loadMs: 2000 })], { ...suite, candidates: [] }); assert.equal(a.suite.limits.loadMs, 2500); });
t('then files the weakest answer once', () => { const s = { limits: {}, cases: [], candidates: [] }; const a = improve([ok('a', { chars: 9 }), ok('b')], s); assert.equal(a.key, 'weak | a');
  assert.equal(improve([ok('a', { chars: 9 }), ok('b')], s, [a.key]).key, 'weak | b'); });

const inv = inventory([{ name: 'calc', examples: ['open a calculator'] }, { name: 'none' }]);
t('inventory has skills with examples and pages', () => assert.deepEqual(inv.map((f) => f.id), ['skill:calc', 'page:/store/', 'page:/films/']));
t('variants are new wordings', () => { const v = variants('play voidquest', { solarquest: 'voidquest' }); assert.ok(v.includes("let's play voidquest")); assert.ok(v.includes('play solarquest')); assert.ok(!v.includes('play voidquest')); });
t('plan takes least recently tested, untried asks, and never loops', () => {
  let seen = {}; const asks = [];
  for (let i = 0; i < 40; i++) { const p = plan(inv, seen, 2); if (!p.length) break; asks.push(...p.map((x) => x.ask)); seen = remember(seen, p, '2026-10-' + String(10 + i).padStart(2, '0') + 'T00:00:00Z'); }
  assert.equal(new Set(asks).size, asks.length); assert.equal(plan(inv, seen, 2).length, 0); assert.ok(asks.includes('open a calculator') && asks.includes('/store/'));
  const s2 = { features: { 'skill:calc': '2026-10-01T00:00:00Z', 'page:/store/': '2026-10-09T00:00:00Z' }, asks: [] }; assert.equal(plan(inv, s2, 1)[0].feature, 'page:/films/'); });
t('priority skills go first', () => { const inv2 = inventory([{ name: 'a', examples: ['x a'] }, { name: 'b', examples: ['x b'] }, { name: 'c', examples: ['x c'] }], []);
  assert.deepEqual(plan(inv2, {}, 2, {}, ['skill:c', 'skill:b']).map((p) => p.feature), ['skill:c', 'skill:b']); });
t('a console error on two asks is one failure', () => assert.equal(judge({ ask: 'a' }, { text: 'x', errors: ['boom 1'] }).key, judge({ ask: 'b' }, { text: 'y', errors: ['boom 2'] }).key));
t('a wording keeps the example it came from', () => { const inv3 = inventory([{ name: 'v', examples: ['play despacito', 'watch the moon landing'] }], []);
  const p = plan(inv3, { asks: ['play despacito', 'watch the moon landing'] }, 1)[0]; assert.equal(p.base, 'play despacito');
  const all = variants('play despacito'); const q = plan(inv3, { asks: ['play despacito', 'watch the moon landing', ...all] }, 1)[0]; assert.equal(q.base, 'watch the moon landing'); });
t('an answer that replaces a status line in the middle of the page counts as something appearing', () => {
t('a card-stats idle wait over the limit is flagged, never failed (asked by Void: flag an idle wait over 500 ms)', () => {
  const c = { ask: 'what are you?', expect: { text: 'V01D' } }, r = { text: 'I am V01D', errors: [] }, lim = { statsIdleMs: 500 };
  const slow = judge(c, { ...r, statsIdleMs: 812 }, lim), quick = judge(c, { ...r, statsIdleMs: 120 }, lim), none = judge(c, { ...r, statsIdleMs: null }, lim);
  assert.deepEqual(slow.flags, ['stats idle 812 ms > 500']); assert.equal(slow.ok, true, 'a flag is not a failure');
  assert.deepEqual(quick.flags, []); assert.deepEqual(none.flags, [], 'no measure (stats not loaded yet) is no flag'); assert.deepEqual(judge(c, { ...r, statsIdleMs: 9000 }, {}).flags, [], 'no limit, no flag');
});
  const before = 'V01D\n↵\ntype anything\nsupport V01D', after = 'V01D\n↵\nthe void is empty · summon something first\nsupport V01D';
  assert.match(changedText(before, after), /void is empty/); assert.equal(judge({ ask: 'bring it to the front' }, { text: changedText(before, after) }).ok, true);
  assert.equal(changedText(before, before), ''); assert.equal(changedText('a', 'a then more'), ' then more'); });
console.log('site-test: ' + n + ' checks passed');
