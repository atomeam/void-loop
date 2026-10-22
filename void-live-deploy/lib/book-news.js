// What's new in the book (owner, 2026-10-17: "make sure the book shows every update immediately in an organized way").
// Pure functions. The book's skill pages are written by tools/guide.mjs into skills/guide.json at build time, so a change reaches
// them only after a regeneration and a deploy; the growth ledger (void.growth.json) is appended to by every shipped change, so the
// reader (skills/guide.js) fetches it fresh each time the book opens and these functions turn its newest entries into the book's
// "What's new" chapter, right after the contents, and shift every later page number to make room. Only ledger entries, never text
// made up here: a line is the entry's own `show` (else its own `what`), a "try it" is the entry's own `try`.
// Tests: tools/book-news.test.mjs.

export const NEWS_ID = 'news';
export const NEWS_MAX = 36;       // the newest entries the chapter holds
export const NEWS_PER_PAGE = 6;   // entries on a page
export const KIND_ORDER = ['grow', 'build', 'fix'];
export const KIND_NAME = { grow: 'Grew', build: 'Built', fix: 'Fixed', retire: 'Retired', idea: 'Ideas', finding: 'Found' };

const LINE_MAX = 150;
const cut = (s) => String(s || '').replace(/\s+/g, ' ').trim(); // whole sentences, never cut with an ellipsis (owner, 2026-10-21: the book cut its What's new lines)

/** the ledger entries worth a line: the newest NEWS_MAX with a date and some text, newest first, as { at, day, kind, line, try }. Pure. */
export function newsEntries(ledger, max = NEWS_MAX, tryOf = null) { // tryOf(entry): an ask for an entry with no `try` of its own (skills/showcase.js playable)
  const out = [];
  for (const e of Array.isArray(ledger) ? ledger : []) {
    if (!e || typeof e.at !== 'string' || !/^\d{4}-\d\d-\d\d/.test(e.at)) continue;
    const line = cut(e.show || e.what, LINE_MAX); if (!line) continue;
    let t = e.try || ''; if (!t && tryOf) { try { t = tryOf(e) || ''; } catch (_) { t = ''; } }
    out.push({ at: e.at, day: e.at.slice(0, 10), kind: String(e.kind || 'grow'), line, try: t ? cut(t, 90) : '' });
  }
  // a stable sort, newest first (ledger order breaks ties: later lines are newer)
  return out.map((e, i) => [e, i]).sort((a, b) => (a[0].at < b[0].at ? 1 : a[0].at > b[0].at ? -1 : b[1] - a[1])).slice(0, max).map((x) => x[0]);
}

/** entries (newest first) grouped by day, newest day first, then by kind in KIND_ORDER (others after): [{ day, groups: [{ kind, name, items }] }]. Pure. */
export function groupNews(entries) {
  const days = [];
  for (const e of entries || []) {
    let d = days.find((x) => x.day === e.day); if (!d) { d = { day: e.day, groups: [] }; days.push(d); }
    let g = d.groups.find((x) => x.kind === e.kind); if (!g) { g = { kind: e.kind, name: KIND_NAME[e.kind] || e.kind, items: [] }; d.groups.push(g); }
    g.items.push(e);
  }
  const rank = (k) => { const i = KIND_ORDER.indexOf(k); return i < 0 ? KIND_ORDER.length : i; };
  for (const d of days) d.groups.sort((a, b) => rank(a.kind) - rank(b.kind));
  return days.sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** the chapter's pages: the grouped entries cut into pages of at most `per` lines, each page regrouped (a day that runs over a page starts again
 *  at the top of the next, so every page reads on its own). [{ kind:'news', days }]. Pure. */
export function newsPages(entries, per = NEWS_PER_PAGE) {
  const flat = groupNews(entries).flatMap((d) => d.groups.flatMap((g) => g.items));
  const pages = [];
  for (let i = 0; i < flat.length; i += per) pages.push({ kind: 'news', chapter: NEWS_ID, title: 'What’s new', days: groupNews(flat.slice(i, i + per)) });
  return pages;
}

/** how many entries are newer than `seenAt` (an ISO time kept by the reader), 0 when nothing was kept (a first visit has no "since"). Pure. */
export function newSince(entries, seenAt) {
  if (!seenAt || typeof seenAt !== 'string') return 0;
  return (entries || []).filter((e) => e.at > seenAt).length;
}

/** the book with the What's new chapter after the contents: later pages, chapter ranges, the index, miniature owner links and totals move up
 *  by the chapter's pages. The input book is not changed. With no entries the book is returned as it is. Pure. */
export function withNews(book, ledger, opts = {}) {
  const entries = newsEntries(ledger, opts.max, opts.tryOf), np = newsPages(entries, opts.per);
  if (!book || !Array.isArray(book.pages) || !np.length) return book;
  const at = book.pages.findIndex((p) => p.kind === 'toc'); if (at < 0) return book;
  const k = np.length, first = at + 2; // the page number the chapter starts on
  const shift = (n) => (n >= first ? n + k : n);
  const pages = book.pages.map((p) => { const q = { ...p, n: shift(p.n) }; if (p.ownerPage) q.ownerPage = shift(p.ownerPage); if (p.entries) q.entries = p.entries.map((e) => ({ ...e, page: shift(e.page) })); return q; });
  np.forEach((p, i) => { p.n = first + i; p.size = entries.length; });
  pages.splice(at + 1, 0, ...np);
  const chapters = book.chapters.map((c) => ({ ...c, from: shift(c.from), to: shift(c.to) }));
  chapters.splice(1, 0, { id: NEWS_ID, name: 'What’s new', kind: 'news', for: 'the newest changes, live from the ledger', from: first, to: first + k - 1, count: entries.length });
  return { ...book, pages, chapters, index: (book.index || []).map((e) => ({ ...e, page: shift(e.page) })), totals: { ...book.totals, pages: pages.length, chapters: chapters.length }, news: { count: entries.length, latest: entries[0].at, from: first, to: first + k - 1, entries } };
}
