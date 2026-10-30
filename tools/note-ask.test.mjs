// A note aimed at someone, and the stock chatbot refusal (void-live-deploy/lib/note-ask.js, functions/api/answer.js, skills/recent.js): the owner's
// card of 2026-10-30, where a pasted note was answered "I cannot perform the actions you described ... My functions are limited to processing the
// text and images provided to me within this interface", and the note itself was cut at 240 characters. Run: node --test tools/note-ask.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNote, isChatLog, setupFacts, noteFinish, talksLimits, dropLimits, noteRule, noteReading, relatedPage, PAGES, NO_LIMITS_RULE } from '../void-live-deploy/lib/note-ask.js';
import SECRETS from '../void-live-deploy/lib/verse-secrets.js';
import { scan, render } from './verse-secrets.mjs';
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
  assert.match(src, /note \? ' ' \+ noteRule\(notePage, noteFacts\)/);
  assert.match(src, /talksLimits\(answer\) && dropLimits\(answer\)\.length < 80/);
  assert.match(src, /NO_LIMITS_RULE/);
  assert.match(src, /answer = dropLimits\(answer\);\n\s*if \(!answer && note\) answer = noteReading\(ask, notePage, noteFacts\);/);
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

// the owner's paste of 2026-10-30: a chat log from the rap task, read live as "a broken automation" with a guessed MODAL_TOKEN
const CHAT = [
  "On it. I'll give Verse ears: it listens to a track you drop in, measures the beat, flow and mix, scores its own take against it, then raps again and shows the new score.",
  'Let Claude upload this file?', 'For the task "Teach Verse to rap".', 'test-beat-78bpm-swing60.wav', 'rap-ears', 'To', 'a-to-mind.com', 'You allowed this',
  'Today 3:27 AM',
  "Cloudflare's free AI has no music or singing model. ACE-Step 1.5 is open and can make songs. Modal's free plan gives $30 a month.",
  "Should I go the Modal route? You'd make a free Modal account and save its token as a secret in the site's Cloudflare settings yourself (never paste it in chat). I'll write every other step.",
  'Edited', 'Today 8:03 AM', 'Every genre now plays live on real instruments.',
  "Should I set it up once you've made the account? Meanwhile I'll swap in real bass and guitar recordings.",
].join('\n');
const NO_MODAL = /^No Verse code reads a Modal secret yet, so there is no Modal name to save/;
// since the sing work (modal-sing.yml), the repo's workflows read two real Modal secrets: Verse names those, never a guess
const REAL_MODAL = "Verse's code reads these Modal names: MODAL_TOKEN_ID and MODAL_TOKEN_SECRET as GitHub repository secrets.";
const NONE = { cloudflare: [], github: [] };

test('a copied chat is read as a chat, with ⏎ or new lines; an ordinary ask is not', () => {
  assert.equal(isChatLog(CHAT), true);
  assert.equal(isChatLog(CHAT.replace(/\n/g, ' ⏎ ')), true);
  assert.equal(isNote(CHAT), true);
  for (const q of ['what is a black hole', WHOLE, 'Today 3:27 AM I ate soup and it was good, then I went for a walk in the park with my dog and we saw a heron by the pond.', 'My zap is broken: it fails with a 401 error every time it runs, since yesterday. How do I fix it?'])
    assert.equal(isChatLog(q), false, q);
  assert.deepEqual(relatedPage(CHAT), { path: '/rap/', name: 'Verse raps' });
});

test('the setup facts come from the names Verse reads, never a guess', () => {
  const facts = setupFacts(CHAT);
  assert.equal(facts.length, 1, 'Cloudflare settings is where a secret goes, not a Cloudflare secret: ' + facts.join(' | '));
  assert.equal(facts[0], REAL_MODAL, 'the names the code reads now');
  assert.match(setupFacts(CHAT, NONE)[0], NO_MODAL, 'with no Modal secret in the code, Verse says so');
  const fake = { cloudflare: ['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET'], github: [] };
  assert.equal(setupFacts(CHAT, fake)[0], "Verse's code reads these Modal names: MODAL_TOKEN_ID and MODAL_TOKEN_SECRET in the site's Cloudflare settings.");
  assert.deepEqual(setupFacts('Good, Beam has it. I am checking it. You make the account whenever you want.'), [], 'no service named, no fact');
  assert.deepEqual(setupFacts('Modal is a word for a dialog box. You make one with a button.'), [], 'no secret, token or account: not about setup');
});

test('the model is given the facts and told never to guess or ask a name; the read-back carries them', () => {
  const facts = setupFacts(CHAT), rule = noteRule(relatedPage(CHAT), facts);
  assert.match(rule, /or a copied chat, not a question to you and not a broken automation/);
  assert.ok(rule.includes(facts[0]));
  assert.match(rule, /never guess one, and never ask what one is called/);
  assert.doesNotMatch(noteRule(null), /Facts from Verse/);
  const r = noteReading(CHAT);
  assert.ok(r.includes(REAL_MODAL));
  assert.match(noteReading(CHAT, relatedPage(CHAT), setupFacts(CHAT, NONE)), /No Verse code reads a Modal secret yet/);
  assert.match(r, /https:\/\/a-to-mind\.com\/rap\/ \(Verse raps\)\.$/);
});

test('the model answer is made true: a guessed name, a question back and "broken automation" go; the cut line and the facts are added', () => {
  const live = 'This looks like a broken automation. Save MODAL_TOKEN in your Cloudflare settings. What is the variable called in your code? The chat says Verse now plays every genre live.\nhttps://a-to-mind.com/rap/ (Verse raps)';
  const out = noteFinish(live, CHAT);
  assert.doesNotMatch(out, /\bMODAL_TOKEN\b|broken automation|\?/);
  assert.match(out, /The chat says Verse now plays every genre live\./);
  assert.ok(out.includes(REAL_MODAL));
  assert.match(noteFinish(live, CHAT, setupFacts(CHAT, NONE), NONE), /No Verse code reads a Modal secret yet/);
  assert.match(out, /\nhttps:\/\/a-to-mind\.com\/rap\/ \(Verse raps\)$/, 'the page line stays last');
  // the cut note of 2026-10-30, as the live model read it: no word that it was cut
  const cutLive = 'The note states that Beam has the item and that the sender is checking #1795. It asks you to create a Modal account and add two repository secrets.\nhttps://a-to-mind.com/music/ (Music tools)';
  const c = noteFinish(cutLive, CUT);
  assert.match(c, /It stops mid-sentence at “Until then the music”, so the rest is not here\./);
  assert.ok(c.includes(REAL_MODAL));
  assert.equal(noteFinish(cutLive, WHOLE).includes('stops mid-sentence'), false, 'a whole note is not called cut');
  assert.equal(noteFinish('It is cut off at "the music". ' + cutLive, CUT).match(/stops mid-sentence/g), null, 'said once, not twice');
  // a real name Verse reads is kept
  assert.match(noteFinish('Add STRIPE_SECRET_KEY in the Cloudflare settings. You make the Stripe account.', 'You make the Stripe account and add its secret key. Then Beam takes it from there.'), /STRIPE_SECRET_KEY/);
});

test('verse-secrets.js is current: what the code reads now, names only', () => {
  assert.equal(read('../void-live-deploy/lib/verse-secrets.js'), render(scan()), 'run: node tools/verse-secrets.mjs --write');
  for (const n of [...SECRETS.cloudflare, ...SECRETS.github]) assert.match(n, /^[A-Z][A-Z0-9_]+$/, n);
  assert.ok(SECRETS.cloudflare.includes('STRIPE_SECRET_KEY') && SECRETS.github.includes('CLOUDFLARE_API_TOKEN'));
});

test('the answer route finishes every note answer with noteFinish', () => {
  const src = read('../void-live-deploy/functions/api/answer.js');
  assert.match(src, /const noteFacts = note \? setupFacts\(ask\) : \[\]/);
  assert.match(src, /noteRule\(notePage, noteFacts\)/);
  assert.match(src, /if \(!answer && note\) answer = noteReading\(ask, notePage, noteFacts\);\n\s*else if \(note \|\| isPaste\(ask\)\) answer = noteFinish\(answer, ask, note \? noteFacts : setupFacts\(ask\)\);/);
});
