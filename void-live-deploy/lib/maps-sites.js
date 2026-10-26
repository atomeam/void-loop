// The maps and search floors' pages, one row each (owner, 2026-10-26: "every site gets a page"): the floor's own page (/maps/ for Google Maps, /search/ for
// Google Search) and a page for each smaller site of its lane, each with the panels that site's features need. tools/maps-search-pages.mjs writes each
// page's index.html and app.js from its row; lib/seo.js, lib/toolkit.js and sw.js name the same paths. Pure.
export const MAPS_SITES = Object.freeze([
  { path: '/maps/', lane: 'maps', name: 'Maps', h1: 'Maps', tag: 'A real map with place search, directions, saved places and a link that holds it',
    does: 'A free map of the world on OpenStreetMap: search places and addresses, directions by car, bike or on foot with every turn, tap the map for what is there, save places on your device, and share a place or a route as a link. No account, no ads.',
    intro: 'Search a place, tap the map, or get directions by car, bike or on foot. Places you save stay on this device; a place or a route is shared as a link.',
    panels: ['search', 'map', 'directions', 'traffic', 'saved'],
    asks: ['map', 'maps', 'directions', 'driving directions', 'walking directions', 'bike route', 'map of a city', 'find a place on a map', 'share a location link'],
    action: { template: '/maps/?q={search_term_string}', input: 'search_term_string', search: true },
    links: [['Map of Lisbon', '/maps/?q=Lisbon'], ['Directions from Lisbon to Porto', '/maps/?from=Lisbon&to=Porto'], ['Cycling in Amsterdam', '/maps/?from=Amsterdam%20Centraal&to=Vondelpark&mode=bike'], ['Walking in Paris', '/maps/?from=Louvre&to=Notre-Dame%20de%20Paris&mode=foot'], ['Deutsch', '/maps/?lang=de']],
    de: { h1: 'Karten', intro: 'Suchen Sie einen Ort, tippen Sie auf die Karte oder lassen Sie sich die Route mit Auto, Fahrrad oder zu Fuß zeigen. Gespeicherte Orte bleiben auf diesem Gerät; ein Ort oder eine Route wird als Link geteilt.' } },
]);
export const SEARCH_SITES = Object.freeze([
  { path: '/search/', lane: 'search', name: 'Search', h1: 'Search', tag: 'Answers with sources, Wikipedia, Wikidata and every engine one tap away',
    does: 'Search with answers that cite their sources, Wikipedia and Wikidata results with when each page was last edited, the same search on Google, Bing, DuckDuckGo, Brave and Wikipedia in one tap, bangs like !g and !w that run on your device, and a history kept on your device only. Verse does not crawl the web, and says so.',
    intro: 'Ask a question or type words. Verse answers with its sources, shows what Wikipedia and Wikidata have, and opens the same search on Google, Bing, DuckDuckGo, Brave or Wikipedia. Bangs like !g cats jump straight there.',
    panels: ['box', 'engines', 'answer', 'wiki', 'wikidata', 'history', 'bangs', 'share'],
    asks: ['search', 'search engine', 'search the web', 'search with sources', 'private search with history on my device', 'bangs search', 'search google bing duckduckgo at once', 'wikipedia search'],
    action: { template: '/search/?q={search_term_string}', input: 'search_term_string', search: true },
    links: [['Who wrote Hamlet?', '/search/?q=who+wrote+hamlet'], ['How tall is Mount Everest?', '/search/?q=how+tall+is+mount+everest'], ['Search Wikipedia for the Eiffel Tower', '/search/?q=eiffel+tower'], ['Deutsch', '/search/?lang=de']],
    de: { h1: 'Suche', intro: 'Stellen Sie eine Frage oder tippen Sie Wörter. Verse antwortet mit Quellen, zeigt, was Wikipedia und Wikidata haben, und öffnet dieselbe Suche bei Google, Bing, DuckDuckGo, Brave oder Wikipedia. Bangs wie !g Katzen springen direkt dorthin.' } },
]);
export const FLOOR_SITES = Object.freeze([...MAPS_SITES, ...SEARCH_SITES]);
