// eightball (skills/eightball.js): the Magic 8 Ball as a stage kind, not an ask matcher. It refuses every ask (the page's chance line answers),
// picks from the classic 20, summonBall puts one ball up and then reuses it, and the ball's card: the flat ball and caption, a tap that
// shakes (history kept to 20, logged, saved), a ball asked again that shakes before it tells, and the 3D miniature handed its answer.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import sk, { ANSWERS, pick, summonBall } from '../void-live-deploy/skills/eightball.js';

class El {
  constructor(tag) { this.tagName = tag; this.kids = []; this.on = {}; this.dataset = {}; this.style = {}; this.attrs = {}; this.className = ''; this.title = ''; this._t = ''; }
  get textContent() { return this._t + this.kids.map((k) => k.textContent).join(''); } set textContent(v) { this._t = String(v); this.kids = []; }
  set innerHTML(v) { this._t = ''; this.kids = []; this._html = v; }
  setAttribute(k, v) { this.attrs[k] = v; } addEventListener(t, f) { (this.on[t] ||= []).push(f); }
  click() { (this.on.click || []).forEach((f) => f({ stopPropagation() {} })); }
  appendChild(c) { this.kids.push(c); return c; } append(...cs) { cs.forEach((c) => this.appendChild(c)); }
}
globalThis.document = { createElement: (t) => new El(t), createTextNode: (t) => ({ textContent: String(t) }) };
function stageOf(extra = {}) {
  const log = { saves: 0, logs: [], drags: [], shown: [] };
  return { log, api: { stage: { appendChild: (el) => log.shown.push(el) }, bindDrag: (el, th) => log.drags.push([el, th]), save: () => { log.saves++; }, log: (r) => log.logs.push(r), ...extra } };
}
const parts = (el) => ({ view: el.kids[0], said: el.kids[1], grip: el.kids[2] });
const face = (view) => view.kids[0].kids[0].textContent; // the flat ball's blue window

test('not an ask matcher: no examples, every ask refused, run answers none', async () => {
  assert.deepEqual(sk.examples, []); assert.deepEqual(sk.nearMisses, ['magic 8 ball']);
  for (const a of [...sk.nearMisses, 'shake the magic 8 ball', 'eightball', 'will it rain? magic 8 ball']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
  assert.equal(await sk.run('magic 8 ball', {}), 'none'); assert.deepEqual(Object.keys(sk.stageKinds), ['eightball']);
});
test('the classic 20 answers (10 yes, 5 non-committal, 5 no), all different, and pick reads them in order', () => {
  assert.deepEqual(ANSWERS, ['It is certain', 'It is decidedly so', 'Without a doubt', 'Yes, definitely', 'You may rely on it', 'As I see it, yes', 'Most likely', 'Outlook good', 'Yes', 'Signs point to yes',
    'Reply hazy, try again', 'Ask again later', 'Better not tell you now', 'Cannot predict now', 'Concentrate and ask again',
    "Don't count on it", 'My reply is no', 'My sources say no', 'Outlook not so good', 'Very doubtful']);
  assert.equal(new Set(ANSWERS).size, 20); assert.ok(!ANSWERS.includes('No'), 'a plain "No" is not one of the classic 20');
  assert.equal(pick(() => 0), 'It is certain'); assert.equal(pick(() => 0.5), 'Reply hazy, try again'); assert.equal(pick(() => 0.9999), 'Very doubtful'); assert.equal(pick(() => 0.07), 'It is decidedly so');
  const seen = new Set(); for (let i = 0; i < 2000; i++) seen.add(pick()); assert.equal(seen.size, 20);
});
test('summonBall: one ball in the middle of the screen; asking again reuses it with the new answer', () => {
  globalThis.innerWidth = 1000; globalThis.innerHeight = 800;
  const things = { c: { id: 'c', kind: 'chess' } }; let renders = 0; const summoned = [];
  const stage = { things: () => things, render: () => { renders++; } }, summon = (k, o) => { summoned.push([k, o]); const t = { id: 'b', kind: k, ...o }; things.b = t; return t; };
  const ball = summonBall(stage, summon, 'Yes'); assert.deepEqual(summoned, [['eightball', { answer: 'Yes', n: 0, x: 380, y: 180 }]]); assert.equal(ball, things.b); assert.equal(renders, 0);
  assert.equal(summonBall(stage, summon, 'No'), ball); assert.equal(ball.answer, 'No'); assert.equal(ball.n, 1); assert.equal(renders, 1);
  summonBall(stage, summon, 'Most likely'); assert.equal(ball.n, 2); assert.equal(ball.answer, 'Most likely'); assert.equal(summoned.length, 1);
  delete things.b; things.old = { id: 'old', kind: 'eightball', answer: 'Yes' }; summonBall(stage, summon, 'Outlook good'); assert.equal(things.old.n, 1, 'a ball with no count starts at 1');
  globalThis.innerWidth = 100; globalThis.innerHeight = 100; summonBall({ things: () => ({}), render() {} }, (k, o) => summoned.push([k, o]), 'Yes'); assert.deepEqual(summoned.at(-1)[1], { answer: 'Yes', n: 0, x: 10, y: 40 });
});
test('the flat ball: its answer on the ball and under it, a random-pick caption, a grip to drag', () => {
  const th = { id: 'f1', kind: 'eightball', x: 12, y: 34, answer: 'Yes', n: 0 }, { log, api } = stageOf(); sk.stageKinds.eightball.mount(th, api);
  const el = log.shown[0], { view, said, grip } = parts(el);
  assert.match(el.className, /eightball-wrap/); assert.equal(el.dataset.id, 'f1'); assert.match(el.style.cssText, /left:12px;top:34px;width:240px/); assert.deepEqual(log.drags, [[el, th]]);
  assert.equal(face(view), 'Yes'); assert.equal(said.textContent, 'Yes'); assert.equal(said.title, 'a random pick from the classic 20 answers, not a prediction'); assert.equal(said.attrs['aria-live'], 'polite');
  assert.equal(grip.textContent, '⠿ Magic 8 Ball · tap to shake');
});
test('a tap shakes it: a new answer, a count, the last 20 in history, saved and logged', () => {
  const rnd = mock.method(Math, 'random', () => 0.5);
  try {
    const th = { id: 'f2', kind: 'eightball', x: 0, y: 0, answer: 'Yes', n: 3, question: 'old?', history: Array.from({ length: 20 }, (_, i) => ({ q: null, a: 'h' + i })) }, { log, api } = stageOf();
    sk.stageKinds.eightball.mount(th, api); const { view, said } = parts(log.shown[0]);
    view.kids[0].click();
    assert.equal(th.answer, 'Reply hazy, try again'); assert.equal(th.n, 4); assert.equal(th.question, null);
    assert.equal(th.history.length, 20); assert.equal(th.history[0].a, 'h1'); assert.deepEqual({ ...th.history[19], at: 0 }, { q: null, a: 'Reply hazy, try again', at: 0, how: 'shaken' }); assert.ok(!isNaN(Date.parse(th.history[19].at)));
    assert.equal(log.saves, 1); assert.deepEqual(log.logs, [{ domain: 'void.stage', ask: 'shake the magic 8 ball', score: 'pass', note: 'chance' }]);
    assert.equal(view.kids.length, 1, 'redrawn, not stacked'); assert.equal(face(view), 'Reply hazy, try again'); assert.equal(said.textContent, 'Reply hazy, try again', 'no question shown after a tap');
  } finally { rnd.mock.restore(); }
});
test('asked again (3D ball): the question shows, it shakes, and tells the answer 1.5 s later; the flat ball tells at once', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const mini = { miniature: () => new Promise(() => {}) }, th = { id: 'f3', kind: 'eightball', x: 0, y: 0, answer: 'Yes', n: 0 };
    let { log, api } = stageOf(mini); sk.stageKinds.eightball.mount(th, api); assert.equal(parts(log.shown[0]).said.textContent, 'Yes', 'first sight: no shake');
    th.answer = 'Very doubtful'; th.n = 1; th.question = 'will it rain?';
    ({ log, api } = stageOf(mini)); sk.stageKinds.eightball.mount(th, api); const { said } = parts(log.shown[0]);
    assert.equal(said.textContent, '“will it rain?”'); mock.timers.tick(1499); assert.equal(said.textContent, '“will it rain?”');
    mock.timers.tick(1); assert.equal(said.textContent, '“will it rain?”Very doubtful');
    ({ log, api } = stageOf(mini)); sk.stageKinds.eightball.mount(th, api); assert.equal(parts(log.shown[0]).said.textContent, '“will it rain?”Very doubtful', 'a redraw with no new ask tells at once');
    th.answer = 'No'; th.n = 2; ({ log, api } = stageOf()); sk.stageKinds.eightball.mount(th, api); assert.equal(parts(log.shown[0]).said.textContent, '“will it rain?”No', 'no WebGL: the flat ball does not shake, it tells');
  } finally { mock.timers.reset(); }
});
test('with 3D: the miniature gets the answer, count and a shake hook; if it fails, the flat ball', async () => {
  const th = { id: 'f4', kind: 'eightball', x: 0, y: 0, answer: 'Outlook good', n: 2 }, updates = [], asked = [];
  let { log, api } = stageOf({ miniature: (view, kind, data, opts) => { asked.push([kind, data, opts]); return Promise.resolve({ update: (d) => updates.push(d) }); } });
  sk.stageKinds.eightball.mount(th, api); await new Promise((r) => setImmediate(r));
  assert.equal(asked[0][0], 'eightball'); assert.equal(asked[0][2].key, 'eightball:f4'); assert.equal(asked[0][2].label, 'Magic 8 Ball: Outlook good. Tap it to shake; drag to turn it');
  assert.equal(updates.length, 1); assert.equal(updates[0].answer, 'Outlook good'); assert.equal(updates[0].n, 2); assert.equal(parts(log.shown[0]).view.kids.length, 0, 'no flat ball under the 3D one');
  const rnd = mock.method(Math, 'random', () => 0); try { updates[0].onShake(); } finally { rnd.mock.restore(); }
  assert.equal(updates.length, 2); assert.equal(updates[1].answer, 'It is certain'); assert.equal(updates[1].n, 3); assert.equal(parts(log.shown[0]).said.textContent, '', 'the answer waits while it shakes');
  ({ log, api } = stageOf({ miniature: () => Promise.reject(new Error('no webgl')) })); sk.stageKinds.eightball.mount({ id: 'f5', x: 0, y: 0, answer: 'No', n: 0 }, api); await new Promise((r) => setImmediate(r));
  assert.equal(face(parts(log.shown[0]).view), 'No');
});
