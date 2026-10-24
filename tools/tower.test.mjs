import test from 'node:test';
import assert from 'node:assert/strict';
import { tower, gate, FLOORS, aspectsOf, towerLine } from '../void-live-deploy/lib/tower.js';
import { verdict, record } from './tower-gate.mjs';
const all = (f, v = 'better') => Object.fromEntries(aspectsOf(f).map((a) => [a, { verdict: v, evidence: 'x' }]));
test('a floor is beaten only when every aspect passes with evidence', () => {
  const f = FLOORS[0]; assert.equal(gate(f, all(f)).beaten, true);
  const e = all(f); delete e.speed; assert.equal(gate(f, e).beaten, false); assert.deepEqual(gate(f, e).left, ['speed']);
  const n = all(f); n.speed.evidence = ''; assert.equal(gate(f, n).beaten, false);
});
test('one queue, easiest first: conquered sites, then the one with the fewest aspects left, and a regression puts a site back', () => {
  const ev = { [FLOORS[1].id]: all(FLOORS[1]), [FLOORS[4].id]: Object.fromEntries(aspectsOf(FLOORS[4]).slice(0, 6).map((a) => [a, { verdict: 'better', evidence: 'x' }])) };
  let t = tower([], ev);
  assert.equal(t.floors[0].id, FLOORS[1].id); assert.equal(t.floors[0].state, 'beaten'); assert.equal(t.marker, 2);
  assert.equal(t.floors[1].id, FLOORS[4].id); assert.equal(t.floors[1].state, 'current'); // 5 aspects left beats every untouched site
  assert.equal(t.floors.filter((f) => f.state === 'current').length, 1);
  const r = record({ verdict: 'better' }, 'worse', 900, 500, 'e', 'now'); assert.equal(r.was, 'better');
  ev[FLOORS[1].id].speed = r; t = tower([], ev); assert.equal(t.beaten, 0); assert.equal(t.floors.find((f) => f.id === FLOORS[1].id).regressed.length, 1);
  assert.equal(t.floors[0].id, FLOORS[1].id); assert.equal(t.floors[0].state, 'current'); // 1 aspect left: it is the fight again
  assert.match(towerLine(t), /^Tower: now [^ ]+ \(\d+ of \d+ aspects beaten\), 0 conquered$/); assert.doesNotMatch(towerLine(t), / of \d+ floors| of 39\b/);
});
test('the tower has no end: every site in the frontier is in the queue once, never a site already listed, a regressed or blocked one never dropped', async () => {
  const { frontierOf, hostOf } = await import('../void-live-deploy/lib/tower.js');
  assert.equal(hostOf('https://www.Example.com/x?y'), 'example.com'); assert.equal(hostOf('not a host'), ''); assert.equal(hostOf('javascript:alert(1)'), '');
  const fr = frontierOf({ sites: [{ site: 'b.example', hardness: 30 }, { site: 'a.example', hardness: 12 }, { site: 'www.a.example' }, { site: 'isitchristmas.com' }, { site: 'c.example', blocked: 'a wall' }] });
  assert.deepEqual(fr.map((x) => x.host), ['a.example', 'b.example', 'c.example']); assert.equal(fr[2].blocked, 'a wall');
  const t = tower([], {}, { sites: Array.from({ length: 500 }, (_, i) => ({ site: 's' + i + '.example' })) });
  assert.equal(t.total, FLOORS.length + 500); assert.equal(t.open, true);
  // the real queue: the scan's sites (tower.frontier.json) are in it, and exactly one site is the current one
  const file = JSON.parse((await import('node:fs')).readFileSync(new URL('../void-live-deploy/tower.frontier.json', import.meta.url), 'utf8'));
  const live = tower([], {}, file); assert.ok(live.total > FLOORS.length + 100, 'the scan\'s sites are in the queue'); assert.equal(live.floors.filter((f) => f.state === 'current').length, 1);
});
test('no opponent downgrades: color-hex.com is a floor again, beside hexcolor16.com, so Verse beats both', () => {
  assert.ok(FLOORS.some((f) => f.site === 'color-hex.com')); assert.ok(FLOORS.some((f) => f.site === 'hexcolor16.com'));
  assert.equal(new Set(FLOORS.map((f) => f.id)).size, FLOORS.length);
});
test('verdicts come from numbers only', () => {
  assert.equal(verdict(100, 200), 'better'); assert.equal(verdict(3, 3, true), 'equal'); assert.equal(verdict(NaN, 1), 'unverified');
});
test('the tower skill answers its asks and not near misses', async () => {
  const { default: sk } = await import('../void-live-deploy/skills/tower.js');
  for (const a of sk.examples) assert.equal(sk.match(a.toLowerCase(), a), true, a);
  for (const a of sk.nearMisses) assert.equal(sk.match(a.toLowerCase(), a), false, a);
  const t = tower([], {}), h = sk.towerHtml(t, (s) => String(s));
  // nothing conquered yet: only the current site is drawn, with each of its aspects, and nothing above or after it
  assert.equal((h.match(/class="tower-floor"/g) || []).length, 1); assert.match(h, /data-state="current"/); assert.doesNotMatch(h, /data-state="ahead"|FINAL BOSS|YOU ARE HERE|data-boss/);
  assert.equal((h.match(/<li data-v=/g) || []).length, t.floors[0].m); assert.doesNotMatch(h, /<img|logo/i);
  assert.match(sk.detailText(t.floors[0]), /^0 of 11 aspects beaten on /);
  // three conquered: the current site first, the conquered under it, newest first
  const ev = Object.fromEntries(FLOORS.slice(0, 3).map((f) => [f.id, all(f)])), t3 = tower([], ev), h3 = sk.towerHtml(t3, (s) => String(s));
  const states = [...h3.matchAll(/data-state="(\w+)"/g)].map((x) => x[1]);
  assert.deepEqual(states, ['current', 'beaten', 'beaten', 'beaten']); assert.match(h3, /3 conquered · now: /);
  assert.ok(h3.indexOf(FLOORS[2].site) < h3.indexOf(FLOORS[0].site));
});
test('the live card tells what moved between two polls', async () => {
  const sk = (await import('../void-live-deploy/skills/tower.js')).default;
  const a = tower([], {}), ev = { [FLOORS[0].id]: Object.fromEntries(aspectsOf(FLOORS[0]).map((x) => [x, { verdict: 'better', evidence: 'e' }])) }, b = tower([], ev);
  assert.deepEqual(sk.changes(a, a), []);
  const said = sk.changes(a, b).join(' ');
  assert.match(said, /isitchristmas\.com is beaten\./); assert.match(said, /Now: (?!isitchristmas)/);
  assert.match(sk.changes(b, a).join(' '), /isitchristmas\.com slipped\./);
  assert.deepEqual(sk.changes(null, b), []);
});

test('a tie at the ideal score passes as equal-and-better; any other tie, or speed, stays equal', async () => {
  const { verdict, rescore } = await import('./tower-gate.mjs');
  assert.equal(verdict(0, 0, false, 0), 'equal-and-better'); assert.equal(verdict(3, 3, true, 3), 'equal-and-better');
  assert.equal(verdict(2, 2, true, 3), 'equal'); assert.equal(verdict(900, 900, false), 'equal'); assert.equal(verdict(1, 0, false, 0), 'worse');
  const r = rescore({ mobile: { verdict: 'equal', verse: 0, best: 0, evidence: 'e' }, reliability: { verdict: 'equal', verse: 3, best: 3, evidence: 'e' }, speed: { verdict: 'worse', verse: 3341, best: 908, evidence: 'e' }, history: { verdict: 'better', evidence: 'argon' } });
  assert.equal(r.mobile.verdict, 'equal-and-better'); assert.equal(r.reliability.verdict, 'equal-and-better'); assert.equal(r.speed.verdict, 'worse'); assert.equal(r.history.verdict, 'better');
});
test('every floor with a fatality says it in plain words, and the card detail carries it; no site sends Verse down any more', async () => {
  const { detailText } = await import('../void-live-deploy/skills/tower.js');
  const withKill = FLOORS.filter((f) => f.fatality); assert.ok(withKill.length >= 4);
  for (const f of withKill) { assert.ok(f.fatality.length > 20 && f.fatality.length < 200, f.id); assert.match(detailText({ ...f, n: 1, m: 9, left: [], lost: [] }), new RegExp('FATALITY \\(the killshot\\): ' + f.fatality.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); }
  assert.doesNotMatch(detailText({ site: 'x', n: 0, m: 9, left: [], lost: [], page: '' }), /FATALITY/);
  assert.equal((await import('node:fs')).existsSync(new URL('../void-live-deploy/tower.sentdown.json', import.meta.url)), false);
});
test('a floor may name its fatality as `killshot` too: the same word for the same thing', async () => {
  const { fatalityOf } = await import('../void-live-deploy/lib/tower.js'), { detailText } = await import('../void-live-deploy/skills/tower.js');
  assert.equal(fatalityOf({ killshot: 'a thing it cannot do' }), 'a thing it cannot do'); assert.equal(fatalityOf({ fatality: 'a', killshot: 'b' }), 'a'); assert.equal(fatalityOf({}), '');
  assert.match(detailText({ site: 'x', n: 1, m: 9, left: [], lost: [], killshot: 'a thing it cannot do' }), /FATALITY \(the killshot\): a thing it cannot do\./);
});
