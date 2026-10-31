import test from 'node:test';
import assert from 'node:assert/strict';
import { tower, gate, FLOORS, aspectsOf, towerLine, passingRows, sizeTier, easeLine } from '../void-live-deploy/lib/tower.js';
import { towerHtml, heroHtml, chipsHtml, actionsHtml } from '../void-live-deploy/skills/tower.js';
import { verdict, record } from './tower-gate.mjs';
// every aspect passing; journey rows carry their steps and negative controls (the gate's standards, 2026-10-28)
const all = (f) => passingRows(f);
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
  // a site Verse is losing on is not easy to beat: an easier site is fought first, and the hard one stays in the queue
  assert.notEqual(t.floors[0].id, FLOORS[1].id); assert.equal(t.floors[0].id, FLOORS[4].id); assert.equal(t.floors[0].state, 'current');
  assert.equal(t.floors.find((f) => f.id === FLOORS[1].id).state, 'ahead');
  assert.match(towerLine(t), /^Versus: now [^ ]+ \(Verse ahead on \d+ of \d+ aspects\), 0 surpassed$/); assert.doesNotMatch(towerLine(t), / of \d+ floors| of 39\b|Tower/);
  ev[FLOORS[1].id].speed = { verdict: 'better', evidence: 'fixed' }; t = tower([], ev);
  assert.equal(t.floors[0].id, FLOORS[1].id); assert.equal(t.floors[0].state, 'beaten'); // its loss fixed, it falls
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
test('the tower skill answers its asks and not near misses; the card is headed Versus (owner, 2026-10-25) and every old "tower" ask still opens it', async () => {
  const { default: sk } = await import('../void-live-deploy/skills/tower.js');
  for (const a of sk.examples) assert.equal(sk.match(a.toLowerCase(), a), true, a);
  for (const a of ['versus', 'Verse versus', 'the versus', 'show me versus', 'open versus', 'Versus?', 'the tower', 'verse tower', 'show me the tower']) assert.equal(sk.match(a.toLowerCase(), a), true, a);
  for (const a of sk.nearMisses) assert.equal(sk.match(a.toLowerCase(), a), false, a);
  const t = tower([], {}), h = sk.towerHtml(t, (s) => String(s));
  assert.match(h, /<h2 class="tw-head">Versus<\/h2>/); assert.doesNotMatch(h, /The tower|3D tower/); assert.match(sk.about, /^Versus: /);
  // nothing conquered yet: only the current site is drawn, with each of its aspects, and nothing above or after it
  assert.equal((h.match(/class="tower-floor"/g) || []).length, 1); assert.match(h, /data-state="current"/); assert.doesNotMatch(h, /data-state="ahead"|FINAL BOSS|YOU ARE HERE|data-boss/);
  assert.equal((h.match(/<li data-v=/g) || []).length, t.floors[0].m); assert.match(h, /class="tw-logo"/); // logos only (owner, 2026-10-25)
  assert.match(sk.detailText(t.floors[0]), new RegExp('^0 of ' + t.floors[0].m + ' aspects ahead of ')); // whichever floor stands first, its own count
  // three conquered: the current site first, the conquered under it, newest first
  const ev = Object.fromEntries(FLOORS.slice(0, 3).map((f) => [f.id, all(f)])), t3 = tower([], ev), h3 = sk.towerHtml(t3, (s) => String(s));
  const states = [...h3.matchAll(/data-state="(\w+)"/g)].map((x) => x[1]);
  assert.deepEqual(states, ['current', 'beaten', 'beaten', 'beaten']); assert.match(h3, /3 surpassed · easiest site left: /);
  assert.ok(h3.indexOf(FLOORS[2].site) < h3.indexOf(FLOORS[0].site));
});
test('the live card tells what moved between two polls', async () => {
  const sk = (await import('../void-live-deploy/skills/tower.js')).default;
  const a = tower([], {}), first = a.floors[0], ev = { [first.id]: passingRows(first, { evidence: 'e' }) }, b = tower([], ev);
  assert.deepEqual(sk.changes(a, a), []);
  const said = sk.changes(a, b).join(' ');
  assert.ok(said.includes(first.site + ' is surpassed.'), said); // beating the site at the front moves the marker
  assert.ok(/Now: /.test(said) && !said.includes('Now: ' + first.site), said);
  assert.ok(sk.changes(b, a).join(' ').includes(first.site + ' slipped.'));
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
  for (const f of withKill) { assert.ok(f.fatality.length > 20 && f.fatality.length < 200, f.id); assert.match(detailText({ ...f, n: 1, m: 9, left: [], lost: [] }), new RegExp('Verse\'s edge: ' + f.fatality.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); }
  assert.doesNotMatch(detailText({ site: 'x', n: 0, m: 9, left: [], lost: [], page: '' }), /Verse's edge/);
  assert.equal((await import('node:fs')).existsSync(new URL('../void-live-deploy/tower.sentdown.json', import.meta.url)), false);
});
test('a floor may name its fatality as `killshot` too: the same word for the same thing', async () => {
  const { fatalityOf } = await import('../void-live-deploy/lib/tower.js'), { detailText } = await import('../void-live-deploy/skills/tower.js');
  assert.equal(fatalityOf({ killshot: 'a thing it cannot do' }), 'a thing it cannot do'); assert.equal(fatalityOf({ fatality: 'a', killshot: 'b' }), 'a'); assert.equal(fatalityOf({}), '');
  assert.match(detailText({ site: 'x', n: 1, m: 9, left: [], lost: [], killshot: 'a thing it cannot do' }), /Verse's edge: a thing it cannot do\./);
});
test('the matchup (owner, 2026-10-25: avatars for the battle, "how aware we are"): the VS splash, one row per aspect with the gate\'s numbers, when it was measured, what is next', async () => {
  const { vsHtml, matchupHtml, matchRows, metaLine, nums, ago, siteFace } = await import('../void-live-deploy/skills/tower.js');
  const { hashOf } = await import('../void-live-deploy/lib/avatar.js'); const esc = (s) => String(s);
  const f = FLOORS.find((x) => x.id === 'calculator');
  const ev = { [f.id]: { speed: { verdict: 'equal-and-better', verse: 95, best: 132, evidence: 'Verse (/calculator/) 95 ms to the load event (median of 3, phone width) vs calculator.net 132 ms to the load event', at: '2026-10-25T05:46:54.276Z' },
    reliability: { verdict: 'better', verse: 3, best: 2, evidence: 'Verse (/calculator/) 3 of 3 loads answered vs calculator.net 2 of 3 loads answered', at: '2026-10-25T06:00:00.000Z' },
    mobile: { verdict: 'equal', verse: 0, best: 0, evidence: 'Verse (/calculator/) 0 px sideways overflow vs calculator.net 0 px' } } };
  const t = tower([], ev), cur0 = t.floors.find((x) => x.id === f.id); assert.equal(cur0.state, 'current'); assert.equal(cur0.ev, ev[f.id], 'the floor carries its evidence rows');
  // a loss sends a site behind every site Verse loses on nothing (lib/tower.js), so the lossy floor is read on its own
  const evL = { [f.id]: { ...ev[f.id], accuracy: { verdict: 'worse', verse: 1, best: 3, evidence: 'Verse (/calculator/) 1 of 3 right vs calculator.net 3 of 3 right', at: '2026-10-25T05:46:54.276Z' } } }, cur = tower([], evL).floors.find((x) => x.id === f.id);
  assert.equal(nums(ev[f.id].speed), '95 ms vs 132 ms'); assert.equal(nums(ev[f.id].reliability), '3 of 3 vs 2 of 3'); assert.equal(nums(ev[f.id].mobile), '0 px vs 0 px'); assert.equal(nums({ verdict: 'better', evidence: 'stub' }), ''); assert.equal(nums(null), '');
  const rows = matchRows(cur), by = Object.fromEntries(rows.map((r) => [r.a, r]));
  assert.equal(rows.length, cur.m); assert.deepEqual([by.speed.v, by.speed.say], ['won', 'equal and better']); assert.deepEqual([by.reliability.v, by.reliability.say], ['won', 'won']);
  assert.deepEqual([by.accuracy.v, by.accuracy.say, by.accuracy.nums], ['lost', 'lost', '1 of 3 vs 3 of 3']); assert.deepEqual([by.mobile.v, by.mobile.say], ['open', 'equal, not yet better']); assert.deepEqual([by.offline.v, by.offline.say, by.offline.nums], ['open', 'not measured yet', '']);
  const now = Date.parse('2026-10-25T09:00:00Z');
  assert.equal(metaLine(cur, now), 'last measured 3 hours ago · next: accuracy (Verse loses on it, so it comes first)');
  assert.equal(metaLine({ ev: {}, measured: false, lost: [] }, now), 'not measured yet · next: the gate re-measures on the next deploy');
  assert.equal(metaLine({ ev: { speed: { verdict: 'better', evidence: 'stub' } }, measured: true, lost: [] }, now), 'last measured: time not recorded · next: the gate re-measures on the next deploy');
  assert.equal(ago('2026-10-25T08:59:30Z', now), 'just now'); assert.equal(ago('2026-10-25T08:45:00Z', now), '15 minutes ago'); assert.equal(ago('2026-10-24T09:00:00Z', now), '24 hours ago'); assert.equal(ago('2026-10-23T09:00:00Z', now), '2 days ago'); assert.equal(ago('2026-09-01T00:00:00Z', now), 'on 2026-09-01'); assert.equal(ago('x', now), '');
  // the splash: Verse's mark left, the site's fighter right (keyed by its host, so the same face as anywhere else), names in plain text, an energy bar each
  const vs = vsHtml(cur, esc);
  assert.ok(vs.indexOf('src="/verse-logo.webp"') < vs.indexOf('class="tw-vsmark"') && vs.indexOf('class="tw-vsmark"') < vs.indexOf('domain=calculator.net'), 'Verse, VS, the site: logos only');
  assert.match(vs, /class="tw-who">Verse<\/span>/); assert.match(vs, /class="tw-who">calculator\.net<\/span>/); assert.match(vs, /class="tw-vs tw-in"/); assert.doesNotMatch(vsHtml(cur, esc, { enter: false }), /tw-in/);
  assert.equal((vs.match(/<i data-k="v">/g) || []).length, 2, "Verse's bar: the two aspects it has won or is equal-and-better on"); assert.equal((vs.match(/<i data-k="s">/g) || []).length, 1, "the site's bar: the one aspect Verse loses"); assert.equal((vs.match(/<i>/g) || []).length, (cur.m - 2) + (cur.m - 1), 'the rest grey on both');
  assert.equal(siteFace(cur, 24), siteFace({ site: 'calculator.net', url: 'https://www.calculator.net/x' }, 24)); assert.match(siteFace(cur, 24), /width="24"/); assert.match(vs, /class="tw-logo"/); // logos only (owner, 2026-10-25)
  assert.ok(hashOf('calculator.net') !== hashOf('isitchristmas.com'));
  // the card: the splash before the stack, the rows inside the current site's button with the numbers and the awareness line, a conquered site with its small face
  const won = { ...ev, [FLOORS[0].id]: all(FLOORS[0]) }, t2 = tower([], won), h = towerHtml(t2, esc, { now }); assert.equal(t2.floors.find((x) => x.state === 'current').id, f.id);
  assert.ok(h.indexOf('class="tw-vs') < h.indexOf('class="tw-stack')); assert.match(h, /95 ms vs 132 ms/); assert.match(h, /last measured 3 hours ago · next: the gate re-measures on the next deploy/);
  assert.match(h, new RegExp('data-state="beaten"><span class="tw-face"><span class="tw-logo-wrap"[^>]*><img class="tw-logo" src="[^"]*' + FLOORS[0].site.replace(/\./g, '\\.'))); // the beaten site's logo, never a face
  assert.equal((h.match(/<li data-v=/g) || []).length, cur0.m); assert.equal((h.match(/<li data-v="won"/g) || []).length, 2); assert.equal((h.match(/<li data-v="lost"/g) || []).length, 0);
  const m = matchupHtml(cur, esc, { now }); assert.ok(m.startsWith('<style>') && m.includes('class="tw-vs') && m.includes('3 of 3 vs 2 of 3') && m.includes('last measured 3 hours ago'));
  assert.match(h, /@media \(prefers-reduced-motion:reduce\)\{\.tw-vs \*,\.tw-vs::after\{animation:none!important\}/);
});

test('a row the gate scored against its default bar (the site turned it away) says "not measured" and is not credited to either side (2026-10-29)', async () => {
  const { vsHtml, matchRows, onBar } = await import('../void-live-deploy/skills/tower.js'); const esc = (s) => String(s);
  const at = '2026-10-29T05:59:18.672Z', b = (verdict, verse, best, what) => ({ verdict, verse, best, at, evidence: 'Verse (/fanfic/) ' + verse + what + ' vs the bar (sycophanthex.com unreachable) ' + best + what });
  const ev = { speed: b('worse', 261, 200, ' ms to the load event'), mobile: b('equal-and-better', 0, 0, ' px sideways overflow at 390 px'), offline: b('worse', 0, 1, ' (1: the page shows itself again with the network cut)'),
    reliability: { verdict: 'incomplete', incomplete: true, verse: 3, best: null, evidence: 'Verse (/fanfic/) 3 of 3 loads answered; sycophanthex.com turned the gate away', at },
    accuracy: { verdict: 'worse', verse: 1, best: 3, evidence: 'Verse (/fanfic/) 1 of 3 right vs sycophanthex.com 3 of 3 right', at } };
  const f = { site: 'sycophanthex.com', url: 'https://sycophanthex.com/', aspects: ['speed', 'mobile', 'offline', 'reliability', 'accuracy'], m: 5, n: 1, lost: ['speed', 'offline', 'accuracy'], left: ['reliability'], ev };
  assert.equal(onBar(ev.speed), true); assert.equal(onBar(ev.accuracy), false); assert.equal(onBar(ev.reliability), false); assert.equal(onBar(undefined), false);
  const by = Object.fromEntries(matchRows(f).map((r) => [r.a, r]));
  assert.deepEqual([by.speed.say, by.speed.bar, by.speed.nums], ['below the default bar', true, '261 ms vs 200 ms']); assert.equal(by.mobile.say, 'not measured: the site turned the gate away');
  assert.equal(by.offline.say, 'below the default bar'); assert.deepEqual([by.accuracy.say, by.accuracy.bar], ['lost', false], 'a row measured on the site keeps its own word'); assert.equal(by.reliability.say, 'not measured yet');
  const vs = vsHtml(f, esc);
  assert.equal((vs.match(/<i data-k="s">/g) || []).length, 1, "the site's bar lights only what was measured on the site"); assert.match(vs, /class="tw-bar-n">1 of 5<\/span><\/div><\/div>/);
  assert.match(vs, /<div class="tw-barnote">3 of 5 aspects are not measured: sycophanthex\.com turned the gate away, so they are not counted for either side<\/div>/);
  assert.match(vs, /aria-label="Verse versus sycophanthex\.com: Verse ahead on 1 of 5 aspects, sycophanthex\.com on 1; 3 of 5 aspects are not measured/);
  assert.doesNotMatch(vsHtml({ ...f, ev: { accuracy: ev.accuracy } }, esc), /tw-barnote/, 'no note when every row was measured on the site');
});

test('every surpassed site is on the card, visible and copyable, with a taught-me line from the gate\'s numbers when none was written', async () => {
  const { tower, learnedOf, FLOORS } = await import('../void-live-deploy/lib/tower.js');
  const { towerHtml, verseTake } = await import('../void-live-deploy/skills/tower.js');
  const good = (a) => ({ verdict: 'better', evidence: 'x' }), ev = {};
  const { passingRows } = await import('../void-live-deploy/lib/tower.js');
  const lane = FLOORS.find((f) => f.lane === 'translate');
  ev[lane.id] = passingRows(lane);
  ev[lane.id].speed = { verdict: 'equal-and-better', verse: 101, best: 712, evidence: 'Verse 101 ms vs 712 ms' };
  ev[lane.id].completeness = { verdict: 'better', verse: 10, best: 3, of: 10, evidence: 'Verse 10 of 10 things a full answer shows vs 3 of 10 (Verse lacks: none; site lacks: listen, speak, camera)' };
  ev[lane.id]['camera text'] = { verdict: 'better', verse: 2, best: 0, evidence: 'Verse 2 of 2 shown vs 0 of 2 (Verse lacks: none; site lacks: camera)' };
  const t = tower([], ev), won = t.floors.find((f) => f.id === lane.id);
  assert.equal(won.state, 'beaten');
  const line = learnedOf(won);
  assert.match(line, /^beaten on \d+ of \d+ aspects: 101 ms to load against 712 ms; 10 of 10 things a full answer shows against 3 \(the site lacked listen, speak, camera\); the site had no camera text$/);
  assert.equal(learnedOf({ learned: 'written by hand', ev: won.ev }), 'written by hand'); assert.equal(learnedOf({ ev: {} }), '');
  assert.ok(verseTake(t).learned.some((x) => x.site === won.site && x.text === line));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const html = towerHtml(t, esc);
  const rowAt = html.indexOf('<div class="tower-floor" role="button"'), rowEnd = html.indexOf('</div>', rowAt), link = html.indexOf('<div class="tw-links"', rowEnd);
  assert.ok(rowAt > 0 && html.slice(rowAt, rowEnd).includes(esc(won.site)), 'a surpassed site is a copyable row, not a button');
  const linkTag = html.slice(link, html.indexOf('>', link)); assert.ok(!/data-share-skip/.test(linkTag), 'its links copy with the card'); assert.ok(html.slice(link).includes('/compare/?floor='));
  assert.ok(html.includes('<b>Surpassed (1)</b>')); assert.ok(!/max-height:min\(48vh/.test(html), 'no scroll cap hides the list');
  // the site's own icon when the gate kept one; the drawn fighter otherwise
  const { siteFace } = await import('../void-live-deploy/skills/tower.js');
  assert.match(siteFace({ ...won, icon: 'tower.icons/tradukka.com.png' }, 24), /<img class="tw-logo" src="\/tower.icons\/tradukka.com.png"/); assert.match(siteFace(won, 24), /s2\/favicons\?sz=128&domain=tradukka\.com/); assert.doesNotMatch(siteFace(won, 24), /<svg/, 'logos only, never a drawn face');
  assert.equal(tower([], ev, null, { [won.site]: 'tower.icons/x.png' }).floors.find((f) => f.id === lane.id).icon, 'tower.icons/x.png');
});

test('a page older than the evidence file knows it: the sites the file names that its floors do not', async () => {
  const { tower } = await import('../void-live-deploy/lib/tower.js');
  const { staleOf } = await import('../void-live-deploy/skills/tower.js');
  const t = tower([], {});
  assert.equal(staleOf({ floors: { 'translate: deepl.com': {}, 'calculator': {} } }, t), 0);
  assert.equal(staleOf({ floors: { 'translate: nope.example': {}, 'another: x.example': {}, 'calculator': {} } }, t), 2);
  assert.equal(staleOf(null, t), 0); assert.equal(staleOf({}, null), 0);
});

test('a mega-site floor waits (owner, 2026-10-26: "we should just go after smaller sites no reason to go after big sites yet"): even with the fewest aspects left it is never the current fight while a small site remains', () => {
  const giant = FLOORS.find((f) => f.defer);
  assert.ok(giant, 'some floors are marked defer');
  const ev = { [giant.id]: Object.fromEntries(aspectsOf(giant).slice(0, 2).map((a) => [a, { verdict: 'better', evidence: 'x' }])) };
  const t = tower([], ev);
  const g = t.floors.find((f) => f.id === giant.id);
  assert.equal(g.state, 'ahead', 'the giant stays in the queue, just not first');
  assert.ok(g.floor > t.floors.find((f) => f.state === 'current').floor, 'it stands behind the current fight');
  const cur = t.floors.find((f) => f.state === 'current');
  assert.ok(!cur.defer, 'the current fight is never a deferred floor while small sites remain');
  assert.equal(t.floors.filter((f) => f.state === 'current').length, 1);
});
test('the shopping floor fights from Verse\'s own store, and the store page exists with what the probes read', async () => {
  const { readFileSync } = await import('node:fs');
  const s = FLOORS.find((f) => f.id === 'shopping');
  assert.equal(s.site, 'Amazon'); assert.equal(s.page, '/store/'); assert.ok(s.defer);
  const html = readFileSync(new URL('../void-live-deploy/store/index.html', import.meta.url), 'utf8');
  assert.ok(!/http-equiv="refresh"/.test(html), 'the store page is a page, not a redirect');
  const redir = readFileSync(new URL('../void-live-deploy/_redirects', import.meta.url), 'utf8');
  assert.match(redir, /\/shopping\/ \/store\/ 301/, '/shopping/ lands on the store, so the floor\'s own name never 404s');
  assert.match(redir, /\/shopping \/store\/ 301/, 'the same without the slash');
  const { PROBES } = await import('./tower-probes.mjs');
  const probe = PROBES.shopping;
  assert.ok(probe, 'the shopping floor has a probe');
  assert.match(probe.ask.verse, /cart=void-monthly%2Ccode-review-pro%3A2|cart=void-monthly,code-review-pro:2/);
  assert.ok(probe.truth.length >= 4, 'accuracy is judged against a worked-out answer');
  for (const a of ['catalogue', 'checkout', 'delivery tracking']) assert.ok(probe.askParts[a] && probe.askParts[a].length >= 5, a + ' is measured');
  assert.ok(probe.facts.length >= 18, 'completeness has a real checklist');
});
test('with the size data the target is the easiest site: a small one before a giant, fewer aspects left first, a page before none', () => {
  const rank = { ranks: { calculator: 1338, 'is it': 853018 }, order: {} };
  const t = tower([], {}, null, null, rank), cur = t.floors.find((f) => f.state === 'current');
  assert.ok(cur.tier === 0, 'the target is small: ' + cur.id + ' tier ' + cur.tier);
  const calc = t.floors.find((f) => f.id === 'calculator');
  assert.equal(calc.tier, 2); assert.ok(t.floors.indexOf(calc) > t.floors.indexOf(cur));
  assert.deepEqual([sizeTier(null), sizeTier(150000), sizeTier(50000), sizeTier(5000), sizeTier(500)], [0, 0, 1, 2, 3]);
  assert.match(easeLine(cur), /aspects left to pass/);
});
test('a held floor is never beaten, whatever the gate rows say', () => {
  const f = FLOORS.find((x) => x.id === 'paint'), t = tower([], { paint: passingRows(f) }), p = t.floors.find((x) => x.id === 'paint');
  assert.equal(p.n, p.m, 'every row reads a win'); assert.equal(p.beaten, false); assert.notEqual(p.state, 'beaten'); assert.match(easeLine(p), /^held, not beaten: Verse's page is not yet better/);
});
test('the card leads with the target: hero with logo, name and weight chips, three actions, up next, an honest empty surpassed, the long takes folded', () => {
  const size = { sites: { 'isitchristmas.com': { bytes: 700, scripts: 0, nodes: 20, routes: 1 } } };
  const t = tower([], {}, null, null, { ranks: {}, order: {}, list: {} }, size), cur = t.floors.find((f) => f.state === 'current'), esc = (s) => String(s);
  const h = towerHtml(t, esc, { enter: false });
  const at = (m) => h.indexOf(m);
  assert.ok(at('<div class="tw-hero"') < at('<div class="tw-vs') && at('<div class="tw-vs') < at('<div class="tw-stack tower-stack"') && at('<div class="tw-stack tower-stack"') < at('<div class="tw-actions"') && at('<div class="tw-actions"') < at('<div class="tw-next"'), 'the order: hero, fight, aspects, actions, up next');
  assert.match(heroHtml(cur, esc), /Now assimilating[\s\S]*tw-hero-name/); assert.match(h, /Nothing surpassed yet/); assert.match(h, /<details class="tw-fold tw-take"/);
  assert.match(chipsHtml({ size: { bytes: 700, scripts: 0, nodes: 20, routes: 1 }, weight: 900 }, esc), /700 B<\/b> · 1 KB club[\s\S]*<b>0<\/b> scripts[\s\S]*<b>20<\/b> elements[\s\S]*<b>1<\/b> route</);
  assert.match(chipsHtml({ size: null, weight: null }, esc), /not weighed yet/);
  // the reason line says why, not what the chips and the matchup already show (owner, 2026-10-30: it repeated the counts above it)
  const pinned = { ...cur, pinned: true, page: '/x/', n: 10, m: 12, lost: ['mobile'], weight: 13000, size: { bytes: 11264, scripts: 0, nodes: 187, routes: 11, controls: 22 } };
  const why = (heroHtml(pinned, esc).match(/<p class="tw-why">([^<]*)<\/p>/) || [])[1] || '';
  assert.match(why, /^Why this one: /); assert.doesNotMatch(why, /11 KB|scripts|elements|routes|aspects|loses|until Verse surpasses/, why);
  assert.match(actionsHtml({ id: 'x', page: '/x/', url: 'https://x.com/' }, esc), /Open Verse's page[\s\S]*Side by side[\s\S]*Visit/); assert.match(actionsHtml({ id: 'x' }, esc), /No Verse page yet/);
});
test('the want card and the Versus card name the same site: both rank with the target, so the fight in progress leads on each', async () => {
  const fs = await import('node:fs'), { towerArgs } = await import('../void-live-deploy/lib/tower.js');
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8')); } catch (_) { return null; } };
  const inv = rd('lap.items.json'), files = { ev: rd('tower.evidence.json'), fr: rd('tower.frontier.json'), rk: rd('tower.rank.json'), sz: rd('tower.size.json'), tg: rd('tower.target.json') };
  const raw = (inv && inv.onlySite) || [], cats = raw.map((r) => ({ category: r.category, status: r.status, skills: r.skills })); // skills/tower.js passes the rows, /api/will the categories
  const card = tower(...towerArgs(raw, files)), will = tower(...towerArgs(cats, files));
  assert.equal(will.floors[will.marker - 1].id, card.floors[card.marker - 1].id); assert.equal(towerLine(will), towerLine(card));
  const tgt = files.tg && files.tg.id && card.floors.find((f) => f.id === files.tg.id);
  if (tgt && !tgt.beaten && !tgt.held) assert.equal(card.floors[card.marker - 1].id, tgt.id, 'the target stays first until it is beaten');
  assert.equal(towerArgs([], {}).length, 7); assert.equal(towerArgs([], { tg: {} })[6], null);
});
test('a held site says why in the Versus line, so all aspects ahead and none surpassed explains itself', () => {
  const t = { floors: [{ site: 'heycolor.com', n: 16, m: 16, held: 'not yet better at painting a picture' }], marker: 1, beaten: 0 };
  assert.equal(towerLine(t), 'Versus: now heycolor.com (Verse ahead on 16 of 16 aspects; held: not yet better at painting a picture), 0 surpassed');
});

test('a default-bar score is never a lead: it is not counted ahead, it keeps the floor open, and it cannot make a site surpassed (owner card, 2026-10-29)', async () => {
  const { gate, passes, barRow } = await import('../void-live-deploy/lib/tower.js');
  const { matchRows, vsHtml, verseTake } = await import('../void-live-deploy/skills/tower.js'); const esc = (s) => String(s);
  const at = '2026-10-29T05:59:18.672Z', bar = (verdict, what) => ({ verdict, verse: 0, best: 0, at, evidence: 'Verse (/fanfic/) 0' + what + ' vs the bar (sycophanthex.com unreachable) 0' + what });
  const ev = { mobile: bar('equal-and-better', ' px sideways overflow at 390 px'), design: bar('better', ' design faults'), speed: { verdict: 'better', verse: 90, best: 200, at, evidence: 'Verse (/fanfic/) 90 ms vs sycophanthex.com 200 ms' } };
  assert.equal(barRow(ev.mobile), true); assert.equal(barRow(ev.speed), false);
  assert.equal(passes('mobile', ev.mobile), false, 'a row against the default bar is not a pass'); assert.equal(passes('speed', ev.speed), true);
  const floor = { id: 'fanfic', site: 'sycophanthex.com', url: 'https://sycophanthex.com/', aspects: ['mobile', 'design', 'speed'] }, g = gate(floor, ev);
  assert.equal(g.n, 1, 'only the aspect measured on the site counts as ahead'); assert.equal(g.beaten, false, 'never surpassed on numbers that are not its own');
  assert.ok(g.left.includes('design') && g.left.includes('mobile') && !g.left.includes('speed')); assert.ok(g.incomplete.includes('mobile') && g.incomplete.includes('design'), 'the card lists them as not measured');
  const f = { ...floor, ...g, ev, state: 'current' }, rows = Object.fromEntries(matchRows(f).map((r) => [r.a, r]));
  for (const a of ['mobile', 'design']) { assert.equal(rows[a].v, 'open'); assert.equal(rows[a].say, 'not measured: the site turned the gate away'); }
  assert.match(vsHtml(f, esc), /2 of \d+ aspects are not measured: sycophanthex\.com turned the gate away/);
  const take = verseTake({ floors: [f], beaten: 0 }).now; assert.match(take, /I lead on speed\./); assert.doesNotMatch(take, /lead on[^.]*(mobile|design)/);
  const all = gate(floor, { mobile: bar('better', ' px'), design: bar('better', ' faults'), speed: ev.speed }); assert.equal(all.beaten, false, 'two default-bar wins and one real win are not a surpass');
});

test('the frontier is smallest first: a site the scan counted by its fewest controls, then its fewer bytes, before a site it did not count', async () => {
  const { frontierOf } = await import('../void-live-deploy/lib/tower.js');
  const fr = { sites: [{ site: 'old.test', hardness: 1 }, { site: 'heavy.test', controls: 3, bytes: 90000, hardness: 40 }, { site: 'light.test', controls: 3, bytes: 4000, hardness: 50 }, { site: 'few.test', controls: 1, bytes: 800000, hardness: 60 }] };
  assert.deepEqual(frontierOf(fr, []).map((x) => x.host), ['few.test', 'light.test', 'heavy.test', 'old.test']);
  assert.deepEqual(frontierOf(fr, []).map((x) => [x.controls, x.bytes]), [[1, 800000], [3, 4000], [3, 90000], [null, null]]);
});

test('the queue ranks on measured rows only: a loss against the default bar (the site turned the gate away) never moves a site back', async () => {
  const { judgeRows } = await import('./tower-self.mjs');
  const fr = { sites: [{ site: 'plain.test', hardness: 5 }, { site: 'away.test', hardness: 5 }] };
  const first = aspectsOf({ id: 'x', site: 'x', url: 'https://x.test/', extra: [] })[0];
  const ev = { 'away.test': { [first]: { verdict: 'worse', evidence: '1.2 s vs the bar (away.test unreachable)' } }, 'plain.test': { [first]: { verdict: 'worse', evidence: 'Verse 3 s, plain.test 1 s' } } };
  const t = tower([], ev, fr), at = (id) => t.floors.findIndex((f) => f.id === id), away = t.floors[at('away.test')];
  assert.ok(at('away.test') < at('plain.test'), 'a real loss waits; a default-bar loss does not');
  assert.deepEqual([away.lost, away.rankLost, away.barred], [[first], [], [first]], 'the card still shows the loss, the queue does not rank on it');
  assert.match(easeLine(away), /1 of them not measured: the site turned the gate away/);
  const j = judgeRows({ id: 'away.test', site: 'away.test', url: 'https://away.test/', extra: [] }, ev['away.test']);
  assert.deepEqual(j.jobs.find((x) => x.aspect === first), { aspect: first, evidence: 'not measured yet: away.test turned the gate away, so only the default bar was scored' });
});
