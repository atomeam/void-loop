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

const cut = (s) => String(s || '').replace(/\s+/g, ' ').trim(); // whole sentences, never cut with an ellipsis (owner, 2026-10-21: the book cut its What's new lines)

/** the part of an entry's own words a reader can use (2026-10-24: the chapter showed "Why these: tab (no benchmark ask, evidence tier:
 *  tested, 30 failed runs name it); coin ..." for every entry Verse's self-hardening wrote): an entry that says "New phrases: ..." is those
 *  sentences ("“tell me a quote” now opens quote."); otherwise its words up to the first internal section ("Why these:", "Did not route:",
 *  "Candidates tried:"). Only the entry's own words, cut, never reworded. Pure. */
export function plainOf(what) {
  const t = cut(what), m = /\bNew phrases:\s*(.+?)(?:\s+(?:Did not route|Why these|Candidates tried):|$)/.exec(t);
  return m ? m[1].trim() : t.replace(/\s+(?:Why these|Did not route|Candidates tried):[\s\S]*$/, '').trim();
}

// The chapter is for visitors (owner's screenshot, 2026-10-30: lines read "docs/promotions/2026-10-29.md, PR #1583 ... this line records it",
// "lib/tower.js LANE_PAGES", "“yesno” now opens yesno" five times over, and the day was UTC's Friday on a Thursday evening). So a line is
// shown only when a visitor can do something with it: a grow, build or fix with an ask or a page to try, in words free of file paths, PR
// numbers, commit hashes and code names. The ledger itself is not changed: every entry stays on the growth card and in /void.growth.json
// with its evidence; the book shows the visitor's part of the same entry, never words made up here.
const SHOWN = new Set(['grow', 'build', 'fix']);
/** words written for the agents, not a visitor: a file path or name, a PR number, a commit hash, a CODE_NAME, a ledger note. */
export const INTERNAL = /(?:\b[\w.-]+\.(?:m?js|json|md|ya?ml|html|css|toml)\b|#\d{2,}|\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|this line records it|\bPR\b|\b(?:npm|node|git)\s|--\w)/;

/** the try a visitor can use, from an entry's own `try`: an ask in plain words, or a page of the site ("/kanban/"); '' for a developer step
 *  ("node --test tools/x.test.mjs", "watch the next verse-job run ship"). "a-to-mind.com/gradient/ then See it as a card" is its page. Pure. */
export function visitorTry(t) {
  let s = cut(t).replace(/^open\s+(?=(?:https?:\/\/)?(?:www\.)?a-to-mind\.com\/|\/)/i, '').replace(/^(?:https?:\/\/)?(?:www\.)?a-to-mind\.com(?=\/)/i, '');
  if (!s || INTERNAL.test(s)) return '';
  const page = /^(\/[\w%?=&.,+()*:\/-]*)(?:\s|$)/.exec(s);
  if (page) return page[1].replace(/[,.;:]+$/, '');
  if (/\bthen\b/i.test(s) || /^(?:watch|read|type|run|open the|wait)\b/i.test(s) || /\b(?:verse-job|will job|card link|the next run|press|see it as)\b/i.test(s) || s.length > 90) return '';
  return s;
}

const quote = (s) => '\u201c' + String(s).trim() + '\u201d';
const and = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '');
/** the new ways of asking an entry proved, as [{ ask, skill }]: its `phrases`, else the "New phrases: “x” now opens y; ..." in its words. Pure. */
export function phrasesOf(e) {
  const ps = Array.isArray(e && e.phrases) ? e.phrases.filter((p) => p && p.ask && p.skill).map((p) => ({ ask: cut(p.ask), skill: cut(p.skill) })) : [];
  if (ps.length) return ps;
  const m = /\bNew phrases:\s*(.+?)(?:\s+(?:Did not route|Why these|Candidates tried):|$)/.exec(cut(e && e.what));
  return m ? [...m[1].matchAll(/[\u201c"]([^\u201d"]+)[\u201d"]\s+now opens\s+([\w-]+)/g)].map((x) => ({ ask: x[1], skill: x[2] })) : [];
}

/** the visitor's line for a ledger entry, or '' when it is the agents' alone: new ways of asking grouped by the skill they open ("“hangman”,
 *  “play hangman” and “start hangman” now open hangman"); "Verse fixes its movie skill: learn to handle "x"" as "The movie skill now answers
 *  “x”"; else the entry's `show`; else its own words with the agents' parentheticals left out, cut to the first clause when the rest still
 *  names files or code. Pure. */
export function visitorLine(e) {
  if (!e) return '';
  const ps = phrasesOf(e);
  if (ps.length) {
    const by = new Map(); for (const p of ps) { const k = p.skill.replace(/-/g, ' '); if (!by.has(k)) by.set(k, []); if (!by.get(k).includes(p.ask)) by.get(k).push(p.ask); }
    return [...by].map(([k, asks]) => and(asks.map(quote)) + ' now open' + (asks.length === 1 ? 's ' : ' ') + k).join('; ');
  }
  const fx = /^(?:Verse|Void|V01D) fixes its ([\w -]+?) skill:\s*learn to handle\s*["\u201c](.+?)["\u201d]\s*(?:\(from my probes\)\s*)?$/i.exec(cut(e.what)); // the forge marks a probe's fix (tools/propose-fix.mjs ledgerWhat)
  if (fx && !e.show) return 'The ' + fx[1].replace(/-/g, ' ') + ' skill now answers ' + quote(fx[2]);
  const show = cut(e.show);
  if (show && !INTERNAL.test(show)) return show;
  let w = plainOf(e.what).replace(/^asked by (?:Verse|Void|V01D):\s*/i, '').replace(/\s*\(([^()]*)\)/g, (all, inner) => (INTERNAL.test(inner) || /\bbuilt \d{4}-\d\d-\d\d\b/.test(inner) ? '' : all)).trim();
  if (INTERNAL.test(w)) w = w.split(/(?<=[a-z0-9)"\u201d/])[:;](?=\s)/i)[0].trim();
  return INTERNAL.test(w) ? '' : w;
}

/** an entry's day where the visitor is: "2026-10-29" for 03:00 UTC on the 30th in New York (owner, 2026-10-30: the chapter said Friday on a
 *  Thursday evening). `tz` is an IANA zone; none means the device's own. UTC's day when the zone is unknown. Pure. */
export function dayOf(at, tz) {
  try {
    const d = new Date(at); if (isNaN(d)) return String(at).slice(0, 10);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    return get('year') + '-' + get('month') + '-' + get('day');
  } catch (_) { return String(at).slice(0, 10); }
}

/** the ledger entries a visitor can use: the newest NEWS_MAX, newest first, as { at, day, kind, line, try }. `tryOf(entry)` gives an ask for
 *  an entry with no usable `try` of its own (skills/showcase.js playable); the page Verse assimilated a site as ("as /converter/") is its try otherwise.
 *  `opts.tz`: the zone the day is counted in (the device's own when unset). Pure. */
// an entry that says nothing was added is not news (owner, 2026-10-24, on six of them in one day: "why is this even happening"); the
// ledger keeps them (append-only), the book skips them, and grow-self.yml no longer writes them
export const NOTHING = /\b(?:found nothing to add|nothing to add this cycle|nothing added)\b/i;
export function newsEntries(ledger, max = NEWS_MAX, tryOf = null, opts = {}) {
  const out = [], seen = new Set();
  for (const e of Array.isArray(ledger) ? ledger : []) {
    if (!e || typeof e.at !== 'string' || !/^\d{4}-\d\d-\d\d/.test(e.at) || !SHOWN.has(String(e.kind || 'grow'))) continue;
    const line = visitorLine(e); if (!line || NOTHING.test(line)) continue;
    let t = visitorTry(e.try);
    if (!t && tryOf) { try { t = visitorTry(tryOf(e)); } catch (_) { t = ''; } }
    if (!t) { const pg = /\bas (\/[a-z0-9-]+\/)(?=[\s:;,.]|$)/.exec(line); t = pg ? pg[1] : ''; }
    if (!t) continue; // nothing a visitor can try: the agents' record, kept on the growth card
    const day = dayOf(e.at, opts.tz), once = day + '|' + line; if (seen.has(once)) continue; seen.add(once); // the same words twice in a day are one line
    out.push({ at: e.at, day, kind: String(e.kind || 'grow'), line: line.charAt(0).toUpperCase() + line.slice(1), try: t });
  }
  // a stable sort, newest first (ledger order breaks ties: later lines are newer)
  return out.map((e, i) => [e, i]).sort((a, b) => (a[0].at < b[0].at ? 1 : a[0].at > b[0].at ? -1 : b[1] - a[1])).slice(0, max).map((x) => x[0]);
}

/** a day's heading: "Today", "Yesterday", else "Thursday 29 October"; `today` is the visitor's own day (dayOf(now)). Pure. */
export function dayLabel(day, today = dayOf(new Date().toISOString())) {
  const t = new Date(day + 'T12:00:00Z'); if (isNaN(t)) return String(day);
  const y = new Date(new Date(today + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10);
  const long = t.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); // day is already the visitor's
  return day === today ? 'Today, ' + long : day === y ? 'Yesterday, ' + long : long;
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
 *  at the top of the next, so every page reads on its own). [{ kind:'news', days }], each day carrying `all`, the whole day's entries. Pure. */
export function newsPages(entries, per = NEWS_PER_PAGE) {
  const whole = groupNews(entries), flat = whole.flatMap((d) => d.groups.flatMap((g) => g.items));
  const dayAll = new Map(whole.map((d) => [d.day, d.groups.flatMap((g) => g.items)]));
  const pages = [];
  for (let i = 0; i < flat.length; i += per) {
    const days = groupNews(flat.slice(i, i + per));
    for (const d of days) d.all = dayAll.get(d.day); // the whole day, not this page's part: "play all N" counts what the stage plays
    pages.push({ kind: 'news', chapter: NEWS_ID, title: 'What’s new', days });
  }
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
  const entries = newsEntries(ledger, opts.max, opts.tryOf, opts), np = newsPages(entries, opts.per);
  if (!book || !Array.isArray(book.pages) || !np.length) return book;
  const at = book.pages.findIndex((p) => p.kind === 'toc'); if (at < 0) return book;
  const k = np.length, first = at + 2; // the page number the chapter starts on
  const shift = (n) => (n >= first ? n + k : n);
  const pages = book.pages.map((p) => { const q = { ...p, n: shift(p.n) }; if (p.ownerPage) q.ownerPage = shift(p.ownerPage); if (p.entries) q.entries = p.entries.map((e) => ({ ...e, page: shift(e.page) })); return q; });
  np.forEach((p, i) => { p.n = first + i; p.size = entries.length; p.grown = Array.isArray(ledger) ? ledger.length : 0; }); // grown: the page's universe has a star per ledger entry
  pages.splice(at + 1, 0, ...np);
  const chapters = book.chapters.map((c) => ({ ...c, from: shift(c.from), to: shift(c.to) }));
  chapters.splice(1, 0, { id: NEWS_ID, name: 'What’s new', kind: 'news', for: 'the newest changes, live from the ledger', from: first, to: first + k - 1, count: entries.length });
  return { ...book, pages, chapters, index: (book.index || []).map((e) => ({ ...e, page: shift(e.page) })), totals: { ...book.totals, pages: pages.length, chapters: chapters.length }, news: { count: entries.length, latest: entries[0].at, from: first, to: first + k - 1, entries } };
}
