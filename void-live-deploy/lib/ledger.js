// The repo activity ledger (owner, 2026-10-28: Verse takes over the two Zaps that logged atomeam/void-loop's pull requests and issues into a
// Zapier table). Everything here is pure: the page (/ledger/) does the fetching, this file turns GitHub's issues list into rows, filters,
// searches, exports and the link that restores a view. One endpoint carries both kinds: /repos/{owner}/{repo}/issues?state=all lists issues
// and pull requests together, a pull request is the item with a `pull_request` field, and its merge time is pull_request.merged_at.
// No token, no server: the page reads the public REST API from the browser, 60 requests an hour per network, and a conditional request
// (If-None-Match with the saved ETag) that comes back 304 does not count against that. Tests: tools/ledger.test.mjs.

export const API = 'https://api.github.com';
export const STORE = 'a2m.void.ledger.v1';
export const PER_PAGE = 100;
export const FIRST_PAGES = 20; // the first look at a repo reads at most 2,000 of its newest items; "Load older" reads on
export const MAX_REPOS = 6; // repos kept on this device, the least recently opened dropped first
export const MAX_ROWS = 6000; // rows kept per repo
export const DEFAULT_REPO = 'atomeam/void-loop';
export const COLUMNS = Object.freeze(['kind', 'number', 'title', 'url', 'author', 'state', 'created_at', 'closed_at', 'merged_at', 'updated_at', 'labels', 'comments']);
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** "owner/repo" from what a person types: the bare name, a github.com URL (any page under it), or owner/repo.git; null when it is not one. */
export function parseRepo(text) {
  let s = String(text || '').trim();
  if (!s) return null;
  s = s.replace(/^git@github\.com:/i, '').replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').replace(/[?#].*$/, '');
  const [owner, repo0] = s.split('/'); const repo = String(repo0 || '').replace(/\.git$/i, '');
  if (!NAME.test(owner || '') || !NAME.test(repo) || /^\.+$/.test(owner) || /^\.+$/.test(repo)) return null;
  return owner + '/' + repo;
}

/** 'pr' when the issues list item is a pull request, else 'issue'. */
export const kindOf = (item) => (item && item.pull_request ? 'pr' : 'issue');

/** one ledger row from one issues-list item: the columns the Zapier table had (title, number, URL, author, state, created) and more. */
export function rowOf(item) {
  const pr = kindOf(item) === 'pr', merged = pr ? (item.pull_request.merged_at || null) : null;
  return {
    kind: pr ? 'pr' : 'issue', number: item.number, title: String(item.title || ''), url: item.html_url || '',
    author: (item.user && item.user.login) || '', state: merged ? 'merged' : item.state === 'closed' ? 'closed' : 'open',
    created_at: item.created_at || null, closed_at: item.closed_at || null, merged_at: merged, updated_at: item.updated_at || item.created_at || null,
    labels: (item.labels || []).map((l) => (typeof l === 'string' ? l : l && l.name)).filter(Boolean), comments: item.comments | 0,
    draft: !!item.draft, bot: !!(item.user && (item.user.type === 'Bot' || /\[bot\]$/.test(item.user.login || ''))),
  };
}

/** rows merged by number, a newer copy (by updated_at) replacing an older one; newest created first. */
export function mergeRows(have, add) {
  const by = new Map((have || []).map((r) => [r.number, r]));
  for (const r of add || []) { const o = by.get(r.number); if (!o || String(r.updated_at || '') >= String(o.updated_at || '')) by.set(r.number, r); }
  return [...by.values()].sort((a, b) => b.number - a.number);
}

/** the URL of the next page from a Link header, or null. */
export function nextLink(link) {
  const m = String(link || '').split(',').map((s) => s.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/)).find((x) => x && x[2] === 'next');
  return m ? m[1] : null;
}

/** the first page's address: every issue and pull request, newest first, or only those updated since a time (the refresh). */
export function listUrl(repo, { since = null, perPage = PER_PAGE } = {}) {
  const q = new URLSearchParams({ state: 'all', per_page: String(perPage) });
  if (since) { q.set('since', since); q.set('sort', 'updated'); q.set('direction', 'asc'); } else { q.set('sort', 'created'); q.set('direction', 'desc'); }
  return API + '/repos/' + repo + '/issues?' + q;
}

/** the newest updated_at among the rows: the `since` of the next refresh. */
export const lastUpdated = (rows) => (rows || []).reduce((m, r) => (r.updated_at && r.updated_at > m ? r.updated_at : m), '') || null;

/** the rate limit from response headers: { limit, remaining, reset (ms) } with nulls for what is missing. `get` is (name) => value. */
export function rateOf(get) {
  const n = (h) => { const v = get(h); return v == null || v === '' ? null : Number(v); };
  const reset = n('x-ratelimit-reset');
  return { limit: n('x-ratelimit-limit'), remaining: n('x-ratelimit-remaining'), reset: reset == null ? null : reset * 1000, retryAfter: n('retry-after') };
}

/** true when a 403 or 429 is GitHub's rate limit (and not a private or blocked repo). */
export const isRateLimited = (status, rate) => (status === 429 || status === 403) && !!rate && (rate.remaining === 0 || rate.retryAfter != null);

/** the filters a view can have, with their defaults; what is not default goes in the link. */
export const DEFAULTS = Object.freeze({ repo: DEFAULT_REPO, tab: 'issue', state: 'all', q: '', author: '', label: '', from: '', to: '', sort: 'new', bots: '1' });

/** rows of one tab that pass the filters, sorted. Search matches title, #number, author and labels, every word. */
export function filterRows(rows, f = {}) {
  const v = { ...DEFAULTS, ...f };
  const words = String(v.q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = (rows || []).filter((r) => {
    if (v.tab !== 'all' && r.kind !== v.tab) return false;
    if (v.state !== 'all' && r.state !== v.state) return false;
    if (v.author && r.author.toLowerCase() !== String(v.author).toLowerCase()) return false;
    if (v.label && !r.labels.some((l) => l.toLowerCase() === String(v.label).toLowerCase())) return false;
    if (v.bots === '0' && r.bot) return false;
    const day = String(r.created_at || '').slice(0, 10);
    if (v.from && day < v.from) return false;
    if (v.to && day > v.to) return false;
    if (words.length) { const hay = (r.title + ' #' + r.number + ' ' + r.number + ' ' + r.author + ' ' + r.labels.join(' ')).toLowerCase(); if (!words.every((w) => hay.includes(w) || hay.includes(w.replace(/^#/, '')))) return false; }
    return true;
  });
  const key = { new: (a, b) => b.number - a.number, old: (a, b) => a.number - b.number, updated: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)), comments: (a, b) => b.comments - a.comments || b.number - a.number }[v.sort] || ((a, b) => b.number - a.number);
  return out.sort(key);
}

/** counts for the tabs and the state chips. */
export function counts(rows) {
  const c = { issue: 0, pr: 0, open: 0, closed: 0, merged: 0 };
  for (const r of rows || []) { c[r.kind]++; c[r.state]++; }
  return c;
}

/** the authors and labels in the rows, most frequent first: the filter lists. */
export function facets(rows) {
  const a = new Map(), l = new Map();
  for (const r of rows || []) { a.set(r.author, (a.get(r.author) || 0) + 1); for (const x of r.labels) l.set(x, (l.get(x) || 0) + 1); }
  const sort = (m) => [...m].filter(([k]) => k).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([k]) => k);
  return { authors: sort(a), labels: sort(l) };
}

const cell = (v) => { const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v); return /[",\r\n]/.test(s) || /^[=+\-@\t]/.test(s) ? '"' + (/^[=+\-@\t]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; };

/** CSV (RFC 4180, CRLF) of the rows with a header; a cell a spreadsheet would run as a formula is quoted behind an apostrophe. */
export function toCSV(rows, cols = COLUMNS) {
  return [cols.join(',')].concat((rows || []).map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n') + '\r\n';
}

/** JSON of the rows with where they came from. */
export function toJSON(rows, { repo = '', fetchedAt = null, view = null } = {}) {
  return JSON.stringify({ repo, source: repo ? API + '/repos/' + repo + '/issues' : API, fetched_at: fetchedAt, view, count: (rows || []).length, rows: (rows || []).map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c]]))) }, null, 2);
}

/** the query string for a view: only what differs from the defaults, so the plain page link stays plain. */
export function encodeView(v) {
  const q = new URLSearchParams();
  for (const [k, d] of Object.entries(DEFAULTS)) { const x = v[k] == null ? '' : String(v[k]); if (x !== d) q.set(k, x); }
  const s = q.toString(); return s ? '?' + s : '';
}

/** a view from a query string; anything unknown or malformed falls back to its default. The repo is kept as typed (the page says when it is not a repo). */
export function decodeView(search) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, '')), v = { ...DEFAULTS };
  const pick = (k, ok) => { const x = q.get(k); if (x != null && ok(x)) v[k] = x; };
  pick('repo', (x) => x.length <= 300);
  if (q.get('repo') == null && q.get('r')) v.repo = q.get('r').slice(0, 300);
  pick('tab', (x) => ['issue', 'pr', 'all'].includes(x));
  if (q.get('tab') === 'prs' || q.get('tab') === 'pulls') v.tab = 'pr';
  if (q.get('tab') === 'issues') v.tab = 'issue';
  pick('state', (x) => ['all', 'open', 'closed', 'merged'].includes(x));
  pick('q', (x) => x.length <= 200); pick('author', (x) => x.length <= 100); pick('label', (x) => x.length <= 100);
  pick('from', (x) => /^\d{4}-\d{2}-\d{2}$/.test(x)); pick('to', (x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
  pick('sort', (x) => ['new', 'old', 'updated', 'comments'].includes(x)); pick('bots', (x) => x === '0' || x === '1');
  return v;
}

/** the saved copy of one repo, out of the whole store; null when there is none or it is broken. */
export function cached(store, repo) {
  const e = store && store.repos && store.repos[String(repo).toLowerCase()];
  return e && Array.isArray(e.rows) ? e : null;
}

/** the store with one repo's copy written: rows capped, the least recently opened repos dropped past MAX_REPOS. Pure (returns a new store). */
export function putCache(store, repo, entry, now = Date.now()) {
  const repos = { ...((store && store.repos) || {}) };
  repos[String(repo).toLowerCase()] = { ...entry, repo, rows: (entry.rows || []).slice(0, MAX_ROWS), openedAt: now };
  const keep = Object.entries(repos).sort((a, b) => (b[1].openedAt || 0) - (a[1].openedAt || 0)).slice(0, MAX_REPOS);
  return { v: 1, repos: Object.fromEntries(keep) };
}

/** rows created after a time: what is new since the last look (the Zaps' "new item" trigger, read on the page). */
export const newSince = (rows, t) => (t ? (rows || []).filter((r) => r.created_at && r.created_at > t) : []);
