// The book (lib/guide.js, tools/guide.mjs, skills/guide.js): the one line read off a skill's header, the examples and family
// parts read off its text, the games read off the rack, the chapters and pages, page numbering, the index at the back, and
// completeness: every skill in skills/index.json (a family opened into its members) is on exactly one page of the real book.
// Run: node --test tools/guide.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { oneLine, listOf, partsOf, gamesOf, miniDocOf, miniOwners, asksInHeader, compose, glows, GLOW_ABOVE, spreadOf, pagesOfSpread, glyphSvg, openerSvg, seedOf, TIERS, TIER_MEANING } from '../void-live-deploy/lib/guide.js';
import { bookFromRepo, textOf, OUT } from './guide.mjs';
import guideSkill, { guideOf, pageHtml, tocHtml } from '../void-live-deploy/skills/guide.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the one line is the first sentence of the header after the skill name, with builder notes left out', () => {
  assert.equal(oneLine('/**\n * tide skill — the next high and low tide for a place (Open-Meteo, no key). "tide in Lisbon".\n * Contract: { name, examples }\n */', 'tide'), 'The next high and low tide for a place');
  assert.equal(oneLine('/**\n * weather skill — Open-Meteo, no key\n * Contract: { name, examples, match(lower, text), run(text, api) }\n */', 'weather'), 'Open-Meteo, no key');
  assert.equal(oneLine('/**\n * sky — "sky", "the night sky": the stage becomes the real sky overhead (skills/sky-world.js) and a card sits\n * on top of it. The first skill to own the stage.\n */', 'sky'), '"sky", "the night sky": the stage becomes the real sky overhead and a card sits on top of it');
  assert.equal(oneLine('/**\n * remind skill — "remind me at 5" (plan item 7)\n * Uses the confirm line already in lib/approval-core.js\n */', 'remind'), '"remind me at 5": uses the confirm line already in lib/approval-core.js', 'a line that is only a quoted ask carries the next sentence');
  assert.equal(oneLine('/**\n * routine — frontier #13\'s first piece. "call this my morning" keeps the last few asks as a routine.\n */', 'routine'), '"call this my morning" keeps the last few asks as a routine', 'a build-order number is dropped');
  assert.equal(oneLine('/**\n * clock miniature — a brass desk clock that keeps real time.\n */', 'clock'), 'A brass desk clock that keeps real time');
  assert.equal(oneLine('/**\n * Card\'s miniature: a 12 cm hourglass, glass bulbs in a turned walnut frame.\n */', 'timer'), 'A 12 cm hourglass, glass bulbs in a turned walnut frame');
  assert.equal(oneLine('// no block comment', 'x'), '');
  assert.ok(oneLine('/**\n * long skill — ' + 'word '.repeat(60) + '\n */', 'long').endsWith('word'), 'a long line is kept whole (owner, 2026-10-21)');
});

test('examples, near misses, family parts and header asks are read off a skill file\'s text', () => {
  const src = "/**\n * x skill — \"make a thing\", \"another thing\".\n * parts: ['a', 'b-c']\n */\nexport default { name: 'x', examples: ['make a thing', \"it's one\"], nearMisses: ['not this'] };";
  assert.deepEqual(listOf(src), ['make a thing', "it's one"]);
  assert.deepEqual(listOf(src, 'nearMisses'), ['not this']);
  assert.deepEqual(partsOf(src), ['a', 'b-c']);
  assert.equal(partsOf('export default {}'), null);
  assert.deepEqual(asksInHeader(src), ['make a thing', 'another thing']);
});

test('the games are read off the rack\'s GAMES, the miniature table off docs/miniatures.md, owners off who mounts a kind', () => {
  const rack = "export const GAMES = [\n  { id: 'chess', title: 'Chess', ask: 'play chess', color: '#2c2f38', ink: '#f4e9d2', motif: 'chess' },\n  { id: 'monopoly', title: 'The Landlord’s Game', ask: 'play monopoly', color: '#c8e3c4', ink: '#1d3b25', motif: 'monopoly' },\n];\nexport function rackOf() {}";
  assert.deepEqual(gamesOf(rack).map((g) => g.id + '/' + g.title + '/' + g.ask), ['chess/Chess/play chess', 'monopoly/The Landlord’s Game/play monopoly']);
  const md = '| kind | card | what it does |\n|---|---|---|\n| `clock` | worldtime ("time in Tokyo") | brass desk clock per place |\n| `chess`, `checkers` | the playable boards | see above |';
  assert.deepEqual(miniDocOf(md), { clock: { card: 'worldtime ("time in Tokyo")', what: 'brass desk clock per place' }, chess: { card: 'the playable boards', what: 'see above' }, checkers: { card: 'the playable boards', what: 'see above' } });
  assert.deepEqual(miniOwners(['a', 'b'], (n) => (n === 'b' ? "stageApi.miniature(host, 'clock', {}, {})" : 'nothing')), { clock: 'b' });
});

const sample = () => {
  const files = {
    time: "/**\n * time skill — the time family.\n * parts: ['timer', 'clock']\n */",
    timer: "/**\n * timer skill — countdowns on the stage.\n */\nexport default { examples: ['set a timer for 5 minutes', 'make a timer', 'pause', 'resume'] }",
    clock: "/**\n * clock skill — the clock on the stage: \"make a clock\".\n */\nexport default { examples: [] }",
    chess: "/**\n * chess skill — a real wooden chess set.\n */\nexport default { examples: ['play chess'] }\nstageApi.miniature(view, 'chess', data(), {})",
    growth: "/**\n * growth skill — Verse's growth ledger.\n */\nexport default { examples: ['growth'] }",
  };
  const families = { families: [
    { id: 'time', name: 'Time', for: 'timers and clocks', skills: [{ name: 'timer', tier: 'proven', why: 'a self-test, 2 real asks' }, { name: 'clock', tier: 'tested', why: 'a self-test' }] },
    { id: 'games', name: 'Games', for: 'play', skills: [{ name: 'chess', tier: 'checked', why: 'x' }, { name: 'growth', tier: 'tested', why: 'y' }] },
    { id: 'self', name: 'Verse itself', for: 'how Verse grows', skills: [] },
  ] };
  const games = [{ id: 'chess', title: 'Chess', ask: 'play chess', color: '#2c2f38', ink: '#f4e9d2', motif: 'chess' }, { id: 'growth', title: 'Growing Pains', ask: 'play growth', color: '#111', ink: '#eee', motif: 'go' }, { id: 'voidquest', title: 'VoidQuest', ask: 'play voidquest', color: '#14122b', ink: '#cdbcff', motif: 'monopoly' }];
  return compose({ names: ['time', 'chess', 'growth'], read: (n) => files[n] || '', families, games, minis: ['chess', 'clock'], readMini: (k) => (k === 'clock' ? '/**\n * clock miniature — a brass desk clock.\n */' : ''), miniDoc: { chess: { card: 'the playable boards', what: 'see above' } }, core: [{ name: 'page', description: 'A page.', examples: ['what is a black hole'] }] });
};

test('compose: a family skill opens into its members, each on one page in its family; chapters, numbering and the index', () => {
  const b = sample();
  assert.deepEqual(b.unplaced, []);
  assert.deepEqual(b.chapters.map((c) => c.id), ['front', 'time', 'games', 'self', 'minis', 'rules', 'index']);
  assert.deepEqual(b.pages.map((p) => p.n), b.pages.map((_, i) => i + 1), 'pages are numbered 1.. in order');
  assert.deepEqual(b.pages.slice(0, 4).map((p) => p.kind), ['cover', 'how', 'legend', 'toc']);
  const timer = b.pages.find((p) => p.name === 'timer');
  assert.equal(timer.chapter, 'time'); assert.equal(timer.line, 'Countdowns on the stage'); assert.deepEqual(timer.examples, ['set a timer for 5 minutes', 'make a timer', 'pause']); assert.equal(timer.tier, 'proven');
  assert.deepEqual(b.pages.find((p) => p.name === 'clock' && p.kind === 'skill').examples, ['make a clock'], 'an empty examples list falls back to the asks the header quotes');
  const chess = b.pages.find((p) => p.name === 'chess' && p.kind === 'skill');
  assert.equal(chess.title, 'Chess'); assert.equal(chess.game.ask, 'play chess'); assert.equal(chess.examples[0], 'play chess');
  const vq = b.pages.find((p) => p.kind === 'game'); assert.equal(vq.title, 'VoidQuest'); assert.equal(vq.chapter, 'games');
  const t = b.chapters.find((c) => c.id === 'time'); assert.equal(b.pages[t.from - 1].kind, 'opener'); assert.equal(b.pages[t.to - 1].name, 'clock');
  const minis = b.pages.filter((p) => p.kind === 'mini');
  assert.deepEqual(minis.map((p) => p.name + ':' + p.owner + ':' + p.line), ['chess:chess:The 3D version of the chess card.', 'clock:clock:A brass desk clock']);
  assert.deepEqual(b.index.map((e) => e.name), ['Chess', 'Chess (3D)', 'Clock', 'Clock (3D)', 'Growing Pains', 'Growth', 'Timer', 'VoidQuest'], 'A to Z, a boxed game under its box name and its own');
  assert.ok(b.index.every((e) => b.pages[e.page - 1] && (b.pages[e.page - 1].title === e.name.replace(' (3D)', '') || b.pages[e.page - 1].name === e.name.toLowerCase())), 'the index points at the right pages');
  assert.deepEqual(b.totals, { pages: b.pages.length, chapters: 7, skills: 4, games: 3, minis: 2 });
  assert.equal(b.pages[b.pages.length - 1].kind, 'index');
});

test('spreads: the cover alone on the right, then pairs', () => {
  assert.equal(spreadOf(1), 0); assert.equal(spreadOf(2), 1); assert.equal(spreadOf(3), 1); assert.equal(spreadOf(4), 2);
  assert.deepEqual(pagesOfSpread(0, 9), [0, 1]); assert.deepEqual(pagesOfSpread(1, 9), [2, 3]); assert.deepEqual(pagesOfSpread(4, 9), [8, 9]); assert.deepEqual(pagesOfSpread(5, 10), [10, 0]);
});

test('every page has a glyph of its own, the same on every visit, with no image file and no network', () => {
  const b = sample();
  for (const p of b.pages) { const g = glyphSvg(p); assert.match(g, /^<svg class="gglyph"/); assert.ok(!/<img|url\(|http/.test(g), 'inline only'); assert.equal(g, glyphSvg(p)); }
  assert.notEqual(glyphSvg(b.pages.find((p) => p.name === 'timer')), glyphSvg(b.pages.find((p) => p.name === 'clock' && p.kind === 'skill')), 'two skills of one family differ');
  assert.match(glyphSvg(b.pages.find((p) => p.name === 'chess' && p.kind === 'skill')), /♞/, 'a boxed game wears its box motif');
  assert.equal(seedOf('clock'), seedOf('clock'));
  const op = openerSvg(b.pages[4], b); assert.equal((op.match(/data-page="/g) || []).length, 2, 'the opener composes its skills\' glyphs');
});

test('the rating words are the four tiers, each with a meaning for the front matter', () => {
  assert.deepEqual(Object.keys(TIER_MEANING).sort(), [...TIERS].sort());
  for (const t of TIERS) assert.ok(TIER_MEANING[t].length > 10);
});

test('the reader: pages render to HTML with try-it asks as data-ask links, the contents jump by page', () => {
  const b = sample(), esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const timer = pageHtml(b.pages.find((p) => p.name === 'timer'), b, esc);
  assert.match(timer, /data-ask="set a timer for 5 minutes"/); assert.match(timer, /Countdowns on the stage/); assert.match(timer, /proven/); assert.match(timer, /<svg class="gglyph"/);
  assert.match(pageHtml(b.pages[2], b, esc), /nothing checks it yet/, 'the legend says what each word means');
  assert.match(pageHtml(b.pages[1], b, esc), /data-ask="what is a black hole"/, 'how to ask lists the page\'s own built-ins');
  const toc = tocHtml(b, esc); assert.match(toc, /data-page="5"/); assert.match(toc, /Time/);
  const idx = pageHtml(b.pages[b.pages.length - 1], b, esc); assert.match(idx, /data-page="/); assert.match(idx, /VoidQuest/);
  for (const p of b.pages) assert.ok(pageHtml(p, b, esc).length > 20, p.kind + ' renders');
  assert.match(pageHtml(b.pages.find((p) => p.kind === 'mini' && p.name === 'chess'), b, esc), /data-page="/, 'a miniature page links to its card\'s page');
});

test('the skill opens on the book asks and leaves books, notes and the self page alone', () => {
  for (const a of guideSkill.examples) assert.ok(guideSkill.match(a.toLowerCase(), a), a);
  for (const a of ['open the book', 'the guide', 'show me everything you can do', 'everything you can do', 'the manual', 'open the guide', 'strategy guide', 'flip through the book']) assert.ok(guideOf(a), a);
  for (const a of ['what can you do', 'books by octavia butler', 'book called dune', 'open a notepad', 'guide me to the station', 'a book about dogs', 'the book thief', 'menu', 'help']) assert.ok(!guideOf(a), a + ' is not the book');
});

test('completeness: the real book has every skill in skills/index.json (families opened) on exactly one page, every rack game and every miniature, and guide.json is what the generator writes', () => {
  const b = bookFromRepo();
  const names = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  const members = names.flatMap((n) => partsOf(readFileSync(resolve(root, 'void-live-deploy/skills/' + n + '.js'), 'utf8')) || [n]);
  const where = {}; for (const p of b.pages) if (p.kind === 'skill') where[p.name] = (where[p.name] || 0) + 1;
  const missing = members.filter((n) => !where[n]), twice = Object.entries(where).filter(([, c]) => c > 1).map(([n]) => n);
  assert.deepEqual(missing, [], 'skills on no page'); assert.deepEqual(twice, [], 'skills on two pages'); assert.deepEqual(b.unplaced, []);
  assert.equal(b.totals.skills, members.length);
  const games = gamesOf(readFileSync(resolve(root, 'void-live-deploy/skills/rack.js'), 'utf8'));
  for (const g of games) assert.ok(b.pages.some((p) => p.game && p.game.title === g.title), g.title + ' is in the games chapter');
  const minis = readdirSync(resolve(root, 'void-live-deploy/skills/mini')).filter((f) => f.endsWith('.js') && f !== 'sample.js').map((f) => f.replace(/\.js$/, ''));
  for (const k of minis) assert.ok(b.pages.some((p) => p.kind === 'mini' && p.name === k), k + ' is in the miniatures chapter');
  for (const n of members) assert.ok(b.index.some((e) => e.page === b.pages.find((p) => p.kind === 'skill' && p.name === n).n), n + ' is in the index');
  for (const p of b.pages) if (p.kind === 'skill') { assert.ok(p.line && p.line.length > 3, p.name + ' has a line'); assert.ok(TIERS.includes(p.tier)); }
  assert.equal(readFileSync(OUT, 'utf8'), textOf(b), 'void-live-deploy/skills/guide.json is stale: node tools/guide.mjs');
});

// asked by Verse: a 'proven' glow on a skill's book page when its success_rate in families.json is above 0.9
test('a skill page glows only when its success_rate is above 0.9, and the glow is drawn', () => {
  assert.equal(GLOW_ABOVE, 0.9);
  for (const [r, want] of [[1, true], [0.999, true], [0.91, true], [0.9, false], [0.882, false], [0, false], [undefined, false], ['1', false], [1.2, false]]) assert.equal(glows(r), want, String(r));
  const fam = { families: [{ id: 'stage', name: 'S', skills: [{ name: 'a', tier: 'proven', why: 'w', success_rate: 0.97 }, { name: 'b', tier: 'proven', why: 'w', success_rate: 0.8 }, { name: 'c', tier: 'tested', why: 'w' }] }] };
  const b = compose({ names: ['a', 'b', 'c'], read: (n) => '/**\n * ' + n + ' skill: it does a thing.\n */', families: fam });
  const by = (n) => b.pages.find((p) => p.kind === 'skill' && p.name === n);
  assert.equal(by('a').glow, 97); assert.equal(by('b').glow, undefined); assert.equal(by('c').glow, undefined);
  assert.match(glyphSvg(by('a')), /drop-shadow.*data-glow="97"/); assert.doesNotMatch(glyphSvg(by('b')), /drop-shadow|data-glow/);
});
