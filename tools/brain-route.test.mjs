// Verse Brain routes asks (lib/brain-route.js; owner, 2026-10-30: "give the brain more to do and more power in the site"): when more
// than one skill can answer, the brain picks, learns from whether the card was kept, logs why, and every lesson can be undone.
// Run: node --test tools/brain-route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../void-live-deploy/lib/brain-route.js';
import * as B from '../void-live-deploy/lib/brain.js';
import { startHost } from '../void-live-deploy/lib/brain-host.js';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('with nothing learned it picks what the page picks; one choice is no choice', () => {
  const r = R.createRoutes();
  const p = R.route(r, 'weather in boston', ['weather', 'place', 'map']);
  assert.equal(p.pick, 'weather'); assert.equal(p.changed, false); assert.match(p.why, /page's first choice/);
  assert.equal(R.route(r, 'weather in boston', ['weather']), null);
  assert.equal(r.picks, 1); assert.equal(r.log.length, 1); assert.equal(r.log[0].first, 'weather');
});

test('a card left teaches it: the next time those words go to the other skill, and Undo takes the lesson back', () => {
  const r = R.createRoutes();
  const a = R.route(r, 'flip a coin please', ['coin-story', 'coin']);
  assert.equal(a.pick, 'coin-story');
  assert.ok(R.outcome(r, a.id, false)); assert.equal(R.outcome(r, a.id, true), false, 'only the first outcome counts');
  const b = R.route(r, 'flip a coin', ['coin-story', 'coin']);
  assert.equal(b.pick, 'coin'); assert.equal(b.changed, true); assert.match(b.why, /chose coin over coin-story: for these words coin-story was left or asked again before/);
  assert.ok(R.undo(r, a.id)); assert.equal(R.undo(r, a.id), false);
  assert.equal(R.route(r, 'flip a coin', ['coin-story', 'coin']).pick, 'coin-story', 'with the lesson undone it is back to the page order');
  assert.deepEqual(r.w, {}, 'nothing of the undone lesson is left');
});

test('a kept card holds its place, and words it attends to now lean toward a skill named for them', () => {
  const r = R.createRoutes();
  const a = R.route(r, 'timer for tea', ['timer', 'tea']); R.outcome(r, a.id, true);
  assert.equal(R.route(r, 'timer for tea', ['timer', 'tea']).why, 'kept timer: it was kept before for these words');
  const c = R.route(R.createRoutes(), 'something about music', ['lyrics', 'piano'], ['piano']);
  assert.equal(c.pick, 'piano'); assert.match(c.why, /it is thinking about piano/);
});

test('the ask\'s own words are not attention: with nothing learned the page\'s first choice stands (2026-10-30, shard 1)', () => {
  // the brain hears each ask as a goal before the page routes it, so "stage" is in its focus when "find milk on the stage" is routed
  const p = R.route(R.createRoutes(), 'find milk on the stage', ['note-tools', 'stage-find'], ['find', 'milk', 'stage']);
  assert.equal(p.pick, 'note-tools'); assert.equal(p.changed, false);
  assert.equal(R.route(R.createRoutes(), 'find milk on the stage', ['note-tools', 'stage-find'], ['stage', 'garden']).pick, 'note-tools');
  assert.equal(R.route(R.createRoutes(), 'search notes for milk', ['note-tools', 'stage-find'], ['stage']).pick, 'stage-find', 'a word from before this ask still leans');
});

test('measured: a visitor who wants the second skill gets it far more often once the brain learns (simulated, 200 asks)', () => {
  // the page always picks the first skill; this visitor keeps "convert" cards and leaves "converter-story" ones
  const asks = ['convert 5 miles to km', 'convert 100 usd to eur', '5 km to miles convert', 'convert 30 c to f'], cands = ['converter-story', 'convert'];
  const r = R.createRoutes(); let brainKept = 0, pageKept = 0;
  for (let i = 0; i < 200; i++) {
    const t = asks[i % asks.length], p = R.route(r, t, cands), good = p.pick === 'convert';
    R.outcome(r, p.id, good); if (good) brainKept++; if (cands[0] === 'convert') pageKept++;
  }
  assert.equal(pageKept, 0);
  assert.ok(brainKept >= 195, 'the brain gave the wanted skill ' + brainKept + ' of 200 times; the page order 0');
});

test('tool-page asks are heard and logged with where the page sent them; an owner key never is', () => {
  const r = R.createRoutes();
  assert.ok(R.heard(r, '100 c to f', '/piano/', '/convert/?q=100%20c%20to%20f'));
  assert.equal(R.heard(r, 'unlock abcdefghijklmnopqrstuvwxyz', '/piano/', '/'), null);
  const a = R.actionsOf(r)[0]; assert.equal(a.kind, 'heard'); assert.match(a.why, /asked on \/piano\/; that page sent it to \/convert\//);
});

test('what it learned is kept with the brain and comes back; wrong shapes are ignored', () => {
  const b = B.createBrain(7); b.routes = R.createRoutes();
  const p = R.route(b.routes, 'flip a coin', ['coin-story', 'coin']); R.outcome(b.routes, p.id, false);
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b)));
  const b2 = B.createBrain(8); assert.ok(B.loadKnowledge(b2, k).includes('routes'));
  assert.equal(R.route(b2.routes, 'flip a coin', ['coin-story', 'coin']).pick, 'coin');
  assert.equal(R.loadRoutes(R.createRoutes(), { w: 5 }), false);
  const r3 = R.createRoutes(); assert.ok(R.loadRoutes(r3, { w: { coin: { coin: [1, 'x'], bad: 3 } }, log: [{ id: 'r1', cands: ['a', 'b'], outcome: 'nope' }] }));
  assert.deepEqual(r3.w, { coin: { coin: [1, 0] } }); assert.equal(r3.log[0].outcome, null);
});

test('the host routes with its own attention, takes outcomes, undoes, forgets, and hears the tool-page asks kept on the device', async () => {
  const store = new Map([['a2m.brain.heard.v1', JSON.stringify([{ text: 'flip a coin', from: '/piano/', to: '/coin/', at: 1 }, { text: 'unlock abcdefghijklmnopqrstuvwxyz' }])]]);
  const win = { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), removeItem: (k) => store.delete(k), setItem: (k, v) => store.set(k, v) } };
  const h = startHost({ win, doc: null, ticking: false, bridge: false, store: { loadKept: async () => null, keep: async () => true } });
  await h.ready;
  assert.equal(store.has('a2m.brain.heard.v1'), false, 'the queue is read once');
  assert.deepEqual(h.actions().map((a) => a.kind), ['heard']); assert.ok(h.brain.concepts.words.includes('coin'), 'it heard the tool-page ask');
  assert.ok(!h.brain.concepts.words.some((w) => /abcdefghij/.test(w)), 'an owner key is never heard');
  const p = h.route('flip a coin', ['coin-story', 'coin']); assert.ok(p.id);
  assert.ok(h.judge(p.id, false)); assert.deepEqual(h.routeStats(), { picks: 1, changed: 0, good: 0, bad: 1 });
  assert.ok(h.undoRoute(p.id)); assert.equal(h.routeStats().bad, 0);
  h.forgot(); assert.deepEqual(h.actions(), []); h.stop();
});

test('the stage asks the brain to choose among every skill that can answer, and teaches it from the next ask, an undo or 20 s', () => {
  const html = read('void-live-deploy/index.html');
  assert.equal(html, read('void.html')); assert.equal(html, read('void-live-deploy/void.html'));
  assert.match(html, /async function firstSkill\(lower0, text, deadline, all = false\)/);
  assert.match(html, /return all \? learnedSkills\.filter\(fits\) : \(learnedSkills\.find\(fits\) \|\| null\)/);
  assert.match(html, /routed = window\.verseBrainHost\.route\(text, all\.map\(\(sk\) => sk\.name\)\)/);
  assert.match(html, /settleRoute\('ask', text\)/);
  // a next ask the page sends to the same skill is that skill used again, not a correction (three period dates in a row)
  assert.match(html, /firstSkill\(String\(next \|\| ''\)\.toLowerCase\(\), next, Date\.now\(\)\)\.then\(\(sk\) => \{ if \(!sk \|\| sk\.name !== w\.pick\) h\.judge\(w\.id, false\); \}\)/);
  assert.match(html, /watchRoute\(routed\.id, vpageEl, text, routed\.pick\)/); assert.match(html, /settleRoute\('undo'\)/); assert.match(html, /setTimeout\(\(\) => settleRoute\('time'\), 20000\)/);
  assert.match(read('void-live-deploy/lib/toolkit.js'), /'a2m\.brain\.heard\.v1'/);
  const page = read('void-live-deploy/brain/index.html'), app = read('void-live-deploy/brain/app.js');
  assert.match(page, /id="didBox"/); assert.match(app, /host\.undoRoute\(a\.id\)/); assert.match(app, /\['Routes', /);
});
