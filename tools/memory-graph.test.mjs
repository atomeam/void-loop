// The personal memory graph (lib/memory-graph.js, skills/memory-graph.js; asked by Verse). node --test tools/memory-graph.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { empty, parseGraph, topicOf, noteAsk, confidence, pct, factAsk, exportOf, previewOf, importInto, noteFactStored, forgetFactStored, SCHEMA, FACT_MAX, noteFact, forgetFact, patterns, suggest, whenWords, trim, readGraph, writeGraph, noteAskStored, setOn, clearGraph, NODE_MAX, EDGE_MAX, LABEL_MAX, WORDS_MAX, STALE_DAYS, GRAPH_KEY, NOTE } from '../void-live-deploy/lib/memory-graph.js';
import { STORES } from '../void-live-deploy/lib/state.js';
import graphSkill, { previewHtml as exportPreviewHtml } from '../void-live-deploy/skills/memory-graph.js';
import memorySkill from '../void-live-deploy/skills/memory.js';

const T0 = Date.parse('2026-10-18T19:30:00'); // local time: a Sunday evening
const DAY = 864e5;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SENTENCES = [
  'make a clock', 'make a 5 minute timer', 'add a sticky that says call mom at 3pm tomorrow', 'show me a picture of a cat on a bicycle in the rain', 'translate hello to spanish please',
  'what is the weather in tokyo right now', 'remember that my api key is sk-abcdefghijklmnopqrstuvwxyz0123', 'email jane@example.com that i am late', 'set a timer for 30 seconds 1234567890',
];

test('the graph store is named once in lib/state.js', () => { assert.equal(STORES.graph.key, GRAPH_KEY); assert.ok(!STORES.graph.secret); });

test('a topic is a few object words, never the sentence: short, lowercased, letters only, no numbers, addresses or key-shaped words', () => {
  assert.equal(topicOf('clock', 'make a clock'), 'clock');
  assert.equal(topicOf('timer', 'make a 5 minute timer'), 'minute timer');
  assert.equal(topicOf('sticky', 'add a sticky that says call mom at 3pm tomorrow'), 'sticky call mom');
  assert.equal(topicOf('image', 'show me a picture of a cat on a bicycle in the rain'), 'picture cat bicycle rain');
  assert.equal(topicOf('memory', 'remember that my api key is sk-abcdefghijklmnopqrstuvwxyz0123'), 'remember api key');
  assert.equal(topicOf('act', 'email jane@example.com that i am late'), 'email jane example com late'.split(' ').slice(0, WORDS_MAX).join(' '));
  assert.equal(topicOf('clock', 'make a'), 'clock', 'no object words: the skill name');
  assert.equal(topicOf('skill:timer', '12345 !!!'), 'timer');
  assert.ok(topicOf('x', 'extraordinarily long words of unbelievable magnitude everywhere').length <= LABEL_MAX);
  let g = empty();
  for (const s of SENTENCES) g = noteAsk(g, { skill: 'clock', text: s, at: T0 });
  for (const n of Object.values(g.nodes)) {
    assert.ok(n.label.length <= LABEL_MAX, n.label);
    for (const s of SENTENCES) assert.ok(!n.label.includes(s) && !s.toLowerCase().startsWith(n.label + ' ') || n.label.split(' ').length < s.split(' ').length, n.label);
    assert.ok(!/\d|@|sk-/.test(n.label), 'no number, address or key in ' + n.label);
  }
  const text = JSON.stringify(g);
  for (const s of SENTENCES) assert.ok(!text.includes(s), 'the sentence is never stored: ' + s);
  assert.ok(!text.includes('sk-abcdef') && !text.includes('example.com') && !text.includes('3pm'));
});

test('noteAsk bumps the skill, the topic, their edge, the pair with the skill just before, the visit slot and the count; off or skipped leaves the graph as it was', () => {
  let g = empty();
  const g0 = g;
  g = noteAsk(g, { skill: 'skill:clock', text: 'make a clock', at: T0 });
  assert.notEqual(g, g0, 'pure: a new graph'); assert.deepEqual(Object.keys(g0.nodes), [], 'the old one untouched');
  g = noteAsk(g, { skill: 'timer', text: 'make a 5 minute timer', at: T0 + 60e3 });
  g = noteAsk(g, { skill: 'clock', text: 'Make a CLOCK!', at: T0 + 120e3 });
  assert.equal(g.asks, 3); assert.equal(g.first, new Date(T0).toISOString()); assert.equal(g.last, new Date(T0 + 120e3).toISOString());
  assert.equal(g.nodes['skill:clock'].n, 2); assert.equal(g.nodes['topic:clock'].n, 2); assert.equal(g.nodes['topic:clock'].kind, 'topic'); assert.equal(g.nodes['skill:timer'].kind, 'skill');
  assert.equal(g.edges['skill:clock>topic:clock'], 2); assert.equal(g.edges['skill:timer>topic:minute timer'], 1);
  assert.equal(g.edges['skill:clock>skill:timer'], 2, 'clock then timer, timer then clock: one undirected pair, twice');
  const d = new Date(T0); assert.equal(g.visits[d.getDay()][Math.floor(d.getHours() / 6)], 3);
  const off = { ...g, on: false }; assert.equal(noteAsk(off, { skill: 'clock', text: 'make a clock', at: T0 }), off);
  assert.equal(noteAsk(g, { skill: 'memory-graph', text: 'what do you know about me', at: T0 }), g, 'asking what it knows is not an interest');
  assert.equal(noteAsk(g, { skill: '', text: 'x', at: T0 }), g); assert.equal(noteAsk(g, { skill: '<b>', text: 'x', at: T0 }), g);
  const later = noteAsk(g, { skill: 'sticky', text: 'add a sticky', at: T0 + 3 * DAY });
  assert.equal(later.edges['skill:clock>skill:sticky'], undefined, 'hours apart is not together');
  assert.equal(later.nodes['topic:sticky'].label, 'sticky');
});

test('the caps hold: at most 300 nodes and 600 edges, the least recently seen go first with their edges', () => {
  let g = empty();
  for (let i = 0; i < NODE_MAX + 50; i++) g = noteAsk(g, { skill: 'clock', text: 'topic number ' + 'abcdefghijklmnopqrstuvwxyz'[i % 26] + 'x' + 'abcdefghijklmnopqrstuvwxyz'[Math.floor(i / 26) % 26] + 'y' + 'abcdefghijklmnopqrstuvwxyz'[Math.floor(i / 676) % 26], at: T0 + i * 1000 });
  assert.ok(Object.keys(g.nodes).length <= NODE_MAX, String(Object.keys(g.nodes).length));
  assert.ok(g.nodes['skill:clock'], 'the busy skill node stays (seen last)');
  assert.equal(g.nodes['topic:topic number axay'], undefined, 'the oldest topic went');
  for (const k of Object.keys(g.edges)) { const [a, b] = k.split('>'); assert.ok(g.nodes[a] && g.nodes[b], 'no edge to a gone node: ' + k); }
  // edges: many skills each with their own topic and pairs, beyond EDGE_MAX
  let e = empty();
  const big = { ...empty(), nodes: {}, edges: {} };
  for (let i = 0; i < 100; i++) { big.nodes['skill:s' + i] = { kind: 'skill', label: 's' + i, n: 1, first: new Date(T0 + i).toISOString(), last: new Date(T0 + i).toISOString() }; }
  for (let i = 0; i < 100; i++) for (let j = i + 1; j < 100 && Object.keys(big.edges).length < EDGE_MAX + 100; j++) big.edges['skill:s' + i + '>skill:s' + j] = 1;
  assert.ok(Object.keys(big.edges).length > EDGE_MAX);
  e = trim(big);
  assert.equal(Object.keys(e.edges).length, EDGE_MAX);
  assert.equal(e.edges['skill:s0>skill:s1'], undefined, 'the edge between the two oldest nodes went first');
});

test('parseGraph takes only a well-formed graph; bad text, bad nodes and dangling edges are dropped', () => {
  const g = noteAsk(noteAsk(empty(), { skill: 'clock', text: 'make a clock', at: T0 }), { skill: 'timer', text: 'a timer', at: T0 + 1 });
  assert.deepEqual(parseGraph(JSON.stringify(g)), g);
  assert.deepEqual(parseGraph('not json'), empty()); assert.deepEqual(parseGraph('[1]'), empty()); assert.deepEqual(parseGraph('{"v":2}'), empty());
  const bad = JSON.parse(JSON.stringify(g)); bad.nodes['topic:x'] = { kind: 'weird', label: 'x', n: 1, first: 'a', last: 'b' }; bad.edges['topic:x>skill:clock'] = 1; bad.edges['skill:clock>topic:clock'] = 'two'; bad.visits = 'no'; bad.on = false; bad.prev = { skill: '<x>' };
  const p = parseGraph(JSON.stringify(bad));
  assert.equal(p.nodes['topic:x'], undefined); assert.equal(p.edges['topic:x>skill:clock'], undefined); assert.equal(p.edges['skill:clock>topic:clock'], undefined); assert.equal(p.edges['skill:clock>skill:timer'], 1);
  assert.deepEqual(p.visits, empty().visits); assert.equal(p.on, false); assert.equal(p.prev, null);
});

test('patterns: top interests weighted by recency, the usual pairs, when you visit, what you have not come back to', () => {
  let g = empty();
  const old = T0 - 30 * DAY;
  for (let i = 0; i < 5; i++) g = noteAsk(g, { skill: 'weather', text: 'weather in tokyo', at: old + i * 1000 }); // often, long ago: lapsed
  for (let i = 0; i < 3; i++) { g = noteAsk(g, { skill: 'clock', text: 'make a clock', at: T0 - i * DAY }); g = noteAsk(g, { skill: 'timer', text: 'make a 5 minute timer', at: T0 - i * DAY + 60e3 }); }
  g = noteAsk(g, { skill: 'sticky', text: 'add a sticky that says tea', at: T0 - 20 * DAY }); // once, long ago: not lapsed (n < 3), low score
  const p = patterns(g, T0);
  assert.equal(p.asks, 12); assert.equal(p.first, new Date(old).toISOString());
  assert.deepEqual(p.interests.slice(0, 2).map((t) => t.label).sort(), ['clock', 'minute timer'], JSON.stringify(p.interests));
  assert.ok(p.interests.find((t) => t.label === 'weather tokyo').score < 3, 'five asks a month ago weigh less than three this week');
  assert.equal(p.interests.find((t) => t.label === 'clock').skill, 'clock');
  assert.deepEqual(p.pairs.map(({ a, b, n }) => ({ a, b, n })), [{ a: 'clock', b: 'timer', n: 3 }]);
  assert.deepEqual(p.lapsed.map((t) => [t.label, t.n, t.days]), [['weather tokyo', 5, 29]]); // the last of the five was four seconds after `old`: 29 whole days
  assert.ok(p.when.total === 12 && p.when.words.startsWith('usually '), p.when.words);
  assert.deepEqual(patterns(empty(), T0).interests, []); assert.equal(patterns(empty(), T0).when.words, ''); assert.equal(patterns(null, T0).asks, 0);
  assert.equal(STALE_DAYS, 14);
});

test('whenWords names the busiest days and times of day, nothing under three visits', () => {
  const v = empty().visits; v[2][3] = 4; v[4][3] = 3; v[0][1] = 1; // Tuesday and Thursday evenings, one Sunday morning
  assert.equal(whenWords(v).words, 'usually on Tuesdays and Thursdays, in the evening');
  assert.deepEqual(whenWords(v).days, ['Tuesday', 'Thursday']);
  const one = empty().visits; one[1][1] = 2; assert.equal(whenWords(one).words, '');
  const m = empty().visits; m[1][1] = 5; assert.equal(whenWords(m).words, 'usually on Mondays, in the morning');
  assert.equal(whenWords('bad').words, '');
});

test('suggest: at most three, each a real example of a skill the patterns name, with why; nothing without examples', () => {
  let g = empty();
  for (let i = 0; i < 5; i++) g = noteAsk(g, { skill: 'weather', text: 'weather in tokyo', at: T0 - 30 * DAY + i });
  for (let i = 0; i < 3; i++) { g = noteAsk(g, { skill: 'clock', text: 'make a clock', at: T0 - i * DAY }); g = noteAsk(g, { skill: 'timer', text: 'make a 5 minute timer', at: T0 - i * DAY + 60e3 }); }
  const ex = { clock: ['make a clock', 'show me the time'], timer: ['make a 5 minute timer', 'set a timer for 30 seconds'], weather: ['weather in Tokyo', 'will it rain tomorrow'], sticky: ['add a sticky that says buy milk'] };
  const s = suggest(g, T0, ex);
  assert.ok(s.length >= 1 && s.length <= 3, JSON.stringify(s));
  const all = new Set(Object.values(ex).flat());
  for (const x of s) { assert.ok(all.has(x.ask), x.ask); assert.ok(x.why && x.skill); }
  assert.equal(s[0].skill, 'weather', 'what you have not come back to comes first'); assert.match(s[0].why, /not come back/);
  assert.ok(s.some((x) => x.skill === 'clock' && x.ask === 'show me the time'), 'an interest suggests another ask of its skill, not the one already made: ' + JSON.stringify(s));
  assert.equal(new Set(s.map((x) => x.ask)).size, s.length, 'no repeats');
  assert.deepEqual(suggest(g, T0, {}), []); assert.deepEqual(suggest(g, T0, null), []); assert.deepEqual(suggest(empty(), T0, ex), []);
  assert.deepEqual(suggest(g, T0, { clock: ['free text the skill never listed'] }).map((x) => x.ask), ['free text the skill never listed'], 'only what the examples map holds, nothing invented');
  assert.deepEqual(suggest(g, T0, { weather: [42, ''] }), []);
});

test('facts are explicit, kept word for word (clipped), once each, and forgotten by name', () => {
  let g = noteFact(empty(), 'I prefer tabs over spaces', T0);
  g = noteFact(g, '  I prefer   tabs over spaces.  ', T0 + 1);
  assert.equal(Object.values(g.nodes).filter((n) => n.kind === 'fact').length, 1);
  assert.equal(patterns(g, T0).facts[0], 'I prefer tabs over spaces');
  assert.equal(noteFact(g, '   ', T0), g);
  assert.deepEqual(patterns(forgetFact(g, 'I prefer tabs over spaces'), T0).facts, []);
  assert.equal(noteFact(empty(), 'x'.repeat(500), T0).nodes[Object.keys(noteFact(empty(), 'x'.repeat(500), T0).nodes)[0]].label.length, 120);
});

test('storage: noteAskStored says "note" exactly once, stop keeps what is there and keeps nothing new, start resumes, forget empties; bad storage never throws', () => {
  const s = mem();
  const r1 = noteAskStored(s, { skill: 'clock', text: 'make a clock', at: T0 });
  assert.equal(r1.note, true); assert.equal(r1.graph.asks, 1); assert.ok(s.m.has(GRAPH_KEY));
  assert.equal(noteAskStored(s, { skill: 'timer', text: 'make a timer', at: T0 + 1 }).note, false, 'the note is shown once');
  assert.equal(readGraph(s).asks, 2);
  assert.equal(setOn(s, false).on, false);
  assert.equal(noteAskStored(s, { skill: 'clock', text: 'make a clock', at: T0 + 2 }).graph.asks, 2, 'off: nothing new');
  assert.equal(setOn(s, true).on, true);
  assert.equal(noteAskStored(s, { skill: 'clock', text: 'make a clock', at: T0 + 3 }).graph.asks, 3);
  const c = clearGraph(s); assert.equal(c.asks, 0); assert.deepEqual(c.nodes, {}); assert.equal(c.on, true); assert.equal(readGraph(s).asks, 0);
  assert.equal(noteAskStored(s, { skill: 'clock', text: 'make a clock', at: T0 + 4 }).note, false, 'after a forget the note is not shown again');
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readGraph(bad), empty()); assert.equal(writeGraph(empty(), bad), false); assert.equal(noteAskStored(bad, { skill: 'clock', text: 'x', at: T0 }).note, false);
  assert.match(NOTE, /forget my patterns/); assert.match(NOTE, /stop remembering/);
});

test('the skill: its asks, its look-alikes, and the privacy ask of the memory skill no longer takes "what do you know about me"', () => {
  for (const q of graphSkill.examples) assert.ok(graphSkill.match(q.toLowerCase(), q), q);
  for (const q of ['What do you know about me?', 'show my patterns', 'what have you noticed about me', 'stop remembering me', 'clear my patterns', 'resume remembering']) assert.ok(graphSkill.match(q.toLowerCase(), q), q);
  for (const q of graphSkill.nearMisses) { assert.ok(!graphSkill.match(q.toLowerCase(), q), q); }
  for (const q of ['remember me', 'forget me', 'who am i', 'what is a pattern', 'stop', 'remember that I like tea', 'what do you keep about me']) assert.ok(!graphSkill.match(q.toLowerCase(), q), q);
  assert.ok(!memorySkill.match('what do you know about me', 'what do you know about me'), 'the graph card answers it now');
  assert.ok(memorySkill.match('what do you keep about me', 'what do you keep about me'), 'the privacy page still answers "keep"');
  assert.deepEqual(['show', 'forget', 'stop', 'start', ''], ['what do you know about me', 'forget my patterns', 'stop remembering', 'start remembering', 'what is a knowledge graph'].map(graphSkill.graphAskOf));
});

test('the card: chips tap into a skill\'s own example, counts and the since day, the privacy line, Forget and Stop (Start when off); escaped; honest when empty', () => {
  let g = empty();
  for (let i = 0; i < 2; i++) { g = noteAsk(g, { skill: 'clock', text: 'make a clock', at: T0 + i * 1000 }); g = noteAsk(g, { skill: 'timer', text: 'make a 5 minute timer', at: T0 + i * 1000 + 100 }); }
  g = noteAsk(g, { skill: 'sticky', text: 'add a sticky that says <b>tea</b>', at: T0 + 5000 });
  const ex = { clock: ['make a clock'], timer: ['make a 5 minute timer', 'set a timer for 30 seconds'], sticky: ['add a sticky that says buy milk'] };
  const p = patterns(g, T0 + 6000), html = graphSkill.cardHtml(esc, p, suggest(g, T0 + 6000, ex), ex);
  assert.match(html, /What I've noticed/); assert.match(html, /from 5 asks on this device since 2026-10-18/);
  assert.ok(html.includes('data-ask="make a clock"') && html.includes('data-ask="make a 5 minute timer"'), 'an interest chip asks its skill\'s example');
  assert.match(html, /clock and timer, together 3 times/);
  assert.ok(html.includes('class="mg-chips mg-next"'), 'next, maybe'); assert.ok(!html.includes('<b>tea</b>') && html.includes('sticky tea<small>'), 'escaped, and a tag\'s letters are no topic');
  assert.ok(html.includes('data-ask="forget my patterns"') && html.includes('data-ask="stop remembering"') && !html.includes('data-ask="start remembering"'));
  assert.match(html, /Nothing leaves this device/); assert.match(html, /a2m\.void\.graph\.v1/); assert.ok(html.includes('data-ask="privacy"'));
  const off = graphSkill.cardHtml(esc, patterns({ ...g, on: false }, T0), [], ex); assert.match(off, /Off: I am not keeping/); assert.ok(off.includes('data-ask="start remembering"'));
  const none = graphSkill.cardHtml(esc, patterns(empty(), T0), [], {}); assert.match(none, /Nothing yet/); assert.ok(!/from \d+ asks/.test(none)); assert.ok(!none.includes('mg-next'));
  const noEx = graphSkill.cardHtml(esc, p, [], {}); assert.ok(/<span class="mg-chip"[^>]*>clock/.test(noEx) && !/mg-chip" data-ask/.test(noEx.replace(/<a [^>]*>/g, '')), 'no example known: a chip with no ask, never an invented one');
});

// ---- confidence, export and import (asked by Verse)
const isoAt = (t) => new Date(t).toISOString();

test('confidence: more distinct days is surer, a repeat on the same day counts a quarter, time away halves it over 30 days, always 0 to 1', () => {
  const mk = (n, days, last) => ({ kind: 'fact', label: 'x', n, days, first: isoAt(T0 - 9 * DAY), last: isoAt(last) });
  const once = confidence(mk(1, 1, T0), T0), twice = confidence(mk(2, 2, T0), T0), same = confidence(mk(2, 1, T0), T0), many = confidence(mk(9, 9, T0), T0);
  assert.ok(once > 0 && once < twice && same > once && same < twice && twice < many && many <= 1, JSON.stringify({ once, twice, same, many }));
  assert.ok(Math.abs(once - (1 - Math.exp(-1 / 3))) < 1e-9, 'one day, seen now: 1 - exp(-1/3)');
  assert.ok(Math.abs(confidence(mk(1, 1, T0 - 30 * DAY), T0) - once / 2) < 1e-9, 'unseen for 30 days: half');
  for (const bad of [null, undefined, 5, 'x', {}, { n: 0 }, { n: NaN }, { n: -3, days: 2 }]) assert.equal(confidence(bad, T0), 0);
  assert.ok(confidence({ kind: 'fact', label: 'x', n: 1e9, days: 1e9, first: isoAt(T0), last: isoAt(T0) }, T0) <= 1);
  assert.equal(confidence(mk(1, 1, T0 + 5 * DAY), T0), once, 'a last-seen in the future is not fresher than now');
  assert.equal(pct(0.626), 63); assert.equal(pct(7), 100); assert.equal(pct('x'), 0);
});

test('confidence: a fact told again rises, told on a new day rises more, "forget that" takes it out; old nodes count one day; interests and pairs carry it', () => {
  let g = empty();
  g = noteFact(g, 'I like green tea in the morning', T0);
  const c1 = patterns(g, T0).factItems[0].conf;
  g = noteFact(g, 'i like green tea in the morning.', T0 + 60e3); // same day, same fact
  const c2 = patterns(g, T0 + 60e3).factItems[0].conf;
  g = noteFact(g, 'I like green tea in the morning', T0 + 2 * DAY); // two days later
  const p3 = patterns(g, T0 + 2 * DAY), node = Object.values(g.nodes)[0];
  assert.equal(p3.factItems.length, 1); assert.equal(p3.facts.length, 1);
  assert.equal(node.days, 2); assert.equal(node.n, 3);
  assert.ok(c1 < c2 && c2 < p3.factItems[0].conf, JSON.stringify([c1, c2, p3.factItems[0].conf]));
  g = forgetFact(g, 'I like green tea in the morning'); assert.deepEqual(patterns(g, T0).factItems, []);
  const old = parseGraph(JSON.stringify({ v: 1, nodes: { 'fact:a b c': { kind: 'fact', label: 'a b c', n: 2, first: isoAt(T0), last: isoAt(T0) } }, edges: {} }));
  assert.equal(old.nodes['fact:a b c'].days, 1);
  let h = empty(); h = noteAsk(h, { skill: 'clock', text: 'make a clock', at: T0 }); h = noteAsk(h, { skill: 'timer', text: 'make a timer', at: T0 + 1000 }); h = noteAsk(h, { skill: 'clock', text: 'make a clock', at: T0 + 2000 }); h = noteAsk(h, { skill: 'timer', text: 'make a timer', at: T0 + 3000 });
  const pi = patterns(h, T0 + 4000); assert.ok(pi.interests.length >= 2 && pi.interests.every((t) => t.conf > 0 && t.conf <= 1));
  assert.ok(pi.pairs.length === 1 && pi.pairs[0].conf > 0);
});

test('factAsk: the memory skill\'s own remember/forget forms, three words or more', () => {
  assert.deepEqual(factAsk('remember that I like green tea'), { remember: 'I like green tea' });
  assert.deepEqual(factAsk('Please remember: my cat is called Pixel.'), { remember: 'my cat is called Pixel' });
  assert.deepEqual(factAsk('forget that I like green tea'), { forget: 'I like green tea' });
  for (const x of ['remember the titans', 'remember that song', 'forget it', 'remember that', '', null]) assert.equal(factAsk(x), null, String(x));
});

test('stored facts: told twice is one node; off keeps nothing new; forget that removes it; storage that throws is fine', () => {
  const s = mem();
  noteFactStored(s, 'my cat is called Pixel', T0); noteFactStored(s, 'My cat is called pixel.', T0 + 2 * DAY);
  const g = readGraph(s); assert.equal(Object.keys(g.nodes).length, 1); assert.equal(Object.values(g.nodes)[0].n, 2); assert.equal(Object.values(g.nodes)[0].days, 2);
  setOn(s, false); noteFactStored(s, 'my dog is called Rex', T0); assert.equal(Object.keys(readGraph(s).nodes).length, 1);
  forgetFactStored(s, 'my cat is called Pixel'); assert.equal(Object.keys(readGraph(s).nodes).length, 0);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => { noteFactStored(bad, 'a b c', T0); forgetFactStored(bad, 'a b c'); });
});

const sample = () => {
  let g = empty();
  for (const [s, t, at] of [['clock', 'make a clock', T0], ['timer', 'make a 5 minute timer', T0 + 60e3], ['clock', 'make a clock', T0 + DAY], ['timer', 'make a 5 minute timer', T0 + DAY + 60e3]]) g = noteAsk(g, { skill: s, text: t, at });
  return noteFact(g, 'I like green tea in the morning', T0 + DAY);
};

test('exportOf: the graph plus { schema, exportedAt }, a copy, and no sentence in it', () => {
  const g = sample(), f = exportOf(g, T0 + 5 * DAY);
  assert.equal(f.schema, SCHEMA); assert.equal(f.schema, 'void.memory.v1'); assert.equal(f.exportedAt, isoAt(T0 + 5 * DAY));
  assert.deepEqual(f.nodes, g.nodes); assert.deepEqual(f.edges, g.edges); assert.equal(f.asks, g.asks);
  f.nodes['skill:clock'].n = 999; f.edges.zzz = 1; assert.notEqual(g.nodes['skill:clock'].n, 999, 'a copy'); assert.ok(!('zzz' in g.edges));
  assert.deepEqual(exportOf(null, T0).nodes, {}); assert.doesNotThrow(() => exportOf('x')); assert.doesNotThrow(() => exportOf({ nodes: 5 }));
  const text = JSON.stringify(exportOf(g, T0));
  assert.ok(!text.includes('make a clock') && !text.includes('5 minute timer'), 'the sentences were never in the graph, so never in the file');
});

test('importInto: a round trip onto an empty graph gives the same graph; the same file twice changes nothing; a larger count wins, the person\'s on/off stays', () => {
  const g = sample(), file = JSON.stringify(exportOf(g, T0));
  const r = importInto(empty(), file);
  assert.ok(r.ok, r.why); assert.equal(r.skipped, 0); assert.equal(r.added, Object.keys(g.nodes).length); assert.equal(r.merged, 0);
  assert.deepEqual(r.graph.nodes, g.nodes); assert.deepEqual(r.graph.edges, g.edges); assert.deepEqual(r.graph.visits, g.visits); assert.equal(r.graph.asks, g.asks); assert.equal(r.graph.first, g.first); assert.equal(r.graph.last, g.last);
  const again = importInto(r.graph, file); assert.ok(again.ok); assert.deepEqual(again.graph, r.graph); assert.equal(again.added, 0); assert.equal(again.merged, Object.keys(g.nodes).length);
  const onto = { ...empty(), on: false, noted: true, nodes: { 'skill:clock': { kind: 'skill', label: 'clock', n: 50, days: 4, first: isoAt(T0 - 20 * DAY), last: isoAt(T0 - 10 * DAY) } } };
  const m = importInto(onto, file); assert.ok(m.ok);
  assert.equal(m.graph.on, false); assert.equal(m.graph.noted, true); assert.equal(m.graph.nodes['skill:clock'].n, 50); assert.equal(m.graph.nodes['skill:clock'].days, 4);
  assert.equal(m.graph.nodes['skill:clock'].first, isoAt(T0 - 20 * DAY)); assert.equal(m.graph.nodes['skill:clock'].last, g.nodes['skill:clock'].last);
  assert.equal(onto.nodes['skill:clock'].n, 50, 'the graph handed in is untouched');
  assert.equal(importInto(empty(), exportOf(g, T0)).ok, true, 'an object works as well as text');
});

test('importInto: version, schema and shape are checked, and a file over 2 MB is refused before it is parsed', () => {
  const good = exportOf(sample(), T0);
  assert.match(importInto(empty(), JSON.stringify({ ...good, v: 2 })).why, /version 2/);
  assert.match(importInto(empty(), JSON.stringify({ ...good, schema: 'void.stage.v1' })).why, /not a Verse memory file/);
  assert.match(importInto(empty(), JSON.stringify({ ...good, schema: undefined })).why, /not a Verse memory file/);
  assert.equal(importInto(empty(), 'not json {').ok, false);
  for (const x of ['null', '[]', '5', '"x"', '{}', JSON.stringify({ ...good, nodes: [] }), JSON.stringify({ ...good, nodes: 'x' }), JSON.stringify({ ...good, nodes: {} })]) assert.equal(importInto(empty(), x).ok, false, x);
  for (const x of [null, undefined, 5, [], {}]) assert.equal(importInto(empty(), x).ok, false);
  const huge = '{"schema":"void.memory.v1","v":1,"nodes":{},"pad":"' + 'a'.repeat(10 * 1024 * 1024) + '"}';
  const r = importInto(empty(), huge); assert.equal(r.ok, false); assert.match(r.why, /over 2 MB/);
});

test('importInto: malicious input is dropped or cleaned: huge labels, __proto__ keys, wrong types, ids that do not match their kind, odd dates and counts', () => {
  const T = isoAt(T0), node = (over = {}) => ({ kind: 'topic', label: 'garden', n: 2, first: T, last: T, days: 1, ...over });
  const file = {
    schema: SCHEMA, v: 1, asks: 'lots', unknownTop: { evil: true },
    nodes: JSON.parse('{"__proto__":{"kind":"topic","label":"pwned","n":1,"first":"' + T + '","last":"' + T + '"},"topic:garden":' + JSON.stringify({ ...node(), extra: '<script>', admin: true }) + ',"constructor":' + JSON.stringify(node()) + '}'),
  };
  Object.assign(file.nodes, {
    'topic:huge': node({ label: 'x'.repeat(5000) }), 'topic:long': node({ label: 'a'.repeat(FACT_MAX + 1) }), 'topic:num': node({ label: 12345 }), 'topic:obj': { kind: 'topic', label: { a: 1 }, n: 1, first: T, last: T },
    'skill:clock': node({ kind: 'skill', label: 'Clock' }), 'skill:bad': node({ kind: 'skill', label: 'not a skill name!' }), 'topic:wrongkind': node({ kind: 'skill', label: 'timer' }),
    'topic:badn': node({ n: -1 }), 'topic:nann': node({ n: 'many' }), 'topic:baddate': node({ first: 'yesterday' }), 'topic:nodate': { kind: 'topic', label: 'garden', n: 1 }, 'topic:str': 'garden', 'topic:null': null, 'topic:arr': [1],
    'topic:keyed': node({ label: 'sk-abcdefghijklmnopqrstuvwxyz0123 jane@example.com 4242424242424242' }), // secret-scan: ok (a made-up key for the test)
    'topic:pond': node({ label: 'Pond', n: 1e300 }),
    'fact:a b c': node({ kind: 'fact', label: '  I like\u0000\u0001 green\n\ttea  ', n: 3, days: 99 }), 'fact:long': node({ kind: 'fact', label: 'w '.repeat(100) }),
  });
  file.edges = JSON.parse('{"skill:clock>topic:garden":4,"__proto__>topic:garden":3,"topic:garden>skill:clock>x":2,"skill:clock>topic:nowhere":1,"topic:garden>topic:garden":-1,"skill:clock>topic:pond":"2"}');
  const r = importInto(empty(), JSON.stringify(file));
  assert.ok(r.ok, r.why);
  assert.equal(Object.getPrototypeOf(r.graph.nodes), Object.prototype); assert.equal(({}).pwned, undefined); assert.equal(({}).evil, undefined);
  assert.ok(!Object.keys(r.graph.nodes).includes('__proto__') && !Object.keys(r.graph.nodes).includes('constructor'));
  const n = r.graph.nodes;
  assert.deepEqual(Object.keys(n['topic:garden']).sort(), ['days', 'first', 'kind', 'label', 'last', 'n'], 'unknown fields dropped');
  assert.equal(n['skill:clock'].label, 'clock'); assert.ok(!n['skill:bad']);
  for (const gone of ['topic:huge', 'topic:long', 'topic:num', 'topic:obj', 'topic:wrongkind', 'topic:badn', 'topic:nann', 'topic:baddate', 'topic:nodate', 'topic:str', 'topic:null', 'topic:arr', 'fact:long', 'topic:keyed']) assert.ok(!n[gone], gone);
  assert.ok(!Object.values(n).some((x) => /pwned|script|@|sk-|\d{6}/.test(x.label)), 'a key, an address or a number never survives as a label: ' + JSON.stringify(Object.values(n).map((x) => x.label)));
  assert.equal(n['topic:pond'].n, 1e6, 'a count is capped');
  const factKey = Object.keys(n).find((k) => k.startsWith('fact:')), fact = n[factKey];
  assert.equal(fact.label, 'I like green tea'); assert.equal(fact.days, 3, 'days never above the count'); assert.equal(factKey, 'fact:i like green tea', 'the id is made again from the label');
  assert.deepEqual(r.graph.edges, { 'skill:clock>topic:garden': 4 },'only edges between kept nodes, well-formed');
  assert.equal(r.graph.asks, 0, 'a count that is not a number is nothing');
  assert.ok(r.skipped >= 12);
  for (const k of Object.keys(n)) assert.ok(n[k].label.length <= FACT_MAX);
  assert.equal(JSON.stringify(r.graph).includes('<script>'), false);
});

test('importInto: the caps hold, however many nodes and edges the file brings', () => {
  const nodes = {}, edges = {}, az = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < NODE_MAX * 3; i++) { const label = 'w' + az[i % 26] + az[Math.floor(i / 26) % 26] + az[Math.floor(i / 676) % 26]; nodes['topic:' + label] = { kind: 'topic', label, n: 1, first: isoAt(T0 - i * 1000), last: isoAt(T0 - i * 1000) }; }
  const ids = Object.keys(nodes); for (let i = 0; i < EDGE_MAX * 3; i++) edges[ids[i % ids.length] + '>' + ids[(i * 7 + 1) % ids.length]] = 1;
  const file = JSON.stringify({ schema: SCHEMA, v: 1, nodes, edges });
  const r = importInto(empty(), file);
  assert.ok(r.ok); assert.ok(Object.keys(r.graph.nodes).length <= NODE_MAX); assert.ok(Object.keys(r.graph.edges).length <= EDGE_MAX);
  for (const k of Object.keys(r.graph.edges)) { const [a, b] = k.split('>'); assert.ok(r.graph.nodes[a] && r.graph.nodes[b], 'no edge to a gone node'); }
  assert.ok(r.skipped >= NODE_MAX, 'the rest were counted as skipped');
  const full = noteAsk(empty(), { skill: 'clock', text: 'make a clock', at: T0 });
  assert.ok(Object.keys(importInto(full, file).graph.nodes).length <= NODE_MAX);
});

// Moved here 2026-10-22 from tools/memory-preview.test.mjs, where they sat beside the newer snippets card of the
// memory-preview skill (that name now belongs to skills/memory-preview.js); they test this skill's export look
// (asked by Verse, ask-20261021-1627-2 and its 5 rewordings): a look at what an export holds before it downloads.
test('the preview wordings reach the memory card, and the old asks keep their meaning', () => {
  for (const a of ['preview my memory', "what's in my memory export", 'peek at my backup', 'preview my memory export before I download it', 'look inside my memory file', 'what is in my memory backup']) assert.equal(graphSkill.graphAskOf(a), 'preview', a);
  assert.equal(graphSkill.graphAskOf('export my memory'), 'export');
  assert.equal(graphSkill.graphAskOf('import my memory'), 'import');
  assert.equal(graphSkill.graphAskOf('what do you know about me'), 'show');
  for (const a of ['preview the report', 'what is in my fridge', 'peek at the stars', 'preview my stage']) assert.equal(graphSkill.graphAskOf(a), '', a);
});

test('previewOf counts what the file holds and samples the biggest labels, never more than asked', () => {
  let g = empty();
  for (let i = 0; i < 4; i++) g = noteAsk(g, { skill: 'timer', text: 'make a 5 minute timer', at: T0 + i * 1000 });
  g = noteAsk(g, { skill: 'clock', text: 'make a clock', at: T0 + 9000 });
  g = noteFact(g, 'I like tea', T0 + 10000);
  const pv = previewOf(exportOf(g, T0 + 20000), 2);
  assert.ok(pv.things >= 3);
  assert.equal(pv.sample.length, 2);
  assert.ok(pv.sample[0].n >= pv.sample[1].n, 'biggest first');
  assert.ok(pv.kB >= 1);
  assert.equal(Object.values(pv.kinds).reduce((a, b) => a + b, 0), pv.things);
  const h = exportPreviewHtml(esc, pv);
  assert.match(h, /What my memory export holds/);
  assert.match(h, /data-ask="export my memory"/);
  assert.match(h, /nothing has downloaded/);
});

test('an empty graph previews as empty, and a label is escaped', () => {
  const pv = previewOf(exportOf(empty(), T0));
  assert.equal(pv.things, 0);
  assert.match(exportPreviewHtml(esc, pv), /Nothing yet/);
  const h = exportPreviewHtml(esc, { things: 1, links: 0, kinds: { topic: 1 }, sample: [{ kind: 'topic', label: '<b>x</b>', n: 1 }], kB: 1, first: null, last: null });
  assert.ok(!h.includes('<b>x</b>'));
  assert.equal(previewOf(null).things, 0);
});

