// Growth speed gauge (asked by Verse: "Connect the 'wants' backlog to a visual 'growth-speed' gauge on the stage"). node --test tools/growth-speed.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import skill, { gaugeSvg, gaugeHtml } from '../void-live-deploy/skills/growth-speed.js';
import { velocityOf, velocityLine } from '../void-live-deploy/skills/wants.js';
const NOW = Date.parse('2026-10-20T12:00:00Z'), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const FOLLOW = { total: 10, built: 4, recent: [{ ask: 'a', at: '2026-10-19T00:00:00Z' }, { ask: 'b', at: '2026-10-18T00:00:00Z' }, { ask: 'c', at: '2026-10-10T00:00:00Z' }] };
test('the gauge shows the same numbers as the wants card velocity line', () => {
  const html = gaugeHtml({ follow: FOLLOW }, esc, NOW), v = velocityOf(FOLLOW, NOW);
  assert.deepEqual([v.pct, v.week, v.before, v.trend], [40, 2, 1, 'faster']);
  assert.match(html, /data-pct="40" data-trend="faster" data-week="2" data-before="1"/); assert.ok(html.includes(esc(velocityLine(v)))); assert.match(html, />40%<\/text>/);
  assert.match(gaugeHtml(null, esc, NOW), /could not read what became of my asks/); assert.match(gaugeHtml({}, esc, NOW), /will not guess/);
});
test('the dial: empty at 0 (no fill arc), the needle straight up at 50, far right at 100, clamped beyond', () => {
  assert.ok(!gaugeSvg({ pct: 0, trend: 'steady' }).includes('gs-fill')); assert.match(gaugeSvg({ pct: 50, trend: 'slower' }), /x2="100\.0" y2="34\.0" stroke="rgb\(255,170,110\)"/);
  assert.match(gaugeSvg({ pct: 100 }), /A80 80 0 0 1 180\.0 100\.0/); assert.match(gaugeSvg({ pct: 140 }), />100%</); assert.match(gaugeSvg({ pct: 'x' }), />0%</);
});
test('the skill takes its asks and leaves speed questions about the world alone', () => {
  for (const a of [...skill.examples, 'Growth-speed gauge', "show me verse's growth speed", 'growth speed', 'how fast do your wants get built?']) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses.concat(['speed of growth of a baby', 'how fast are you'])) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
