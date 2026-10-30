// brain-dialogue: the conversation orb (owner, 2026-10-30) is a real organ of Verse Brain. It keeps what this visitor asked and what Verse
// answered on their own device, so a repeat says when it was asked and what Verse said then, and a follow-up names the ask it follows.
// Its proxy for "Out in the world": follow-ups answered and not asked again, on 2 or more separate days. Nothing it keeps leaves the device,
// an owner key is never kept, and the self it publishes holds counts only.
// Run: node --test tools/brain-dialogue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as Dl from '../void-live-deploy/lib/brain-dialogue.js';
import { startHost } from '../void-live-deploy/lib/brain-host.js';

const T0 = Date.UTC(2026, 9, 27, 15), MIN = 60000, DAY = Dl.DAY;

test('a repeat on a later day says when it was asked, what Verse said, and whether the answer is the same', () => {
  const D = Dl.makeDialogue();
  assert.equal(Dl.heard(D, 'How tall is Mount Everest?', T0), null, 'a first ask builds on nothing');
  Dl.answered(D, 'How tall is Mount Everest?', '<p>Mount <b>Everest</b> is 8,849 m tall.</p>', T0 + 2000);
  const r = Dl.heard(D, 'how tall is mount everest', T0 + 2 * DAY);
  assert.equal(r.kind, 'repeat'); assert.equal(r.entry.ask, 'How tall is Mount Everest?');
  const a = Dl.answered(D, 'how tall is mount everest', 'Mount Everest is 8,849 m tall.', T0 + 2 * DAY + 1500);
  assert.equal(a.kind, 'repeat'); assert.equal(a.prior.at, T0); assert.equal(a.prior.answer, 'Mount Everest is 8,849 m tall.'); assert.equal(a.same, true);
  Dl.heard(D, 'How tall is Mount Everest?', T0 + 5 * DAY);
  assert.equal(Dl.answered(D, 'How tall is Mount Everest?', 'Everest was remeasured at 8,850 m.', T0 + 5 * DAY + 900).same, false, 'a changed answer says so');
  assert.equal(D.repeats, 2);
});

test('the same ask again a minute later is not a repeat: it marks the first answer as not kept', () => {
  const D = Dl.makeDialogue();
  Dl.heard(D, 'weather in oslo', T0); Dl.answered(D, 'weather in oslo', 'Rain.', T0 + 1000);
  assert.equal(Dl.heard(D, 'weather in oslo', T0 + MIN), null);
  assert.equal(D.log[0].again, true);
});

test('a follow-up builds on the earlier ask: by its words or by the start of its answer', () => {
  const D = Dl.makeDialogue();
  Dl.heard(D, 'who directed Alien', T0); Dl.answered(D, 'who directed Alien', 'Alien (1979) was directed by Ridley Scott.', T0 + 1000);
  const f = Dl.heard(D, 'what else did ridley scott make', T0 + 3 * MIN);
  assert.equal(f.kind, 'follow', 'Ridley Scott was in the answer'); assert.equal(f.entry.ask, 'who directed Alien');
  const a = Dl.answered(D, 'what else did ridley scott make', 'Blade Runner, Gladiator and The Martian.', T0 + 3 * MIN + 800);
  assert.equal(a.kind, 'follow'); assert.equal(a.prior.ask, 'who directed Alien');
  assert.equal(Dl.heard(D, 'flip a coin', T0 + 4 * MIN), null, 'an ask with nothing in common follows nothing');
  assert.equal(Dl.heard(D, 'alien sequel', T0 + 2 * DAY).kind, 'follow', 'a shared word follows inside the window');
  assert.equal(Dl.heard(D, 'alien prequel', T0 + 40 * DAY), null, 'not after FOLLOW_DAYS');
});

test('the proxy: follow-ups answered and not asked again, on 2 separate days', () => {
  const D = Dl.makeDialogue(), day = (n, ask, follow, again) => {
    const t = T0 + n * DAY; Dl.heard(D, ask, t); Dl.answered(D, ask, 'An answer about ' + ask + '.', t + 1000);
    Dl.heard(D, follow, t + 2 * MIN); Dl.answered(D, follow, 'More on ' + follow + '.', t + 2 * MIN + 1000);
    if (again) Dl.heard(D, follow, t + 4 * MIN);
  };
  day(0, 'black holes', 'how do black holes evaporate', true);
  let s = Dl.dialogueStats(D, T0 + 1 * DAY); assert.equal(s.kept, 0, 'asked again: not kept'); assert.equal(s.met, false);
  day(1, 'tides', 'why are spring tides higher');
  assert.equal(Dl.dialogueStats(D, T0 + DAY + 3 * MIN).kept, 0, 'not kept until GAP has passed');
  s = Dl.dialogueStats(D, T0 + 2 * DAY); assert.equal(s.kept, 1); assert.equal(s.days, 1); assert.equal(s.met, false);
  day(3, 'volcanoes', 'which volcanoes are active');
  s = Dl.dialogueStats(D, T0 + 4 * DAY); assert.equal(s.kept, 2); assert.equal(s.days, 2); assert.equal(s.met, true);
});

test('an owner key is never kept, the log is capped, and a wrong record restores nothing', () => {
  const D = Dl.makeDialogue();
  assert.equal(Dl.heard(D, 'unlock abcdefghijklmnopqrstuvwxyz123456', T0), null); assert.equal(D.log.length, 0);
  for (let i = 0; i < Dl.MAX + 15; i++) Dl.heard(D, 'ask number ' + i, T0 + i * DAY);
  assert.equal(D.log.length, Dl.MAX);
  assert.equal(Dl.loadDialogue(Dl.makeDialogue(), { log: 'nonsense' }), false);
  assert.equal(Dl.loadDialogue(Dl.makeDialogue(), { log: [{ ask: 'unlock abcdefghijklmnopqrstuvwxyz123456', at: T0 }] }), false);
});

test('it is an organ of the brain: a recalled ask lights its ideas again, it is kept on the device, and the self holds counts only', () => {
  const b = B.createBrain(7);
  assert.ok(B.ORGAN_IDS.includes('dialogue') && B.ORGAN_IDS.length === 23);
  B.ask(b, 'tell me about dragons'); Dl.heard(b.dialogue, 'tell me about dragons', T0); Dl.answered(b.dialogue, 'tell me about dragons', 'Dragons are creatures of myth.', T0 + 1000);
  for (let t = 0; t < 600; t++) B.stepBrain(b, { x: 0.5, y: 0.5, over: false });
  assert.equal(b.runs.dialogue, 0, 'with no recalled ask it rests and takes no run from the others');
  const i = b.concepts.words.indexOf('dragons'), n = b.concepts.node[i], dim = b.ws.nodes.act[n];
  const r = Dl.heard(b.dialogue, 'tell me about dragons', T0 + DAY); b.dialogue.now = T0 + DAY; assert.equal(r.kind, 'repeat');
  let ran = 0; for (let t = 0; t < 200 && b.dialogue.pending.length; t++) { B.stepBrain(b, { x: 0.5, y: 0.5, over: false }); ran++; }
  assert.equal(b.dialogue.pending.length, 0, 'the organ ran within ' + ran + ' ticks'); assert.ok(b.runs.dialogue >= 1);
  assert.ok(b.board.dialogue && b.board.dialogue.lit >= 1, 'it lit the earlier ask\'s ideas'); assert.ok(dim < 0.5 && b.ws.nodes.act[n] >= 0.79, 'dragons had dimmed to ' + dim + ' and is lit again');
  const s = B.selfOf(b).dialogue; assert.deepEqual(Object.keys(s).sort(), ['answered', 'asks', 'days', 'follows', 'kept', 'met', 'repeats']);
  assert.ok(Object.values(s).every((v) => typeof v === 'number' || typeof v === 'boolean'), 'counts only');
  assert.ok(!/dragons/.test(JSON.stringify(B.selfOf(b).dialogue)) && !/dragons/.test(JSON.stringify(B.params(b))), 'no words in the self or the seal');
  assert.ok(B.selfSays(b).some((x) => /^Dialogue: 2 asks of yours kept on this device, 1 answered; 1 repeat and 0 follow-ups built on an earlier ask\.$/.test(x)), B.selfSays(b).join(' | '));
  const k = JSON.parse(JSON.stringify(B.knowledgeOf(b))), c = B.createBrain(8), done = B.loadKnowledge(c, k);
  assert.ok(done.includes('dialogue')); assert.equal(c.dialogue.log.length, 2); assert.equal(c.dialogue.repeats, 1);
  assert.equal(c.dialogue.log[0].answer, 'Dragons are creatures of myth.');
});

test('the host: it hears the ask, keeps the answer, the card gets the earlier ask, and Forget clears it', async () => {
  const doc = new EventTarget(); doc.visibilityState = 'visible'; const win = new EventTarget(); let clock = T0;
  const box = { k: null }, st = { loadKept: async () => box.k, keep: async (k) => { box.k = JSON.parse(JSON.stringify(k)); return true; } };
  const h = startHost({ doc, win, seed: 5, store: st, ticking: false, bridge: false, now: () => clock });
  await h.ready;
  doc.dispatchEvent(new CustomEvent('void:ask', { detail: { text: 'who painted the starry night' } })); await h.ready; await new Promise((r) => setTimeout(r, 0));
  assert.equal(h.answered('who painted the starry night', 'Vincent van Gogh painted it in 1889.').kind, null, 'a first ask builds on nothing');
  await h.save(true); h.stop();
  clock = T0 + DAY + 3 * 3600000;
  const h2 = startHost({ doc, win, seed: 6, store: st, ticking: false, bridge: false, now: () => clock }); await h2.ready;
  const heard = h2.hear('when did van gogh die');
  assert.equal(heard.recalled.kind, 'follow', 'a reload keeps the earlier ask; van gogh was in its answer');
  const a = h2.answered('when did van gogh die', 'He died in July 1890.');
  assert.equal(a.kind, 'follow'); assert.equal(a.prior.ask, 'who painted the starry night'); assert.equal(a.prior.at, T0);
  clock += 20 * MIN; assert.deepEqual(h2.dialogue(), { asks: 2, answered: 2, repeats: 0, follows: 1, kept: 1, days: 1, met: false });
  h2.forgot(); assert.equal(h2.dialogue().asks, 0, 'Forget clears the log'); h2.stop();
});
