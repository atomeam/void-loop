// tools/journal.test.mjs: the engine of /journal/ (the Versus floor for ajsonline.org). The papers come from the DOI registry, so the
// tests work on one record of it, written here by hand from what the registry holds: no network, no key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOI_PREFIX, WORKS, articlesOf, articleOf, authorsOf, bylineOf, dateOf, dateTextOf, paragraphsOf, plainText, matches, searchOf, volumesOf, apaOf, bibtexOf, pubUnits, puWithoutEquationExtra, countedWords } from '../void-live-deploy/lib/journal.js';

// one paper as the registry holds it: the title, the authors, the date, the volume, the pages and the abstract in JATS
const WORK = {
  DOI: '10.2475/001c.172254',
  title: ['Reflection Seismic Insights Into the Pleistocene An-Nafud Sand Sea'],
  author: [{ given: 'Simon A.', family: 'Stewart' }, { given: 'David S.', family: 'Mackertich' }],
  issued: { 'date-parts': [[2026, 11, 5]] },
  volume: '326', issue: '4', page: '1-24',
  'container-title': ['American Journal of Science'],
  abstract: '<jats:p>The An-Nafud sand sea formed during the Pleistocene and occupies\n    approximately 60,200 km\n                    <jats:sup>2</jats:sup>\n    of northern Saudi Arabia.</jats:p>',
  license: [{ URL: 'http://creativecommons.org/licenses/by/4.0/' }],
  'reference-count': 61, 'is-referenced-by-count': 4,
};
const ANSWER = { message: { items: [WORK, { DOI: '10.2475/001c.1', title: [''] }, { title: ['no doi'] }] } };

test('the papers are read from the DOI registry, under the journal\'s own prefix', () => {
  assert.equal(DOI_PREFIX, '10.2475');
  assert.ok(WORKS.startsWith('https://api.crossref.org/prefixes/10.2475/works'), WORKS);
});

test('an abstract in JATS reads as plain words, and its paragraphs stay whole paragraphs', () => {
  assert.equal(plainText(WORK.abstract), 'The An-Nafud sand sea formed during the Pleistocene and occupies approximately 60,200 km2 of northern Saudi Arabia.');
  assert.equal(plainText(''), '');
  assert.equal(plainText(null), '');
  const two = paragraphsOf('<jats:p>First part here.</jats:p><jats:p>Second part here.</jats:p>');
  assert.deepEqual(two, ['First part here.', 'Second part here.'], 'a paragraph is a whole piece of the text, never a cut sentence');
  assert.deepEqual(paragraphsOf('<jats:p>Only one.</jats:p>'), ['Only one.']);
  assert.deepEqual(paragraphsOf(''), []);
  assert.deepEqual(paragraphsOf('plain text without tags'), ['plain text without tags']);
});

test('a paper keeps what a reader needs: the title, the byline, the date, the volume and the abstract', () => {
  const a = articleOf(WORK);
  assert.equal(a.doi, '10.2475/001c.172254');
  assert.equal(a.title, 'Reflection Seismic Insights Into the Pleistocene An-Nafud Sand Sea');
  assert.equal(a.byline, 'Stewart and Mackertich');
  assert.equal(a.date, '2026-11-05');
  assert.equal(a.dateText, '5 November 2026');
  assert.equal(a.year, '2026');
  assert.equal(a.volume, '326');
  assert.equal(a.issue, '4');
  assert.equal(a.pages, '1-24');
  assert.equal(a.refs, 61);
  assert.equal(a.citedBy, 4);
  assert.equal(a.url, 'https://doi.org/10.2475/001c.172254');
  assert.ok(a.licence.includes('creativecommons'), 'the licence the paper carries is shown');
  assert.equal(a.snippet, a.abstract, 'a short abstract is its own snippet');
});

test('a paper with no date, no volume and no abstract still reads', () => {
  const a = articleOf({ DOI: '10.2475/x', title: ['Bare'] });
  assert.equal(a.date, ''); assert.equal(a.dateText, ''); assert.equal(a.year, ''); assert.equal(a.volume, ''); assert.equal(a.abstract, ''); assert.equal(a.byline, ''); assert.deepEqual(a.paragraphs, []);
});

test('a byline names three people and then counts the rest', () => {
  const many = [{ family: 'One' }, { family: 'Two' }, { family: 'Three' }, { family: 'Four' }, { family: 'Five' }];
  assert.equal(bylineOf([{ family: 'Solo' }]), 'Solo');
  assert.equal(bylineOf(many.slice(0, 2)), 'One and Two');
  assert.equal(bylineOf(many.slice(0, 3)), 'One, Two and Three');
  assert.equal(bylineOf(many), 'One, Two, Three and 2 more');
  assert.equal(bylineOf([]), '');
});

test('an answer with a paper that has no title or no DOI is left out', () => {
  const list = articlesOf(ANSWER);
  assert.equal(list.length, 1);
  assert.equal(list[0].doi, '10.2475/001c.172254');
  assert.equal(articlesOf({}).length, 0);
  assert.equal(articlesOf(null).length, 0);
});

test('the newest paper comes first, and papers of one day by title', () => {
  const list = articlesOf({ message: { items: [
    { DOI: '10.2475/a', title: ['B paper'], issued: { 'date-parts': [[2026, 1, 1]] } },
    { DOI: '10.2475/b', title: ['A paper'], issued: { 'date-parts': [[2026, 1, 1]] } },
    { DOI: '10.2475/c', title: ['Newest'], issued: { 'date-parts': [[2027, 5, 2]] } },
  ] } });
  assert.deepEqual(list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title)).map((a) => a.title), ['Newest', 'A paper', 'B paper']);
});

test('the volumes hold their papers, newest volume first', () => {
  const list = articlesOf({ message: { items: [
    { DOI: '10.2475/a', title: ['A'], volume: '326', issued: { 'date-parts': [[2026, 11, 5]] } },
    { DOI: '10.2475/b', title: ['B'], volume: '326', issued: { 'date-parts': [[2026, 10, 1]] } },
    { DOI: '10.2475/c', title: ['C'], volume: '325', issued: { 'date-parts': [[2025, 9, 1]] } },
  ] } });
  const v = volumesOf(list);
  assert.deepEqual(v.map((x) => x.volume), ['326', '325']);
  assert.equal(v[0].count, 2);
  assert.equal(v[0].year, '2026');
});

test('a search looks in the title, the abstract, the authors and the volume, and every word must be there', () => {
  const a = articleOf(WORK);
  assert.ok(matches(a, 'sand sea'));
  assert.ok(matches(a, 'Stewart'));
  assert.ok(matches(a, '326'));
  assert.ok(!matches(a, 'sand volcano'));
  assert.ok(matches(a, ''));
  assert.equal(searchOf([a], 'sand').length, 1);
  assert.equal(searchOf([a], 'nothing here').length, 0);
});

test('a snippet is the first paragraph of the abstract, whole', () => {
  const a = articleOf(WORK);
  assert.equal(a.snippet, a.paragraphs[0]);
  assert.equal(a.abstract, a.paragraphs.join(' '));
});

test('a citation in APA: the family names with initials, the year, the title, the journal, the volume and the DOI', () => {
  const a = articleOf(WORK);
  assert.equal(apaOf(a), 'Stewart, S. A., & Mackertich, D. S. (2026). Reflection Seismic Insights Into the Pleistocene An-Nafud Sand Sea. American Journal of Science, 326(4), 1-24. https://doi.org/10.2475/001c.172254');
  const one = articleOf({ DOI: '10.2475/x', title: ['One'], author: [{ given: 'A', family: 'Solo' }], issued: { 'date-parts': [[2020, 1, 1]] } });
  assert.equal(apaOf(one), 'Solo, A. (2020). One. American Journal of Science. https://doi.org/10.2475/x');
});

test('a BibTeX entry names the first author and the year in its key', () => {
  const b = bibtexOf(articleOf(WORK));
  assert.ok(b.startsWith('@article{stewart2026,'), b.slice(0, 40));
  assert.ok(b.includes('doi = {10.2475/001c.172254}'));
  assert.ok(b.includes('author = {Simon A. Stewart and David S. Mackertich}'));
});

test('the length of a paper in publication units, with the guidelines\' own examples', () => {
  // 15,000 words and 10 figures or tables: 30 PU of words and 15 PU of figures, 45 PU, the free limit
  const one = pubUnits({ words: 15000, figures: 10 });
  assert.equal(one.textPU, 30); assert.equal(one.figPU, 15); assert.equal(one.pu, 45); assert.equal(one.over, 0); assert.equal(one.fee, 0);
  // 20,000 words and 12 figures or tables: 58 PU, 13 PU over the limit, $1,300
  const two = pubUnits({ words: 20000, figures: 12 });
  assert.equal(two.pu, 58); assert.equal(two.over, 13); assert.equal(two.fee, 1300);
  // 8,000 words, 4 figures and 32 equations: 23 PU as the guidelines print it, 3 excess equation PU, $300
  const three = pubUnits({ words: 8000, figures: 4, equations: 32 });
  assert.equal(puWithoutEquationExtra(three), 23, 'the total the guidelines\' example prints');
  assert.equal(three.eqPU, 1, 'the first ten equations count as one unit');
  assert.equal(three.eqExtraPU, 3, 'one more for every ten equations past the first ten');
  assert.equal(three.over, 0); assert.equal(three.eqFee, 300); assert.equal(three.fee, 300);
  // a short-form paper may be 4 PU at most
  const short = pubUnits({ words: 2500, limit: 4 });
  assert.equal(short.pu, 5); assert.equal(short.over, 1); assert.equal(short.fee, 100);
  // a table counts like a figure, and the total is rounded up
  assert.equal(pubUnits({ words: 100, tables: 2 }).pu, 4, '0.2 PU of words and 3 PU of tables, rounded up');
  assert.equal(pubUnits({ words: 1 }).pu, 1);
  assert.equal(pubUnits({}).pu, 0);
  assert.equal(pubUnits({ words: -5, figures: -2 }).pu, 0, 'a number below zero is no number');
});

test('the words of a paper that count for its length', () => {
  assert.equal(countedWords('one two three'), 3);
  assert.equal(countedWords('one  two\nthree '), 3);
  assert.equal(countedWords(''), 0);
});
