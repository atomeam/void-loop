// lib/ground.js: the semantic validator's first step: is the answer card about what was asked?
import assert from 'node:assert/strict';
import { triggersFrom, subjectOf, grounded } from '../void-live-deploy/lib/ground.js';

const recipeAsks = ['recipe for banana bread', 'recipe for pancakes', 'how do i make lasagna', 'give me a recipe for chili', 'recipe for tacos', 'how to make soup'];
const t = triggersFrom(recipeAsks);
assert.ok(t.has('recipe'), 'a word in most of the skill\'s asks is its trigger');
assert.ok(!t.has('banana'), 'a word in one ask is a subject, not a trigger');
assert.deepEqual(subjectOf('recipe for banana bread', t), ['banana', 'bread']);
assert.deepEqual(subjectOf('tell me a joke', new Set(['joke'])), [], 'no subject: nothing to judge');
assert.equal(grounded('recipe for banana bread', 'Banana bread\n3 ripe bananas, flour…', t).ok, true);
const off = grounded('recipe for banana bread', 'Pancakes\nflour, milk, eggs', t);
assert.equal(off.ok, false, 'a card about something else is not grounded');
assert.deepEqual(off.missing, ['banana', 'bread']);
assert.equal(grounded('tell me a joke', 'Why did the chicken…', new Set(['joke'])).ok, true);
// three or more subject words: half is enough (a card need not repeat every word)
assert.equal(grounded('weather in new york city', 'New York: 18°', new Set(['weather'])).ok, true);
// accents and plural forms
assert.equal(grounded('define café', 'Café (noun): a small restaurant', new Set(['define'])).ok, true);
// the validator's own mistakes on the first full run (2026-10-14): apostrophes, verbs, numbers written differently
assert.deepEqual(subjectOf("what's the moon tonight", new Set(['moon'])), []);
assert.deepEqual(subjectOf('how do gears work', new Set(['gear'])), []);
assert.equal(grounded('car loan $20000 at 7% for 5 years', 'Monthly payment on $20,000 at 7% over 5 years', new Set(['loan', 'car'])).ok, true);
assert.equal(grounded('payment on a $300k mortgage', 'A $300,000 mortgage', new Set(['mortgage', 'payment'])).ok, true);
assert.equal(grounded('how many rolls of wallpaper for a 12x14 room', 'A 12 × 14 room needs 8 rolls', new Set(['wallpaper', 'roll', 'room'])).ok, true);
assert.equal(grounded('what is a 20% tip on 45', 'A 20% tip on $45.00 is $9.00', new Set(['tip'])).ok, true, '45 and 45.00 are one number');
// the page's check: a skill's own name and words shared by its examples are triggers; only a card with none of the subject is unmet
const { judgeCard, skillTriggers } = await import('../void-live-deploy/lib/ground.js');
const recipe = { name: 'recipe', examples: ['recipe for pancakes', 'lasagna recipe', 'recipes with chicken', 'how do i make guacamole'] };
assert.ok(skillTriggers(recipe).has('recipe'));
assert.ok(skillTriggers({ name: 'define', examples: [] }).has('define'), "the skill's own name");
assert.equal(judgeCard('how do i make guacamole', 'Guacamole\n3 avocados', recipe).unmet, false);
assert.equal(judgeCard('how do i make guacamole', 'Pancakes\nflour, milk', recipe).unmet, true, 'a card about something else');
assert.equal(judgeCard('recipe for banana bread', 'Banana pudding', recipe).unmet, false, 'part of the subject shown: not reported on the page');
assert.equal(judgeCard('a recipe please', 'Pancakes', recipe).unmet, false, 'no subject: nothing to judge');
// verify on 3365bf4: the calendar's own one-word ask ("agenda") and a misspelling of what the card says ("calender" on a CALENDAR
// card) were reported as ungrounded, so a calendar visit sent a miss
const calendar = { name: 'calendar', examples: ['my calendar', 'agenda', "what's next", 'call Sam next Tuesday at 4', 'clear calender'] };
const agendaCard = 'CALENDAR\nTHU, OCT 15\n12:00 PM\nLunch with Ana';
assert.ok(skillTriggers(calendar).has('agenda'), 'an example that is one word is the skill\'s own word');
assert.equal(judgeCard('agenda', agendaCard, calendar).unmet, false);
assert.equal(judgeCard('calender', agendaCard, calendar).unmet, false, 'one letter off what the card says is what it says');
assert.equal(judgeCard('how do i make guacamole', 'Guacamole\n3 avocados', recipe).unmet, false);
assert.equal(judgeCard('how do i make guacamole', 'Pancakes\nflour, milk', recipe).unmet, true, 'still: a card about something else');
assert.equal(judgeCard('lasagne', 'Pancakes\nflour', recipe).unmet, true, 'a near spelling only counts against what the card shows');
assert.equal(judgeCard('cat', 'car parts', { name: 'x', examples: [] }).unmet, true, 'short words must match exactly');
// a skill that looks a named thing up refuses a card about something else; every other skill is only reported (Adam's incident
// card, 2026-10-30: "how do i make guacamole" got a pancakes card)
const { refusalLine } = await import('../void-live-deploy/lib/ground.js');
const strict = { ...recipe, refuseUngrounded: true };
assert.equal(judgeCard('how do i make guacamole', 'Pancakes\nflour, milk', strict).refuse, true);
assert.equal(judgeCard('how do i make guacamole', 'Guacamole\n3 avocados', strict).refuse, false);
assert.equal(judgeCard('how do i make guacamole', 'Pancakes\nflour, milk', recipe).refuse, false, 'only a skill that says so refuses');
assert.equal(judgeCard('calculate a 20% tip on 45', 'A 20% tip on $45.00 is $9.00', { name: 'tip', examples: [] }).refuse, false, 'a tip card is never refused');
assert.equal(refusalLine('how do i make guacamole', ['guacamole'], 'Pancakes'), "I don't have guacamole yet: the card I found was Pancakes, so I did not show it. I've noted it, so I can learn it.");
console.log('ground: ok');
