// The 'Words and the world' family's skills that had only benchmark asks behind them (Verse's ask of 2026-10-22, ask-20261022-0420-3:
// "Strengthen the 'Words and the world' skill family to increase the number of proven skills"). Each one is checked here the way a
// person meets it: its own examples reach it through the real routing order, its near misses do not, and its card, run against a
// stand-in for the outside service, says what the service said and names the source. Lists run 5.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import joke from '../void-live-deploy/skills/joke.js';
import news, { isNews, isTechNews, topicNewsOf } from '../void-live-deploy/skills/news.js';
import book, { bookOf } from '../void-live-deploy/skills/book.js';
import show, { showOf } from '../void-live-deploy/skills/show.js';
import sport, { sportOf, leagueOf, pickTeam } from '../void-live-deploy/skills/sport.js';
import senolytic, { senolyticCard } from '../void-live-deploy/skills/senolytic.js';
import videoPlay from '../void-live-deploy/skills/video-play.js';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
const mods = {}; for (const n of names) mods[n] = (await import(pathToFileURL(resolve(dir, n + '.js')).href)).default;
for (const n of names) for (const m of mods[n].members || []) mods[m.name] = m;
const route = (ask) => { const k = names.find((n) => mods[n].match(ask.toLowerCase(), ask)); return k ? (mods[k].part ? mods[k].part(ask.toLowerCase(), ask) : k) : null; };
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// a card on a stand-in page; `still` says the card is up for the first n checks, then gone (so a live card does not start its timer)
const page = (n = 99) => { let k = 0; const api = { esc, _pageStill: () => k++ < n, showPage: (fn) => { const el = { innerHTML: '', querySelector: () => null }; fn(el); api.el = el; return el; } }; return api; };
const withFetch = async (answer, fn) => { const real = globalThis.fetch, seen = []; globalThis.fetch = async (u) => { seen.push(String(u)); const b = answer(String(u)); if (b === null) throw new TypeError('blocked');
  return { ok: true, status: 200, json: async () => b }; }; try { return await fn(seen); } finally { globalThis.fetch = real; } };

test('each skill takes its own examples through the real routing order and leaves its near misses', () => {
  for (const s of [joke, news, book, show, sport, senolytic, videoPlay]) {
    for (const t of s.examples) assert.equal(route(t), s.name, s.name + ' example: ' + t);
    for (const t of s.nearMisses) assert.notEqual(route(t), s.name, s.name + ' near miss: ' + t);
  }
});

test('joke: riddles, tongue twisters and knock-knock jokes from its own lists, the dad joke from icanhazdadjoke, named', async () => {
  let a = page(); assert.equal(await joke.run('tell me a riddle', a), 'joke'); assert.match(a.el.innerHTML, /<h2>A riddle<\/h2>.*show the answer/s);
  a = page(); await joke.run('tongue twister', a); assert.match(a.el.innerHTML, /Tongue twister/);
  a = page(); await joke.run('knock knock', a); assert.match(a.el.innerHTML, /Who's there\?/);
  await withFetch(() => ({ id: 'j1', joke: 'I only know 25 letters of the alphabet. I don\'t know y.' }), async () => { a = page(); assert.equal(await joke.run('tell me a joke', a), 'joke'); });
  assert.match(a.el.innerHTML, /25 letters/); assert.match(a.el.innerHTML, /icanhazdadjoke\.com\/j\/j1/);
  await withFetch(() => null, async () => { a = page(); assert.equal(await joke.run('dad joke', a), 'joke'); });
  assert.match(a.el.innerHTML, /didn't answer/, 'the service down still gets a joke');
});

test('news: headlines, tech news and a topic each read the right feed and name it', async () => {
  assert.ok(isNews('news today') && isNews('what\'s in the news') && !isNews('news anchor jobs'));
  assert.ok(isTechNews('tech news') && isTechNews('hacker news today')); assert.equal(topicNewsOf('news about spacex'), 'spacex');
  let a;
  await withFetch(() => ({ hits: [{ objectID: '1', title: 'A thing shipped', url: 'https://example.com/a', points: 120 }] }), async (seen) => { a = page(1); assert.equal(await news.run('tech news', a), 'news'); assert.match(seen[0], /hn\.algolia\.com\/api\/v1\/search\?tags=front_page/); });
  assert.match(a.el.innerHTML, /A thing shipped.*120 points.*Source: .*Hacker News/s);
  await withFetch(() => ({ hits: [] }), async (seen) => { a = page(1); await news.run('news about spacex', a); assert.match(seen[0], /query=spacex/); });
  assert.match(a.el.innerHTML, /No Hacker News stories mention/);
  await withFetch(() => null, async () => { a = page(); assert.equal(await news.run('tech news', a), 'none'); });
  assert.match(a.el.innerHTML, /didn't answer just now/);
});

test('book: an author, a title, an ISBN and books like one, from Open Library', async () => {
  assert.deepEqual(bookOf('isbn 978-0441172719'), { q: '9780441172719', isbn: true });
  assert.deepEqual(bookOf('books like the hobbit'), { q: 'hobbit', isbn: false, like: true });
  assert.equal(bookOf('book a table'), null);
  let a;
  await withFetch(() => ({ docs: [{ key: '/works/OL1W', title: 'Kindred', author_name: ['Octavia E. Butler'], first_publish_year: 1979 }] }), async () => { a = page(); assert.equal(await book.run('books by octavia butler', a), 'book'); });
  assert.match(a.el.innerHTML, /openlibrary\.org\/works\/OL1W.*Kindred.*Octavia E\. Butler.*1979.*Source: .*Open Library/s);
  await withFetch(() => null, async () => { a = page(); assert.equal(await book.run('book called dune', a), 'none'); });
  assert.match(a.el.innerHTML, /didn't answer/);
});

test('show: a TV show, its network and its end, from TVMaze; history is not television', async () => {
  assert.equal(showOf('when did breaking bad end'), 'breaking bad'); assert.equal(showOf('when did world war 2 end'), null); assert.equal(showOf('what network is the office on'), 'the office');
  let a;
  await withFetch(() => ({ name: 'Severance', network: { name: 'Apple TV+' }, status: 'Running', premiered: '2022-02-18', summary: '<p>Work and life, <b>split</b>.</p>', url: 'https://www.tvmaze.com/shows/44933/severance' }), async () => { a = page(); assert.equal(await show.run('tv show severance', a), 'show'); });
  assert.match(a.el.innerHTML, /<h2>Severance<\/h2>.*Apple TV\+ · Running · 2022-02-18.*Work and life, split\..*TVMaze/s);
});

test('sport: the team of the league asked for (TheSportsDB, key 123), else its Wikipedia summary (site-test issue #1048)', async () => {
  assert.equal(sportOf('nfl team chiefs'), 'chiefs'); assert.equal(leagueOf('nfl team chiefs'), 'nfl'); assert.equal(sportOf('what stadium do the yankees play in'), 'yankees');
  const rugby = { idTeam: '1', strTeam: 'Chiefs', strLeague: 'Super Rugby', strSport: 'Rugby' }, kc = { idTeam: '2', strTeam: 'Kansas City Chiefs', strLeague: 'NFL', strSport: 'American Football', strStadium: 'Arrowhead Stadium' };
  assert.equal(pickTeam([rugby, kc], 'nfl'), kc); assert.equal(pickTeam([rugby], 'nfl'), null); assert.equal(pickTeam([rugby], ''), rugby);
  let a;
  await withFetch((u) => (/thesportsdb/.test(u) ? { teams: [rugby, kc] } : null), async (seen) => { a = page(); assert.equal(await sport.run('nfl team chiefs', a), 'sport'); assert.match(seen[0], /\/json\/123\/searchteams\.php\?t=chiefs/); });
  assert.match(a.el.innerHTML, /Kansas City Chiefs.*NFL.*Arrowhead Stadium.*TheSportsDB/s);
  await withFetch((u) => (/thesportsdb/.test(u) ? { teams: [rugby] } : /w\/api\.php/.test(u) ? { query: { search: [{ title: 'Kansas City Chiefs' }] } } : { title: 'Kansas City Chiefs', extract: 'The Kansas City Chiefs are a professional American football team.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Kansas_City_Chiefs' } } }),
    async (seen) => { a = page(); assert.equal(await sport.run('nfl team chiefs', a), 'sport'); assert.match(seen[1], /srsearch=chiefs%20NFL%20team/); });
  assert.match(a.el.innerHTML, /<h2>Kansas City Chiefs<\/h2>.*American football.*Wikipedia.*TheSportsDB had no NFL team/s);
  await withFetch(() => null, async () => { a = page(); assert.equal(await sport.run('nba team celtics', a), 'sport'); });
  assert.match(a.el.innerHTML, /Neither TheSportsDB nor Wikipedia/);
});

test('senolytic: the trial card says its numbers, its caveat and its dated sources, and claims no cure', async () => {
  const c = senolyticCard(); assert.equal(c.sources.length, 4); assert.match(c.caveat, /hypothesis-generating/);
  const a = page(); assert.equal(await senolytic.run('senolytics for fatty liver', a), 'senolytic');
  assert.match(a.el.innerHTML, /47% on the drugs vs 7%.*NCT05506488.*no cure is claimed/s);
  assert.equal(await senolytic.run('what is fatty liver', page()), 'none');
});

test('video-play: the last-chance "play <anything>" leaves games and music to their own skills', async () => {
  assert.ok(videoPlay.match('play despacito', 'play despacito'));
  for (const t of ['play chess', 'play a game', 'play music']) assert.ok(!videoPlay.match(t, t), t);
  assert.equal(names.indexOf('video-play') > names.indexOf('joke'), true, 'it routes after the everyday skills');
});
