// The tower rules (docs/TOWER-RULES.md), one test per rule, on the real published files where it can. Any change to the tower must keep these
// green; tools/checks.mjs runs this file, so a broken rule fails the build. Run: node --test tools/tower-rules.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { tower, towerArgs, FLOORS, passingRows, notFloorOf, assimOf, pageGroups, countsOf, towerLine, outclassLine, MIN_FEATURES } from '../void-live-deploy/lib/tower.js';
import { towerHtml, attemptLogOf } from '../void-live-deploy/skills/tower.js';
import { siteSlug } from '../void-live-deploy/lib/obituary.js';
import { buildable } from '../void-live-deploy/lib/gate-badge.js';
import { advance, stallCheck, HOLD_DAYS } from './tower-target.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), SITE = path.join(ROOT, 'void-live-deploy');
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SITE, f), 'utf8')); } catch (_) { return null; } };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
// the tower as the site serves it, from the same files and arguments the card reads (skills/tower.js load)
const files = { ev: rd('tower.evidence.json'), fr: rd('tower.frontier.json'), rk: rd('tower.rank.json'), sz: rd('tower.size.json'), tg: rd('tower.target.json'), ft: rd('tower.features.json'), gn: rd('tower.gone.json'), pa: rd('parity.json') };
const served = () => { const inv = rd('lap.items.json'), t = tower(...towerArgs((inv && inv.onlySite) || [], files)); t.inventory = files.pa; t.target = files.tg; return t; };
const RULES = fs.readFileSync(path.join(ROOT, 'docs', 'TOWER-RULES.md'), 'utf8');
const hand = new Set(FLOORS.map((f) => f.id));

test('the rules file exists, is linked from the board and the tower skill, and states the rules in neutral words', () => {
  for (let i = 1; i <= 13; i++) assert.match(RULES, new RegExp('^' + i + '\\. \\*\\*', 'm'), 'rule ' + i);
  assert.doesNotMatch(RULES, /\bowner\b|\bhe said\b|[“”]/i, 'no attributions or quotes');
  assert.match(fs.readFileSync(path.join(ROOT, 'docs', 'TAGTEAM.md'), 'utf8'), /docs\/TOWER-RULES\.md|TOWER-RULES\.md/);
  assert.match(fs.readFileSync(path.join(SITE, 'skills', 'tower.js'), 'utf8').split('\n').slice(0, 8).join('\n'), /docs\/TOWER-RULES\.md/);
  assert.match(fs.readFileSync(path.join(ROOT, 'tools', 'checks.mjs'), 'utf8'), /tower-rules\.test\.mjs/, 'checks.mjs runs these tests');
});

test('rule 1: a stub, settled, unstudied or thinly studied site is never a floor; the served climb holds only studied real sites', () => {
  const pa = { sites: { 'real.example': { total: 12, pct: 40, gaps: [] }, 'thin.example': { total: 2, pct: 90, gaps: [] }, 'placeholder.example': { total: 3, pct: 50, gaps: ['A full feature study of this site (not written yet)'] } } };
  assert.equal(notFloorOf({ host: 'real.example', controls: 40, bytes: 90000 }, null, pa), '');
  assert.match(notFloorOf({ host: 'stub.example', controls: 0, bytes: 1200 }, null, pa), /stub/);
  assert.match(notFloorOf({ host: 'parked.example' }, { sites: { 'parked.example': { controls: 1, bytes: 900 } } }, pa), /stub/);
  assert.match(notFloorOf({ host: 'random.example', controls: 50, bytes: 90000 }, null, pa), /not studied/);
  assert.match(notFloorOf({ host: 'thin.example', controls: 50, bytes: 90000 }, null, pa), /only 2 features/);
  assert.match(notFloorOf({ host: 'placeholder.example', controls: 50, bytes: 90000 }, null, pa), /only 2 features/);
  assert.match(notFloorOf({ host: 'real.example', controls: 40, bytes: 90000 }, null, pa, new Set(['real.example'])), /settled/);
  const fr = { sites: [{ host: 'stub.example', controls: 0, bytes: 1200 }, { host: 'random.example', controls: 50, bytes: 90000 }, { host: 'real.example', controls: 40, bytes: 90000 }] };
  const t = tower([], {}, fr, null, null, null, null, null, null, null, pa);
  const ids = t.floors.map((f) => f.id);
  assert.ok(!ids.some((id) => /stub\.example|random\.example/.test(id)), 'the stub and the unstudied site stay off the climb');
  assert.ok(t.notFloors.length >= 2, 'they stay in data as candidates');
  const s = served();
  for (const f of s.floors) if (!hand.has(f.id)) assert.equal(notFloorOf({ host: f.host || f.site }, files.sz, files.pa), '', f.id + ' is on the climb but not a floor');
  const cur = s.floors.find((f) => f.state === 'current');
  assert.ok(cur, 'the served tower has a current floor');
  assert.ok(hand.has(cur.id) || notFloorOf({ host: cur.host || cur.site }, files.sz, files.pa) === '', cur.id + ' is a real, studied site');
});

test('rule 2: the climb is closest first (by assimilation), and size never orders it', () => {
  // within one band (buildable now, needs a partner or a licence, far future, deferred), closest first; the bands keep that order
  const s = served(), band = (f) => (buildable(f.badge) ? 0 : 1) * 4 + (f.farFuture ? 2 : 0) + (f.defer ? 1 : 0);
  const q = s.floors.filter((f) => !f.beaten && f.state !== 'passed' && !f.pinned);
  assert.ok(q.length > 100, 'the climb has its floors');
  for (let i = 1; i < q.length; i++) {
    const a = q[i - 1], b = q[i];
    assert.ok(band(a) <= band(b), a.id + ' before ' + b.id + ': the bands keep their order');
    if (band(a) === band(b) && !a.rankLost.length === !b.rankLost.length) assert.ok(a.assim >= b.assim, a.id + ' (' + a.assim + '%) before ' + b.id + ' (' + b.assim + '%)');
  }
  const far = s.floors.filter((f) => f.farFuture).map((f) => f.id).join(' ');
  assert.match(far, /amazon|shop/i, 'Amazon is a far floor'); assert.match(far, /youtube|video/i, 'YouTube is a far floor');
  const sz = { sites: Object.fromEntries(FLOORS.map((f, i) => [String(f.url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''), { controls: 5 + i, bytes: 30000 + i * 1000 }])) };
  const a = tower([], {}, null, null, null, null, null, null, null, null, files.pa).floors.map((f) => f.id), b = tower([], {}, null, null, null, sz, null, null, null, null, files.pa).floors.map((f) => f.id);
  assert.deepEqual(b, a, 'page size changes nothing');
  assert.equal(assimOf({ beaten: false, m: 10, n: 10, measured: true }, null) <= 99, true, 'never 100 unless assimilated');
});

test('rule 3: a floor never yields on a timer; its open aspects are retried', () => {
  assert.equal(HOLD_DAYS, Infinity);
  const floors = [{ id: 'a', n: 2, m: 12, open: ['speed'], left: ['speed'], lost: [] }, { id: 'b', n: 11, m: 12, open: [], left: [], lost: [] }];
  for (const today of ['2026-11-10', '2027-01-01', '2030-06-01']) {
    assert.equal(stallCheck({ id: 'a', n: 2, since: '2026-10-01', progressAt: '2026-10-01' }, floors, today).stalled, false);
    const { file } = advance({ id: 'a', n: 2, since: '2026-10-01', progressAt: '2026-10-01' }, floors, today);
    assert.equal(file.id, 'a', 'still the floor on ' + today);
    assert.ok((file.background || []).some((x) => x.id === 'a' && /^retry: /.test(x.job)));
  }
});

test('rule 4: leading with aspects still open is not assimilated; every aspect verified is', () => {
  const f = FLOORS.find((x) => x.id === 'coin flip');
  const lead = { speed: { verdict: 'better', evidence: 'gate', verse: 1, best: 2 } };
  const t1 = tower([], { 'coin flip': lead }, null, null, null, null, 'coin flip', []);
  assert.equal(t1.floors.find((x) => x.id === 'coin flip').beaten, false);
  assert.equal(countsOf(t1).assimilated, 0);
  const t2 = tower([], { 'coin flip': passingRows(f) }, null, null, null, null, 'coin flip', []);
  assert.equal(t2.floors.find((x) => x.id === 'coin flip').beaten, true);
  assert.equal(countsOf(t2).assimilated, 1);
});

const STATUS_WORDS = /\b(surpass\w*|outclass\w*|conquer\w*|defeat\w*|beaten|passed|parity)\b/i;
const BOASTS = /\b(crush\w*|destroy\w*|dominat\w*|obliterat\w*|annihilat\w*|killshot|fatality|smash\w*|humiliat\w*|best in the world|unbeatable|victory)\b/i;
const cards = () => { const s = served(), f = FLOORS.find((x) => x.id === 'coin flip'), t = tower([], { 'coin flip': passingRows(f) }, null, null, null, null, null, [], null, null, files.pa); t.inventory = files.pa; return [s, t]; };

test('rule 5: one status word, assimilated, on the card and in the score lines', () => {
  for (const t of cards()) {
    const h = text(towerHtml(t, esc, { now: Date.parse('2026-11-09T12:00:00Z') }));
    assert.match(h, /assimilated/); assert.doesNotMatch(h, STATUS_WORDS);
    for (const line of [towerLine(t), outclassLine(t)]) { assert.match(line, /assimilated/); assert.doesNotMatch(line, STATUS_WORDS); }
  }
});

test('rule 6: no boast words on the card or a rival page', async () => {
  const { rivalPageHtml } = await import('../void-live-deploy/lib/rival-page.js');
  for (const t of cards()) assert.doesNotMatch(text(towerHtml(t, esc)), BOASTS);
  const r = rd('rivals/flightconnections.com.json'); assert.ok(r);
  assert.doesNotMatch(text(rivalPageHtml(r, rd('history/flightconnections.com.json'), esc)), BOASTS);
});

test('rule 7: the History is the rival\'s own, cited, and never Verse\'s attempt log', () => {
  const s = served(), cur = s.floors.find((f) => f.state === 'current'), h = rd('history/' + siteSlug(cur.site) + '.json');
  assert.ok(h && Array.isArray(h.events), 'the current rival has a history file');
  s.history = h; const html = towerHtml(s, esc);
  const cited = h.events.filter((e) => !e.u && e.s);
  if (cited.length) { assert.match(html, /class="tw-history"/); for (const e of cited.slice(0, 3)) assert.ok(html.includes(esc(e.s)), 'cites ' + e.s); }
  assert.doesNotMatch(text(html), /gave way|gives way|took on|taking on|held the tower|attempt/i);
  for (const e of h.events) if (!e.u) assert.ok(e.s && /^https?:\/\//.test(e.s), 'every known fact links its source');
});

test('rule 8: every floor has its rival page, kept current by the deploy and the gate', async () => {
  assert.ok(fs.existsSync(path.join(SITE, 'rival', 'index.html')));
  const idx = rd('rivals/index.json'); assert.ok(idx && idx.rivals);
  for (const f of served().floors) assert.ok(fs.existsSync(path.join(SITE, 'rivals', siteSlug(f.site) + '.json')), f.site + ' has no rival page');
  // the files are regenerated on every deploy and every gate run (deploy.yml, tower-gate.yml); here: every served floor has one and the index maps it
  const { build } = await import('./rival-pages.mjs'); assert.equal(typeof build, 'function');
  for (const f of served().floors) assert.ok(idx.rivals[f.site] || idx.rivals[siteSlug(f.site)], f.site + ' is not in rivals/index.json');
  assert.match(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8'), /node tools\/rival-pages\.mjs/, 'deploy.yml regenerates the rival pages');
  const gate = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'tower-gate.yml'), 'utf8');
  assert.match(gate, /node tools\/tower-gate\.mjs --versus/);
  assert.doesNotMatch(gate, /node tools\/rival-pages\.mjs/);
});

test('rule 8: a rival page shows only cited facts, escapes what it reads, and names the rival in plain text', async () => {
  const { rivalPageHtml, historyRows, rivalTitle } = await import('../void-live-deploy/lib/rival-page.js');
  const h = { events: [{ k: 'Founding', t: 'Founded: unknown (no source found yet)', u: 1 }, { k: 'Launch', t: 'Launched in 2009', s: 'https://en.wikipedia.org/wiki/X' }, { k: 'Bad', t: 'no link', s: 'javascript:alert(1)' }] };
  assert.deepEqual(historyRows(h).map((x) => x.text), ['Launched in 2009', 'no link']); assert.equal(historyRows(h)[1].source, '', 'only an https source is linked');
  const html = rivalPageHtml({ site: '<b>x</b>', features: [{ feature: '<img src=x>', area: 'a', status: 'missing', original: 'o', verse: 'v' }], lacks: [{ feature: 'f', status: 'missing' }], match: {} }, h, esc);
  assert.doesNotMatch(html, /<img|<b>x/); assert.doesNotMatch(html, /unknown \(no source/); assert.match(html, /Launched in 2009/);
  assert.equal(rivalTitle({ site: 'flightconnections.com' }), 'flightconnections.com');
});

test('rule 9: a combined Verse page carries the union of its rivals\' features and is assimilated only when all its rivals are', () => {
  const idx = rd('rivals/index.json');
  for (const [page, g] of Object.entries(idx.pages)) {
    const names = new Set((g.union || []).map((u) => u.feature));
    for (const site of g.rivals) { const r = rd('rivals/' + siteSlug(site) + '.json'); if (!r) continue; for (const x of r.features || []) assert.ok(names.has(x.feature), page + ' lacks ' + site + "'s " + x.feature); }
  }
  const groups = pageGroups([{ id: 'a', page: '/x/?mode=1', beaten: true }, { id: 'b', page: '/x/', beaten: false }, { id: 'c', page: '/y/', beaten: true }]);
  assert.equal(groups['/x/'].assimilated, false); assert.equal(groups['/y/'].assimilated, true);
  assert.ok(MIN_FEATURES >= 3);
});

test('rule 10: the card shows no Verse dates, clocks, takes or attempt log; the log stays in data for the activity page', () => {
  for (const t of cards()) {
    const h = towerHtml(t, esc), x = text(h);
    assert.doesNotMatch(x, /\bsince\b|\bupdated\b|Verse's take|last measured|\bago\b|tried, and when/i);
    assert.doesNotMatch(x, /\b20\d\d-\d\d-\d\d\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b|\d{1,2}:\d\d(:\d\d)? ?[AP]M/, 'no dates or clock times');
    assert.doesNotMatch(h, /href="\/assimilated\/"/);
  }
  assert.ok(Array.isArray(attemptLogOf(served())), 'the attempt log is still built from tower.target.json');
});

test('rule 11: names in plain text, no logos; each floor shows its gate badge', () => {
  for (const t of cards()) {
    const h = towerHtml(t, esc);
    assert.doesNotMatch(h, /favicons|tower\.icons\//i);
    for (const img of h.match(/<img[^>]*>/g) || []) assert.match(img, /src="\/verse-logo\.webp"/, 'only Verse\'s own mark is an image: ' + img.slice(0, 80));
    const cur = t.floors.find((f) => f.state === 'current'); if (cur) assert.match(h.split('class="tw-cur"')[1] || '', /tw-gate|data-gate/, 'the current floor has its gate badge');
  }
});

test('rule 12 and 13: studies respect robots.txt, and the current floor\'s gaps go to the build queue', () => {
  const scan = fs.readFileSync(path.join(ROOT, 'tools', 'feature-scan.mjs'), 'utf8');
  assert.match(scan, /robots\.txt respected/); assert.match(scan, /Missing features become build jobs on Verse's queue/);
  assert.match(scan, /tower\(\[\], ev, null, null, null, null, null, null, null, null, pa\)/, 'the queue follows the closest-first climb');
  assert.match(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'feature-scan.yml'), 'utf8'), /--queue/);
});
