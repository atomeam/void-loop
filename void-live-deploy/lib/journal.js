/**
 * journal: the engine of /journal/ (the Versus floor for ajsonline.org, the American Journal of Science, 2026-11-07).
 *
 * The papers themselves are not copied here: they are read live from Crossref, the DOI registry, where a journal deposits its own metadata
 * (title, authors, abstract, dates, volume, pages, licence, how many papers cite it). Crossref answers with `Access-Control-Allow-Origin: *`,
 * so the page asks it directly from the browser: nothing of the reader's is sent, and no key is needed. The prefix 10.2475 is this
 * journal's own, so every paper it lists is one of its papers.
 *
 * The rules for authors (publication units, the reference style, the manuscript order) are the journal's published rules, and the page
 * works them out on the device: that arithmetic is the one thing here that is not a link away. Pure where it can be, so the tests can
 * check it without a network: tools/journal.test.mjs.
 */

/** the journal's own DOI prefix: every work under it is one of its papers. */
export const DOI_PREFIX = '10.2475';
/** where the papers are read from: Crossref's works list for that prefix. */
export const WORKS = 'https://api.crossref.org/prefixes/' + DOI_PREFIX + '/works';
/** the fields the page needs, asked for by name so the answer stays small (an abstract is most of the weight). The names are the
 *  registry's own (it calls the reference count `references-count`), and a name it does not know is answered with a 400. */
export const FIELDS = 'DOI,title,author,issued,volume,issue,page,abstract,container-title,license,link,references-count,is-referenced-by-count,subject,type';
/** how many papers one page of the list shows. */
export const PAGE_SIZE = 20;

/** the journal's own name for itself in a citation, as the published metadata carries it. */
export const JOURNAL = 'American Journal of Science';

/** the markup an abstract arrives in (JATS: <jats:p>, <jats:sup>) read as plain words. Pure. */
export function plainText(html) {
  return String(html || '')
    .replace(/\s*<(?:jats:)?sup\b[^>]*>([\s\S]*?)<\/(?:jats:)?sup>/gi, '$1')   // a superscript belongs to the word before it: km2, not km 2
    .replace(/\s*<(?:jats:)?sub\b[^>]*>([\s\S]*?)<\/(?:jats:)?sub>/gi, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/** a person's name as it is written in a paper: "Family, Given" read as "Given Family". Pure. */
export function nameOf(author) {
  const a = author || {}, given = String(a.given || '').trim(), family = String(a.family || '').trim();
  if (!given && !family) return String(a.name || '').trim();
  if (!given) return family;
  if (!family) return given;
  return given + ' ' + family;
}

/** the initials of a given name, the way a reference list writes it: "Michael T.". Pure. */
export function initialsOf(given) {
  return String(given || '').trim().split(/\s+/).filter(Boolean)
    .map((w) => (/^[A-Z]\.$/.test(w) ? w : w.charAt(0).toUpperCase() + '.')).join(' ');
}

/** the papers' authors, each with the name, the family name and the initials a citation needs. Pure. */
export function authorsOf(work) {
  return ((work && work.author) || []).map((a) => ({
    name: nameOf(a), family: String(a.family || '').trim(), given: String(a.given || '').trim(),
    initials: initialsOf(a.given), orcid: String(a.ORCID || '').replace(/^https?:\/\/orcid\.org\//, ''),
  }));
}

/** the byline under a title: "Stewart, Mackertich and 9 more" when there are more than three. Pure. */
export function bylineOf(authors, max = 3) {
  const list = authors || [], names = list.map((a) => a.family || a.name).filter(Boolean);
  if (!names.length) return '';
  if (names.length <= max) return names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  return names.slice(0, max).join(', ') + ' and ' + (names.length - max) + ' more';
}

/** the date a paper was published, as the metadata carries it: "2026-11-05", or '' when it has none. Pure. */
export function dateOf(work) {
  const d = work && work.issued && work.issued['date-parts'] && work.issued['date-parts'][0];
  if (!d || !d.length) return '';
  const y = d[0], m = d[1] || 1, day = d[2] || 1;
  return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/** the date as a person reads it: "5 November 2026". Pure. */
export function dateTextOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return Number(m[3]) + ' ' + months[Number(m[2]) - 1] + ' ' + m[1];
}

/** the paragraphs of an abstract, each whole (owner, 2026-10-21: "i need to see the whole sentences"): a JATS abstract holds one
 *  <jats:p> per paragraph, so a paragraph is a whole piece of the text and never a cut sentence. Pure. */
export function paragraphsOf(html) {
  const raw = String(html || '');
  const parts = raw.match(/<(?:jats:)?p\b[^>]*>[\s\S]*?<\/(?:jats:)?p>/gi);
  if (parts && parts.length) return parts.map((p) => plainText(p)).filter(Boolean);
  const one = plainText(raw);
  return one ? [one] : [];
}

/** one paper of the journal, read out of the registry's own record. Pure. */
export function articleOf(work) {
  const w = work || {}, authors = authorsOf(w), paragraphs = paragraphsOf(w.abstract);
  const title = plainText((w.title || [])[0]), issued = dateOf(w);
  return {
    doi: String(w.DOI || ''), title, authors, byline: bylineOf(authors), paragraphs,
    abstract: paragraphs.join(' '), snippet: paragraphs[0] || '',
    date: issued, dateText: dateTextOf(issued), year: issued ? issued.slice(0, 4) : '',
    volume: String(w.volume || ''), issue: String(w.issue || ''), pages: String(w.page || ''),
    journal: plainText((w['container-title'] || [])[0]) || JOURNAL,
    subject: (w.subject || []).slice(0, 3), refs: Number(w['references-count'] || w['reference-count'] || 0), citedBy: Number(w['is-referenced-by-count'] || 0),
    licence: String((w.license || [])[0] && w.license[0].URL) || '', url: 'https://doi.org/' + String(w.DOI || ''),
  };
}

/** the papers of one answer from the registry. Pure. */
export function articlesOf(payload) {
  const items = (payload && payload.message && payload.message.items) || (payload && payload.items) || [];
  return items.map(articleOf).filter((a) => a.doi && a.title);
}

/** the newest paper first, and papers of the same day by title. Pure. */
export function sortNewest(list) {
  return (list || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
}

/** the volumes a list of papers holds, newest first, each with how many papers of it are here. Pure. */
export function volumesOf(list) {
  const by = new Map();
  for (const a of list || []) {
    const v = a.volume || '?';
    if (!by.has(v)) by.set(v, { volume: v, count: 0, year: a.year || '', newest: a.date || '' });
    const row = by.get(v);
    row.count++; if ((a.date || '') > row.newest) row.newest = a.date;
    if ((a.year || '') > row.year) row.year = a.year;
  }
  return [...by.values()].sort((a, b) => String(b.volume).localeCompare(String(a.volume), 'en', { numeric: true }));
}

/** whether a paper answers a search: its title, its abstract, its authors or its volume. Pure. */
export function matches(article, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const a = article || {}, hay = [a.title, a.abstract, a.volume, a.journal, (a.authors || []).map((x) => x.name).join(' ')].join(' ').toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/** the papers of a list that answer a search, newest first. Pure. */
export function searchOf(list, query) {
  return sortNewest((list || []).filter((a) => matches(a, query)));
}

/** a citation in the style the journal's guidelines name (APA, 7th edition): "Family, G. I., & Family, G. I. (2026). Title. Journal, 326(3), 1-20. https://doi.org/10.2475/...". Pure. */
export function apaOf(article) {
  const a = article || {}, names = (a.authors || []).map((x) => x.family ? x.family + ', ' + x.initials : x.name).filter(Boolean);
  let who = '';
  if (names.length === 1) who = names[0];
  else if (names.length === 2) who = names[0] + ', & ' + names[1];
  else if (names.length > 2) who = names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1];
  const year = a.year || 'n.d.', vol = a.volume ? ', ' + a.volume : '', issue = a.issue ? '(' + a.issue + ')' : '', pages = a.pages ? ', ' + a.pages : '';
  return who + ' (' + year + '). ' + a.title + '. ' + a.journal + (vol ? vol + issue + pages : '') + (a.doi ? '. https://doi.org/' + a.doi : '');
}

/** a citation as BibTeX, for a reference manager. Pure. */
export function bibtexOf(article) {
  const a = article || {}, key = (a.authors || [])[0];
  const surname = (key && (key.family || key.name) || 'anon').toLowerCase().replace(/[^a-z]/g, '') || 'anon';
  const year = a.year || '', title = (a.title || '').replace(/[{}]/g, '');
  return '@article{' + surname + year + ',\n  title = {' + title + '},\n  author = {' + (a.authors || []).map((x) => x.name).join(' and ') + '},\n  journal = {' + a.journal + '},\n  volume = {' + a.volume + '},\n  number = {' + a.issue + '},\n  pages = {' + a.pages + '},\n  year = {' + year + '},\n  doi = {' + a.doi + '}\n}';
}

/**
 * The length of a paper in publication units, the measure the journal's guidelines use: 1 PU for every 500 words of the text, 1.5 PU for
 * every figure and table, the first ten equations as 1 PU and every ten more as 1 PU again, the whole rounded up. A long paper is free up
 * to 45 PU and $100 for each PU over that; the excess equation PU are charged on their own, the way the guidelines' example charges them
 * on a short paper. Pure: the working is shown, so the reader can check it.
 */
export function pubUnits({ words = 0, figures = 0, tables = 0, equations = 0, limit = 45 } = {}) {
  const w = Math.max(0, Math.round(Number(words) || 0)), f = Math.max(0, Math.round(Number(figures) || 0));
  const t = Math.max(0, Math.round(Number(tables) || 0)), e = Math.max(0, Math.round(Number(equations) || 0));
  const textPU = w / 500, figPU = (f + t) * 1.5;
  const eqPU = e > 0 ? 1 : 0;                                // the first ten equations count as one unit
  const eqExtraPU = e > 10 ? Math.ceil((e - 10) / 10) : 0;  // one more for every ten equations past the first ten
  const pu = Math.ceil(textPU + figPU + eqPU + eqExtraPU);
  const over = Math.max(0, pu - limit), overFee = over * 100, eqFee = eqExtraPU * 100;
  return { words: w, figures: f, tables: t, equations: e, textPU, figPU, eqPU, eqExtraPU, pu, limit, over, overFee, eqFee, fee: overFee + eqFee };
}

/** the same length, read as the guidelines' example reads it: the total without the excess equation units added on top. Pure. */
export function puWithoutEquationExtra(u) {
  return Math.ceil(u.textPU + u.figPU + u.eqPU);
}

/** the words of a paper that count for its length: the abstract, the text, the notes and the references, the captions left out. Pure. */
export function countedWords(text) {
  return String(text || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
