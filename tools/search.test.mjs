// The search floor (lib/search-core.js, skills/web-search.js, /search/): the engines' URL patterns, bangs (before or after the words, alone, custom and
// checked), search as if from a country, Wikipedia and Wikidata read, an answer's [n] made links only to real sources, the history on the device, and the
// page registered where the tower and the toolkit look.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../void-live-deploy/lib/search-core.js';
import { SEARCH_SITES } from '../void-live-deploy/lib/maps-sites.js';
import ws, { searchAsk } from '../void-live-deploy/skills/web-search.js';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
import { TOOLS, RELATED, CARD_ASK } from '../void-live-deploy/lib/toolkit.js';
const site = new URL('../void-live-deploy', import.meta.url).pathname;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('the five engines get the same search in their own URL pattern, words encoded', () => {
  const l = Object.fromEntries(C.engineLinks('c++ & "rust"', 'en', C.MAIN_ENGINES).map((e) => [e.id, e.url]));
  assert.deepEqual(Object.keys(l), ['google', 'bing', 'duckduckgo', 'brave', 'wikipedia']);
  assert.equal(l.google, 'https://www.google.com/search?q=c%2B%2B+%26+%22rust%22');
  assert.equal(l.bing, 'https://www.bing.com/search?q=c%2B%2B+%26+%22rust%22');
  assert.equal(l.duckduckgo, 'https://duckduckgo.com/?q=c%2B%2B+%26+%22rust%22');
  assert.equal(l.brave, 'https://search.brave.com/search?q=c%2B%2B+%26+%22rust%22');
  assert.equal(l.wikipedia, 'https://en.wikipedia.org/w/index.php?search=c%2B%2B+%26+%22rust%22');
  assert.equal(C.engineLinks('x', 'de', ['wikipedia'])[0].url, 'https://de.wikipedia.org/w/index.php?search=x');
  for (const e of C.ENGINES) assert.match(e.url, /^https:\/\/[^/]+\/.*%s/, e.id);
});
test('bangs: before or after the words, alone for the front page, the page language, custom ones checked, unknown ones ignored', () => {
  assert.deepEqual(C.bangOf('!g cats'), { bang: 'g', name: 'Google', url: 'https://www.google.com/search?q=cats', words: 'cats' });
  assert.equal(C.bangOf('eiffel tower !w').url, 'https://en.wikipedia.org/w/index.php?search=eiffel+tower');
  assert.equal(C.bangOf('eiffel tower !w', 'de').url, 'https://de.wikipedia.org/w/index.php?search=eiffel+tower');
  assert.equal(C.bangOf('!yt').url, 'https://www.youtube.com/');
  assert.equal(C.bangOf('!maps lisbon').url, '/maps/?q=lisbon', 'Verse\'s own pages first');
  assert.equal(C.bangOf('!nope cats'), null); assert.equal(C.bangOf('cats!g'), null); assert.equal(C.bangOf('what is 5!'), null);
  assert.deepEqual(C.customBang('!my', 'https://example.com/s?q=%s'), ['my', ['!my', 'https://example.com/s?q=%s']]);
  for (const [w, u] of [['my', 'javascript:alert(1)%s'], ['my', 'http://example.com/?q=%s'], ['my', 'https://example.com/'], ['bad word', 'https://e.com/%s'], ['', 'https://e.com/%s'], ['my', 'data:text/html,%s']]) assert.equal(C.customBang(w, u), null, w + ' ' + u);
  const s = mem(); C.addCustomBang('ex', 'https://example.com/find?q=%s', s); assert.equal(C.bangOf('!ex hello', 'en', C.customBangs(s)).url, 'https://example.com/find?q=hello');
  C.removeCustomBang('ex', s); assert.deepEqual(C.customBangs(s), {});
  for (const [k, [, u]] of Object.entries(C.BANGS)) assert.ok(/^https:\/\/[a-z0-9.-]+\/|^\/[a-z?]/.test(u.replace('%l', 'en')) && u.includes('%s'), k);
});
test('search as if from a country: Google gl, hl and pws=0, Bing cc and setlang, DuckDuckGo kl', () => {
  const l = Object.fromEntries(C.fromLinks('best pizza', 'DE').map((x) => [x.id, x.url]));
  assert.equal(l.google, 'https://www.google.com/search?q=best+pizza&gl=de&hl=de&pws=0'); assert.equal(l.bing, 'https://www.bing.com/search?q=best+pizza&cc=de&setlang=de'); assert.equal(l.duckduckgo, 'https://duckduckgo.com/?q=best+pizza&kl=de-de');
  assert.match(C.fromLinks('x', 'JP', 'en')[0].url, /gl=jp&hl=en/); assert.match(C.fromLinks('x', 'ZZ')[0].url, /gl=us/, 'an unknown country falls back to the US');
});
test('Wikipedia and Wikidata: the addresses carry origin=* and the answers are read, tags stripped, missing pages null', () => {
  assert.equal(C.wikiSearchUrl('who wrote hamlet'), 'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srprop=snippet%7Ctimestamp%7Cwordcount&srlimit=10&srsearch=who%20wrote%20hamlet');
  assert.match(C.wikidataUrl('hamlet', 'de'), /^https:\/\/www\.wikidata\.org\/w\/api\.php\?action=wbsearchentities&format=json&origin=\*&limit=5&type=item&language=de&uselang=de&search=hamlet$/);
  const r = C.wikiResults({ query: { searchinfo: { totalhits: 12, suggestion: 'hamlet' }, search: [{ title: 'Hamlet (play)', snippet: 'The <span class="searchmatch">Tragedy</span> &amp; more', timestamp: '2026-10-20T10:00:00Z', wordcount: 9 }] } });
  assert.deepEqual(r, { total: 12, suggestion: 'hamlet', results: [{ title: 'Hamlet (play)', url: 'https://en.wikipedia.org/wiki/Hamlet_(play)', snippet: 'The Tragedy & more', edited: '2026-10-20', words: 9 }] });
  assert.deepEqual(C.wikiResults(null).results, []);
  assert.equal(C.wikiSummary({ type: 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' }), null);
  assert.equal(C.wikiSummary({ title: 'X', extract: 'y', thumbnail: { source: 'https://evil.example/x.png' } }).image, '', 'only a Wikimedia picture is shown');
  const page = C.wikiPage({ query: { pages: { 1: { title: 'Hamlet', fullurl: 'https://en.wikipedia.org/wiki/Hamlet', extract: 'Lead.\n\n== Plot ==\nA ghost.\n=== Act I ===\nThe start.', langlinks: [{ lang: 'de', '*': 'Hamlet' }] } } } });
  assert.deepEqual(page.sections.map((s) => [s.level, s.heading, s.text]), [[1, '', 'Lead.'], [2, 'Plot', 'A ghost.'], [3, 'Act I', 'The start.']]); assert.deepEqual(page.langs, [{ lang: 'de', title: 'Hamlet' }]);
  assert.equal(C.wikiPage({ query: { pages: { '-1': { title: 'Nope', missing: '' } } } }), null);
  assert.deepEqual(C.wikidataResults({ search: [{ id: 'Q41567', label: 'Hamlet', description: 'tragedy' }] }), [{ id: 'Q41567', label: 'Hamlet', description: 'tragedy', url: 'https://www.wikidata.org/wiki/Q41567' }]);
});
test('an answer\'s [n] becomes a link only when source n is a real https page', () => {
  const p = C.answerParts('By Shakespeare [1], around 1600 [2] [3].', [{ title: 'Hamlet', url: 'https://en.wikipedia.org/wiki/Hamlet' }, { title: 'x', url: 'javascript:alert(1)' }]);
  assert.deepEqual(p, [{ text: 'By Shakespeare ' }, { cite: 1, url: 'https://en.wikipedia.org/wiki/Hamlet', title: 'Hamlet' }, { text: ', around 1600 ' }, { text: '[2]' }, { text: ' ' }, { text: '[3]' }, { text: '.' }]);
});
test('the history: newest first, no repeats, pause stops it, remove and clear; suggestions start with the words', () => {
  const s = mem(); C.remember('cats', s, 1); C.remember('dogs', s, 2); C.remember('Cats', s, 3);
  assert.deepEqual(C.history(s).map((x) => x.q), ['Cats', 'dogs']);
  C.setPaused(true, s); C.remember('secret', s, 4); assert.ok(!C.history(s).some((x) => x.q === 'secret')); C.setPaused(false, s);
  assert.deepEqual(C.suggest('do', C.history(s)).map((x) => x.q), ['dogs']); assert.deepEqual(C.suggest('at', C.history(s)).map((x) => x.q), ['Cats']);
  C.forget('dogs', s); assert.deepEqual(C.history(s).map((x) => x.q), ['Cats']); C.clearHistory(s); assert.deepEqual(C.history(s), []);
});
test('the search floor names /search/, the page exists with its share picture and search engine file, and the stage card for an explicit web search opens it', () => {
  assert.equal(FLOORS.find((x) => x.id === 'search').page, '/search/?q=who+wrote+hamlet');
  for (const r of SEARCH_SITES) { assert.ok(fs.existsSync(site + r.path + 'index.html') && fs.existsSync(site + '/og/' + r.path.replace(/^\/|\/$/g, '').replace(/\//g, '-') + '.png'), r.path); assert.match(fs.readFileSync(site + r.path + 'index.html', 'utf8'), /rel="search" type="application\/opensearchdescription\+xml"/); }
  assert.match(fs.readFileSync(site + '/search/opensearch.xml', 'utf8'), /template="https:\/\/a-to-mind\.com\/search\/\?q=\{searchTerms\}"/);
  assert.ok(TOOLS['/search/'] && RELATED['/search/'].length && CARD_ASK['/search/'] === 'search the web for hamlet');
  assert.equal(searchAsk('who wrote hamlet'), null, 'a question stays with the answer engine');
  assert.deepEqual(searchAsk('google best pizza in naples'), { q: 'best pizza in naples', bang: null });
  for (const n of ws.nearMisses) assert.equal(ws.match(n.toLowerCase(), n), false, n);
  let html = ''; ws.run('search the web for <b>hamlet</b>', { showPage: (fn) => { const el = { dataset: {} }; fn(el); html = el.innerHTML; assert.equal(el.dataset.page, '/search/'); }, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') });
  assert.ok(!/<b>/.test(html), 'the words are escaped'); assert.match(html, /does not crawl the web/); assert.match(html, /https:\/\/www\.bing\.com\/search\?q=%3Cb%3Ehamlet%3C%2Fb%3E/);
});
