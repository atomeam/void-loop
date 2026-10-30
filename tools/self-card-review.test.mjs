// The owner's review of the self card (2026-10-30): the readout named Games least proven while the bars marked Words and the world; an
// ask naming onlineconverter.com was "built" by a ledger line about another site; one hardening line showed twice under four skills; and
// a pasted review prompt was saved as a calendar event. Run: node --test tools/self-card-review.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { weakestFamily, wrongWeakest, weakestSentence } from '../void-live-deploy/lib/weakest.js';
import { familyBars } from '../void-live-deploy/lib/skill-confidence.js';
import { familyFacts, followThrough, voiceFacts, sitesIn } from '../void-live-deploy/lib/voice.js';
import { selfSections } from '../void-live-deploy/lib/self-blocks.js';
import { builtByFamily } from '../void-live-deploy/lib/built-detail.js';
import calendar from '../void-live-deploy/skills/calendar.js';

const sk = (n, p, c = 0, t = 0) => [...Array(p)].map((_, i) => ({ name: n + 'p' + i, tier: 'proven' })).concat([...Array(c)].map((_, i) => ({ name: n + 'c' + i, tier: 'checked' })), [...Array(t)].map((_, i) => ({ name: n + 't' + i, tier: 'tested' })));
const fam = { totals: { proven: 72, checked: 7 }, families: [{ id: 'games', name: 'Games', count: { proven: 34 }, skills: sk('g', 34, 3) }, { id: 'words', name: 'Words and the world', count: { proven: 38 }, skills: sk('w', 38, 4) }] };

test('the bars, the facts the model reads and the check name the same least proven family', () => {
  assert.equal(weakestFamily(fam).name, 'Words and the world');
  assert.equal(familyBars(fam).find((b) => b.weak).name, 'Words and the world');
  assert.match(familyFacts(fam), /Least proven family: Words and the world \(38 of 42 proven, the lowest proven share; the family bars mark it weakest\)/);
});

test('a readout that names the wrong family is caught; the right family, or no family, is left alone', () => {
  const w = wrongWeakest('The skill index has 375 entries. The Games family remains the least proven family with 34 proven skills.', fam);
  assert.equal(w.said.name, 'Games'); assert.equal(w.is.name, 'Words and the world');
  assert.equal(wrongWeakest('Words and the world is my least proven family.', fam), null);
  assert.equal(wrongWeakest('I want more Games.', fam), null);
  assert.equal(weakestSentence(w.is), 'Words and the world is my least proven family: 38 of 42 skills proven, the lowest proven share.');
});

test('the self card keeps the model words, says the bars disagree, and shows the bars\' family as weakest', () => {
  const v = { entries: [{ kind: 'daily', at: '2026-10-30T08:00:00Z', thoughts: 'The Games family remains the least proven family with 34 proven skills.', weakest: 'The Games family is the least proven family with 34 proven skills.', better: 'Prove more.' }] };
  const S = selfSections(v, Date.parse('2026-10-30T09:00:00Z'), fam), words = S.find((s) => s.id === 'words').blocks, grow = S.find((s) => s.id === 'growth').blocks;
  assert.equal(words[0].text, v.entries[0].thoughts, 'kept word for word');
  assert.ok(words.some((b) => b.t === 'note' && /The bars disagree: Words and the world \(38 of 42 proven\) is the least proven family, not Games \(34 of 37 proven\)/.test(b.text)));
  assert.equal(grow[1].text, 'Words and the world is my least proven family: 38 of 42 skills proven, the lowest proven share.');
  assert.match(grow[2].text, /The model wrote "The Games family is the least proven family with 34 proven skills\."/);
  assert.match(voiceFacts(v.entries, fam), /Words and the world is my least proven family/);
  assert.doesNotMatch(voiceFacts(v.entries, fam), /Games family/);
});

test('an ask naming a site is built only by evidence that names that site', () => {
  const ask = 'Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js';
  const entries = [{ at: '2026-10-29T08:00:00Z', asks: [{ ask }, { ask: 'Add a lib/tool-sites.js row and LANE_PAGES entry for onlineconverter tower' }] }];
  const other = { at: '2026-10-29T04:48:05Z', what: 'The wants card holds the STL checker until sycophanthex.com is beaten; a new lane site must come with a page of its own', asked: 'Add a lib/tool-sites.js row and LANE_PAGES entry for any new tower' };
  assert.equal(sitesIn(ask, other.asked + ' ' + other.what), false);
  assert.ok(followThrough(entries, [other]).open.some((g) => g.ask === ask), 'not built by the other site\'s line');
  const real = { at: '2026-10-30T02:24:46Z', what: 'Verse assimilates onlineconverter.com as /converter/', asked: ask };
  assert.ok(followThrough(entries, [other, real]).built.some((g) => g.ask === ask && g.builtAt === real.at));
});

test('one hardening run logged twice shows once under each skill', () => {
  const ph = [{ ask: 'mp4 to mp3', skill: 'converter' }, { ask: 'random uuid', skill: 'uuid' }];
  const line = (at) => ({ at, kind: 'grow', what: 'Verse hardened itself: mp4 to mp3, random uuid for converter, uuid', phrases: ph });
  const f = { families: [{ id: 'make', name: 'Making things', skills: [{ name: 'converter' }, { name: 'uuid' }] }] };
  const r = builtByFamily([line('2026-10-29T20:49:49Z'), line('2026-10-29T22:53:22Z')], f);
  for (const s of r.families[0].skills) assert.equal(s.items.length, 1, s.name);
});

test('calendar: a pasted review prompt is not an event; real events still are', () => {
  const m = (t) => calendar.match(t.toLowerCase(), t);
  assert.equal(m("Review what Verse's loop shipped since the last summary. List each PR merged today and what it changed, then tell me what to fix next."), false);
  assert.equal(m('Review the loop since last Tuesday and summarise it'), false);
  for (const t of ['dentist Oct 12 at 3pm', 'call Sam next Tuesday at 4', 'add dentist to my calendar Oct 12 at 3', 'remind me to call mom tomorrow at 5', 'gym at 7pm']) assert.equal(m(t), true, t);
});

test('a batch-titled check that names the self card or the book is placed under its skill, not unmapped', async () => {
  const { skillOfCheck } = await import('../void-live-deploy/lib/autopsy.js');
  const names = ['growth', 'guide', 'book', 'calendar'];
  assert.equal(skillOfCheck('void asks batch 4: the growth velocity sparkline on the self card (asked by Verse): first in "What got built"', names, []), 'growth');
  assert.equal(skillOfCheck('owner asks batch 2: "open the book" shows the router rules', ['guide', 'calendar'], []), 'guide');
  assert.equal(skillOfCheck('calendar: a dentist at 3', names, []), 'calendar');
});
