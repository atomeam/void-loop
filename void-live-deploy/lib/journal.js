/**
 * lib/journal.js — the readers behind /journal/: the journal's own public RSS feed (latest papers) and
 * Crossref's public API (search), normalized to one shape, plus the saved list kept on the device.
 * No API key anywhere; both endpoints are public and keyless. Pure apart from the saved-list key.
 */

/** The journal's public RSS feed. */
export const FEED = 'https://ajsonline.org/feed';
/** Crossref's public search (no key, polite pool). */
export const CROSSREF = 'https://api.crossref.org/works';
/** The feed read through Verse's own edge: /api/journal-proxies it with the right CORS header server-side,
 * so the page works even where the journal's feed does not send CORS headers. Falls back to the feed itself. */
export const FEED_VIA = '/api/feed?u=' + encodeURIComponent(FEED);

/** One RSS <item> block (string) -> one paper shape. Pure; works on the raw XML so it runs in Node tests too. */
export function fromRssItem(xml) {
  const grab = (tag) => { const m = String(xml).match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>')); return m ? m[1].trim() : ''; };
  const media = String(xml).match(/media:content[^>]*url="([^"]+)"/);
  const guid = grab('guid');
  return {
    title: grab('title'),
    url: grab('link'),
    authors: '', // the feed names no authors
    abstract: grab('description'),
    date: grab('pubDate') ? new Date(grab('pubDate')).toISOString().slice(0, 10) : '',
    volume: '', // the home page names the current volume; the feed does not carry it per item
    doi: guid.startsWith('https://doi.org/') ? guid.slice('https://doi.org/'.length) : guid,
    image: media ? media[1] : '',
  };
}

/** Crossref work -> the same shape. Pure. */
export function fromCrossref(w) {
  const authors = (w.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ')).join(', ');
  return {
    title: (w.title || [''])[0],
    url: (w.link && w.link[0] && w.link[0].URL) || ('https://doi.org/' + (w.DOI || '')),
    authors,
    abstract: w.abstract || '',
    date: w.published && w.published['date-parts'] && w.published['date-parts'][0] ? w.published['date-parts'][0].join('-') : (w.issued && w.issued['date-parts'] && w.issued['date-parts'][0] ? w.issued['date-parts'][0].join('-') : ''),
    volume: w.volume || '',
    doi: w.DOI || '',
    image: '',
  };
}

/** Strip JATS tags from a Crossref abstract. Pure. */
export function jatsText(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Latest papers from the journal's own feed, read through Verse's own edge proxy first (CORS-safe),
 * falling back to the feed itself. Throws when neither answers, so the page can say so. */
export async function papers(fetchImpl = fetch) {
  try {
    const r = await fetchImpl(FEED_VIA, { headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' } });
    if (r.ok) return parseFeed(await r.text());
  } catch (_) {}
  const r = await fetchImpl(FEED, { headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' } });
  if (!r.ok) throw new Error('feed ' + r.status);
  return parseFeed(await r.text());
}

/** The feed's text -> paper shapes. Pure. */
export function parseFeed(xml) {
  const items = String(xml).match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.map(fromRssItem).filter((p) => p.title && p.url);
}

/** Search the public research record (Crossref). Pure apart from the fetch. */
export async function searchCrossref(query, { rows = 25, fetchImpl = fetch } = {}) {
  const u = CROSSREF + '?query.bibliographic=' + encodeURIComponent(query) + '&rows=' + rows + '&select=DOI,title,author,abstract,published,issued,volume,link';
  const r = await fetchImpl(u, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('search ' + r.status);
  const j = await r.json();
  const items = (j.message && j.message.items) || [];
  return items.map(fromCrossref).filter((p) => p.title && p.doi);
}

// ---- the saved list, kept in localStorage under KEY ----
export function savedList(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } }
export function isSaved(key, doi) { return savedList(key).some((r) => r.doi === doi); }
export function toggleSave(key, paper) {
  let rows = savedList(key);
  const had = rows.some((r) => r.doi === paper.doi);
  rows = rows.filter((r) => r.doi !== paper.doi);
  if (!had) rows.unshift({ doi: paper.doi, title: paper.title, url: paper.url, date: paper.date }); // toggling a saved paper takes it back off
  try { localStorage.setItem(key, JSON.stringify(rows.slice(0, 200))); } catch (_) {}
  return rows;
}
