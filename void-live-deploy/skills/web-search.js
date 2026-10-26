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
function run(text, api) {
  const { showPage, esc } = api, a = searchAsk(text); if (!a) return 'none';
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
  examples: ['search the web for hamlet', 'google best pizza in naples', '!w eiffel tower'],
  nearMisses: ['who wrote hamlet', 'search podcasts', 'search my notes for milk'],
  match(lower, text) { return !!searchAsk(text || lower); },
  run,
};
