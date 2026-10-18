// "tell me about <a skill of V01D's>" (asked by Void): lib/about-skill.js and skills/about-skill.js against the real book, the real
// ratings and the real overlap pairs: every example resolves to its skill, every near miss (Wikipedia's topics, V01D's self page) to
// nothing, the resolve rule holds (named: any page; tagged or bare: an exact hit, bare also a coined name), and the card's facts are right.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAsk, resolveSkill, aboutOf } from '../void-live-deploy/lib/about-skill.js';
import skill, { aboutText, cardHtml, prime, suite } from '../void-live-deploy/skills/about-skill.js';
import { historyAsk } from '../void-live-deploy/lib/match-history.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const book = json('void-live-deploy/skills/guide.json'), fams = json('void-live-deploy/skills/families.json'), overlaps = json('tools/skill-overlap.json');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = (ask) => { const p = resolveSkill(ask, book); return p ? p.name : null; };

test('parseAsk: the phrasings, the wrappers, and what is named or tagged', () => {
  assert.deepEqual(parseAsk('tell me about the chess skill'), { topic: 'chess', named: true, tagged: false });
  assert.deepEqual(parseAsk("What's your weather skill?"), { topic: 'weather', named: true, tagged: false });
  assert.deepEqual(parseAsk("tell me about v01d's forge"), { topic: 'forge', named: true, tagged: false });
  assert.deepEqual(parseAsk('how does the guide skill work'), { topic: 'guide', named: true, tagged: false });
  assert.deepEqual(parseAsk('how do i use the recipe skill'), { topic: 'recipe', named: true, tagged: false });
  assert.deepEqual(parseAsk('what is the chess game'), { topic: 'chess', named: false, tagged: true });
  assert.deepEqual(parseAsk('what is a sim card'), { topic: 'sim', named: false, tagged: true });
  assert.deepEqual(parseAsk('what is family health'), { topic: 'family health', named: false, tagged: false });
  assert.deepEqual(parseAsk('tell me about tokyo'), { topic: 'tokyo', named: false, tagged: false });
  assert.equal(parseAsk('tell me about yourself'), null);
  assert.equal(parseAsk('what can you do'), null);
  assert.equal(parseAsk('define serendipity'), null);
  assert.equal(parseAsk('play chess'), null);
  assert.equal(parseAsk(''), null);
});

test('every example of the skill resolves to the skill it names', () => {
  const want = { 'tell me about the chess skill': 'chess', 'what is the forge skill': 'forge', "what's the define skill": 'define', 'explain the guide skill': 'guide', 'how does the deps skill work': 'deps', 'how do i use the recipe skill': 'recipe' };
  const history = { 'chess match history': 'chess', 'my chess record': 'chess', 'my record against void': 'chess' }; // the match history asks (lib/match-history.js historyAsk), not the book's resolve
  assert.deepEqual(Object.keys(want).concat(Object.keys(history)).sort(), [...skill.examples].sort(), 'the test names every example');
  for (const [ask, name] of Object.entries(want)) assert.equal(nameOf(ask), name, ask);
  for (const [ask, name] of Object.entries(history)) { assert.equal(nameOf(ask), null, ask + ': not an about-ask'); assert.equal(historyAsk(ask).game, name, ask); assert.ok(skill.match(ask, ask), ask + ' matches'); }
});

test('every near miss resolves to nothing: the world keeps its route, V01D its self page', () => {
  for (const ask of skill.nearMisses) if (ask !== 'tell me about zorbleflux') assert.equal(nameOf(ask), null, ask);
  // "tell me about zorbleflux" is zorbleflux's own (ranked first); the rule would also leave it: a bare one-word name
  assert.equal(nameOf('tell me about zorbleflux'), null);
  for (const ask of ['what is time', 'tell me about music', 'what is memory', 'what is a riot', 'what is light', 'what is the weather', 'tell me about chess', 'what is a credit card']) assert.equal(nameOf(ask), null, ask);
});

test('the resolve rule: named takes any page (partial titles too), tagged an exact hit, bare an exact coined name', () => {
  assert.equal(nameOf('what is the chess game'), 'chess');
  assert.equal(nameOf('tell me about your chess'), 'chess');
  assert.equal(nameOf('what is family health'), 'family-health');
  assert.equal(nameOf('what is family-health'), 'family-health');
  assert.equal(nameOf('tell me about the zorbleflux game'), 'zorbleflux');
  assert.equal(nameOf('tell me about the make skill'), 'make', 'a skill a chapter of the same name shadows in pageFor');
  assert.equal(nameOf('what is the sky skill'), 'sky');
  const partial = book.pages.find((p) => p.kind === 'skill' && /\s/.test(p.title) && p.title.toLowerCase() !== p.name.replace(/-/g, ' '));
  if (partial) { const word = partial.title.toLowerCase().split(/\s+/).find((w) => w.length > 4); if (word && !book.pages.some((p) => p.kind === 'skill' && (p.name === word || p.title.toLowerCase() === word))) { assert.equal(nameOf('what is ' + word), null, 'bare partial: the world'); assert.ok(nameOf('what is the ' + word + ' skill'), 'named partial: the book'); } }
  assert.equal(resolveSkill('tell me about the chess skill', null), null);
  assert.equal(resolveSkill('tell me about the chess skill', { pages: [] }), null);
  assert.equal(nameOf('tell me about the games'), null, 'a chapter is not a skill');
});

test('aboutOf: title, line, examples, family, tier, related (overlap pairs first, then the family), try', () => {
  const page = book.pages.find((p) => p.kind === 'skill' && p.name === 'chess');
  const a = aboutOf(page, fams, overlaps, { book });
  assert.equal(a.name, 'chess'); assert.equal(a.title, 'Chess'); assert.equal(a.line, page.line);
  assert.ok(a.examples.length >= 1 && a.examples.length <= 6 && a.examples.includes('play chess'));
  assert.equal(a.family && a.family.id, 'games'); assert.ok(['experiment', 'tested', 'checked', 'proven'].includes(a.tier)); assert.ok(a.why);
  assert.ok(a.related.length >= 1 && a.related.length <= 6 && !a.related.some((r) => r.name === 'chess'));
  assert.ok(a.related.every((r) => r.title && r.ask === 'tell me about the ' + r.name + ' skill'));
  assert.equal(a.tryAsk, 'play chess');
  // the module's own about text wins over the page's line
  assert.equal(aboutOf(page, fams, null, { book, about: '  Its own words. ' }).line, 'Its own words.');
  // overlap partners come first, then the same family; with no overlaps the family alone
  const cal = book.pages.find((p) => p.kind === 'skill' && p.name === 'calendar');
  if (cal) { const r = aboutOf(cal, fams, overlaps, { book }).related; assert.equal(r[0].via, 'overlap'); assert.ok(overlaps.pairs.some((pr) => pr.split('~').includes(r[0].name))); }
  const fo = aboutOf(page, fams, null, { book }).related; assert.ok(fo.length && fo.every((r) => r.via === 'family'));
  // a page with no family and no book still gives a card
  const lone = aboutOf({ kind: 'skill', name: 'x-y', title: 'X y', line: 'a line', examples: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], tier: 'tested', why: 'w', n: 9 }, null, null);
  assert.equal(lone.family, null); assert.equal(lone.tier, 'tested'); assert.equal(lone.examples.length, 6); assert.deepEqual(lone.related, []); assert.equal(lone.tryAsk, 'a');
});

test('the card: escaped, with chips for the examples and the related skills, a try button and a source line', () => {
  const html = cardHtml({ name: 'x', title: 'X <b>', line: 'says "hi"', examples: ['ask <1>', 'ask 2'], family: { id: 'f', name: 'Fam & co' }, tier: 'checked', why: 'a self-test', related: [{ name: 'y', title: 'Y', ask: 'tell me about the y skill', via: 'family' }], tryAsk: 'ask <1>' }, esc);
  assert.ok(html.includes('<h2>X &lt;b&gt;</h2>') && html.includes('Fam &amp; co') && html.includes('checked (a self-test)') && !html.includes('<b>'));
  assert.equal((html.match(/class="about-chip"/g) || []).length, 2); assert.equal((html.match(/class="about-chip rel"/g) || []).length, 1);
  assert.ok(html.includes('data-ask="ask &lt;1&gt;"') && html.includes('class="about-try"') && html.includes('class="src"'));
  assert.equal(aboutText({ default: { about: ' own ' } }), 'own'); assert.equal(aboutText({ ABOUT: 'A' }), 'A'); assert.equal(aboutText({ default: {} }), ''); assert.equal(aboutText(null), '');
});

test('match: a named ask needs no book; a bare coined name needs it; the self-test passes', () => {
  prime(null);
  assert.equal(skill.match('tell me about the chess skill', 'tell me about the chess skill'), true);
  assert.equal(skill.match('what is family health', 'what is family health'), false, 'no book yet: the world answers');
  prime({ book, fam: fams });
  assert.equal(skill.match('what is family health', 'what is family health'), true);
  for (const n of skill.nearMisses) assert.equal(skill.match(n, n), false, n);
  assert.deepEqual(suite().ok, true, suite().got);
  prime(null);
});
