// tools/tower-gate.mjs and tools/tower-probes.mjs: the scores behind the aspects the gate measures, and the probes' answers worked out by hand
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, rescore, germanScore, sharingScore, MEASURES, UA } from './tower-gate.mjs';
import { probeFor, score, PROBES } from './tower-probes.mjs';
import { FLOORS, aspectsOf } from '../void-live-deploy/lib/tower.js';

test('the gate presents as an ordinary browser, not a headless one', () => { assert.doesNotMatch(UA, /headless/i); assert.match(UA, /Chrome\/\d+/); });
test('local language: a German browser gets German when the page says so or speaks it', () => {
  assert.equal(germanScore('de-DE', ''), 1); assert.equal(germanScore('en', 'Ist heute Weihnachten? Nein, und morgen ist es nicht.'), 1);
  assert.equal(germanScore('en', 'Is it Christmas? No, and not tomorrow either.'), 0); assert.equal(germanScore('', 'Die'), 0, 'one word is not a language');
});
test('sharing: title, image, description and a share control, one each', () => {
  assert.equal(sharingScore({ ogTitle: true, ogImage: true, desc: true, control: true }), 4); assert.equal(sharingScore({}), 0); assert.equal(sharingScore({ desc: true }), 1);
});
test('verdicts for the new aspects: the ideal tie passes, a lower count loses, accuracy and completeness tie only at full marks', () => {
  assert.equal(verdict(1, 1, MEASURES.offline.hi, MEASURES.offline.ideal), 'equal-and-better'); assert.equal(verdict(0, 0, MEASURES.offline.hi, MEASURES.offline.ideal), 'equal');
  assert.equal(verdict(3, 4, MEASURES.sharing.hi, MEASURES.sharing.ideal), 'worse'); assert.equal(verdict(48, 30, MEASURES['big answer'].hi), 'better');
  const rows = rescore({ accuracy: { verdict: 'x', verse: 4, best: 4, of: 4 }, completeness: { verdict: 'x', verse: 9, best: 9, of: 13 } });
  assert.equal(rows.accuracy.verdict, 'equal-and-better'); assert.equal(rows.completeness.verdict, 'equal', 'both missing the same things is not beaten');
});
test('the colour probe: #ff5733 by hand, and a page that shows it passes every truth', () => {
  const p = probeFor('colour'), page = 'HEX #FF5733 RGB rgb(255, 87, 51) HSL hsl(11, 100%, 60%) CMYK 0%, 66%, 80%, 0% shades tints tones complementary triadic analogous contrast HSV lab nearest name tomato';
  assert.equal(score(page, p.truth).n, 4); assert.equal(score(page, p.facts).n, p.facts.length);
  const wrong = score('rgb(255, 88, 51) hsl(11, 100%, 61%) cmyk 0 65 80 0', p.truth); assert.equal(wrong.n, 0, 'a near miss is a miss: ' + wrong.has.join());
  assert.equal(probeFor('colour codes').facts.length, p.facts.length); assert.equal(probeFor('colour codes').site, 'https://hexcolor16.com/ff5733');
});
test('is it: the right answer depends on the day', () => {
  const t = probeFor('is it').truth; assert.equal(t.length, 1);
  const dec25 = new Date().getUTCMonth() === 11 && new Date().getUTCDate() === 25; assert.equal(score(dec25 ? 'YES' : 'NO', t).n, 1); assert.equal(score(dec25 ? 'NO' : 'YES', t).n, 0);
});
test('a probe exists only for a floor on the tower, and floors with no fair question leave accuracy unverified', () => {
  for (const id of Object.keys(PROBES)) assert.ok(FLOORS.some((f) => f.id === id), id);
  for (const id of ['coin flip', 'random number', 'base converter']) assert.equal(probeFor(id).truth, null, id);
  assert.equal(probeFor('weather'), null);
  for (const f of FLOORS) assert.ok(aspectsOf(f).includes('offline') && aspectsOf(f).includes('sharing'), f.id);
});
test('the colour floors\' own aspects are lists both pages are scored on, and they tell the models apart', async () => {
  const { PARTS } = await import('./tower-probes.mjs');
  const models = probeFor('colour codes').parts['every colour model'], palettes = probeFor('colour').parts['shades and palettes'];
  assert.equal(models.length, 15); assert.equal(palettes.length, 12); assert.deepEqual(Object.keys(PARTS).sort(), ['colour', 'colour codes']);
  const has = (t) => score(t, models).has;
  assert.deepEqual(has('OKLCH'), ['OKLCH']); assert.deepEqual(has('Hunter Lab'), ['Hunter Lab']); assert.deepEqual(has('CIE Lab'), ['CIELab']); assert.deepEqual(has('CIELCH'), ['CIELCh']); assert.deepEqual(has('CIELUV'), ['CIELUV']);
  // hexcolor16.com's list, as the owner read it off the page on 2026-10-24
  assert.equal(score('Hexadecimal Decimal RGB CMYK HSL HSV XYZ CIELab CIELUV CIELCH', models).n, 10);
  assert.equal(score('shades tints tones complementary analogous triadic split-complementary tetradic square VGA random', palettes).missing.join(), 'monochromatic');
  assert.deepEqual(probeFor('base converter').parts, {});
});
test('design polish counts what a design review fails first, lower is better and 0 is the best there is', async () => {
  const { defects, designLook } = await import('./tower-gate.mjs');
  assert.equal(defects({ contrast: 2, targets: 1, cls: 0.3 }), 4); assert.equal(defects({ contrast: 0, targets: 0, cls: 0.05 }), 0); assert.ok(Number.isNaN(defects(null)));
  assert.equal(verdict(0, 0, MEASURES['design polish'].hi, MEASURES['design polish'].ideal), 'equal-and-better'); assert.equal(verdict(0, 2, false, 0), 'better'); assert.equal(verdict(1, 0, false, 0), 'worse');
  const { createRequire } = await import('node:module'), req = createRequire(import.meta.url); let pw = null; for (const n of ['playwright-core', 'playwright']) { try { pw = req(n); break; } catch (_) { /* next */ } }
  if (!pw) return; // the in-page part needs a browser
  const b = await pw.chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 800 } });
    await p.setContent('<body style="background:#fff;color:#111"><p>plain text</p><p style="color:#bbb">faint</p><span aria-hidden="true" style="background:#ffeb3b;color:#fff">Aa</span><button style="width:10px;height:10px;padding:0;border:0">x</button><p>a line with <a href="#" style="font-size:10px">a small link</a> in it</p></body>');
    const l = await p.evaluate(designLook);
    assert.equal(l.contrast, 1, 'the faint line fails, the aria-hidden sample on yellow does not count'); assert.equal(l.targets, 1, 'the tiny button counts, the link inside a line does not');
  } finally { await b.close(); }
});
test('a run after a deploy measures the current fight, the floors whose page changed and the ones missing a measurable aspect, at most three', async () => {
  const { pick, measurable } = await import('./tower-gate.mjs'), { FLOORS: F } = await import('../void-live-deploy/lib/tower.js');
  const full = (id) => Object.fromEntries(measurable(F.find((f) => f.id === id)).map((a) => [a, { verdict: 'better', evidence: 'x', verse: 1, best: 2 }]));
  assert.ok(measurable(F.find((f) => f.id === 'colour codes')).includes('every colour model')); assert.ok(!measurable(F.find((f) => f.id === 'coin flip')).includes('accuracy'), 'a flip has no right answer');
  const ev = Object.fromEntries(F.map((f) => [f.id, full(f.id)])); // every floor fully measured: only the fight is picked
  const t = pick(ev, null, []); assert.equal(t.length, 1);
  assert.deepEqual(pick(ev, null, ['void-live-deploy/flip/index.html']).slice(1), ['coin flip'], 'a changed page adds its floor');
  delete ev.calculator.speed; assert.ok(pick(ev, null, []).includes('calculator'), 'a missing row adds its floor');
  assert.ok(pick({}, null, [], 3).length === 3 && pick({}, null, [], 1).length === 1);
  for (const id of pick({}, { sites: [{ site: 'only-on-the-frontier.example', hardness: 1 }] }, [])) assert.ok(F.some((f) => f.id === id), 'a frontier site has no Verse page to measure: ' + id);
});
