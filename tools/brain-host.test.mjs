// brain-host: Verse uses Verse Brain on every page, not only while its card is open (owner, 2026-10-29: "how do we get verse to use its
// grok built brain ?"). Checks, with numbers:
//   - the asks layer (lib/brain-mind.js heardAsk) learns what the visitor asks next, guesses it before it comes and counts its hits
//   - the ask box's suggestions (suggestAsks) put the ask it expects next first; on a replay of a visitor with habits the brain's top
//     suggestion is the next ask far more often than the newest-first list the page showed before, and its top 5 hold it more often too
//   - the host (lib/brain-host.js) hears every 'void:ask' on the page, keeps what it learned on the device, gives it back to a new brain,
//     answers "what are you thinking?" from its state with the visitor's own asks as goals, and is one per page
//   - an owner key is never kept, and the kept record is capped
// Run: node --test tools/brain-host.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as Mi from '../void-live-deploy/lib/brain-mind.js';
import { startHost, ensureHost } from '../void-live-deploy/lib/brain-host.js';

const store = () => { const box = { k: null, saves: 0 }; return { box, loadKept: async () => box.k, keep: async (k) => { box.k = JSON.parse(JSON.stringify(k)); box.saves++; return true; } }; };
const page = () => { const doc = new EventTarget(); doc.visibilityState = 'visible'; const win = new EventTarget(); return { doc, win }; };
const ask = (doc, text) => doc.dispatchEvent(new CustomEvent('void:ask', { detail: { text } }));
const settle = () => new Promise((r) => setTimeout(r, 0));

test('the asks layer learns what comes next, guesses it before it comes, and counts its hits', () => {
  const b = B.createBrain(3);
  const day = ['make a clock', 'make it blue', 'add stars'];
  for (let r = 0; r < 3; r++) for (const t of day) B.heardAsk(b, t);
  const A = b.mind.asks;
  assert.equal(A.heard, 9);
  assert.equal(A.guess, 'make a clock', 'after "add stars" it expects the day to start again');
  assert.ok(A.guessed >= 5 && A.hits === A.guessed, 'every guess it made was right: ' + A.hits + ' of ' + A.guessed);
  assert.deepEqual(B.nextAfter(b, 'Make a clock?').map((x) => x.ask), ['make it blue'], 'case and end punctuation do not make a new ask');
  const r = B.heardAsk(b, 'what is a black hole');
  assert.equal(r.hit, false, 'a wrong guess is counted as wrong');
});

test('the empty ask box: the brain puts the ask it expects next first; the newest-first list puts the ask just made first', () => {
  const b = B.createBrain(4), recent = [];
  const said = (t) => { B.heardAsk(b, t); recent.unshift(t); };
  for (const t of ['make a clock', 'make it blue', 'what is a black hole', 'make a clock', 'make it blue', '15% of 80', 'make a clock']) said(t);
  const newest = [...new Set(recent)].slice(0, 5);
  assert.equal(newest[0], 'make a clock', 'before: the box led with what was just asked');
  const brain = B.suggestAsks(b, newest, 5);
  assert.equal(brain[0], 'make it blue', 'now: it leads with what this visitor asks after "make a clock"');
  assert.equal(new Set(brain).size, brain.length, 'no line twice');
  assert.deepEqual([...brain].sort(), [...newest].sort(), 'the same asks, in the brain\'s order: none lost, none made up');
});

// a seeded visitor with habits: three routines they repeat, and one-off asks between them (30% of the time)
function visitor(seed, n) {
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const routines = [['make a clock', 'make a 5 minute timer', 'make it blue'], ['what is a black hole', 'define entropy', 'read it aloud'], ['make a list', 'add a sticky that says milk', 'keep this', 'close']];
  const one = ['15% of 80', '5 miles in km', '100 usd in eur', 'draw a circle', 'make a counter', 'add stars', 'quieter font', 'what can you do', 'make everything bigger', 'open a notepad'];
  const out = []; while (out.length < n) { if (rnd() < 0.3) out.push(one[Math.floor(rnd() * one.length)]); else out.push(...routines[Math.floor(rnd() * routines.length)]); }
  return out.slice(0, n);
}
/** replay a visitor through the empty box: before each ask, what the box would suggest. Returns { top1, top5 } hit rates for both lists. */
function replay(seq) {
  const b = B.createBrain(7), recent = []; let n = 0; const hit = { old1: 0, old5: 0, new1: 0, new5: 0 };
  for (const t of seq) {
    if (recent.length) {
      const old = recent.slice(0, 5), mine = B.suggestAsks(b, recent.slice(0, 12), 5); n++;
      if (old[0] === t) hit.old1++; if (old.includes(t)) hit.old5++; if (mine[0] === t) hit.new1++; if (mine.includes(t)) hit.new5++;
    }
    B.heardAsk(b, t); const i = recent.indexOf(t); if (i >= 0) recent.splice(i, 1); recent.unshift(t); if (recent.length > 12) recent.pop();
  }
  return Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, Math.round((v / n) * 1000) / 1000]));
}

test('measured: on a replay of 3 visitors with habits, the brain\'s suggestions hold the next ask far more often than newest-first', () => {
  for (const seed of [11, 23, 37]) {
    const r = replay(visitor(seed, 300));
    console.log('visitor ' + seed + ': top 1 brain ' + r.new1 + ' vs newest-first ' + r.old1 + '; top 5 brain ' + r.new5 + ' vs newest-first ' + r.old5);
    assert.ok(r.old1 < 0.05, 'newest-first leads with the ask just made, which is almost never the next one: ' + r.old1);
    assert.ok(r.new1 >= 0.45, 'the brain leads with the next ask about half the time or more: ' + r.new1);
    assert.ok(r.new5 >= r.old5 + 0.1, 'and its 5 hold the next ask more often: ' + r.new5 + ' vs ' + r.old5);
  }
});

test('typed hints that match equally: the brain orders them by habit, then by nearness to its goals', () => {
  const b = B.createBrain(5);
  for (let r = 0; r < 2; r++) for (const t of ['make a clock', 'make it blue']) { B.heardAsk(b, t); B.ask(b, t); }
  B.heardAsk(b, 'make a clock'); B.ask(b, 'make a clock');
  assert.ok(B.askScore(b, 'make it blue') > B.askScore(b, 'make a list'), 'its habit after "make a clock" ranks above a stranger');
  const c = B.createBrain(6); B.ask(c, 'tell me about black holes');
  assert.ok(B.askScore(c, 'what is a black hole') > B.askScore(c, 'make a calculator'), 'a line near its goals ranks above one far from them');
});

test('an owner key is never kept as an ask, and the kept record is capped', () => {
  const b = B.createBrain(8);
  B.heardAsk(b, 'make a clock'); B.heardAsk(b, 'unlock abcdefghijklmnopqrstuvwxyz123456'); B.heardAsk(b, 'make it blue');
  const k = JSON.stringify(B.knowledgeOf(b));
  assert.ok(!/abcdefghijklmnop/.test(k), 'the key is not in what is kept');
  for (let i = 0; i < 200; i++) { B.heardAsk(b, 'ask ' + i); B.heardAsk(b, 'next ' + (i % 13)); }
  assert.ok(Object.keys(b.mind.asks.next).length <= Mi.MAX_ASK_KEYS, 'at most ' + Mi.MAX_ASK_KEYS + ' asks have followers');
  assert.ok(Object.values(b.mind.asks.next).every((row) => Object.keys(row).length <= Mi.MAX_NEXT));
  const c = B.createBrain(9); assert.ok(B.loadKnowledge(c, JSON.parse(k)).includes('asks'));
  assert.equal(c.mind.asks.guess, b.mind.asks.guess === null ? null : c.mind.asks.guess);
  assert.equal(B.loadKnowledge(B.createBrain(1), { v: 1, asks: { next: 'nonsense' } }).includes('asks'), false, 'a wrong shape changes nothing');
});

test('the host hears every ask on the page, keeps it on the device, and gives it back to a new brain', async () => {
  const { doc, win } = page(), st = store();
  const h = startHost({ doc, win, seed: 12, store: st, ticking: false, bridge: false, early: ['make a clock'] });
  await h.ready;
  for (const t of ['make it blue', 'make a clock', 'make it blue', 'make a clock']) ask(doc, t);
  await settle();
  assert.equal(h.brain.mind.asks.heard, 5, 'the early ask and the 4 on the page');
  assert.equal(h.suggest(['make a clock', 'make it blue', 'add stars'])[0], 'make it blue');
  assert.ok(h.brain.mind.goals.some((g) => g.word === 'clock'), 'an ask is a goal of the brain too');
  assert.ok(h.guesses().hits >= 2);
  assert.equal(await h.save(), true); assert.equal(st.box.saves, 1);
  assert.equal(await h.save(), false, 'nothing new, nothing written');
  const fresh = h.reset(99);
  assert.equal(fresh.mind.asks.guess, 'make it blue', 'Reset: a new brain gets back what this device kept');
  h.stop();
  const again = startHost({ doc, win, seed: 13, store: st, ticking: false, bridge: false }); await again.ready;
  assert.equal(again.brain.mind.asks.guess, 'make it blue', 'the next visit starts from what this device kept');
  again.stop();
});

test('"what are you thinking?" is answered by the brain from its state, with the visitor\'s asks as its goals', async () => {
  const { doc, win } = page();
  const h = startHost({ doc, win, seed: 21, store: store(), ticking: false, bridge: false }); await h.ready;
  ask(doc, 'tell me about volcanoes'); await settle();
  for (let i = 0; i < 30; i++) B.stepBrain(h.brain, { over: false });
  const a = h.answer('what are you thinking?');
  assert.match(a, /^I am attending to the /);
  assert.match(a, /volcanoes \d+%/, 'its goals are the visitor\'s own ask: ' + a);
  assert.equal(h.answer('make a clock'), null, 'not a question about itself: no answer');
  h.stop();
});

test('one host a page: ensureHost gives back the running one, and learns only the early asks from before it started', async () => {
  const { doc, win } = page();
  const h = ensureHost({ doc, win, seed: 31, store: store(), ticking: false, bridge: false, early: [{ text: 'make a list', at: Date.now() - 50 }] });
  await h.ready;
  const at = h.startedAt;
  const same = ensureHost({ doc, win, early: [{ text: 'make a list', at: at - 10 }, { text: 'add stars', at: at + 10 }] });
  assert.equal(same, h);
  await h.ready; await settle();
  assert.equal(h.brain.mind.asks.heard, 2, 'the two before it started, not the one it heard itself');
  h.stop(); assert.equal(win.verseBrainHost, undefined);
});

test('the card shows the page\'s one brain: opening adopts it, Reset gives the host a new one, closing lets it go', async () => {
  const { doc, win } = page(); globalThis.window = win; globalThis.innerWidth = 800;
  try {
    const h = ensureHost({ doc, win, seed: 41, store: store(), ticking: false, bridge: false }); await h.ready;
    ask(doc, 'make a clock'); await settle();
    const { idea } = await import('../void-live-deploy/skills/verse-brain.js');
    const opened = idea.create(5);
    assert.equal(opened.b, h.brain, 'the card opens on the brain that heard the page');
    assert.ok(opened.hosted);
    h.adopted = true; // what the card's mount does
    const reset = idea.create(6);
    assert.notEqual(reset.b, opened.b, 'Reset: a new brain');
    assert.equal(h.brain, reset.b, 'and the host thinks with it from then on');
    h.adopted = false; // what closing the card does
    assert.equal(idea.create(7).b, h.brain, 'reopened: the same brain again');
    h.stop();
  } finally { delete globalThis.window; delete globalThis.innerWidth; }
});

test('"what are you thinking about" opens the card and Verse answers in the brain\'s own words', async () => {
  const { doc, win } = page(); globalThis.window = win; globalThis.innerWidth = 800;
  try {
    const h = ensureHost({ doc, win, seed: 51, store: store(), ticking: false, bridge: false }); await h.ready;
    ask(doc, 'tell me about volcanoes'); await settle();
    const { default: skill } = await import('../void-live-deploy/skills/verse-brain.js');
    const said = [], api = { stage: { things: () => ({}), render() {} }, summon() {}, say: (t) => said.push(t) };
    assert.equal(await skill.run('what are you thinking about', api), 'verse-brain');
    assert.match(said[0], /^I am attending to the .*volcanoes \d+%/, said[0]);
    said.length = 0; assert.equal(await skill.run('show me your brain', api), 'verse-brain');
    assert.match(said[0], /^My brain, live/, 'any other ask keeps its line');
    h.stop();
  } finally { delete globalThis.window; delete globalThis.innerWidth; }
});

test('after a reload the card shows what the host kept and gets back what it was thinking, over the asks this page heard', async () => {
  const B = await import('../void-live-deploy/lib/brain.js');
  const { startHost } = await import('../void-live-deploy/lib/brain-host.js');
  let store = null; const mem = { loadKept: async () => store, keep: async (k) => { store = k; return true; } };
  const a = startHost({ seed: 7, store: mem, ticking: false, bridge: false }); await a.ready;
  a.hear('tell me about knights'); a.hear('show me a volcano'); B.ask(a.brain, 'romance mystery');
  for (let i = 0; i < 30; i++) B.stepBrain(a.brain, { over: false });
  // the shared field keeps the working memory in IndexedDB, as a structured clone
  const working = structuredClone(B.workingOf(a.brain)); await a.save(); a.stop();
  const b = startHost({ seed: 8, store: mem, ticking: false, bridge: false, early: ['show me your brain'] }); await b.ready;
  assert.ok(b.restored.length > 0, 'the host lists what it kept');
  assert.ok(!B.isCold(b.brain), 'this page\'s ask warmed it');
  assert.ok(b.onlyHere(), 'it holds only this page\'s asks');
  const done = B.loadWorking(b.brain, working); b.warm(b.brain);
  assert.ok(done.includes('workspace'));
  for (const w of ['romance', 'knights', 'brain']) assert.ok(b.brain.concepts.words.includes(w), w);
  assert.ok(!b.onlyHere(), 'given back once');
  b.stop();
});
