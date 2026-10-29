// lib/film-discovery.js + functions/api/filmfind.js + skills/film-metadata.js: film discovery as JSON, replayed from fixtures (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDiscoveryAsk, searchUrls, selectFilms, toFilm, discover, span, MAX_YEARS } from '../void-live-deploy/lib/film-discovery.js';
import skill, { filmCard, filmOf } from '../void-live-deploy/skills/film-metadata.js';
import pick from '../void-live-deploy/skills/movie.js';
import { LIMITS } from '../void-live-deploy/lib/guard.js';
import * as route from '../void-live-deploy/functions/api/filmfind.js';

const FX = JSON.parse(readFileSync(new URL('./fixtures/itunes-films.json', import.meta.url), 'utf8'));
// answers by the attribute/term of the url, as the real source would
const replay = (log = []) => async (u) => {
  log.push(u);
  const url = new URL(u), term = url.searchParams.get('term'), attr = url.searchParams.get('attribute');
  if (attr === 'directorTerm' && /kurosawa/i.test(term)) return FX.director_kurosawa;
  if (attr === 'releaseYearTerm' && term === '1982') return FX.year_1982;
  if (attr === 'releaseYearTerm' && term === '1984') return FX.year_1984;
  if (!attr && /ikiru/i.test(term)) return FX.title_ikiru;
  return FX.empty;
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('asks parse to structured queries; picks and chatter do not', () => {
  assert.deepEqual(parseDiscoveryAsk('find me a sci-fi film from the 80s'), { kind: 'discover', genre: 'Sci-Fi & Fantasy', from: 1980, to: 1989 });
  assert.deepEqual(parseDiscoveryAsk('Films by Kurosawa'), { kind: 'discover', director: 'Kurosawa' });
  assert.deepEqual(parseDiscoveryAsk('movies directed by Akira Kurosawa'), { kind: 'discover', director: 'Akira Kurosawa' });
  assert.deepEqual(parseDiscoveryAsk('80s horror movies'), { kind: 'discover', genre: 'Horror', from: 1980, to: 1989 });
  assert.deepEqual(parseDiscoveryAsk('show me comedies from 1994'), { kind: 'discover', genre: 'Comedy', from: 1994, to: 1994 });
  assert.deepEqual(parseDiscoveryAsk('film metadata for Ikiru'), { kind: 'title', title: 'Ikiru' });
  assert.deepEqual(parseDiscoveryAsk('yo film metadata for ikiru'), { kind: 'title', title: 'ikiru' }, 'site-test #1152: the yo-prefixed wording must parse, or the ask is refused');
  assert.deepEqual(parseDiscoveryAsk('find films about space'), { kind: 'topic', topic: 'space' });
  for (const no of ['find me a film', 'pick a movie to watch with me', 'movie night', 'films', 'how do I film a video', 'film me a video', 'best films of 2025', 'hello', '', null]) assert.equal(parseDiscoveryAsk(no), null, String(no));
  assert.deepEqual([span('80s'), span('1980s'), span("the 90's"), span('eighties'), span('1994'), span('1999x')], [{ from: 1980, to: 1989 }, { from: 1980, to: 1989 }, { from: 1990, to: 1999 }, { from: 1980, to: 1989 }, { from: 1994, to: 1994 }, null]);
});

test('the skill claims discovery asks and leaves the movie pick alone', () => {
  const t = (s) => skill.match(s.toLowerCase(), s);
  for (const e of skill.examples) assert.ok(t(e), e);
  for (const n of skill.nearMisses) assert.ok(!t(n), n);
  assert.ok(pick.match('pick a movie to watch with me', 'pick a movie to watch with me') && !t('pick a movie to watch with me'));
  assert.ok(!pick.match('films by kurosawa', 'films by Kurosawa'));
  assert.equal(filmOf('film discovery for inception'), 'inception');
  assert.ok(t('yo film metadata for ikiru'), 'site-test #1152: "yo film metadata for ikiru" must be claimed by this skill, never refused as unknown');
  assert.ok(skill.suite().ok);
});

test('a director ask returns only that director\'s feature films, as the JSON fields asked for', async () => {
  const log = [], res = await discover('films by Kurosawa', replay(log));
  assert.equal(log.length, 1); assert.match(log[0], /^https:\/\/itunes\.apple\.com\/search\?/); assert.match(log[0], /attribute=directorTerm&term=Kurosawa/);
  assert.equal(res.count, 3); assert.deepEqual(res.films.map((f) => f.title), ['Rashomon', 'Ikiru', 'Seven Samurai']); // oldest first; the tribute and the song are out
  const ikiru = res.films[1];
  assert.deepEqual(Object.keys(ikiru), ['title', 'year', 'director', 'runtime_min', 'genres', 'plot', 'source']);
  assert.deepEqual(ikiru, { title: 'Ikiru', year: 1952, director: 'Akira Kurosawa', runtime_min: 143, genres: ['Drama'], plot: 'A dying civil servant looks for meaning in his last months.', source: { name: 'iTunes Search API', url: 'https://tv.apple.com/us/movie/ikiru/umc.cmc.example1' } });
  assert.equal(res.films[0].runtime_min, 88); assert.equal(res.films[0].plot, null, 'a field the source lacks is null, not made up');
  assert.deepEqual(res.sources, ['iTunes Search API']); assert.equal(res.note, '');
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(res)));
});

test('genre + decade: one search per year, the genre and years checked on the data, duplicates dropped', async () => {
  const log = [], res = await discover('find me a sci-fi film from the 80s', replay(log));
  assert.equal(log.length, 10); assert.ok(log.every((u) => /attribute=releaseYearTerm/.test(u)));
  assert.deepEqual(res.films.map((f) => [f.title, f.year, f.director]), [['Blade Runner', 1982, 'Ridley Scott'], ['The Terminator', 1984, 'James Cameron']]);
  assert.ok(res.films.every((f) => f.genres[0] === 'Sci-Fi & Fantasy'));
  assert.ok(searchUrls({ kind: 'discover', from: 1900, to: 2100 }).length <= MAX_YEARS, 'a stranger cannot widen the fan-out');
});

test('nothing found says so and lists no film; a source that is down is not "no such film"', async () => {
  const none = await discover('horror films from the 1920s', replay());
  assert.equal(none.count, 0); assert.deepEqual(none.films, []); assert.match(none.note, /list none rather than guess/);
  const down = await discover('films by Kurosawa', async () => { throw new Error('offline'); });
  assert.equal(down.count, 0); assert.match(down.note, /did not answer/);
  const bare = await discover('find me a film', replay()); // not a title either: a plain title lookup of the words, which finds nothing
  assert.equal(bare.count, 0);
  assert.match((await discover('', replay())).note, /Ask for films/);
});

test('hostile input: markup and a long ask are cleaned, and the url goes to one fixed host', async () => {
  const urls = [], res = await discover('film metadata for <script>alert(1)</script> & ' + 'x'.repeat(500), async (u) => { urls.push(u); return FX.empty; });
  assert.equal(res.count, 0); assert.ok(urls.length === 1 && urls.every((u) => u.startsWith('https://itunes.apple.com/search?')) && !/%3C|%3E|[<>]/.test(urls[0]) && decodeURIComponent(urls[0].split('term=')[1]).length <= 80);
  assert.equal(toFilm({ trackName: 'X', trackViewUrl: 'https://evil.example/x', releaseDate: 'nonsense' }).source.url, null, 'a link off apple.com is dropped');
  assert.deepEqual(selectFilms([{ kind: 'feature-movie', trackName: 'A', artistName: 'B' }], { kind: 'discover', director: 'Zed' }), []);
});

test('the route: GET only JSON, the guard has its own small limit, an empty ask is a 400', async () => {
  assert.ok(LIMITS.filmfind && LIMITS.filmfind.body === 0 && LIMITS.filmfind.rpm <= 30);
  assert.equal(route.onRequestPost, undefined);
  const bad = await route.onRequestGet({ request: new Request('https://a-to-mind.com/api/filmfind') });
  assert.equal(bad.status, 400);
  const real = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (u) => { calls++; assert.match(String(u), /^https:\/\/itunes\.apple\.com\/search\?/); return new Response(JSON.stringify(FX.title_ikiru), { status: 200 }); };
  try {
    const r = await route.onRequestGet({ request: new Request('https://a-to-mind.com/api/filmfind?q=' + encodeURIComponent('film metadata for Ikiru')) });
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /json/);
    const j = await r.json(); assert.equal(j.count, 1); assert.equal(j.films[0].title, 'Ikiru'); assert.equal(calls, 1);
  } finally { globalThis.fetch = real; }
});

test('the card shows the same fields, a Copy as JSON chip, the JSON, and says plainly when nothing was found', async () => {
  const res = await discover('films by Kurosawa', replay()), html = filmCard(res, esc);
  for (const s of ['Ikiru (1952)', 'Akira Kurosawa', '143 min', 'Drama', 'A dying civil servant', 'iTunes Search API', 'Copy as JSON', '&quot;runtime_min&quot;: 143']) assert.ok(html.includes(s), s);
  assert.ok(!html.includes('<script'));
  const empty = filmCard(await discover('horror films from the 1920s', replay()), esc);
  assert.ok(/list none rather than guess/.test(empty) && !/Copy as JSON/.test(empty) && !/fm-film/.test(empty));
});
