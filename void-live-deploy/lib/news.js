// The news page's pure half (void-live-deploy/news/, functions/api/news.js; Versus' BBC News floor): the closed list of feeds, a small RSS / RDF / Atom
// reader that needs no DOM (it runs in a Worker), the grouping of near-identical headlines across sources into one story with "N sources", search,
// followed topics and sources, ages and the share link. Nothing here fetches.
//
// FEED TERMS (written by hand, not read off the sites; the owner confirms the BBC and Guardian lines, see the PR): a feed is on this list only
// because its publisher offers it as a public RSS / Atom feed for readers and aggregators. Verse shows a headline, the source, the age and, where
// the feed itself carries one, its short summary (cut to 220 characters), and always links out; it never copies an article, a picture or the
// full text (content:encoded is not read at all). BBC states its feeds are for personal, non-commercial use: Verse is free, has no ads and no
// account, which is the use the BBC describes, and the PR asks the owner to confirm it. Reuters withdrew its public feeds in 2020, so it is not here.
// CBC refuses every request from a server (a 403 from its edge, Oct 2026), so CBS News, whose feeds answer, takes its place.
export const SECTIONS = Object.freeze({
  top: 'Top stories', world: 'World', uk: 'UK', us: 'US', business: 'Business', tech: 'Technology', science: 'Science', sport: 'Sport', culture: 'Culture',
  africa: 'Africa', asia: 'Asia', europe: 'Europe', 'middle-east': 'Middle East', 'latin-america': 'Latin America',
});
export const LANGS = Object.freeze({ en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch' });
export const SOURCES = Object.freeze({
  bbc: ['BBC News', 'https://www.bbc.co.uk/news'], gdn: ['The Guardian', 'https://www.theguardian.com/'], npr: ['NPR', 'https://www.npr.org/'], aje: ['Al Jazeera', 'https://www.aljazeera.com/'],
  dw: ['DW', 'https://www.dw.com/'], f24: ['France 24', 'https://www.france24.com/'], cbs: ['CBS News', 'https://www.cbsnews.com/'], abc: ['ABC News Australia', 'https://www.abc.net.au/news'],
  sky: ['Sky News', 'https://news.sky.com/'], eur: ['Euronews', 'https://www.euronews.com/'], rnz: ['RNZ', 'https://www.rnz.co.nz/'], ars: ['Ars Technica', 'https://arstechnica.com/'],
  vrg: ['The Verge', 'https://www.theverge.com/'], hn: ['Hacker News', 'https://news.ycombinator.com/'], nat: ['Nature', 'https://www.nature.com/'], nasa: ['NASA', 'https://www.nasa.gov/'],
  sci: ['ScienceDaily', 'https://www.sciencedaily.com/'], afn: ['Africanews', 'https://www.africanews.com/'], elp: ['El País', 'https://elpais.com/'], lmd: ['Le Monde', 'https://www.lemonde.fr/'],
  tgs: ['Tagesschau', 'https://www.tagesschau.de/'], spg: ['Der Spiegel', 'https://www.spiegel.de/'], rfi: ['RFI', 'https://www.rfi.fr/'],
});
const B = 'https://feeds.bbci.co.uk/', G = 'https://www.theguardian.com/', N = (n) => 'https://feeds.npr.org/' + n + '/rss.xml', DW = (n) => 'https://rss.dw.com/rdf/rss-' + n;
// [source, section, language, url]: the only addresses the server ever fetches
export const FEEDS = Object.freeze([
  ['bbc', 'top', 'en', B + 'news/rss.xml'], ['gdn', 'top', 'en', G + 'world/rss'], ['npr', 'top', 'en', N(1001)], ['aje', 'top', 'en', 'https://www.aljazeera.com/xml/rss/all.xml'],
  ['dw', 'top', 'en', DW('en-all')], ['f24', 'top', 'en', 'https://www.france24.com/en/rss'], ['cbs', 'top', 'en', 'https://www.cbsnews.com/latest/rss/main'],
  ['abc', 'top', 'en', 'https://www.abc.net.au/news/feed/51120/rss.xml'], ['sky', 'top', 'en', 'https://feeds.skynews.com/feeds/rss/home.xml'], ['eur', 'top', 'en', 'https://www.euronews.com/rss'],
  ['bbc', 'world', 'en', B + 'news/world/rss.xml'], ['gdn', 'world', 'en', G + 'world/rss'], ['npr', 'world', 'en', N(1004)], ['aje', 'world', 'en', 'https://www.aljazeera.com/xml/rss/all.xml'],
  ['dw', 'world', 'en', DW('en-world')], ['f24', 'world', 'en', 'https://www.france24.com/en/rss'], ['cbs', 'world', 'en', 'https://www.cbsnews.com/latest/rss/world'], ['rnz', 'world', 'en', 'https://www.rnz.co.nz/rss/world.xml'],
  ['bbc', 'uk', 'en', B + 'news/uk/rss.xml'], ['gdn', 'uk', 'en', G + 'uk/rss'], ['sky', 'uk', 'en', 'https://feeds.skynews.com/feeds/rss/uk.xml'],
  ['bbc', 'us', 'en', B + 'news/world/us_and_canada/rss.xml'], ['gdn', 'us', 'en', G + 'us-news/rss'], ['npr', 'us', 'en', N(1003)],
  ['bbc', 'business', 'en', B + 'news/business/rss.xml'], ['gdn', 'business', 'en', G + 'uk/business/rss'], ['npr', 'business', 'en', N(1006)], ['dw', 'business', 'en', DW('en-bus')], ['cbs', 'business', 'en', 'https://www.cbsnews.com/latest/rss/moneywatch'], ['sky', 'business', 'en', 'https://feeds.skynews.com/feeds/rss/business.xml'],
  ['bbc', 'tech', 'en', B + 'news/technology/rss.xml'], ['gdn', 'tech', 'en', G + 'uk/technology/rss'], ['npr', 'tech', 'en', N(1019)], ['ars', 'tech', 'en', 'https://feeds.arstechnica.com/arstechnica/index'], ['vrg', 'tech', 'en', 'https://www.theverge.com/rss/index.xml'], ['hn', 'tech', 'en', 'https://news.ycombinator.com/rss'], ['cbs', 'tech', 'en', 'https://www.cbsnews.com/latest/rss/technology'],
  ['bbc', 'science', 'en', B + 'news/science_and_environment/rss.xml'], ['gdn', 'science', 'en', G + 'science/rss'], ['npr', 'science', 'en', N(1007)], ['nat', 'science', 'en', 'https://www.nature.com/nature.rss'], ['nasa', 'science', 'en', 'https://www.nasa.gov/feed/'], ['sci', 'science', 'en', 'https://www.sciencedaily.com/rss/top/science.xml'], ['dw', 'science', 'en', DW('en-sci')],
  ['bbc', 'sport', 'en', B + 'sport/rss.xml'], ['gdn', 'sport', 'en', G + 'uk/sport/rss'], ['sky', 'sport', 'en', 'https://feeds.skynews.com/feeds/rss/sport.xml'], ['abc', 'sport', 'en', 'https://www.abc.net.au/news/feed/45924/rss.xml'],
  ['bbc', 'culture', 'en', B + 'news/entertainment_and_arts/rss.xml'], ['gdn', 'culture', 'en', G + 'uk/culture/rss'], ['npr', 'culture', 'en', N(1008)], ['sky', 'culture', 'en', 'https://feeds.skynews.com/feeds/rss/entertainment.xml'], ['cbs', 'culture', 'en', 'https://www.cbsnews.com/latest/rss/entertainment'],
  ['bbc', 'africa', 'en', B + 'news/world/africa/rss.xml'], ['gdn', 'africa', 'en', G + 'world/africa/rss'], ['afn', 'africa', 'en', 'https://www.africanews.com/feed/rss'],
  ['bbc', 'asia', 'en', B + 'news/world/asia/rss.xml'], ['gdn', 'asia', 'en', G + 'world/asia-pacific/rss'], ['rnz', 'asia', 'en', 'https://www.rnz.co.nz/rss/pacific.xml'],
  ['bbc', 'europe', 'en', B + 'news/world/europe/rss.xml'], ['gdn', 'europe', 'en', G + 'world/europe-news/rss'], ['eur', 'europe', 'en', 'https://www.euronews.com/rss'],
  ['bbc', 'middle-east', 'en', B + 'news/world/middle_east/rss.xml'], ['gdn', 'middle-east', 'en', G + 'world/middleeast/rss'], ['f24', 'middle-east', 'en', 'https://www.france24.com/en/middle-east/rss'],
  ['bbc', 'latin-america', 'en', B + 'news/world/latin_america/rss.xml'], ['gdn', 'latin-america', 'en', G + 'world/americas/rss'], ['f24', 'latin-america', 'en', 'https://www.france24.com/en/americas/rss'],
  ['bbc', 'top', 'es', B + 'mundo/rss.xml'], ['dw', 'top', 'es', DW('sp-all')], ['f24', 'top', 'es', 'https://www.france24.com/es/rss'], ['elp', 'top', 'es', 'https://elpais.com/rss/elpais/portada.xml'],
  ['f24', 'top', 'fr', 'https://www.france24.com/fr/rss'], ['lmd', 'top', 'fr', 'https://www.lemonde.fr/rss/une.xml'], ['dw', 'top', 'fr', DW('fr-all')], ['rfi', 'top', 'fr', 'https://www.rfi.fr/fr/rss'],
  ['dw', 'top', 'de', DW('de-all')], ['tgs', 'top', 'de', 'https://www.tagesschau.de/index~rss2.xml'], ['spg', 'top', 'de', 'https://www.spiegel.de/schlagzeilen/index.rss'],
]);
/** the feeds that answer a section in a language (other languages only have their top stories). Pure. */
export function feedsFor(sec, lang) {
  const l = LANGS[lang] ? lang : 'en', s = l === 'en' && SECTIONS[sec] ? sec : 'top';
  return { sec: s, lang: l, feeds: FEEDS.filter((f) => f[1] === s && f[2] === l) };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', pound: '£', euro: '€' };
const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(c); } catch (_) { return ''; } } return ENT[e.toLowerCase()] ?? m; });
/** markup and entities out of a piece of feed text, spaces tidied. Pure. */
export function plain(s) {
  let t = String(s == null ? '' : s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = decode(t); // entity-encoded markup (&lt;p&gt;) becomes tags here and is stripped next
  return decode(t.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
// cut at the last sentence end, else the last word, inside n characters; no ellipsis is ever added (owner, 2026-10-21)
const clip = (s, n) => { if (s.length <= n) return s; const c = s.slice(0, n), d = Math.max(c.lastIndexOf('. '), c.lastIndexOf('! '), c.lastIndexOf('? ')); return d > n / 3 ? c.slice(0, d + 1) : c.replace(/\s+\S*$/, '').replace(/[,;:\s-]+$/, ''); };
const tagOf = (block, name) => { const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i')); return m ? m[1] : ''; };
/** the stories in an RSS 2.0, RSS 1.0 (RDF) or Atom document: [{ title, link (https only), summary, t (ms, 0 when unknown) }]. Pure. */
export function parseFeed(xml, now = Date.now()) {
  const out = [], s = String(xml || '');
  for (const m of s.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const b = m[2], title = clip(plain(tagOf(b, 'title')), 300);
    let link = plain(tagOf(b, 'link'));
    if (!link) { const a = b.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']alternate["']|<link\b[^>]*\bhref=["']([^"']+)["']/i); link = a ? decode(a[1] || a[2] || a[3]) : ''; }
    if (!link) link = plain(tagOf(b, 'guid'));
    if (!/^https:\/\/[^\s"'<>]+$/i.test(link) || !title) continue;
    let sum = clip(plain(tagOf(b, 'description') || tagOf(b, 'summary')), 220);
    if (sum.length < 25 || sum.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) sum = '';
    let t = Date.parse(plain(tagOf(b, 'pubDate') || tagOf(b, 'dc:date') || tagOf(b, 'published') || tagOf(b, 'updated'))); if (!(t > 0)) t = 0; else if (t > now) t = now;
    out.push({ title, link, summary: sum, t });
  }
  return out;
}

const STOP = new Set('the and for with from that this have has had are was were will would about after over into amid says say said new its his her their they them you your than then but not can could out off who how why what when where more most may might also just one two been being while during against under before between'.split(' '));
/** the words of a headline that say what it is about, lower-case and lightly stemmed. Pure. */
export function wordsOf(title) {
  return [...new Set(String(title).toLowerCase().replace(/[’']s\b/g, '').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w)))];
}
const same = (a, b) => { let n = 0; for (const w of a) if (b.includes(w)) n++; return n >= 3 && n / Math.min(a.length, b.length) >= 0.6; };
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
/** items [{ src, title, link, summary, t }] grouped into stories: the near-identical headlines of different sources become one story with an `also` list. Newest first, stories told by more sources lifted. Pure. */
export function stories(items, limit = 60, now = Date.now()) {
  const sorted = [...items].filter((i) => i.t >= now - 7 * 864e5 || !i.t).sort((a, b) => b.t - a.t), groups = [];
  for (const it of sorted) {
    const w = wordsOf(it.title); let g = null;
    if (w.length >= 3) g = groups.find((x) => !x.members.some((m) => m.src === it.src) && same(w, x.w));
    if (g) g.members.push(it); else if (!groups.some((x) => x.members.some((m) => m.link === it.link))) groups.push({ w, members: [it] });
  }
  const out = groups.map((g) => { const lead = g.members[0], first = g.members.find((m) => m.summary) || lead;
    return { id: hash(lead.link), title: lead.title, link: lead.link, src: lead.src, t: lead.t, summary: first.summary, n: g.members.length, also: g.members.slice(1).map((m) => ({ src: m.src, title: m.title, link: m.link, t: m.t })) }; });
  const score = (s) => s.t + (s.n - 1) * 3 * 36e5;
  return out.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** "5 min ago", "3 h ago", "2 d ago", "" when the time is unknown. Pure. */
export function ageText(t, now = Date.now()) {
  if (!(t > 0)) return ''; const m = Math.max(0, Math.floor((now - t) / 6e4));
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago';
}
/** the stories whose headline or summary holds every word of the search. Pure. */
export function search(list, q) {
  const ws = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!ws.length) return list;
  return list.filter((s) => { const h = (s.title + ' ' + (s.summary || '') + ' ' + (s.also || []).map((a) => a.title).join(' ')).toLowerCase(); return ws.every((w) => h.includes(w)); });
}
/** "My news": the stories that match a followed topic word or come from a followed source. Pure. */
export function followed(list, topics, sources) {
  const ts = (topics || []).map((t) => String(t).toLowerCase()).filter(Boolean), ss = new Set(sources || []);
  return list.filter((s) => ss.has(s.src) || (s.also || []).some((a) => ss.has(a.src)) || ts.some((t) => (s.title + ' ' + (s.summary || '')).toLowerCase().includes(t)));
}
/** a link that holds the section, language, search and a read-later story. Pure. */
export function shareLink(o = {}, origin = 'https://a-to-mind.com') {
  const p = new URLSearchParams(); if (o.sec && o.sec !== 'top') p.set('sec', o.sec); if (o.lang && o.lang !== 'en') p.set('lang', o.lang); if (o.q) p.set('q', o.q);
  return origin + '/news/' + (p.toString() ? '?' + p : '');
}
/** what a share says, in words only: the headline, the sources that carry it and the link. Pure. */
export function shareText(s) { const names = [s.src, ...(s.also || []).map((a) => a.src)].map((x) => (SOURCES[x] || [x])[0]); return s.title + ' (' + [...new Set(names)].join(', ') + ')'; }
