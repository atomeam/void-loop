/**
 * web-search skill - made with tools/new-skill.mjs (docs/UPGRADING.md); owner, 2026-10-26: the search floor gets its page (/search/). "search the web for hamlet",
 * "google best pizza in naples", "!w eiffel tower" answer with a card that opens the same search on Google, Bing, DuckDuckGo, Brave and Wikipedia, and on Verse's
 * search page (answers with sources, Wikipedia, Wikidata, history on the device). Verse does not crawl the web and the card says so. A plain question ("who wrote
 * hamlet") is not taken: the answer engine answers it. Nothing is fetched here. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { bangOf, engineLinks, MAIN_ENGINES } from '../lib/search-core.js';
/** the words of an explicit web search, and a bang when there is one; null for anything else. Pure. */
export function searchAsk(text) {
  const t = String(text || '').trim();
  const b = /(?:^|\s)![a-z0-9]{1,12}(?=\s|$)/i.test(t) ? bangOf(t) : null; if (b && b.words) return { q: b.words, bang: b };
  const m = /^(?:search\s+(?:the\s+web|the\s+internet|online|google|bing|duckduckgo|brave)\s+for|web\s+search(?:\s+for)?|google|bing|duckduckgo|look\s+up\s+online)\s+(.+)$/i.exec(t.replace(/[?!.]+$/, ''));
  return m && m[1].trim().length >= 2 ? { q: m[1].trim().slice(0, 300), bang: null } : null;
}
// the search lane's own pages, each for the one job its site does (lib/maps-sites.js)
const PAGES = [
  [/^search\s+(?:google\s+)?(?:as\s+if\s+)?from\s+another\s+country$|^google\s+search\s+from\s+another\s+country$/i, '/search/from/', 'Search from another country', 'Google, Bing and DuckDuckGo as people in another country see them'],
  [/^(?:search\s+(?:several|many|multiple)\s+(?:search\s+)?engines(?:\s+at\s+once)?|metasearch(?:\s+engine)?)$/i, '/search/engines/', 'Many engines at once', 'one box, the engines you choose, Verse\'s answer and Wikipedia beside them'],
  [/^(?:wikipedia\s+reader|read\s+wikipedia(?:\s+without\s+clutter)?)$/i, '/search/wiki/', 'Wikipedia reader', 'search Wikipedia and read any article cleanly'],
  [/^(?:(?:duckduckgo\s+)?bangs?\s+list|list\s+of\s+bangs|search\s+bangs)$/i, '/search/bangs/', 'Bangs', '!g, !w, !yt and your own, run on your device'],
];
/** [page, name, what it does] for an ask about one of the lane's jobs, or null. Pure. */
export function pageAsk(text) { const t = String(text || '').trim().replace(/[?!.]+$/, ''); for (const [re, path, name, does] of PAGES) if (re.test(t)) return [path, name, does]; return null; }
function run(text, api) {
  const { showPage, esc } = api, pa = pageAsk(text);
  if (pa) { showPage((el) => { el.dataset.page = pa[0]; el.innerHTML = '<h2>' + esc(pa[1]) + '</h2><p class="sub">' + esc(pa[2]) + '. Verse does not crawl the web; this page opens the engines that do.</p><p><a href="' + esc(pa[0]) + '" style="font-weight:600">Open the page →</a></p><div class="src">Made by Verse · as of 2026-10</div>'; }); return 'web-search'; } // void-review: ok: fixed text and escaped
  const a = searchAsk(text); if (!a) return 'none';
  const page = '/search/?q=' + encodeURIComponent(a.q);
  showPage((el) => {
    el.dataset.page = '/search/';
    el.innerHTML = '<h2>Search: ' + esc(a.q) + '</h2>' // void-review: ok: escaped
      + (a.bang ? '<p><a href="' + esc(a.bang.url) + '" target="_blank" rel="noopener noreferrer" style="font-weight:600">!' + esc(a.bang.bang) + ': ' + esc(a.bang.name) + ' ↗</a></p>' : '')
      + '<p class="sub">Verse does not crawl the web: the search page answers with its sources, Wikipedia and Wikidata, and opens the same search on the engines that do.</p>'
      + '<p>' + engineLinks(a.q, 'en', MAIN_ENGINES).map((e) => '<a href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer">' + esc(e.name) + ' ↗</a>').join(' · ') + '</p>'
      + '<p><a href="' + esc(page) + '" style="font-weight:600">Open on the search page →</a></p>'
      + '<div class="src">Made by Verse · bangs run on your device · as of 2026-10</div>';
  });
  return 'web-search';
}
export default {
  name: 'web-search',
  examples: ['search the web for hamlet', 'google best pizza in naples', '!w eiffel tower', 'search from another country', 'metasearch engine', 'wikipedia reader', 'bangs list'],
  nearMisses: ['who wrote hamlet', 'search podcasts', 'search my notes for milk'],
  match(lower, text) { return !!(searchAsk(text || lower) || pageAsk(text || lower)); },
  run,
};
