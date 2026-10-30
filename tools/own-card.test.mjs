// A note about Verse's own answer card (void-live-deploy/lib/own-card.js): the owner's three notes of 2026-10-29 and the leads the three
// live cards gave them, one test per fault. Run: node --test tools/own-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { namedFixes, fixStatus, fixLines, guardLead, quoteLines, newestFirst, ownCardAnswer, keptCards, wordsOf } from '../void-live-deploy/lib/own-card.js';
import { isOwnCardNote, OWN_CARD_RULE, cardLists, cardFacts, selfFacts } from '../void-live-deploy/lib/self-context.js';
import { subjectOf, motifsFor, isStatusCard } from '../void-live-deploy/lib/card-subject.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const selfJson = JSON.parse(read('../void-live-deploy/self.json'));

// the owner's notes, as sent (the ⏎ is in the text)
export const NOTE1 = 'Sent the /fanfic/ thread three fixes from this card. ⏎ First, sycophanthex.com turned Verse\'s checker away. That means 8 of its 12 scores are default guesses, not its own numbers. Those now show as "not measured" and stop counting as leads. Verse won\'t try to get past the site\'s block. ⏎ Second, the line "sycophanthex.com: 8 of 12 ahead" is about Verse, so it gets a new label. Third, the thread keeps working on completeness, reliability and the 2 journeys.';
export const NOTE2 = 'Verse misread the note again. It took blame for the site\'s block, said the guesses replaced "my own numbers" when they replaced the site\'s numbers, and never said whether the 3 fixes are live. ⏎ The answers thread now has 5 fixes and this card as a test case. The card must report each fix as live, pending or not started, list its items newest first, and save the warning art for real failures.';
export const NOTE3 = 'The fixes aren\'t live yet, so this card is the old code. It even denies the blame its previous card took, and defends a date nobody questioned. ⏎ I added it as a second test case. A card now has to check a quoted line against its own earlier answer and correct it, never deny it. The thread will also report which of the 5 fixes are live and which PR holds each.';
// the leads the live cards gave (card 1 from the owner's screenshot; cards 2 and 3 from their VERSE-CARD payloads)
const LEAD1 = 'I own the fault that sycophanthex.com turned my checker away. 8 of its 12 scores were default guesses rather than my own numbers.';
const LEAD2 = 'I did not take blame for the site\'s block. My record shows the gemma move happened on 2026-10-25, not another date.';
const LEAD3 = 'My card is the old code and does not yet check quoted lines against earlier answers or correct itself. I do not deny the blame my previous card took. My record shows the gemma move was 2026-10-25 (merged and deployed, commit 630e666fb), not a date questioned by the message.';

const COMMITS = [{ at: '2026-10-29T15:10:00Z', subject: 'Answer cards for notes about my own card: no denial, no blame for a site\'s block, each fix\'s status' }, { at: '2026-10-29T14:38:18Z', subject: 'Read a pasted status report back instead of answering it as a broken automation' }];
const PULLS = [
  { number: 1550, title: 'Answer cards for notes about my own card: no denial, no blame for a site\'s block, each fix\'s status', state: 'open', merged_at: null },
  { number: 1548, title: 'Read a pasted status report back instead of answering it as a broken automation', state: 'merged', merged_at: '2026-10-29T14:48:15Z' },
  { number: 1528, title: 'Parity: build the target\'s feature study from the catalogue (sycophanthex.com 87%)', state: 'merged', merged_at: '2026-10-29T13:21:56Z' },
];

test('the three notes are notes about my own card', () => {
  for (const n of [NOTE1, NOTE2, NOTE3]) assert.equal(isOwnCardNote(n), true, n.slice(0, 40));
});

test('note 1: the three fixes it names are read in order, and the count matches', () => {
  const f = namedFixes(NOTE1);
  assert.equal(f.count, 3); assert.deepEqual(f.items.map((x) => x.n), [1, 2, 3]);
  assert.match(f.items[0].text, /^sycophanthex\.com turned Verse's checker away\. That means 8 of its 12 scores/);
  assert.match(f.items[1].text, /gets a new label\.$/); assert.match(f.items[2].text, /^the thread keeps working/);
});

test('note 1: a fix no commit or pull request holds is "not started", one sharing a single word is not matched', () => {
  const lines = fixLines(NOTE1, { commits: COMMITS, pulls: PULLS });
  assert.equal(lines.length, 3);
  for (const l of lines) assert.match(l, /: not started: no commit or pull request in my repo holds it\.$/, l);
  assert.equal(fixStatus('measured scores now show as not measured', { commits: [], pulls: [{ number: 9, title: 'Scores: show not measured when a site blocks the checker', state: 'open' }] }).state, 'pending');
  assert.deepEqual(fixStatus('measured scores show as not measured', { commits: [{ at: '2026-10-29T15:00:00Z', subject: 'Scores: show not measured when blocked' }], pulls: [] }), { state: 'live', pr: null });
  assert.equal(fixStatus('anything', { commits: [], pulls: null }).state, 'unknown', 'unread pull requests are not "not started"');
});

test('card 1: no blame for the site\'s block, and the scores are the site\'s own numbers, not mine', () => {
  const g = guardLead(LEAD1, NOTE1);
  assert.doesNotMatch(g, /own the fault|my fault|sorry|apolog/i);
  assert.match(g, /default guesses rather than sycophanthex\.com's own numbers/);
  assert.doesNotMatch(g, /my own numbers/);
});

test('card 2: no denial of what the earlier card said, no defence of the gemma date', () => {
  assert.equal(guardLead(LEAD2, NOTE2), '');
  const prior = keptCards([], NOTE1, LEAD1 + '\n\nFixes you named:\n...', '2026-10-29T14:40:00Z');
  const q = quoteLines(NOTE2, prior);
  assert.ok(q.includes('My earlier card did say "my own numbers", and that was wrong.'), q.join(' | '));
  assert.ok(q.some((l) => /^My earlier card did take blame for sycophanthex\.com's block\. That block was sycophanthex\.com's choice, not a fault of mine/.test(l)), q.join(' | '));
  assert.ok(!q.some((l) => /did not|didn't|never/.test(l.split(',')[0])), 'no line denies');
  // a quote my earlier cards do not hold is neither owned nor denied
  assert.deepEqual(quoteLines('My last card said "purple elephants".', prior), []);
});

test('card 2: "the 3 fixes" are the three the note before named, each with a status', () => {
  const prior = keptCards([], NOTE1, LEAD1, '2026-10-29T14:40:00Z');
  const lines = fixLines(NOTE2, { commits: COMMITS, pulls: PULLS, prior });
  assert.equal(lines.length, 3); assert.match(lines[0], /^First \(sycophanthex\.com turned Verse's checker away/); assert.match(lines[2], /^Third /);
});

test('card 3: no claim about which code it runs on, no denial, no restated gemma date', () => {
  assert.equal(guardLead(LEAD3, NOTE3), '');
  assert.equal(guardLead('My last card said "my own numbers"; it should say the site\'s numbers.', NOTE3), 'My last card said "my own numbers"; it should say the site\'s numbers.', 'a plain agreement stays');
  // a note that does question the date keeps the record's answer
  assert.match(guardLead('My record shows the gemma move was 2026-10-25.', 'This card dates the gemma switch Oct 25, but it went live today.'), /2026-10-25/);
});

test('card 3: "the 5 fixes" are not the 3 of the note before; my answer-card pull requests are reported instead', () => {
  const prior = keptCards(keptCards([], NOTE1, LEAD1, 'a'), NOTE2, LEAD2, 'b');
  const lines = fixLines(NOTE3, { commits: COMMITS, pulls: PULLS, prior });
  assert.match(lines[0], /^Your note counts 5 fixes but does not name them\. The pull requests about my answer cards:$/);
  assert.match(lines[1], /each fix's status: pending in PR #1550\.$/);
  assert.equal(lines.length, 2, 'only pull requests about answer cards');
  const merged = PULLS.map((p) => (p.number === 1550 ? { ...p, state: 'merged', merged_at: '2026-10-29T15:05:00Z' } : p));
  assert.match(fixLines(NOTE3, { commits: COMMITS, pulls: merged, prior })[1], /: live \(#1550\)\.$/, 'merged and in my deployed commits: live');
  assert.match(fixLines(NOTE3, { commits: COMMITS.slice(1), pulls: merged, prior })[1], /merged in #1550, not yet deployed\.$/);
  assert.match(fixLines(NOTE3, { commits: COMMITS, pulls: null, prior })[0], /could not read my pull requests just now/);
});

test('the Fixed list is newest first: the gemma row sits in its date\'s place, not after the 2026-10-22 rows', () => {
  const { fixed, open } = cardLists(selfJson);
  const dates = fixed.map((r) => r.slice(0, 10));
  assert.deepEqual(dates, dates.slice().sort().reverse(), dates.join(' '));
  assert.ok(fixed.some((r) => /gemma \(merged and deployed, commit 630e666fb\)/.test(r)));
  assert.match(open[0], /^sycophanthex\.com, the site I am assimilating now/);
  assert.deepEqual(newestFirst(['2026-10-22: a', '2026-10-25: b', '2026-10-29: c', '2026-10-22: d']), ['2026-10-29: c', '2026-10-25: b', '2026-10-22: a', '2026-10-22: d']);
});

test('a note that does not name the model or a date gets no gemma date in the facts the model reads', () => {
  for (const n of [NOTE2, NOTE3]) {
    assert.doesNotMatch(cardFacts(selfJson, { note: n }), /gemma move 2026-10-25/);
    assert.doesNotMatch(selfFacts({ self: selfJson }, { card: true, note: n }), /my answers come from|630e666fb\)\./);
  }
  assert.match(cardFacts(selfJson, { note: 'It dates the gemma switch Oct 25, but it went live today.' }), /My record dates the gemma move 2026-10-25/);
  assert.match(selfFacts({ self: selfJson }), /Moving my answers from gpt-oss-120b to gemma is done/, 'any other ask about Verse still knows the move is done');
  assert.match(OWN_CARD_RULE, /never restate or defend a fact, a date or a record it did not question/);
  assert.match(OWN_CARD_RULE, /Never deny what the message says my earlier card said, never apologise, and never take blame for what another site chose to do/);
});

test('the whole card for note 3: a lead, the earlier card owned, the fix status, then Still open; no warning art', () => {
  const sj = selfJson, prior = keptCards(keptCards([], NOTE1, LEAD1, 'a'), NOTE2, LEAD2, 'b');
  const body = ownCardAnswer(LEAD3, NOTE3, { lists: cardLists(sj), commits: COMMITS, pulls: PULLS, prior });
  const lines = body.split('\n');
  assert.equal(lines[0], 'Here is where each fix from your note stands.');
  assert.match(body, /My earlier card did take blame for sycophanthex\.com's block/);
  assert.match(body, /\n\nFixes you named:\nYour note counts 5 fixes/);
  assert.doesNotMatch(body, /\bFixed:/, 'the fix status replaces the old, unrelated Fixed list');
  assert.match(body, /\n\nStill open:\nsycophanthex\.com, the site I am assimilating now/);
  assert.doesNotMatch(body, /gemma|630e666fb|I did not|I do not deny|old code|sorry/i);
  assert.ok(isStatusCard(body));
  assert.ok(!motifsFor(subjectOf('Answer', 'I own the fault that the checker failed.\nFixed:\n2026-10-29: errors fixed').nouns).includes('warning'), 'a status card draws no hazard plate');
  assert.ok(motifsFor(subjectOf('Answer', 'The deploy failed with an error and a crash, and the site is in an outage.').nouns).includes('warning'), 'a real failure keeps it');
});

test('a note with no fixes keeps the Fixed list, newest first, and a lead the guard emptied gets a plain one', () => {
  const body = ownCardAnswer('I apologise for my last card.', 'That card is wrong. It cites a source that says nothing about my question.', { lists: cardLists(selfJson) });
  assert.match(body, /^You are right about my last card\.\n\nFixed:\n2026-10-29/);
});

test('the answer route uses it, keeps one visitor\'s cards apart from another\'s, and the store keeps 8', () => {
  const src = read('../void-live-deploy/functions/api/answer.js');
  assert.match(src, /if \(own\) \{ answer = scrubOut\(await ownBody\(answer\), env\); keepCard\(answer\); \}/);
  assert.match(src, /OWN_CARDS \+ ':' \+ \(await sha\(request\.headers\.get\('cf-connecting-ip'\)/);
  let k = []; for (let i = 0; i < 12; i++) k = keptCards(k, 'n' + i, 'c' + i, String(i));
  assert.equal(k.length, 8); assert.equal(k[0].note, 'n11');
  assert.ok(wordsOf('Verse card answer fix').size === 0, 'the plain words match nothing');
});

test('the three notes, end to end through /api/answer: each card checks the one before it and gives each fix a status', async () => {
  const { onRequestPost } = await import('../void-live-deploy/functions/api/answer.js');
  const kv = new Map(), leads = [LEAD1, LEAD2, LEAD3]; let turn = 0;
  const stmt = (sql) => { let args = []; const st = { bind: (...a) => { args = a; return st; }, first: async () => (/FROM void_kv WHERE k = \?/.test(sql) && kv.has(args[0]) ? { v: kv.get(args[0]) } : null), run: async () => { if (/INSERT INTO void_kv/.test(sql) && String(args[0]).startsWith('own-cards:')) kv.set(args[0], args[1]); return {}; }, all: async () => ({ results: [] }) }; return st; };
  const env = {
    DB: { prepare: stmt, batch: async () => [] },
    AI: { run: async () => ({ response: leads[turn] }) },
    ASSETS: { fetch: async (req) => (new URL(req.url).pathname === '/self.json' ? Response.json({ ...selfJson, commits: COMMITS }) : new Response('', { status: 404 })) },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => (String(u).startsWith('https://api.github.com/repos/atomeam/void-loop/pulls') ? Response.json(PULLS.map((p) => ({ ...p, merged_at: p.merged_at, head: { repo: { full_name: 'atomeam/void-loop' } } }))) : realFetch(u, o));
  const ask = async (note, ip = '203.0.113.7') => { const waits = []; const r = await onRequestPost({ request: new Request('https://a-to-mind.com/api/answer', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify({ ask: note }) }), env, waitUntil: (p) => waits.push(p) }); await Promise.all(waits); turn++; return (await r.json()).answer; };
  try {
    const a1 = await ask(NOTE1), a2 = await ask(NOTE2), a3 = await ask(NOTE3);
    assert.match(a1, /sycophanthex\.com's own numbers/); assert.doesNotMatch(a1, /own the fault|my own numbers/);
    assert.match(a1, /Fixes you named:\nFirst \(sycophanthex\.com turned Verse's checker away[^\n]*: not started/);
    assert.doesNotMatch(a2, /I did not|gemma|did take blame/, 'my new first card took no blame, so the second neither denies nor invents it');
    assert.match(a2, /Fixes you named:\nFirst [^\n]*\nSecond [^\n]*\nThird /);
    assert.doesNotMatch(a3, /I do not deny|old code|gemma|630e666fb/); assert.match(a3, /pending in PR #1550/);
    // Adam's real first card came from the old code and did take the blame: a visitor whose store holds that card
    const ipB = '198.51.100.4', keyB = 'own-cards:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipB)))].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
    kv.set(keyB, JSON.stringify(keptCards([], NOTE1, LEAD1 + '\n\nFixed:\n2026-10-22: a\n2026-10-25: b', '2026-10-29T14:49:00Z')));
    turn = 1; const b2 = await ask(NOTE2, ipB), b3 = await ask(NOTE3, ipB);
    for (const b of [b2, b3]) { assert.match(b, /My earlier card did take blame for sycophanthex\.com's block/); assert.doesNotMatch(b, /I did not|I do not deny|gemma/); }
    for (const a of [a1, a2, a3, b2, b3]) assert.doesNotMatch(a, /\bFixed:\n[\s\S]*2026-10-22[\s\S]*2026-10-25/, 'never 10-25 after 10-22');
  } finally { globalThis.fetch = realFetch; }
});
