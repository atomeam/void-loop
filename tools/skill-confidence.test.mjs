// The skill-confidence strip (lib/skill-confidence.js). Run: node --test tools/skill-confidence.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ageDays, confidenceOf, confidenceSummary, confidenceHtml, WEATHER_DAYS } from '../void-live-deploy/lib/skill-confidence.js';
const today = Date.parse('2026-10-17T12:00:00Z');
const fam = { families: [{ id: 'a', name: 'Al<pha>', skills: [
  { name: 'p', tier: 'proven', last_tested: '2026-10-16' }, { name: 'old', tier: 'proven', last_tested: '2026-06-01' },
  { name: 't', tier: 'tested', last_tested: '2026-10-17' }, { name: 'e', tier: 'experiment' }] }] };
test('age is whole days from last_tested, null without a real date', () => {
  assert.equal(ageDays('2026-10-16', today), 1); assert.equal(ageDays('2026-10-17', today), 0); assert.equal(ageDays('yesterday', today), null); assert.equal(ageDays(undefined, today), null);
});
test('a proven skill is denser than a tested one, and age washes the proven look out', () => {
  const p = confidenceOf(fam.families[0].skills[0], today), old = confidenceOf(fam.families[0].skills[1], today), t = confidenceOf(fam.families[0].skills[2], today), e = confidenceOf(fam.families[0].skills[3], today);
  assert.ok(p.density > t.density && t.density > e.density, JSON.stringify([p, t, e]));
  assert.ok(old.density < p.density && old.weathered && !p.weathered, 'a proven skill untested for months is fainter and weathered');
  assert.ok(old.density >= old.base * 0.5 - 0.01, 'never fainter than half its rating');
  assert.equal(e.age, null); assert.ok(e.weathered); assert.match(e.label, /never tested/);
  assert.equal(confidenceOf({ name: 'x', tier: 'bogus' }, today).tier, 'experiment');
  assert.ok(WEATHER_DAYS > 0);
});
test('summary counts ratings and weathered skills', () => {
  const s = confidenceSummary(fam, today); assert.equal(s.total, 4); assert.deepEqual(s.byTier, { proven: 2, checked: 0, tested: 1, experiment: 1 }); assert.equal(s.weathered, 2);
});
test('markup is escaped, one square per skill, strongest first, empty for no families', () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const h = confidenceHtml(fam, today, esc);
  assert.ok(!h.includes('Al<pha>') && h.includes('Al&lt;pha&gt;'));
  assert.equal((h.match(/class="sc-sq[ "]/g) || []).length, 4); assert.match(h, /--ink-density:/); assert.match(h, /sc-weathered/);
  assert.ok(h.indexOf('data-tier="proven"') < h.indexOf('data-tier="experiment"'));
  assert.equal(confidenceHtml({ families: [] }, today), ''); assert.equal(confidenceHtml(null, today), '');
});
test('without an esc passed, names are still escaped', () => {
  const h = confidenceHtml({ families: [{ name: '<b>f</b>', skills: [{ name: '<img onerror=x>', tier: 'proven', last_tested: '2026-10-16' }] }] }, today);
  assert.ok(!h.includes('<img') && !h.includes('<b>f') && h.includes('&lt;img onerror=x&gt;'));
});

test('the family bars (the self card redesign, 2026-10-18): one bar per family, its proven share from the file, the weakest marked once; the strip folded under them', async () => {
  const { familyBars, sureHtml } = await import('../void-live-deploy/lib/skill-confidence.js');
  const f = { families: [
    { id: 'a', name: 'A', skills: [{ name: 'x', tier: 'proven' }, { name: 'y', tier: 'proven' }, { name: 'z', tier: 'tested' }] },
    { id: 'b', name: 'B <i>', skills: [{ name: 'p', tier: 'checked' }, { name: 'q', tier: 'tested' }] },
    { id: 'c', name: 'C', skills: [{ name: 'r', tier: 'tested' }, { name: 's', tier: 'experiment' }] },
    { id: 'd', name: 'D', skills: [] }] };
  const b = familyBars(f);
  assert.deepEqual(b.map((x) => [x.id, x.proven, x.total, Math.round(x.share * 100), x.weak]), [['a', 2, 3, 67, false], ['b', 0, 2, 0, false], ['c', 0, 2, 0, true]], 'a family with no skills has no bar; at the same share the one with fewer checked is weakest');
  const h = sureHtml(f, today);
  assert.equal((h.match(/data-fam-bar=/g) || []).length, 3); assert.equal((h.match(/data-weak="1"/g) || []).length, 1);
  assert.ok(h.includes('B &lt;i&gt;') && !h.includes('B <i>'), 'names escaped');
  assert.match(h, /<details class="sc-more"><summary>Every skill, one square each<\/summary>.*class="sc-strip"/s);
  assert.equal(sureHtml({ families: [] }, today), '');
});
