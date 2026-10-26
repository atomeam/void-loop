// The search floor's working parts (Google Search; /search/ and its lane pages). Verse does not crawl the web, and says so: a search here is Verse's
// answer engine (/api/answer: a language model with Wikipedia sources), Wikipedia's own search and Wikidata's, and the same search opened on the
// engines that do crawl (Google, Bing, DuckDuckGo, Brave and others) with one tap. Bangs ("!g cats", "cats !w") jump straight to a site and run on
// the device; the history stays on the device and can be paused or cleared. Pure: lib/search-ui.js makes every call. Tests: tools/search.test.mjs.

/** the engines a search opens on: the URL pattern with %s for the words (each confirmed against the engine's own search form). */
export const ENGINES = Object.freeze([
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s', crawls: true },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s', crawls: true },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', crawls: false },
  { id: 'brave', name: 'Brave Search', url: 'https://search.brave.com/search?q=%s', crawls: true },
  { id: 'wikipedia', name: 'Wikipedia', url: 'https://%l.wikipedia.org/w/index.php?search=%s', crawls: false },
  { id: 'startpage', name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s', crawls: false },
  { id: 'ecosia', name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s', crawls: false },
  { id: 'mojeek', name: 'Mojeek', url: 'https://www.mojeek.com/search?q=%s', crawls: true },
  { id: 'yandex', name: 'Yandex', url: 'https://yandex.com/search/?text=%s', crawls: true },
  { id: 'wolfram', name: 'Wolfram|Alpha', url: 'https://www.wolframalpha.com/input?i=%s', crawls: false },
]);
/** the five a search names first */
export const MAIN_ENGINES = ['google', 'bing', 'duckduckgo', 'brave', 'wikipedia'];

/** the bangs, run on the device: a bang word -> a site's search (%s the words, %l the page's language). Verse's own pages first. */
export const BANGS = Object.freeze({
  g: ['Google', 'https://www.google.com/search?q=%s'], google: ['Google', 'https://www.google.com/search?q=%s'], b: ['Bing', 'https://www.bing.com/search?q=%s'], bing: ['Bing', 'https://www.bing.com/search?q=%s'],
  ddg: ['DuckDuckGo', 'https://duckduckgo.com/?q=%s'], d: ['DuckDuckGo', 'https://duckduckgo.com/?q=%s'], brave: ['Brave Search', 'https://search.brave.com/search?q=%s'], br: ['Brave Search', 'https://search.brave.com/search?q=%s'],
  sp: ['Startpage', 'https://www.startpage.com/do/search?q=%s'], eco: ['Ecosia', 'https://www.ecosia.org/search?q=%s'], mj: ['Mojeek', 'https://www.mojeek.com/search?q=%s'], wa: ['Wolfram|Alpha', 'https://www.wolframalpha.com/input?i=%s'],
  w: ['Wikipedia', 'https://%l.wikipedia.org/w/index.php?search=%s'], wiki: ['Wikipedia', 'https://%l.wikipedia.org/w/index.php?search=%s'], wen: ['Wikipedia (English)', 'https://en.wikipedia.org/w/index.php?search=%s'], wde: ['Wikipedia (Deutsch)', 'https://de.wikipedia.org/w/index.php?search=%s'],
  wd: ['Wikidata', 'https://www.wikidata.org/w/index.php?search=%s'], wt: ['Wiktionary', 'https://%l.wiktionary.org/w/index.php?search=%s'], wq: ['Wikiquote', 'https://en.wikiquote.org/w/index.php?search=%s'], wv: ['Wikivoyage', 'https://en.wikivoyage.org/w/index.php?search=%s'],
  yt: ['YouTube', 'https://www.youtube.com/results?search_query=%s'], gh: ['GitHub', 'https://github.com/search?q=%s'], so: ['Stack Overflow', 'https://stackoverflow.com/search?q=%s'], mdn: ['MDN Web Docs', 'https://developer.mozilla.org/en-US/search?q=%s'],
  npm: ['npm', 'https://www.npmjs.com/search?q=%s'], pypi: ['PyPI', 'https://pypi.org/search/?q=%s'], r: ['Reddit', 'https://www.reddit.com/search/?q=%s'], hn: ['Hacker News (Algolia)', 'https://hn.algolia.com/?q=%s'],
  a: ['Amazon', 'https://www.amazon.com/s?k=%s'], ebay: ['eBay', 'https://www.ebay.com/sch/i.html?_nkw=%s'], imdb: ['IMDb', 'https://www.imdb.com/find/?q=%s'], gm: ['Google Maps', 'https://www.google.com/maps/search/%s'],
  osm: ['OpenStreetMap', 'https://www.openstreetmap.org/search?query=%s'], gi: ['Google Images', 'https://www.google.com/search?tbm=isch&q=%s'], gn: ['Google News', 'https://news.google.com/search?q=%s'], gs: ['Google Scholar', 'https://scholar.google.com/scholar?q=%s'],
  arxiv: ['arXiv', 'https://arxiv.org/search/?query=%s&searchtype=all'], ia: ['Internet Archive', 'https://archive.org/search?query=%s'], wb: ['Wayback Machine', 'https://web.archive.org/web/*/%s'], dict: ['Merriam-Webster', 'https://www.merriam-webster.com/dictionary/%s'],
  tr: ['Verse translate', '/translate/?q=%s'], maps: ['Verse maps', '/maps/?q=%s'], m: ['Verse maps', '/maps/?q=%s'], weather: ['Verse weather', '/weather/?q=%s'], news: ['Verse news', '/news/?q=%s'], calc: ['Verse calculator', '/calculator/?q=%s'], v: ['Verse', '/?q=%s'],
});
export const CUSTOM_KEY = 'a2m.search.bangs.v1', HISTORY_KEY = 'a2m.search.history.v1', PAUSE_KEY = 'a2m.search.pause.v1';

const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
/** a search URL from a pattern: the words encoded, the language put in. Pure. */
export const fill = (pattern, q, lang = 'en') => pattern.replace(/%l/g, lang === 'de' ? 'de' : 'en').replace(/%s/g, encodeURIComponent(clean(q)).replace(/%20/g, '+'));
/** a bang found in the words: "!g cats", "cats !g", "!g" alone (the site's front page). { bang, name, url, words } or null. Pure. */
export function bangOf(text, lang = 'en', custom = {}) {
  const s = clean(text); const m = /(?:^|\s)!([a-z0-9]{1,12})(?=\s|$)/i.exec(s); if (!m) return null;
  const key = m[1].toLowerCase(), b = (custom && custom[key]) || BANGS[key]; if (!b) return null;
  const words = clean(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length));
  const url = words ? fill(b[1], words, lang) : (/^\//.test(b[1]) ? b[1].replace(/\?.*$/, '') : new URL(b[1].replace(/%l/g, lang === 'de' ? 'de' : 'en').replace(/%s/g, '')).origin + '/');
  return { bang: key, name: b[0], url, words };
}
/** a custom bang checked: a 1 to 12 letter word and an https (or Verse) address with %s. null when it is not safe or not usable. Pure. */
export function customBang(word, url) {
  const w = String(word || '').replace(/^!/, '').trim().toLowerCase(), u = String(url || '').trim();
  if (!/^[a-z0-9]{1,12}$/.test(w) || !/%s/.test(u) || u.length > 500) return null;
  if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(u) && !/^\/[a-z0-9]/i.test(u)) return null;
  return [w, ['!' + w, u]];
}
/** the search on every engine, the five first. Pure. */
export const engineLinks = (q, lang = 'en', ids = null) => (ids ? ids.map((id) => ENGINES.find((e) => e.id === id)).filter(Boolean) : ENGINES).map((e) => ({ id: e.id, name: e.name, url: fill(e.url, q, lang) }));

// ---------- search as if from another country, language or device (the isearchfrom.com lane page) ----------
export const COUNTRIES = Object.freeze([['US', 'United States', 'en'], ['GB', 'United Kingdom', 'en'], ['CA', 'Canada', 'en'], ['AU', 'Australia', 'en'], ['IE', 'Ireland', 'en'], ['NZ', 'New Zealand', 'en'], ['IN', 'India', 'en'], ['ZA', 'South Africa', 'en'],
  ['DE', 'Germany', 'de'], ['AT', 'Austria', 'de'], ['CH', 'Switzerland', 'de'], ['FR', 'France', 'fr'], ['BE', 'Belgium', 'fr'], ['NL', 'Netherlands', 'nl'], ['ES', 'Spain', 'es'], ['MX', 'Mexico', 'es'], ['AR', 'Argentina', 'es'], ['IT', 'Italy', 'it'], ['PT', 'Portugal', 'pt'], ['BR', 'Brazil', 'pt'],
  ['SE', 'Sweden', 'sv'], ['NO', 'Norway', 'no'], ['DK', 'Denmark', 'da'], ['FI', 'Finland', 'fi'], ['PL', 'Poland', 'pl'], ['CZ', 'Czechia', 'cs'], ['GR', 'Greece', 'el'], ['TR', 'Türkiye', 'tr'], ['UA', 'Ukraine', 'uk'], ['RU', 'Russia', 'ru'],
  ['JP', 'Japan', 'ja'], ['KR', 'South Korea', 'ko'], ['CN', 'China', 'zh-CN'], ['TW', 'Taiwan', 'zh-TW'], ['HK', 'Hong Kong', 'zh-TW'], ['SG', 'Singapore', 'en'], ['ID', 'Indonesia', 'id'], ['TH', 'Thailand', 'th'], ['VN', 'Vietnam', 'vi'], ['PH', 'Philippines', 'en'],
  ['AE', 'United Arab Emirates', 'ar'], ['SA', 'Saudi Arabia', 'ar'], ['EG', 'Egypt', 'ar'], ['IL', 'Israel', 'iw'], ['NG', 'Nigeria', 'en'], ['KE', 'Kenya', 'en']]);
/** the same search as people in a country see it: Google with gl (country) and hl (language) and personal results off (pws=0), Bing with cc and setlang,
 *  DuckDuckGo with its region (kl). The results still come from the engine's own servers where you are; a captcha can appear. Pure. */
export function fromLinks(q, cc = 'US', hl = null) {
  const c = COUNTRIES.find((x) => x[0] === String(cc).toUpperCase()) || COUNTRIES[0], lang = hl || c[2], w = encodeURIComponent(clean(q)).replace(/%20/g, '+');
  const kl = { US: 'us-en', GB: 'uk-en', CA: 'ca-en', AU: 'au-en', IE: 'ie-en', NZ: 'nz-en', IN: 'in-en', ZA: 'za-en', DE: 'de-de', AT: 'at-de', CH: 'ch-de', FR: 'fr-fr', BE: 'be-fr', NL: 'nl-nl', ES: 'es-es', MX: 'mx-es', AR: 'ar-es', IT: 'it-it', PT: 'pt-pt', BR: 'br-pt', SE: 'se-sv', NO: 'no-no', DK: 'dk-da', FI: 'fi-fi', PL: 'pl-pl', CZ: 'cz-cs', GR: 'gr-el', TR: 'tr-tr', UA: 'ua-uk', RU: 'ru-ru', JP: 'jp-jp', KR: 'kr-kr', CN: 'cn-zh', TW: 'tw-tzh', HK: 'hk-tzh', SG: 'sg-en', ID: 'id-en', TH: 'th-th', VN: 'vn-vi', PH: 'ph-en', AE: 'xa-ar', SA: 'xa-ar', EG: 'xa-ar', IL: 'il-he', NG: 'wt-wt', KE: 'wt-wt' }[c[0]] || 'wt-wt';
  return [
    { id: 'google', name: 'Google (' + c[1] + ')', url: 'https://www.google.com/search?q=' + w + '&gl=' + c[0].toLowerCase() + '&hl=' + lang + '&pws=0' },
    { id: 'bing', name: 'Bing (' + c[1] + ')', url: 'https://www.bing.com/search?q=' + w + '&cc=' + c[0].toLowerCase() + '&setlang=' + lang },
    { id: 'duckduckgo', name: 'DuckDuckGo (' + c[1] + ')', url: 'https://duckduckgo.com/?q=' + w + '&kl=' + kl },
  ];
}

// ---------- Wikipedia and Wikidata (free APIs, CORS with origin=*; credited on the page) ----------
const WP = (lang) => 'https://' + (lang === 'de' ? 'de' : 'en') + '.wikipedia.org/';
/** Wikipedia's full-text search, ten results with snippets and the time each was last edited. Pure. */
export const wikiSearchUrl = (q, lang = 'en', n = 10) => WP(lang) + 'w/api.php?action=query&list=search&format=json&origin=*&srprop=snippet%7Ctimestamp%7Cwordcount&srlimit=' + n + '&srsearch=' + encodeURIComponent(clean(q));
/** a page's summary (the lead, its picture, its description). Pure. */
export const wikiSummaryUrl = (title, lang = 'en') => WP(lang) + 'api/rest_v1/page/summary/' + encodeURIComponent(String(title).replace(/ /g, '_'));
/** a whole page as plain text with its section headings (for reading it here). Pure. */
export const wikiTextUrl = (title, lang = 'en') => WP(lang) + 'w/api.php?action=query&prop=extracts%7Cinfo%7Clanglinks&explaintext=1&exsectionformat=wiki&inprop=url&lllimit=500&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(title);
/** Wikidata's entity search. Pure. */
export const wikidataUrl = (q, lang = 'en') => 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&limit=5&type=item&language=' + (lang === 'de' ? 'de' : 'en') + '&uselang=' + (lang === 'de' ? 'de' : 'en') + '&search=' + encodeURIComponent(clean(q).slice(0, 200));
const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
/** the search answer read: [{ title, url, snippet, edited, words }], and the total hits. Pure. */
export function wikiResults(json, lang = 'en') {
  const q = json && json.query; if (!q || !Array.isArray(q.search)) return { total: 0, results: [], suggestion: '' };
  return { total: (q.searchinfo && q.searchinfo.totalhits) || q.search.length, suggestion: (q.searchinfo && q.searchinfo.suggestion) || '',
    results: q.search.map((r) => ({ title: String(r.title), url: WP(lang) + 'wiki/' + encodeURIComponent(String(r.title).replace(/ /g, '_')), snippet: strip(r.snippet), edited: String(r.timestamp || '').slice(0, 10), words: r.wordcount || 0 })) };
}
/** a summary read: { title, description, extract, url, image, edited } or null (a missing page). Pure. */
export function wikiSummary(json) {
  if (!json || json.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' || !json.title || json.type === 'disambiguation' && !json.extract) return null;
  return { title: String(json.title), description: String(json.description || ''), extract: String(json.extract || ''), url: (json.content_urls && json.content_urls.desktop && json.content_urls.desktop.page) || '', image: (json.thumbnail && /^https:\/\/upload\.wikimedia\.org\//.test(json.thumbnail.source) && json.thumbnail.source) || '', edited: String(json.timestamp || '').slice(0, 10), disambiguation: json.type === 'disambiguation' };
}
/** a whole page read into sections: { title, url, sections: [{ level, heading, text }], langs: [{ lang, title }] } or null. Pure. */
export function wikiPage(json) {
  const pages = json && json.query && json.query.pages; if (!pages) return null; const p = Object.values(pages)[0]; if (!p || p.missing !== undefined || !p.extract) return null;
  const sections = [{ level: 1, heading: '', text: '' }];
  for (const line of String(p.extract).split('\n')) { const m = /^(={2,6})\s*(.+?)\s*\1$/.exec(line.trim()); if (m) sections.push({ level: m[1].length, heading: m[2], text: '' }); else if (line.trim()) sections[sections.length - 1].text += (sections[sections.length - 1].text ? '\n\n' : '') + line.trim(); }
  return { title: String(p.title), url: String(p.fullurl || ''), sections: sections.filter((s) => s.heading || s.text), langs: (p.langlinks || []).map((l) => ({ lang: l.lang, title: l['*'] || l.title || '' })).filter((l) => l.title) };
}
/** Wikidata's answer read: [{ id, label, description, url }]. Pure. */
export const wikidataResults = (json) => (json && Array.isArray(json.search) ? json.search.map((e) => ({ id: String(e.id), label: String(e.label || e.id), description: String(e.description || ''), url: 'https://www.wikidata.org/wiki/' + encodeURIComponent(String(e.id)) })) : []);

// ---------- Verse's answer ----------
/** an answer's text cut into pieces with its [n] citations made links to the sources. Pure. */
export function answerParts(answer, sources = []) {
  const out = [], re = /\[(\d{1,2})\]/g; let last = 0, m; const s = String(answer || '');
  while ((m = re.exec(s))) { if (m.index > last) out.push({ text: s.slice(last, m.index) }); const src = sources[+m[1] - 1]; out.push(src && /^https:\/\//.test(src.url) ? { cite: +m[1], url: src.url, title: src.title } : { text: m[0] }); last = m.index + m[0].length; }
  if (last < s.length) out.push({ text: s.slice(last) }); return out;
}

// ---------- history, kept on the device ----------
const store0 = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const read = (k, store, fb) => { try { const v = JSON.parse(store.getItem(k) || 'null'); return v == null ? fb : v; } catch (_) { return fb; } };
const write = (k, v, store) => { try { store.setItem(k, JSON.stringify(v)); } catch (_) { /* full or blocked: the page still searches */ } };
export const historyPaused = (store = store0()) => read(PAUSE_KEY, store, false) === true;
export const setPaused = (on, store = store0()) => write(PAUSE_KEY, !!on, store);
/** the history: newest first, [{ q, at }], 200 at most. */
export const history = (store = store0()) => { const l = read(HISTORY_KEY, store, []); return Array.isArray(l) ? l.filter((x) => x && typeof x.q === 'string').slice(0, 200) : []; };
export function remember(q, store = store0(), now = Date.now()) { q = clean(q); if (!q || historyPaused(store)) return history(store); const l = history(store).filter((x) => x.q.toLowerCase() !== q.toLowerCase()); l.unshift({ q, at: new Date(now).toISOString() }); write(HISTORY_KEY, l.slice(0, 200), store); return history(store); }
export const forget = (q, store = store0()) => { write(HISTORY_KEY, history(store).filter((x) => x.q !== q), store); return history(store); };
export const clearHistory = (store = store0()) => { write(HISTORY_KEY, [], store); return []; };
export const customBangs = (store = store0()) => { const o = read(CUSTOM_KEY, store, {}); const out = {}; for (const [k, v] of Object.entries(o || {})) { const c = customBang(k, v && v[1]); if (c) out[c[0]] = c[1]; } return out; };
export function addCustomBang(word, url, store = store0()) { const c = customBang(word, url); if (!c) return null; const all = customBangs(store); all[c[0]] = c[1]; write(CUSTOM_KEY, all, store); return all; }
export const removeCustomBang = (word, store = store0()) => { const all = customBangs(store); delete all[word]; write(CUSTOM_KEY, all, store); return all; };
/** history entries that start with or contain the words, for the suggestions under the box (on the device only). Pure. */
export const suggest = (q, list) => { const w = clean(q).toLowerCase(); if (!w) return []; return list.filter((x) => x.q.toLowerCase().startsWith(w)).concat(list.filter((x) => !x.q.toLowerCase().startsWith(w) && x.q.toLowerCase().includes(w))).slice(0, 6); };
