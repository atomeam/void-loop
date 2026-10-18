// The personal memory graph (lib/memory-graph.js, skills/memory-graph.js; asked by Void). node --test tools/memory-graph.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { empty, parseGraph, topicOf, noteAsk, noteFact, forgetFact, patterns, suggest, whenWords, trim, readGraph, writeGraph, noteAskStored, setOn, clearGraph, NODE_MAX, EDGE_MAX, LABEL_MAX, WORDS_MAX, STALE_DAYS, GRAPH_KEY, NOTE } from '../void-live-deploy/lib/memory-graph.js';
import { STORES } from '../void-live-deploy/lib/state.js';
import graphSkill from '../void-live-deploy/skills/memory-graph.js';
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
  assert.deepEqual(p.pairs, [{ a: 'clock', b: 'timer', n: 3 }]);
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
  const noEx = graphSkill.cardHtml(esc, p, [], {}); assert.ok(noEx.includes('<span class="mg-chip">clock'), 'no example known: a chip with no ask, never an invented one');
});
