// What an answer card may claim (void-live-deploy/lib/answer-honesty.js and functions/api/answer.js): the owner's five answer-card
// notes of 2026-10-29, one test per fault. Run: node --test tools/answer-honesty.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { supports, supportedOnly, hasCorrection, dropUnbackedActs, dropFiller, ASK_MAX, QUERY_MAX, CORRECTION_RULE, ACT_RULE } from '../void-live-deploy/lib/answer-honesty.js';
import { isOwnCardNote, OWN_CARD_RULE, modelFacts, towerFacts, selfFacts, cardFacts, wholeClause } from '../void-live-deploy/lib/self-context.js';
import { SOURCE_LINKS, SOURCE_BOX, cardOf, keywordsOf } from '../void-live-deploy/lib/card-frame.js';
import { towerOf } from './self-context.mjs';
import { tower, LANE_PAGES } from '../void-live-deploy/lib/tower.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const selfJson = JSON.parse(read('../void-live-deploy/self.json'));

// the owner's notes, as they were sent to Verse (card 5's own title is the card 4 note; both were cut at 300 characters before)
const CARD5 = 'This card is the first one that speaks as itself and refuses a false claim. Some parts are still off, and I sent them to the ⏎ Gemma answer card ⏎ thread. ⏎ It dates the gemma switch Oct 25, but it went live today. Its lists leave out PR #1406 and the tool-sites ask. The open asks are not in smallest-first order behind sycophanthex.com, and the "no feelings" line is filler.';
const CARD4 = 'Closer, but it still says "the card" about its own card, and it gives no list of what is fixed and what is still open. ⏎ It also claims "I have noted this correction for the thread", and nothing shows that it wrote that anywhere. I told the thread that Verse may claim an action only after the action ran and left a record. The fixes for these cards are not live yet.';
const CARD1 = 'That card is wrong. It cites a source that says nothing about my question and calls itself fetched, sourced and dated.';
const GUMROAD = { title: 'moonbeam846.gumroad.com/l/first-automation-setup', text: 'First automation setup. A done-for-you Zapier and Make starter pack: three ready workflows, a setup call and a checklist. Instant download.' };

// fault 1: a source stays on the card only when its fetched text holds the claim that cites it
test('fault 1: a paraphrase of the ask cited to a page that says nothing about it loses the source', () => {
  const answer = 'You are describing inconsistencies in a set of answer cards about the Gemma switch, dated October 25 [1].';
  const r = supportedOnly(answer, [GUMROAD]);
  assert.deepEqual(r.sources, [], 'the Gumroad page holds none of it');
  assert.doesNotMatch(r.answer, /\[\d\]/, 'and the marker goes with it');
});

test('fault 1: a source whose text holds the sentence stays, renumbered', () => {
  const curie = { title: 'Marie Curie', text: 'Marie Curie was a Polish and naturalised-French physicist and chemist who conducted pioneering research on radioactivity. She was the first woman to win a Nobel Prize.' };
  const r = supportedOnly('Marie Curie was the first woman to win a Nobel Prize [2]. She was a chemist [1].', [GUMROAD, curie]);
  assert.equal(r.sources.length, 1); assert.equal(r.sources[0].title, 'Marie Curie');
  assert.match(r.answer, /Nobel Prize \[1\]\./);
  assert.equal(supports('the weather in Lisbon is mild', curie.text), false);
});

// fault 2: no "fetched, sourced and dated" on a card that fetched nothing (the page counted the product line as a source)
test('fault 2: the product line under a card is not one of its sources', () => {
  assert.equal(SOURCE_LINKS, '.src:not(.vtail) a'); assert.equal(SOURCE_BOX, '.src:not(.vtail)');
  // the page and the copied card both read the sources through these selectors, never the bare ".src a"
  assert.match(read('../void-live-deploy/lib/card-frame.js'), /querySelectorAll\(SOURCE_LINKS\)/);
  assert.match(read('../void-live-deploy/lib/card-share.js'), /querySelectorAll\(SOURCE_LINKS\)/);
  assert.doesNotMatch(read('../void-live-deploy/lib/card-frame.js') + read('../void-live-deploy/lib/card-share.js'), /querySelectorAll\(['"]\.src a['"]\)/);
});

test('fault 2: an answer card with no sources is "from Verse", not fetched, and earns no Sourced keyword', () => {
  const c = cardOf({ kind: 'Answer', sources: null, ageDays: null });
  assert.equal(c.fetched, false); assert.match(c.typeLine, /from Verse$/); assert.doesNotMatch(c.typeLine, /from a source/);
  assert.deepEqual(keywordsOf({ fetched: false, sources: null }), []);
});

// fault 3: a message that corrects itself is answered from the correction
test('fault 3: a correction is seen, and its rule says the later line wins', () => {
  assert.equal(hasCorrection('The deadline is Friday. Correction: it is Monday.'), true);
  assert.equal(hasCorrection('scratch that, I meant the blue one'), true);
  assert.equal(hasCorrection('what is a correction in stocks'), false);
  assert.match(CORRECTION_RULE, /corrected version only/);
});

// fault 4: the ask is read whole, never cut mid-word
test('fault 4: the answer route reads the whole note; only the encyclopedia search is short', () => {
  assert.ok(CARD5.length > 300, 'the note that was cut is longer than the old 300');
  assert.ok(ASK_MAX >= 4000 && CARD5.length <= ASK_MAX); assert.equal(QUERY_MAX, 300);
  const src = read('../void-live-deploy/functions/api/answer.js');
  assert.match(src, /const norm = \(t, n = ASK_MAX\)/);
  assert.doesNotMatch(src, /const norm = [^\n]*slice\(0, 300\)/);
});

// fault 5: a note about Verse's own card is answered by Verse, about itself, with Fixed and Still open from its records
test('fault 5: the five card notes are notes about my own card; other cards are not', () => {
  for (const t of [CARD1, CARD4, CARD5]) assert.equal(isOwnCardNote(t), true, t.slice(0, 40));
  for (const t of ['my credit card was declined', 'what does the card say in tarot', 'what is the best answer to 2+2', 'make me a birthday card']) assert.equal(isOwnCardNote(t), false, t);
  assert.match(OWN_CARD_RULE, /my last card/); assert.match(OWN_CARD_RULE, /Fixed:/); assert.match(OWN_CARD_RULE, /Still open:/);
  assert.match(read('../void-live-deploy/functions/api/answer.js'), /isOwnCardNote\(ask\) \? ' ' \+ OWN_CARD_RULE/);
});

test('fault 5: the gemma date comes from the record, and #1406 and the card fixes are shipped facts', () => {
  assert.match(modelFacts(selfJson), /2026-10-25, commit 630e666fb/);
  const facts = selfFacts({ self: selfJson });
  assert.match(facts, /#1406|want card names the site Versus is on/);
  assert.match(facts, /cite a source only when its text holds the claim/);
});

test('fault 5: Still open starts with the tower target, then the next smallest sites, and names the page it still needs until it has one', () => {
  const floors = [{ id: 'sycophanthex.com' }, { id: 'nameunit.com' }, { id: 'wheelroot.com' }, { id: 'onlineconverter.com' }, { id: 'bigger.example' }];
  const t = towerOf(floors, { id: 'sycophanthex.com', since: '2026-10-29' });
  assert.equal(t.target, 'sycophanthex.com'); assert.deepEqual(t.next, ['nameunit.com', 'wheelroot.com', 'onlineconverter.com']);
  assert.match(t.page, /LANE_PAGES in lib\/tower\.js/);
  assert.equal(towerOf(floors, { id: 'sycophanthex.com' }, { 'sycophanthex.com': '/fanfic/' }).page, undefined, 'a target with a page needs no note');
  const live = tower([], {}, { sites: [{ site: 'sycophanthex.com', rank: 391415, hardness: 46 }] }, null, null, null, 'sycophanthex.com');
  assert.equal(live.floors.find((f) => f.id === 'sycophanthex.com').page, '/fanfic/', 'the tower target is fought by the fan-fiction archive');
  assert.equal(LANE_PAGES['sycophanthex.com'], '/fanfic/');
  const line = towerFacts(selfJson);
  assert.ok(line.indexOf('sycophanthex.com') >= 0 && line.indexOf('sycophanthex.com') < line.indexOf(selfJson.tower.next[0]), 'the target comes before the next sites');
  const facts = selfFacts({ self: selfJson });
  assert.ok(facts.indexOf('my tower target') < facts.indexOf('Growth inbox, still open'), 'the tower comes before the other open work');
});

// card 5's note: the lists the model copies come from the record, and the record's gemma date stands
test('card 5: the own-card facts give Fixed and Still open from my records, target first, record date kept', () => {
  const c = cardFacts(selfJson, { note: CARD5 }); // this note dates the gemma switch, so the record's date goes to the model (a note that does not: tools/own-card.test.mjs)
  const fixed = c.slice(c.indexOf('Fixed:'), c.indexOf('Still open:')), open = c.slice(c.indexOf('Still open:'));
  assert.ok(c.indexOf('Fixed:') >= 0 && c.indexOf('Fixed:') < c.indexOf('Still open:'), 'Fixed comes before Still open');
  assert.match(fixed, /#1406/); assert.match(fixed, /#1410/); assert.match(fixed, /gemma \(merged and deployed, commit 630e666fb\)/);
  assert.doesNotMatch(open, /#1406/, 'a shipped fix is never listed as open');
  assert.match(open, /^Still open: 1\. sycophanthex\.com, the site I am assimilating now/);
  const next = selfJson.tower.next.map((s) => open.indexOf(s));
  assert.ok(next.every((i, k) => i > open.indexOf('sycophanthex.com') && (k === 0 || i > next[k - 1])), 'the next smallest follow the target, in order');
  assert.match(c, /My record dates the gemma move 2026-10-25[^\n]*my record stands: say so, and do not call the date a fault/);
  assert.match(OWN_CARD_RULE, /Own only a fault my records confirm/);
  assert.equal(selfFacts({ self: selfJson }).includes('my records (they are added under your sentences'), false, 'only a note about my own card gets the lists');
  assert.ok(selfFacts({ self: selfJson }, { card: true, note: CARD5 }).startsWith(c), 'and there they come first');
  assert.doesNotMatch(c, /…/, 'no row is broken mid-word');
  assert.equal(wholeClause('value-drift tracker: how prices move over time, grouped by kind, a kind flagged to…'), 'value-drift tracker: how prices move over time, grouped by kind');
  assert.equal(wholeClause('act skill: asks route to the act skill instead of no answer (`POST /api/answer` "my email" is…'), 'act skill: asks route to the act skill instead of no answer');
  assert.equal(wholeClause('a whole row'), 'a whole row');
});

// fault 6: an answer claims an action only when the action ran and left a record; the answer engine writes nothing
test('fault 6: an answer with no write cannot claim one', () => {
  for (const s of ['I have noted this correction for the thread.', "I've logged it.", 'I will pass this on to my builders.', 'I have added it to my notes.', 'I made a note of it.'])
    assert.equal(dropUnbackedActs(s), '', s);
  assert.equal(dropUnbackedActs('My last card was wrong. I have noted this correction for the thread. Fixed: the source check.'), 'My last card was wrong. Fixed: the source check.');
  for (const s of ['I have not noted anything, because nothing here writes a record.', 'I note that my card cited the wrong page.']) assert.equal(dropUnbackedActs(s), s, s);
  assert.match(ACT_RULE, /Never say you did or will do any of that/);
});

test('no filler about being a program or having no feelings', () => {
  assert.equal(dropFiller('I am a program, and I do not have feelings. My last card cited the wrong page.'), 'My last card cited the wrong page.');
  assert.equal(dropFiller('My card was wrong.'), 'My card was wrong.');
});

// the whole route, with the model stubbed: card 5's note goes to the self path, read whole, and what the model says is cleaned
test('the card 5 note, end to end: self route, whole note, my own facts, no claimed write, no filler, no source', async () => {
  const { onRequestPost } = await import('../void-live-deploy/functions/api/answer.js');
  let seen = null;
  const env = {
    AI: { run: async (_m, inp) => { seen = inp; return { response: 'I am a program, and I do not have feelings. My last card dated nothing right. I have noted this correction for the thread. Fixed: the source check (2026-10-29). Still open: sycophanthex.com.' }; } },
    ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; return p === '/self.json' ? Response.json(selfJson) : new Response('', { status: 404 }); } },
  };
  const res = await (await onRequestPost({ request: new Request('https://a-to-mind.com/api/answer', { method: 'POST', body: JSON.stringify({ ask: CARD5 }) }), env, waitUntil: () => {} })).json();
  assert.ok(seen, 'the model was asked');
  const all = (seen.messages || []).map((m) => m.content).join('\n');
  assert.match(all, /smallest-first order behind sycophanthex\.com/, 'the note reached the model whole');
  assert.match(all, /my last card/); assert.match(all, /2026-10-25, commit 630e666fb/); assert.match(all, /my tower target/);
  assert.match(all, /do not copy them/); assert.match(all, /my record stands/);
  assert.match(res.answer, /\n\nFixed:\n2026-10-29[\s\S]*\n\nStill open:\nsycophanthex\.com/, 'the lists come from my records, under the lead');
  assert.equal(res.self, true);
  assert.deepEqual(res.sources, []);
  assert.doesNotMatch(res.answer, /noted this correction|do not have feelings|I am a program/);
  assert.match(res.answer, /^My last card/);
});
