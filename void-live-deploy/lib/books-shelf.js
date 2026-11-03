// The Bookshelf page's book (void-live-deploy/books/): chapters compiled from the site's own lap inventory
// (void-live-deploy/lap.items.json, written by tools/lap-items.mjs), never prose made up for the page. Every number
// comes from an item's own facts; a fact a group does not carry is left out, and an inventory that did not answer
// falls back to plain chapter names with no numbers at all. Pure: the page fetches the file and renders these.
// Tests: tools/books-shelf.test.mjs.

// the groups tools/lap-items.mjs writes, in the order a reader should meet them: what Verse can do first, then how
// it is built, then what it keeps, then how it checks itself.
export const CHAPTERS = [
  ['skill', 'Skills', 'Every thing Verse can do, each with its example asks and its own tests.'],
  ['tool', 'Tools', 'The checks, builders and small programs that make and measure the site.'],
  ['surface', 'Surfaces', 'The named parts a person meets: the games, the book, the store, the podcast.'],
  ['site', 'The only site you need', 'The everyday kinds of site Verse can stand in for, and how many it covers.'],
  ['doc', 'Docs', 'What Verse wrote down about itself: how it works and what it decided.'],
  ['plan', 'Plans', 'What Verse means to build next, written before it builds it.'],
  ['research', 'Research', 'What it studied first, kept so the next build does not guess.'],
  ['archive', 'Archive', 'Public repositories imported whole and kept as reference, not served.'],
  ['loop', 'The loop', 'How Verse checks, measures and corrects itself while it runs.'],
];
const ORDER = CHAPTERS.map(([group]) => group);
export const FALLBACK = ['Skills', 'Tools', 'Surfaces', 'Docs', 'Plans', 'Research', 'Archive', 'The loop'];

const num = (n) => (Number.isFinite(+n) ? +n : null);
const parts = (facts, keys) => keys.filter((k) => num(facts && facts[k]) !== null).map((k) => num(facts[k]));
const sum = (items, key) => items.reduce((n, it) => n + (num(it && it.facts && it.facts[key]) || 0), 0);
const say = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/** a group's own facts as one plain line; only the facts that group carries, never a made-up number. */
function lineOf(group, items, extra) {
  const n = items.length;
  if (group === 'skill') return say(n, 'skill', 'skills') + ', ' + sum(items, 'lines').toLocaleString('en-US') + ' lines in all, ' + sum(items, 'examples').toLocaleString('en-US') + ' example asks and ' + sum(items, 'tests').toLocaleString('en-US') + ' tests.';
  if (group === 'tool') return say(n, 'tool', 'tools') + ', ' + sum(items, 'lines').toLocaleString('en-US') + ' lines, ' + sum(items, 'tests') + ' with a test of their own and ' + sum(items, 'inChecks') + ' in the fast checks.';
  if (group === 'surface') return say(n, 'surface', 'surfaces') + ' made of ' + sum(items, 'skills') + ' skills and covered by ' + sum(items, 'tests') + ' tests.';
  if (group === 'doc') return say(n, 'document', 'documents') + ', ' + sum(items, 'lines').toLocaleString('en-US') + ' lines in ' + sum(items, 'sections').toLocaleString('en-US') + ' sections.';
  if (group === 'plan') return say(n, 'plan', 'plans') + ', ' + sum(items, 'steps').toLocaleString('en-US') + ' numbered steps in all.';
  if (group === 'research') return say(n, 'study', 'studies') + ', ' + sum(items, 'steps').toLocaleString('en-US') + ' findings and source notes.';
  if (group === 'archive') return say(n, 'repository', 'repositories') + ', ' + sum(items, 'files').toLocaleString('en-US') + ' files, ' + sum(items, 'reusedInLive') + ' named as reused on the live site.';
  if (group === 'site' && extra) return say(n, 'kind of site', 'kinds of site') + ': ' + say(extra.partial, 'partial', 'partial') + ', ' + say(extra.replaced, 'replaced', 'replaced') + ' and ' + say(extra.missing, 'still missing', 'still missing') + '.';
  if (group === 'site') return say(n, 'kind of site', 'kinds of site') + ' counted.';
  if (group === 'loop') return say(n, 'measure', 'measures') + ' of the site’s own work: ' + say(sum(items, 'pages'), 'real page', 'real pages') + ' checked (' + sum(items, 'honestLabels') + ' saying honestly what needs a partner), ' + say(sum(items, 'built'), 'page-to-page connection', 'page-to-page connections') + ' built and ' + say(sum(items, 'journeys'), 'journey played', 'journeys played') + ' end to end, and ' + say(sum(items, 'checks'), 'fast check', 'fast checks') + '.';
  return say(n, 'item', 'items') + '.';
}

/** the file the Bookshelf page reads -> { chapters, totals, ok }; a file that did not answer gives FALLBACK, ok:false. Pure. */
export function compileBook(inv) {
  const items = inv && Array.isArray(inv.items) ? inv.items.filter((it) => it && it.group) : [];
  if (!items.length) return { ok: false, chapters: FALLBACK.map((title) => ({ id: title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''), title, body: 'The ledger did not answer just now. This chapter is still here; its numbers will be again when the ledger does.' })), totals: { items: 0, groups: 0, skills: 0, tests: 0 } };
  const extra = (inv && inv.onlySiteCounts) || null;
  const by = new Map();
  for (const it of items) { const g = ORDER.includes(it.group) ? it.group : 'loop'; const a = by.get(g) || by.set(g, []).get(g); a.push(it); }
  const chapters = ORDER.map((group) => {
    const own = by.get(group) || [];
    const [id, title, plain] = CHAPTERS.find(([g]) => g === group);
    return { id, title, plain, body: lineOf(group, own, extra), count: own.length };
  }).filter((c) => c.count);
  const skills = by.get('skill') || [];
  return { ok: true, chapters, totals: { items: items.length, groups: chapters.length, skills: skills.length, tests: sum(skills, 'tests') } };
}

/** the compiled book as one Markdown file for the page's export and copy buttons. Pure. */
export function bookText(book) {
  const t = (book && book.chapters) || [];
  return '# The Book of Verse\n\nCompiled from the live lap inventory.\n\n' + t.map((c) => '## ' + c.title + '\n\n' + c.body + '\n').join('\n');
}
