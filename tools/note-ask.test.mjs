// A note aimed at someone, and the stock chatbot refusal (void-live-deploy/lib/note-ask.js, functions/api/answer.js, skills/recent.js): the owner's
// card of 2026-10-30, where a pasted note was answered "I cannot perform the actions you described ... My functions are limited to processing the
// text and images provided to me within this interface", and the note itself was cut at 240 characters. Run: node --test tools/note-ask.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNote, talksLimits, dropLimits, noteRule, noteReading, relatedPage, PAGES, NO_LIMITS_RULE } from '../void-live-deploy/lib/note-ask.js';
import { FILLER_RULE, ASK_MAX } from '../void-live-deploy/lib/answer-honesty.js';
import { rememberAsk, recentAsks, KEPT_ASK_MAX } from '../void-live-deploy/skills/recent.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
// the note as it reached Verse, cut at 240 characters, and the whole note
const CUT = "Good, Beam has it. I'm checking #1795 and will hand you the loop line for Beam once it's live. ⏎ The Modal part was for you, not Beam: you make the account and add the two repo secrets, whenever you want real AI songs. Until then the music";
const WHOLE = CUT + ' page plays the built-in beats.';
const REFUSAL = 'I cannot perform the actions you described. I do not have the capability to create accounts, access external platforms like Modal, or manage repository secrets. My functions are limited to processing the text and images provided to me within this interface.';

test('the stock refusal is found, and every line of it is cut', () => {
  assert.equal(talksLimits(REFUSAL), true);
  assert.equal(dropLimits(REFUSAL), '');
  for (const line of ['As an AI, I cannot open links.', 'I am just a language model.', "I'm sorry, but I can't do that.", 'I do not have access to external accounts.', 'I am unable to create the account for you.'])
    assert.equal(talksLimits(line), true, line);
});

test('a real answer keeps its lines: only the limits line goes', () => {
  const mixed = 'The note asks you to make a Modal account and add two repo secrets. I cannot perform the actions you described. Beam already has the loop line.';
  assert.equal(dropLimits(mixed), 'The note asks you to make a Modal account and add two repo secrets. Beam already has the loop line.');
  for (const fine of ['You cannot divide by zero.', 'I cannot stress this enough: sleep matters.', 'As an AI researcher, Ada wrote notes.', 'I have not done it.', 'Most phones cannot open that file.'])
    assert.equal(talksLimits(fine), false, fine);
});

test('the note is read as a note, cut or whole; a question is not a note', () => {
  assert.equal(isNote(CUT), true);
  assert.equal(isNote(WHOLE), true);
  for (const q of ['what is a black hole', 'how do I make an account when you need two repo secrets? Explain.', 'make a 5 minute timer', 'Tell me how you make bread. Then add a list.'])
    assert.equal(isNote(q), false, q);
});

test('a note read back from its own words: what it says, the step, whose step, where it stops, and the Verse page', () => {
  const r = noteReading(CUT);
  assert.match(r, /^The note says: “Good, Beam has it\./);
  assert.match(r, /The step it asks for is the reader’s, not Beam’s: “The Modal part was for you, not Beam: you make the account and add the two repo secrets/);
  assert.match(r, /It stops mid-sentence at “Until then the music”/);
  assert.match(r, /https:\/\/a-to-mind\.com\/music\/ \(Music tools\)/);
  assert.doesNotMatch(r, /\bI (?:cannot|can't|have (?:made|added|created))\b/, 'no limits line and no claimed act');
  assert.doesNotMatch(noteReading(WHOLE), /stops mid-sentence/, 'a whole note is not called cut');
});

test('the related page is a real Verse page, and only one is named', () => {
  const sitemap = read('../void-live-deploy/sitemap.xml');
  for (const [, path] of PAGES) assert.ok(sitemap.includes('<loc>https://a-to-mind.com' + path + '</loc>'), path + ' is in the sitemap');
  assert.deepEqual(relatedPage(CUT), { path: '/music/', name: 'Music tools' });
  assert.equal(relatedPage('Good, I am checking it once it is live. You make the account.'), null);
});

test('the model is told to read the note in its own voice, and never to talk about its limits', () => {
  const rule = noteRule(relatedPage(CUT));
  assert.match(rule, /what step it asks for and whose step that is/);
  assert.match(rule, /never mention what you can or cannot do/);
  assert.match(rule, /https:\/\/a-to-mind\.com\/music\//);
  assert.match(NO_LIMITS_RULE, /must not mention what you can or cannot do/);
  assert.match(FILLER_RULE, /your functions or your interface/);
});

test('the answer route uses it: a note skips the web search, a limits answer is asked again and cut, a cached refusal is not served', () => {
  const src = read('../void-live-deploy/functions/api/answer.js');
  assert.match(src, /const note = !self && !told && isNote\(ask\)/);
  assert.match(src, /self \|\| isPaste\(ask\) \|\| note \? \[\] : await sources\(ask\)/);
  assert.match(src, /note \? ' ' \+ noteRule\(notePage\)/);
  assert.match(src, /talksLimits\(answer\) && dropLimits\(answer\)\.length < 80/);
  assert.match(src, /NO_LIMITS_RULE/);
  assert.match(src, /answer = dropLimits\(answer\);\n\s*if \(!answer && note\) answer = noteReading\(ask, notePage\);/);
  assert.match(src, /!citesUnbacked\(hit\.answer\) && !talksLimits\(hit\.answer\)/);
  assert.match(src, /const answer = dropLimits\(scrubOut\(/, 'the page answer too');
});

test('a long ask is kept whole in recent asks, so a tap on it never asks a cut version', () => {
  const bag = new Map(); const store = { getItem: (k) => bag.get(k) ?? null, setItem: (k, v) => bag.set(k, v) };
  rememberAsk(WHOLE, store);
  assert.equal(recentAsks(store)[0], WHOLE);
  assert.equal(KEPT_ASK_MAX, ASK_MAX);
  for (const p of ['../void.html', '../void-live-deploy/void.html', '../void-live-deploy/index.html']) {
    const html = read(p);
    assert.doesNotMatch(html, /function rememberAsk\(text\) \{\n\s*const t = String\(text \|\| ''\)\.trim\(\)\.slice\(0, 240\)/, p);
    assert.match(html, /function rememberAsk\(text\) \{\n\s*const t = String\(text \|\| ''\)\.trim\(\)\.slice\(0, 4000\)/, p);
  }
});
