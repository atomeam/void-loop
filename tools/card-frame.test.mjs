// Verse cards (lib/card-frame.js): every page is a card with stats from the skill's own evidence. Run: node --test tools/card-frame.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardOf, chromeHtml, lookup, editedDaysAgo, CARD_CSS, RARITY } from '../void-live-deploy/lib/card-frame.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy/skills');
const book = JSON.parse(readFileSync(resolve(root, 'guide.json'), 'utf8')), fam = JSON.parse(readFileSync(resolve(root, 'families.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('a proven skill is a mythic card: cost in words said, power from its success rate, toughness from the real asks, collector number from the book', () => {
  const deps = JSON.parse(readFileSync(resolve(root, 'deps.json'), 'utf8')), st = { book, fam, deps }, c = cardOf({ ...lookup(st, 'forge') });
  assert.equal(c.rarity, RARITY.proven); assert.equal(c.rarity.name, 'Mythic');
  assert.equal(c.power, 9); assert.equal(c.toughness, 4, 'forge: "10 real asks in the benchmark" read on 0-9');
  assert.ok(c.cost >= 1 && c.cost <= 6); assert.match(c.typeLine, /^Skill — Making things$/);
  assert.match(c.number, /^\d{3}\/221$|^\d{3}\/\d{3}$/); assert.ok(c.adds.length > 10 && c.adds.length <= 120);
  assert.match(c.tested, /^2026-/);
});

test('the rarity is the evidence rating, nothing else; an unrated or source page has no stats', () => {
  assert.deepEqual(Object.entries(RARITY).map(([k, v]) => k + ':' + v.name), ['proven:Mythic', 'checked:Rare', 'tested:Uncommon', 'experiment:Common']);
  const a = cardOf({ kind: 'Answer' });
  assert.equal(a.rarity, null); assert.equal(a.power, null); assert.equal(a.toughness, null); assert.equal(a.typeLine, 'Answer — from Verse'); assert.equal(a.cost, 0);
  const t = cardOf({ skill: { name: 'x', tier: 'tested', success_rate: 0.5 } });
  assert.equal(t.rarity.name, 'Uncommon'); assert.equal(t.power, 5);
  assert.equal(cardOf({ skill: { name: 'y', tier: 'experiment' } }).power, 0, 'no success rate: the tier stands in');
});

test('every skill in the book makes a card whose numbers stay in a card\'s range, and every family has its own hue', () => {
  const st = { book, fam }; const hues = new Set();
  for (const p of book.pages.filter((x) => x.kind === 'skill')) {
    const c = cardOf({ ...lookup(st, p.name) });
    assert.ok(c.power >= 0 && c.power <= 9 && c.toughness >= 0 && c.toughness <= 99, p.name);
    assert.ok(c.hue >= 0 && c.hue < 360); hues.add(p.chapter + ':' + c.hue);
  }
  assert.ok(hues.size >= 10);
});

test('the chrome is a type bar with a gem, an adds line, and a footer with the plate; a source card has no plate', () => {
  const deps = JSON.parse(readFileSync(resolve(root, 'deps.json'), 'utf8')), c = cardOf({ ...lookup({ book, fam, deps }, 'forge') }), h = chromeHtml(c, esc);
  assert.match(h.type, /class="vc-type"/); assert.match(h.type, /vc-gem/); assert.match(h.adds, /Adds to Verse/);
  assert.match(h.foot, /class="vc-pt"/); assert.match(h.foot, /P<b>9<\/b>/); assert.match(h.foot, /R<b>4<\/b>/); assert.match(h.foot, /Mythic/); assert.match(h.foot, /Verse/);
  const a = chromeHtml(cardOf({ kind: 'Answer' }), esc); assert.doesNotMatch(a.foot, /vc-pt/); assert.equal(a.adds, '');
});

test('the frame is a frame: a coloured border from the family, a title bar, a type bar, a plate; nothing that hides the page\'s own text', () => {
  for (const k of ['.vpage.vcard{', '.vc-title', '.vc-type', '.vc-adds', '.vc-foot', '.vc-pt', 'attr(data-cost)', 'var(--h)']) assert.ok(CARD_CSS.includes(k), k);
  assert.doesNotMatch(CARD_CSS, /display:none/);
});

test('the age of a source is read from its own source line', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  assert.equal(Math.round(editedDaysAgo('Source: Wikipedia · last edited Sep 3, 2026 · as of 3:00 PM', now)), 44);
  assert.equal(editedDaysAgo('Source: Wikipedia', now), null);
  // a dated rate is a fresh source, not a year-old one: the currency card printed R 1 for yesterday's ECB rate
  assert.equal(Math.round(editedDaysAgo('100 USD = 89.85 EUR · ECB rate of Thu, Oct 29, 2026', Date.UTC(2026, 9, 30, 12))), 2);
  assert.equal(Math.round(editedDaysAgo('updated Oct 30, 2026', Date.UTC(2026, 9, 30, 12))), 1);
  assert.equal(editedDaysAgo('as of 12:19 PM', now), null, 'a clock time alone is when it was fetched, not how old the data is');
});

test('the Illuminati layer: income and control arrows come from the real dependency map', () => {
  const deps = JSON.parse(readFileSync(resolve(root, 'deps.json'), 'utf8')), forge = cardOf({ ...lookup({ book, fam, deps }, 'forge') });
  assert.ok(forge.arrowsOut >= 1, 'the forge controls what it imports'); assert.ok(forge.income >= 0);
  assert.match(chromeHtml(forge, esc).arrows, /vc-arrows/); assert.match(chromeHtml(forge, esc).arrows, /\u25b6/);
  assert.doesNotMatch(chromeHtml(cardOf({ kind: 'Answer', sources: 1, ageDays: 3 }), esc).foot, />I</, 'an answer has no income');
});

test('an unknown tier word never gives a negative stat', () => {
  const c = cardOf({ skill: { name: 'z', tier: 'mystery' } });
  assert.ok(c.power >= 0 && c.toughness >= 1);
});

// skill evolution and type-specific layouts (asked by Verse)
import { evolved, noteTier, EVO_KEY, cardOf as cardOf2 } from '../void-live-deploy/lib/card-frame.js';
test('evolution: only a higher rating than the one this browser last saw evolves a card; a first sight, the same or a lower rating does not', () => {
  assert.deepEqual(evolved('checked', 'proven'), { from: 'Rare', to: 'Mythic' });
  assert.deepEqual(evolved('experiment', 'tested'), { from: 'Common', to: 'Uncommon' });
  assert.equal(evolved(undefined, 'proven'), null); assert.equal(evolved('proven', 'proven'), null); assert.equal(evolved('proven', 'checked'), null); assert.equal(evolved('nonsense', 'proven'), null);
  const m = {}; const store = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } };
  assert.equal(noteTier('weather', 'checked', store), null, 'first sight');
  assert.equal(noteTier('weather', 'checked', store), null, 'unchanged');
  assert.deepEqual(noteTier('weather', 'proven', store), { from: 'Rare', to: 'Mythic' });
  assert.equal(noteTier('weather', 'proven', store), null, 'it evolves once');
  assert.equal(JSON.parse(m[EVO_KEY]).weather, 'proven');
  assert.equal(noteTier('x', 'proven', { getItem() { throw new Error('blocked'); }, setItem() {} }), null, 'blocked storage never throws');
});
test('type-specific layouts: Film, Place, Person and Song each have their own hierarchy, and an answer card knows its kind', () => {
  for (const k of ['film', 'place', 'person', 'song']) assert.match(CARD_CSS, new RegExp('data-kind=' + k + '\\]'), k);
  assert.match(CARD_CSS, /data-kind=place\] \.vc-type\{order:-3/, 'a place leads with its type line');
  assert.equal(cardOf2({ entity: { kind: 'Film', chapter: 'stage', also: [], detail: '1965' } }).kindName, 'film');
  assert.equal(cardOf2({ entity: { kind: 'Place', chapter: 'sky', also: [], detail: '' } }).kindName, 'place');
  assert.equal(cardOf2({ skill: { name: 'weather', tier: 'proven' } }).kindName, '');
});

test('a skill card of a song or a film paints that kind\'s art, not the generic skill art (asked by Owner: music cards had the haunted-door art)', () => {
  const esc = (x) => String(x);
  const plain = chromeHtml(cardOf({ skill: { name: 'media-pick', tier: 'experiment' } }), esc).art;
  const song = cardOf({ skill: { name: 'media-pick', tier: 'experiment' }, artKind: 'Song' }), film = cardOf({ skill: { name: 'movie', tier: 'experiment' }, artKind: 'Film' });
  assert.equal(song.artKind, 'Song'); assert.equal(film.artKind, 'Film');
  assert.notEqual(chromeHtml(song, esc).art, plain); assert.notEqual(chromeHtml(song, esc).art, chromeHtml(film, esc).art);
  for (const bad of ['', 'Skill', 'Answer', 'Nonsense', '<script>']) assert.equal(cardOf({ skill: { name: 'x', tier: 'tested' }, artKind: bad }).artKind, '');
});

test('every stat sits on 0-9: resistance grows about 3 a tenfold of proving asks, an answer is as tough as its source is fresh (owner, 2026-10-18)', async () => {
  const { asksResistance, freshness, cardOf } = await import('../void-live-deploy/lib/card-frame.js');
  assert.deepEqual([0, 1, 2, 10, 99, 100, 1000, 50000].map(asksResistance), [0, 1, 2, 4, 7, 7, 9, 9]);
  assert.deepEqual([null, 0, 1, 7, 30, 365, 4000].map(freshness), [1, 9, 8, 6, 5, 1, 1]);
  const fresh = cardOf({ kind: 'Answer', sources: 2, ageDays: 1 }), stale = cardOf({ kind: 'Answer', sources: 2, ageDays: 400 });
  assert.ok(fresh.toughness > stale.toughness, 'a fresh source outlasts a stale one');
  const busy = cardOf({ skill: { name: 'calc', tier: 'proven', success_rate: 1, why: '9999 real asks' } });
  assert.equal(busy.toughness, 9, 'the most-asked skill tops out at 9, not 99');
});

test('a card prints its abilities as keywords, each from a fact: Proven, Fresh, Linked, Sourced', async () => {
  const { cardOf, chromeHtml, keywordsOf } = await import('../void-live-deploy/lib/card-frame.js');
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  assert.deepEqual(keywordsOf({ tier: 'proven', tested: '2026-10-17', arrows: 2, today: '2026-10-18' }), ['Proven', 'Fresh', 'Linked']);
  assert.deepEqual(keywordsOf({ tier: 'tested', tested: '2026-09-01', arrows: 0, today: '2026-10-18' }), []);
  assert.deepEqual(keywordsOf({ fetched: true, sources: 2 }), ['Sourced']);
  assert.deepEqual(keywordsOf({ fetched: true, sources: 1 }), []);
  const c = cardOf({ skill: { name: 'calc', tier: 'proven', success_rate: 1, why: '40 real asks', last_tested: '2026-10-18' }, deps: { imports: ['lib/x.js'], importedBy: [] }, today: '2026-10-18' });
  const h = chromeHtml(c, esc);
  assert.match(h.adds, /class="vc-kw"[^>]*>Proven</); assert.match(h.adds, />Fresh</); assert.match(h.adds, />Linked</);
  assert.equal(chromeHtml(cardOf({ kind: 'Answer', sources: 2, ageDays: 3 }), esc).adds.match(/class="vc-kw"/g).length, 1, 'an answer on two sources is Sourced');
});

test('a card from a skill with a full page links to it (owner, 2026-10-25)', async () => {
  const { pageLinkHtml, PAGE_OF } = await import('../void-live-deploy/lib/card-frame.js');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  assert.match(pageLinkHtml('calendar', esc), /href="\/calendar\/"[^>]*>Open the full Calendar page →<\/a>$/);
  assert.equal(pageLinkHtml('nope', esc), '');
  for (const [, [href]] of Object.entries(PAGE_OF)) assert.match(href, /^(?:\/[a-z0-9-]+)+\/(?:[a-z-]+)?$/);
});

test('the full-page link keeps what the card shows when the card links to its own page with a query (2026-10-30: the translate card opened an empty translator)', async () => {
  const { ownPageOf, pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  assert.equal(ownPageOf('translate', ['https://translate.google.com/', '/translate/?q=good%20morning&to=fr']), '/translate/?q=good%20morning&to=fr');
  assert.deepEqual(pageOfCard('translate', ownPageOf('translate', ['/translate/?q=good%20morning&to=fr'])), ['/translate/?q=good%20morning&to=fr', 'Translate']);
  assert.equal(ownPageOf('translate', ['/translate/']), '', 'no query: the plain page link stays');
  assert.equal(ownPageOf('translate', ['/notes/?q=x']), '', 'another page is not its own');
  assert.equal(ownPageOf('translate', ['/translate/?q=<b>']), '', 'a query that is not plain is not carried');
  assert.equal(ownPageOf('nope', ['/translate/?q=a']), '', 'a skill with no page has none');
  assert.equal(ownPageOf('stl-check', ['/stl/', '/stl/?sample=hole']), '', 'a card that links to its plain page too keeps it: the sample is an extra');
  assert.equal(ownPageOf('baseconv', ['/base-converter/?b=16&v=ff']), '/base-converter/?b=16&v=ff');
});

test('a unit answer opens the unit converter on that ask, not the plain calculator (2026-10-30: "convert 5 miles to km" linked to an empty /calculator/)', async () => {
  const { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  const q = '/convert/?q=' + encodeURIComponent('5 miles to km');
  assert.deepEqual(pageOfCard('calc', q), [q, 'Unit converter']);
  assert.deepEqual(pageOfCard('calc', '/calculator/'), ['/calculator/', 'Calculator'], 'a sum keeps the calculator');
  const src = readFileSync(resolve(root, '../../void.html'), 'utf8');
  assert.match(src, /const um = lower\.match\(CALC_UNIT_RE\);\n\s+if \(um && !hit\) \{\n\s+el\.dataset\.page = '\/convert\/\?q=' \+ encodeURIComponent\(um\[0\]\.trim\(\)\);/);
});

test('a currency answer opens its pair on Markets, not the plain calculator (2026-10-30: "100 usd to eur" linked to /calculator/, which has no rates)', async () => {
  const { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  assert.deepEqual(pageOfCard('calc', '/markets/?s=USDEUR'), ['/markets/?s=USDEUR', 'Markets']);
  const { resolve: market } = await import('../void-live-deploy/lib/markets.js');
  assert.equal(market('USDEUR').sym, 'USD/EUR', 'Markets reads the pair the card sends');
  const src = readFileSync(resolve(root, '../../void.html'), 'utf8');
  assert.match(src, /const \{ amount, from, to \} = cm;\n\s+if \(from !== to\) el\.dataset\.page = '\/markets\/\?s=' \+ from \+ to;/);
});

test('a unit answer read by word maths links to the unit converter too (2026-10-30: live, "5 miles to km" still opened /calculator/), never a fraction\'s tail', () => {
  const src = readFileSync(resolve(root, '../../void.html'), 'utf8');
  const line = src.match(/const CALC_UNIT_RE = (\/.+\/[a-z]*);/);
  assert.ok(line, 'the unit pattern is in void.html');
  const RE = new Function('return ' + line[1])();
  const guard = src.match(/const wu = lower\.match\(CALC_UNIT_RE\); if \(wu && !(\/.+?\/)\.test\(lower\.slice\(0, wu\.index\)\)\) el\.dataset\.page = '\/convert\/\?q=' \+ encodeURIComponent\(wu\[0\]\.trim\(\)\);/);
  assert.ok(guard, 'the word-maths path sets the converter link before it draws');
  const tail = new Function('return ' + guard[1])();
  const page = (ask) => { const wu = ask.match(RE); return wu && !tail.test(ask.slice(0, wu.index)) ? '/convert/?q=' + encodeURIComponent(wu[0].trim()) : ''; };
  assert.equal(page('5 miles to km'), '/convert/?q=' + encodeURIComponent('5 miles to km'));
  assert.equal(page('what is 70 f in c'), '/convert/?q=' + encodeURIComponent('70 f in c'));
  assert.equal(page('3/4 cup in ml'), '', 'a fraction is not handed over as its last number');
  assert.equal(page('2.5 kg to lb'), '/convert/?q=' + encodeURIComponent('2.5 kg to lb'));
  assert.ok(src.indexOf("el.dataset.page = '/convert/?q=' + encodeURIComponent(wu[0].trim());") < src.indexOf("setV(wm.value, wm.note, wsrc)"), 'the link is set before the card is drawn');
});

test('a card whose art box shows the answer\'s photo does not show the same photo again in its body (2026-10-30: the recipe card showed its dish twice)', () => {
  const css = CARD_CSS.join ? CARD_CSS.join('') : String(CARD_CSS);
  assert.match(css, /\.vpage\.vcard>img\[data-vc-art-src\]\{position:absolute;width:0;height:0;margin:0;opacity:0;pointer-events:none\}/);
  const src = readFileSync(resolve(root, '../lib/card-frame.js'), 'utf8');
  assert.match(src, /if \(source === 'photo' && photoImg && photoImg\.parentNode === el\) photoImg\.dataset\.vcArtSrc = '1';/, 'only a photo that stands on its own in the card is the one hidden');
  assert.match(src, /if \(source !== 'photo' \|\| i !== photoImg\) delete i\.dataset\.vcArtSrc;/, 'a card that no longer shows that photo as art shows it in its body again');
});

test('the Adds to Verse line ends at a whole clause or word, never in the middle of a word (2026-10-30: the jobs card ended "or with a pl")', async () => {
  const { addsLine } = await import('../void-live-deploy/lib/card-frame.js');
  const long = 'Remote jobs: "find me work as a designer", "remote jobs for python", "jobs as a writer", and the role first or with a place';
  assert.equal(addsLine(long), 'Remote jobs: "find me work as a designer", "remote jobs for python", "jobs as a writer"');
  const words = 'A card that names every planet and every moon of the outer solar system in the order of their distance from the sun today';
  const w = addsLine(words);
  assert.ok(w.length <= 120 && words.startsWith(w) && words.charAt(w.length) === ' ' && !w.endsWith('\u2026'), w);
  assert.equal(addsLine('A short line'), 'A short line');
  assert.equal(addsLine('  two   spaces  '), 'two spaces');
  assert.equal(addsLine(null), '');
  const card = cardOf({ page: { line: long, chapter: 'world', n: 1 }, book: { pages: [{}] } });
  assert.equal(card.adds, addsLine(long));
});

test('a holiday card opens its day on the Calendar (2026-10-30: live, "how many days until christmas" had no link to any page)', async () => {
  const { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  const { parseLocal } = await import('../void-live-deploy/lib/calendar.js');
  assert.deepEqual(pageOfCard('', '/calendar/?d=2026-12-25&view=day'), ['/calendar/?d=2026-12-25&view=day', 'Calendar']);
  const src = readFileSync(resolve(root, '../../void.html'), 'utf8');
  const line = src.match(/const holidayPage = (\(d\) => .+);/);
  assert.ok(line, 'the holiday link is in void.html');
  const holidayPage = new Function('return ' + line[1])();
  const page = holidayPage(new Date(2026, 11, 25));
  assert.equal(page, '/calendar/?d=2026-12-25&view=day', 'the local day, not the UTC one');
  assert.equal(parseLocal(new URLSearchParams(page.split('?')[1]).get('d')).getDate(), 25, 'the Calendar reads the same day');
  assert.equal(holidayPage(new Date(2027, 0, 1)), '/calendar/?d=2027-01-01&view=day');
  // both holiday cards ("when is christmas", "how many days until christmas") pass it to bigPage, which sets the card's data-page
  assert.equal((src.match(/\(h\.days === 1 \? '' : 's'\), holidayPage\(h\.d\)\);/g) || []).length, 2);
  assert.match(src, /const bigPage = \(title, big, note, page\) => showPage\(\(p\) => \{ if \(page\) p\.dataset\.page = page;/);
});
