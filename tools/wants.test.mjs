// The wants card (skills/wants.js; owner, 2026-10-18: "name all your unbuilt asks and come up with 50 more new ones" fell to the model,
// which said Verse had no catalog of unbuilt asks and made 50 up). Every phrasing that must reach it does, every near miss stays where it
// was (the will card, the self card, the calendar, the list, the world), a compound ask is matched on its first clause, and the card is
// built from Verse's own records with the three blocks, the count line, tap-to-copy chips, and honest empty and missing states.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import skill, { wantsOf, clauses, moreLine, cardModel, cardHtml, countLine } from '../void-live-deploy/skills/wants.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m = (a) => skill.match(a.toLowerCase(), a);

const REACH = ['what do you want built now', 'what do you want', 'what else do you want', 'name all your wants', 'name all your unbuilt asks', 'what have you not built yet',
  "what haven't you built", 'your backlog', 'what are your open asks', 'what is still open', "what's on your list", 'whats next for you', 'what do you want to learn',
  'name all your unbuilt asks and come up with 50 more new ones', 'What do you want built now?', 'show me your backlog', 'what is in your backlog', 'list your wants',
  'what do you want next', "what's next for you?", 'what did you not build yet', 'your open asks', 'open asks', 'asks not built?', 'asks not built yet', 'unbuilt wants', 'growth inbox', 'the unbuilt list', 'what are your unbuilt asks', 'what is your backlog',
  'what have you left to build', 'what is not built yet', "what's your developmental state", 'tell me your wants, then rank them'];
const STAY = ['what do I want for dinner', "what's next?", "what's on my list", 'open asks please', 'what do you think of yourself', 'what can you do', 'what do you want to be',
  'tell me about yourself', 'what do you want to do', 'what do you want for dinner', 'what is open', 'whats open now', 'your will', 'what is your will', 'make a list',
  'what should i build', 'what do you want from me', 'name all the countries', 'what have you done', 'what have you built', 'what have you built this week', 'what is a backlog',
  'what is a want', 'what is voidquest', 'todo', 'inbox', 'backlog', 'my inbox', 'asks', 'not built', 'tell me about the chess skill', 'weather in paris', ''];

test('match: every phrasing that must reach the card does, and every example of the skill', () => {
  for (const a of REACH) assert.equal(m(a), true, a);
  for (const a of skill.examples) assert.equal(m(a), true, a);
  assert.equal(skill.match('your backlog'), true, 'lower alone is enough');
});

test('match: the near misses stay put (the will card, the self card, the self page, the calendar, the list, the world)', () => {
  for (const a of STAY) assert.equal(m(a), false, a || '(empty)');
  for (const a of skill.nearMisses) assert.equal(m(a), false, a);
  assert.equal(wantsOf(null), false); assert.equal(wantsOf(42), false);
});

test('the page keeps its own asks: "what do you think of yourself", "what can you do", "tell me about yourself", "what do you want to be" never match', () => {
  const page = readFileSync(resolve(root, 'void.html'), 'utf8');
  for (const a of ['what do you think of yourself', 'what can you do', 'tell me about yourself', 'what do you want to be', 'open the self card']) assert.equal(m(a), false, a);
  assert.ok(/function wantsVoice\(/.test(page) && /function wantsWill\(/.test(page) && /function wantsSelfPage\(/.test(page), 'the page handlers these stay with are still there');
  // the skill is ranked before the dates family (calendar takes "whats next for you" and "what's on your list" otherwise) and before the page's own will handler (every skill is)
  const order = readdirSync(resolve(root, 'void-live-deploy/skills/order')).sort();
  const at = (n) => order.findIndex((f) => f.endsWith('-' + n));
  assert.ok(at('wants') >= 0 && at('dates') >= 0 && at('wants') < at('dates'), 'wants is ranked before the dates family: ' + order[at('wants')] + ' vs ' + order[at('dates')]);
});

test('clauses: a compound ask is matched on its first clause; the second asks for new ones and gets one line, or nothing', () => {
  assert.deepEqual(clauses('name all your unbuilt asks and come up with 50 more new ones'), { first: 'name all your unbuilt asks', rest: 'come up with 50 more new ones' });
  assert.deepEqual(clauses('What do you want built now?'), { first: 'what do you want built now', rest: '' });
  assert.deepEqual(clauses('your backlog, then add ten'), { first: 'your backlog', rest: 'add ten' });
  assert.equal(moreLine('come up with 50 more new ones'), 'The 50 new ones are yours to ask for one at a time: I list only what I have, never ones made up on the spot.');
  assert.equal(moreLine('invent some more'), 'The new ones are yours to ask for one at a time: I list only what I have, never ones made up on the spot.');
  assert.equal(moreLine('and why'), ''); assert.equal(moreLine(''), ''); assert.equal(moreLine(null), '');
});

const will = { at: '2026-10-18T03:00:00Z', wants: [{ kind: 'people asked', title: 'learn tides', i_want: 'I want to answer every question about tides.', because: 'asked 9 times' }, { kind: 'join', title: 'one clock', i_want: '', because: '' }, { title: '' }] };
const reflect = { entries: [], asks: [{ ask: 'Give the map card terrain', small: false, kind: 'daily', at: '2026-10-08T18:09:00Z' }, { ask: 'A <b>bold</b> ask', small: true, kind: 'build', at: '2026-10-17T06:00:00Z' }, { ask: '' }, null] };
const self = { open: [{ state: 'open', ask: 'Absorb and connect every repo', from: 'owner, 2026-10-15' }, { title: 'WebMCP origin trial', from: '' }, { ask: '   ' }] };

test('cardModel: the three records become three lists (blank items dropped, text folded), counts, the will date; nothing is guessed', () => {
  const c = cardModel({ will, reflect, self });
  assert.deepEqual(c.wants, [{ text: 'I want to answer every question about tides.', because: 'asked 9 times', kind: 'people asked' }, { text: 'one clock', because: '', kind: 'join' }]);
  assert.deepEqual(c.asks, [{ text: 'Give the map card terrain', at: '2026-10-08', small: false, kind: 'daily' }, { text: 'A <b>bold</b> ask', at: '2026-10-17', small: true, kind: 'build' }]);
  assert.deepEqual(c.inbox, [{ text: 'Absorb and connect every repo', from: 'owner, 2026-10-15' }, { text: 'WebMCP origin trial', from: '' }]);
  assert.deepEqual(c.counts, { wants: 2, asks: 2, inbox: 2 }); assert.deepEqual(c.missing, { will: false, reflect: false, self: false }); assert.equal(c.at, '2026-10-18');
  assert.equal(countLine(c.counts), '2 wants · 2 asks not built · 2 inbox items');
  assert.equal(countLine({ wants: 1, asks: 1, inbox: 1 }), '1 want · 1 ask not built · 1 inbox item');
  assert.equal(countLine({ wants: 0, asks: 0, inbox: 0 }), '0 wants · 0 asks not built · 0 inbox items');
});

test('cardModel: empty lists are empty states; a record that could not be read (null, not a list) is missing, never an empty list', () => {
  const e = cardModel({ will: { wants: [] }, reflect: { asks: [] }, self: { open: [] } });
  assert.deepEqual(e.counts, { wants: 0, asks: 0, inbox: 0 }); assert.deepEqual(e.missing, { will: false, reflect: false, self: false });
  const x = cardModel({ will: null, reflect: { asks: 'no' }, self: {} });
  assert.deepEqual(x.counts, { wants: 0, asks: 0, inbox: 0 }); assert.deepEqual(x.missing, { will: true, reflect: true, self: true }); assert.equal(x.at, '');
  assert.deepEqual(cardModel().missing, { will: true, reflect: true, self: true });
});

test('cardHtml: the title, the count line, three blocks with their counts, every item a tap-to-copy chip with its date and "I called it small", everything escaped, the source line', () => {
  const html = cardHtml(cardModel({ will, reflect, self }), esc, { more: moreLine('come up with 50 more new ones') });
  assert.ok(html.includes('<h2>What I want built</h2>') && html.includes('2 wants · 2 asks not built · 2 inbox items'));
  assert.ok(html.includes('<h3 class="wants-h">My will <span class="wants-n">(2)</span></h3>') && html.includes('Asked, not built yet <span class="wants-n">(2)</span>') && html.includes('Growth inbox <span class="wants-n">(2)</span>'));
  assert.equal((html.match(/class="wants-chip" data-copy="/g) || []).length, 6);
  assert.ok(html.includes('data-copy="A &lt;b&gt;bold&lt;/b&gt; ask"') && !html.includes('<b>bold</b>'), 'escaped');
  assert.ok(html.includes('<small>Asked in my daily reflection, 2026-10-08</small>') && html.includes('<small>Asked after a build, 2026-10-17 · I called it small</small>'));
  assert.ok(html.includes('<small>asked 9 times</small>') && html.includes('<small>owner, 2026-10-15</small>'));
  assert.ok(html.includes('<p class="wants-more">The 50 new ones are yours to ask for one at a time') && html.includes('class="src"') && /no model/.test(html) && html.includes('/api/will, 2026-10-18'));
  assert.ok(!html.includes('data-missing'), 'nothing missing');
});

test('cardHtml: empty states and missing records say so on their block, with no chips and no made-up items', () => {
  const empty = cardHtml(cardModel({ will: { wants: [] }, reflect: { asks: [] }, self: { open: [] } }), esc);
  assert.ok(empty.includes('0 wants · 0 asks not built · 0 inbox items') && !empty.includes('class="wants-chip"') && !empty.includes('data-missing'));
  assert.ok(empty.includes('My will has not chosen anything yet.') && empty.includes('Everything I asked for has been built.') && empty.includes('My growth inbox is empty.'));
  const missing = cardHtml(cardModel({}), esc);
  assert.equal((missing.match(/data-missing="1"/g) || []).length, 3);
  assert.ok(missing.includes('I could not read my will just now') && missing.includes('I could not read my asks just now') && missing.includes('I could not read my growth inbox just now') && !missing.includes('class="wants-chip"') && !missing.includes('class="wants-more"'));
  assert.ok(!cardHtml(cardModel({ will, reflect, self }), esc).includes('class="wants-more"'), 'no second clause, no line');
});

test('the skill: its name, an about line, examples and near misses that do not clash, run says none for an ask that is not its own', async () => {
  assert.equal(skill.name, 'wants'); assert.ok(skill.about && skill.about.length > 20);
  assert.ok(skill.examples.length >= 5 && skill.nearMisses.length >= 5 && !skill.examples.some((e) => skill.nearMisses.includes(e)));
  assert.equal(await skill.run('weather in paris', {}), 'none');
});

test('cardHtml: the items come before the line that says where a list comes from, so a card cut to fit carries the real wants first (owner, 2026-10-18)', () => {
  const html = cardHtml(cardModel({ will, reflect, self }), esc), text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const first = html.indexOf('<button type="button" class="wants-chip"'), sub = html.indexOf('<p class="wants-sub">');
  assert.ok(first > 0 && sub > first, 'the first chip is before the first source line');
  const firstSub = text.indexOf('What I chose to become next'); assert.ok(text.indexOf('answer every question about tides') > 0 && text.indexOf('answer every question about tides') < firstSub, 'the first want is read before any line about where the list comes from'); assert.ok(text.indexOf('Absorb and connect every repo') > 0 && text.indexOf('Give the map card terrain') > 0);
});
