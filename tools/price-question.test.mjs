// A price question must get BOTH the membership line and the services card, in one answer. Two matchers decide that on the
// page: isPaidAsk says the line (void.html PAID_CORE), isPriceQuestion opens the card (PRICE_QUESTION_RE + skills/services.js
// servicesOf). When they drift apart one half shows alone: the flake "paid: signed out, a price question says the membership
// line AND opens the services card under it" went red twice (2026-10-14 and 2026-10-25) because the ask matched one matcher
// and not the other after the V01D -> Verse rename. This pins every price question to the other two, so the halves cannot
// drift again. Run: node --test tools/price-question.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { servicesOf } from '../void-live-deploy/skills/services.js';

const page = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
// the page's own constants, read from the source (no browser): PAID_LEAD + PAID_CORE build PAID_RE, PRICE_QUESTION_RE is the card's half
const oneLine = (name) => { const i = page.indexOf('const ' + name + ' = '); assert.ok(i >= 0, name + ' is in void.html'); const j = page.indexOf('\n', i); return page.slice(i + ('const ' + name + ' = ').length, j).replace(/;\s*(?:\/\/.*)?$/, ''); };
const arrayLit = (name) => { const i = page.indexOf('const ' + name + ' = ['); assert.ok(i >= 0, name + ' is in void.html'); const j = page.indexOf('\n    ];', i); return page.slice(i + ('const ' + name + ' = ').length, j + 6).replace(/;$/, ''); };
const PAID_LEAD = new Function('return ' + oneLine('PAID_LEAD'))();
const PAID_CORE = new Function('return ' + arrayLit('PAID_CORE'))();
const PRICE_QUESTION_RE = new Function('return ' + oneLine('PRICE_QUESTION_RE'))();
const PAID_RE = new RegExp('^' + PAID_LEAD + '(?:' + PAID_CORE.join('|') + ')$');
// the page's own ask tidying (void.html isPaidAsk / isPriceQuestion): lower, collapse spaces, drop trailing punctuation
const norm = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[\s?.!]+$/, '');
const isPaidAsk = (s) => PAID_RE.test(norm(s));
const isPriceQuestion = (s) => PRICE_QUESTION_RE.test(norm(s));

// the price-question forms the page accepts (the card's half). Each one must also be a paid ask and a services ask.
const PRICE_QUESTIONS = ['pricing', 'prices', 'price list', 'the pricing', 'your pricing', 'show me your pricing', 'show me the pricing',
  'show pricing', 'what does Verse cost', 'what does Void cost', 'what does a-to-mind cost', 'what do you cost',
  'how much does Verse cost', 'how much does Void cost', 'how much does Verse cost?', 'how much is Verse', 'how much is Void',
  'how much do you cost', 'Pricing?', 'Prices!'];
// asks that name no price: the card never opens, and nothing here should say a price (kept beside the forms above so a loosened
// pattern that swallows one of these is caught here, not in the browser)
const NOT_PRICE = ['what can you do', 'price of gold', 'price of bitcoin', 'what is pricing', 'the price is right', 'fix my code', 'how much'];

test('every price question is also a paid ask, so the membership line always lands with the card', () => {
  for (const a of PRICE_QUESTIONS) assert.ok(isPriceQuestion(a), 'a price question: ' + a);
  for (const a of PRICE_QUESTIONS) assert.ok(isPaidAsk(a), 'the membership line for: ' + a);
});

test('every price question is a services ask, so the card opens under the line', () => {
  for (const a of PRICE_QUESTIONS) assert.ok(servicesOf(a), 'the services card for: ' + a);
});

test('a price question is not swallowed: the look-alikes stay out of both halves', () => {
  for (const a of NOT_PRICE) { assert.ok(!isPriceQuestion(a), 'not a price question: ' + a); }
});

test('all three page copies carry the same matchers', () => {
  for (const p of ['../void-live-deploy/void.html', '../void-live-deploy/index.html']) assert.equal(readFileSync(new URL(p, import.meta.url), 'utf8'), page, p);
});
