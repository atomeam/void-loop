// The notebook's logic (lib/notebook.js; the frontier's "absorb and connect every repo": linked notes, backlinks, a daily note, what am I missing).
// Run: node --test tools/notebook.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linksOf, backlinksOf, dailyTitle, ensureDaily, missingOf, linkMention, tidyNotes, parseAsk, keyOf, cleanTitle, outlinksOf, padText, MAX_TITLE, MAX_TEXT } from '../void-live-deploy/lib/notebook.js';

const N = (title, text = '') => ({ id: title, title, text, at: 0 });

test('links are [[titles]] in the text, once each in the order they appear; a link is not a bracket pair spanning lines or a title over 60 characters', () => {
  assert.deepEqual(linksOf('See [[Alpha]] and [[Beta Two]], then [[alpha]] again'), ['Alpha', 'Beta Two']);
  assert.deepEqual(linksOf('a [[unclosed\nline]] and [single] and [[ ]]'), []);
  assert.deepEqual(linksOf('[[' + 'x'.repeat(61) + ']]'), []);
  assert.deepEqual(linksOf(null), []);
  assert.equal(keyOf('  Alpha   Note '), 'alpha note');
  assert.equal(cleanTitle('a [b]\nc  d').length <= MAX_TITLE, true);
});

test('backlinks: the notes that link to a title, by key, never the note itself', () => {
  const notes = [N('Alpha', 'about [[Beta]]'), N('Beta', 'back to [[alpha]] and [[Beta]]'), N('Gamma', 'no links')];
  assert.deepEqual(backlinksOf(notes, 'Beta').map((n) => n.title), ['Alpha']);
  assert.deepEqual(backlinksOf(notes, 'ALPHA').map((n) => n.title), ['Beta']);
  assert.deepEqual(backlinksOf(notes, 'Gamma'), []);
});

test('the daily note: today\'s date in the person\'s own day, added once, never twice', () => {
  const d = new Date(2026, 9, 18, 23, 59); // 18 October 2026, local time
  assert.equal(dailyTitle(d), '2026-10-18');
  assert.equal(dailyTitle(new Date(2026, 0, 5)), '2026-01-05');
  const first = ensureDaily([N('Alpha')], d), again = ensureDaily(first.notes, d);
  assert.deepEqual([first.created, first.title, first.notes.map((n) => n.title)], [true, '2026-10-18', ['Alpha', '2026-10-18']]);
  assert.deepEqual([again.created, again.notes.length], [false, 2]);
  assert.equal(ensureDaily(null, d).notes.length, 1);
});

test('what is missing: links to no note (most linked first), plain mentions that are not links, and notes nothing links to or from; today\'s note is never an orphan', () => {
  const notes = [N('Alpha', 'plan with [[Beta]] and [[Missing One]]'), N('Beta', 'talk to [[Missing One]] and [[Missing Two]]; see Alpha later'), N('Gamma', 'alone'), N('2026-10-18', 'empty day'), N('Go', 'tiny title: go go go')];
  const m = missingOf(notes, '2026-10-18');
  assert.deepEqual(m.dangling.map((d) => [d.title, d.from]), [['Missing One', ['Alpha', 'Beta']], ['Missing Two', ['Beta']]]);
  assert.deepEqual(m.unlinked, [{ title: 'Alpha', in: 'Beta' }], 'Beta names Alpha without a link; the two-letter title "Go" is never matched by chance');
  assert.deepEqual(m.orphans, ['Gamma', 'Go'], 'Alpha and Beta link each other; the daily note is the place to start');
  assert.deepEqual(missingOf([], '2026-10-18'), { dangling: [], unlinked: [], orphans: [] });
  assert.deepEqual(missingOf([N('Alpha', 'I wrote [[Alpha]]')], 'x').unlinked, []);
});

test('a plain mention becomes a link where it stands: the first one, as written, never inside an existing link, never part of a longer word', () => {
  assert.equal(linkMention('talk to alpha, then Alpha again', 'Alpha'), 'talk to [[alpha]], then Alpha again');
  assert.equal(linkMention('see [[Alpha]] and Alpha', 'Alpha'), 'see [[Alpha]] and [[Alpha]]');
  assert.equal(linkMention('alphabet soup', 'Alpha'), 'alphabet soup');
  assert.equal(linkMention('nothing here', 'Alpha'), 'nothing here');
  assert.equal(linkMention('the big  idea works', 'big idea'), 'the [[big  idea]] works', 'spaces in a title match any run of spaces');
  assert.equal(linkMention('what is C++ (really)? and a.b', 'C++ (really)?'), 'what is [[C++ (really)?]] and a.b', 'a title with regex characters is read as plain words');
  assert.equal(linkMention('axb and a.b', 'a.b'), 'axb and [[a.b]]', 'a dot in a title is a dot, not any character');
});

test('notes are kept tidy: well-formed only, titles cleaned and unique by key, text capped, at most 200', () => {
  const kept = tidyNotes([{ title: ' Alpha ', text: 'x'.repeat(9000), id: 'a' }, { title: 'alpha' }, { title: '' }, null, { title: 'Beta [x]' }]);
  assert.deepEqual(kept.map((n) => n.title), ['Alpha', 'Beta x']);
  assert.equal(kept[0].text.length, 8000);
  assert.equal(tidyNotes(Array.from({ length: 250 }, (_, i) => ({ title: 'n' + i }))).length, 200);
  assert.deepEqual(tidyNotes('nope'), []);
});

test('the asks the notebook takes, and the look-alikes it leaves', () => {
  for (const a of ['daily note', 'open my daily note', "today's note", 'start the daily note', 'show me my daily note?']) assert.deepEqual(parseAsk(a), { daily: true }, a);
  for (const a of ['notebook', 'open my notebook', 'linked notes', 'show my linked notes', 'linked notes with backlinks']) assert.deepEqual(parseAsk(a), { open: true }, a);
  for (const a of ['what am i missing in my notes', 'what am I missing in the notebook?', 'missing from my linked notes']) assert.deepEqual(parseAsk(a), { missing: true }, a);
  assert.deepEqual(parseAsk('what links to Garden Plan'), { backlinks: 'Garden Plan' });
  assert.deepEqual(parseAsk('Backlinks for Trip to Oslo?'), { backlinks: 'Trip to Oslo' }, 'a title keeps its case');
  assert.deepEqual(parseAsk('new note called Reading List'), { make: 'Reading List' });
  for (const a of ['daily notes app review', 'sticky note buy milk', 'buy a notebook computer', 'what am i missing', 'notepad: call the vet', 'note to self', 'what links to', 'open the daily']) assert.equal(parseAsk(a), null, a);
});

test('links out: the notes a note links to, in order, with the id of each made note and none for a note not made yet, never the note itself', () => {
  const notes = [{ id: 'a', title: 'Alpha', text: 'see [[Gamma]], [[beta]] and [[Alpha]]', at: 0 }, { id: 'b', title: 'Beta', text: '', at: 0 }];
  assert.deepEqual(outlinksOf(notes, notes[0]), [{ title: 'Gamma', id: '' }, { title: 'Beta', id: 'b' }]);
  assert.deepEqual(outlinksOf(notes, notes[1]), []);
  assert.deepEqual(outlinksOf(notes, null), []);
  assert.deepEqual(outlinksOf(null, notes[0]).map((l) => l.id), ['', '']);
});

test('a note as notepad text: the title, then the text with each [[link]] as its plain title, cut to the most a note holds', () => {
  assert.equal(padText({ title: 'Alpha', text: 'see [[Beta]] and [[Gamma Two]]\n\n' }), 'Alpha\nsee Beta and Gamma Two');
  assert.equal(padText({ title: 'Only a title', text: '' }), 'Only a title');
  assert.equal(padText({ title: '', text: 'just [[text]]' }), 'just text');
  assert.equal(padText({ title: 'Long', text: 'x'.repeat(MAX_TEXT + 50) }).length, MAX_TEXT);
  assert.equal(padText(null), '');
});
