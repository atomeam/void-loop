// The Bookshelf page compiles its book from the site's own lap inventory (lib/books-shelf.js): chapters come from the
// items' own groups and facts, nothing is written by hand, and an inventory that did not answer falls back to plain
// chapter names with no numbers. Run: node --test tools/books-shelf.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileBook, bookText, CHAPTERS, FALLBACK } from '../void-live-deploy/lib/books-shelf.js';

const item = (group, facts = {}) => ({ id: group + ':' + Object.keys(facts).join(''), group, facts });
const INV = {
  items: [
    item('skill', { lines: 120, examples: 4, tests: 2 }), item('skill', { lines: 80, examples: 2, tests: 1 }),
    item('tool', { lines: 40, tests: 1, inChecks: 1 }),
    item('surface', { skills: 3, tests: 5 }),
    item('doc', { lines: 90, sections: 6 }),
    item('plan', { lines: 30, steps: 4 }),
    item('research', { lines: 20, steps: 2 }),
    item('archive', { files: 7, reusedInLive: 2 }),
    item('site', { skills: 1, tested: 1, covered: 1 }),
    item('loop', { pages: 98, built: 4, checks: 12 }),
  ],
  onlySiteCounts: { replaced: 0, partial: 21, missing: 3, categories: 24 },
};

test('a missing inventory falls back to the chapter names, with no numbers and no broken words', () => {
  for (const empty of [null, undefined, {}, { items: [] }]) {
    const b = compileBook(empty);
    assert.equal(b.ok, false);
    assert.equal(b.chapters.length, FALLBACK.length);
    assert.deepEqual(b.chapters.map((c) => c.title), FALLBACK);
    assert.equal(b.totals.items, 0);
    for (const c of b.chapters) assert.ok(!/NaN|undefined|null|Infinity/.test(c.body), c.title + ': ' + c.body);
  }
  assert.match(bookText(compileBook(null)), /^# The Book of Verse/);
});

test('every group becomes its own chapter, in the order a reader meets them, with its own facts', () => {
  const b = compileBook(INV);
  assert.equal(b.ok, true);
  assert.deepEqual(b.chapters.map((c) => c.title), CHAPTERS.map((c) => c[1]));
  const by = Object.fromEntries(b.chapters.map((c) => [c.id, c]));
  assert.equal(by.skill.count, 2);
  assert.match(by.skill.body, /^2 skills, 200 lines in all, 6 example asks and 3 tests\.$/);
  assert.match(by.tool.body, /^1 tool, 40 lines, 1 with a test of their own and 1 in the fast checks\.$/);
  assert.match(by.surface.body, /^1 surface made of 3 skills and covered by 5 tests\.$/);
  assert.match(by.doc.body, /^1 document, 90 lines in 6 sections\.$/);
  assert.match(by.plan.body, /^1 plan, 4 numbered steps in all\.$/);
  assert.match(by.research.body, /^1 study, 2 findings and source notes\.$/);
  assert.match(by.archive.body, /^1 repository, 7 files, 2 named as reused on the live site\.$/);
});

test('the site chapter reads the live counts it carries, and the loop chapter sums its measures', () => {
  const by = Object.fromEntries(compileBook(INV).chapters.map((c) => [c.id, c]));
  assert.equal(by.site.body, '1 kind of site: 21 partial, 0 replaced and 3 still missing.');
  assert.equal(by.loop.body, '1 measure of the site’s own work: 98 real pages checked (0 saying honestly what needs a partner), 4 page-to-page connections built and 0 journeys played end to end, and 12 fast checks.');
});

test('a group the page does not name is kept in the loop chapter, never dropped and never printed as an object', () => {
  const b = compileBook({ items: [...INV.items, item('something-new', { things: 508 })] });
  const loop = b.chapters.find((c) => c.id === 'loop');
  assert.equal(loop.count, 2);
  assert.match(loop.body, /^2 measures/);
  for (const c of b.chapters) assert.ok(!/\[object Object\]|NaN|undefined/.test(c.body), c.title + ': ' + c.body);
});

test('totals and the Markdown export carry every chapter', () => {
  const b = compileBook(INV), md = bookText(b);
  assert.deepEqual(b.totals, { items: 10, groups: 9, skills: 2, tests: 3 });
  for (const c of b.chapters) assert.ok(md.includes('## ' + c.title), c.title);
  assert.ok(!/undefined|NaN|\[object Object\]/.test(md));
});
