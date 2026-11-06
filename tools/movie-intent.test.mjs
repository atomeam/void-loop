// The movie pick follows the ask, and every pick in its JSON has a "similarity-score" (asked by Verse, 2026-10-22: "Add a 'similarity-score'
// field to the movie picks JSON so users can see how closely a pick matches their expressed intent"). lib/movie-intent.js reads the ask,
// skills/movie.js sends the intent to the model and scores each looked-up pick on its own genre, year, title and overview. No network.
//   node --test tools/movie-intent.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, pickPrompt, similarity, similarityWords, DEFAULT_PROMPT } from '../void-live-deploy/lib/movie-intent.js';
import movie, { pickJson, runPick, freePick } from '../void-live-deploy/skills/movie.js';

const SCREAM = { verified: true, title: 'Scream', year: 1996, genre: 'Horror', overview: 'A masked killer stalks a small town.', sources: ['iTunes Search API'] };
const SE7EN = { verified: true, title: 'Se7en', year: 1995, genre: 'Thriller', overview: 'Two detectives hunt a serial killer.', sources: ['iTunes Search API'] };
const ALIEN = { verified: true, title: 'Alien', year: 1979, genre: 'Horror', overview: 'A crew in deep space meets a deadly creature.', sources: ['iTunes Search API'] };
const WIKI = { verified: true, title: 'The Blair Witch Project', year: 1999, director: 'Daniel Myrick', sources: ['Wikidata'] }; // Wikidata gives no genre

test('"scary movies from the 90s" wants horror from 1990 to 1999', () => {
  const i = parseIntent('scary movies from the 90s');
  assert.equal(i.genre, 'Horror'); assert.equal(i.genreWord, 'scary'); assert.equal(i.from, 1990); assert.equal(i.to, 1999);
  assert.deepEqual(i.keywords, []);
  assert.deepEqual(i.criteria.map((c) => c.label), ['scary (horror)', '1990s']);
});

test('"pick a movie to watch with me" names nothing to match, so there is no intent', () => {
  for (const a of ['pick a movie to watch with me', 'movie night', 'what should we watch tonight', 'suggest a good film for tonight', '', null]) assert.equal(parseIntent(a), null, String(a));
});

test('genres, moods, decades and keywords are read the way film discovery reads them', () => {
  assert.deepEqual(parseIntent('horror movies from 1994').criteria.map((c) => c.label), ['horror', '1994']);
  assert.deepEqual(parseIntent("movies from the 80's about space").criteria.map((c) => c.label), ['1980s', 'space']);
  assert.deepEqual(parseIntent('zombies movies').keywords, ['zombie']);
  assert.equal(parseIntent('sci fi movies in the eighties').genre, 'Sci-Fi & Fantasy');
  assert.equal(parseIntent('funny films from the 1970s').genre, 'Comedy');
});

test('the intent goes into the prompt; no intent keeps the default prompt', () => {
  assert.equal(pickPrompt(null), DEFAULT_PROMPT);
  const p = pickPrompt(parseIntent('scary movies from the 90s'));
  assert.match(p, /horror movies released between 1990 and 1999/); assert.match(p, /1\. Title \(Year\)/);
  assert.match(pickPrompt(parseIntent('movies about space')), /movies about space/);
});

test('the score is worked out from the pick\'s own data, criterion by criterion', () => {
  const i = parseIntent('scary movies from the 90s');
  assert.deepEqual(similarity(SCREAM, i), { score: 100, matched: ['scary (horror)', '1990s'], missed: [] });
  assert.deepEqual(similarity(SE7EN, i), { score: 50, matched: ['1990s'], missed: ['scary (horror), the source says thriller'] });
  assert.deepEqual(similarity(ALIEN, i), { score: 50, matched: ['scary (horror)'], missed: ['1990s, it is from 1979'] });
  assert.equal(similarity(WIKI, i).score, 50, 'a genre the source does not give is not counted as a match');
  assert.match(similarity(WIKI, i).missed[0], /the source gives no genre/);
  const space = parseIntent('horror movies about space');
  assert.equal(similarity(ALIEN, space).score, 100, 'a keyword matches the overview');
  assert.equal(similarity(SCREAM, space).score, 50);
  assert.equal(similarityWords(similarity(SCREAM, i), i), 'Matches 2 of 2 (100%): scary (horror), 1990s');
  assert.equal(similarityWords(similarity(SE7EN, i), i), 'Matches 1 of 2 (50%): 1990s. Not a match: scary (horror), the source says thriller');
});

test('no intent: the score is null with a reason, never a made-up number', () => {
  const s = similarity(SCREAM, parseIntent('pick a movie to watch with me'));
  assert.equal(s.score, null); assert.match(s.reason, /named no genre, mood, decade or keyword/);
  assert.equal(similarityWords(s, null), '');
});

test('every pick in the picks JSON has a "similarity-score"', () => {
  const i = parseIntent('scary movies from the 90s');
  const js = pickJson([SCREAM, SE7EN, { verified: false, title: 'Made Up' }], i);
  assert.equal(js.length, 2);
  assert.equal(js[0]['similarity-score'], 100); assert.deepEqual(js[0]['similarity-matches'], ['scary (horror)', '1990s']); assert.deepEqual(js[0]['similarity-misses'], []);
  assert.equal(js[1]['similarity-score'], 50);
  const none = pickJson([SCREAM]);
  assert.ok('similarity-score' in none[0]); assert.equal(none[0]['similarity-score'], null); assert.match(none[0]['similarity-reason'], /nothing to score/);
  assert.equal(none[0].title, 'Scream'); assert.equal(none[0].genre, 'Horror');
});

test('the free film added to a pick follows the intent\'s years, and is the day\'s one without an intent', () => {
  const day = { title: 'Nosferatu', year: 1922 };
  assert.equal(freePick(null, day), day);
  assert.equal(freePick(parseIntent('scary movies from the 90s'), day), null, 'no free film is from the 90s');
  assert.equal(freePick(parseIntent('horror movies from the 60s'), day).title, 'Night of the Living Dead');
  assert.equal(freePick(parseIntent('scary movies'), day), null);
});

// runPick end to end with the model and the movie lookup stood in for
async function pickCard(ask) {
  const sent = [], films = { Scream: SCREAM, Se7en: SE7EN, Alien: ALIEN };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    if (u === '/api/answer') { sent.push(JSON.parse(o.body).ask); return { ok: true, json: async () => ({ answer: '1. Se7en (1995)\n2. Scream (1996)\n3. Alien (1979)' }) }; }
    const t = new URL(u, 'https://x').searchParams.get('title');
    return { ok: true, json: async () => films[t] || { verified: false, title: t } };
  };
  const el = { dataset: {}, innerHTML: '' };
  const api = { esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), showPage: (fn) => { fn(el); return el; }, _pageStill: () => true };
  try { await movie.run(ask, api); } finally { globalThis.fetch = oldFetch; }
  return { sent, html: el.innerHTML };
}

test('"scary movies from the 90s": the prompt carries the intent, the closest pick is first, and each row says how it matches', async () => {
  const { sent, html } = await pickCard('scary movies from the 90s');
  assert.equal(sent.length, 1); assert.match(sent[0], /horror movies released between 1990 and 1999/);
  assert.match(html, /<h2>A movie to watch: scary \(horror\), 1990s<\/h2>/);
  const rows = html.split('class="mv-row"').slice(1);
  assert.equal(rows.length, 3); assert.match(rows[0], /Scream/, 'the 100% match comes first');
  assert.match(rows[0], /Matches 2 of 2 \(100%\): scary \(horror\), 1990s/);
  assert.match(html, /Matches 1 of 2 \(50%\): 1990s\. Not a match: scary \(horror\), the source says thriller/);
  const json = JSON.parse(html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  assert.deepEqual(json.intent, ['scary (horror)', '1990s']);
  assert.deepEqual(json.films.map((f) => [f.title, f['similarity-score']]), [['Scream', 100], ['Se7en', 50], ['Alien', 50]]);
  assert.doesNotMatch(html, /Nosferatu|Night of the Living Dead/, 'no off-intent free film is added');
});

test('"pick a movie to watch with me": the default prompt, no match lines, and the JSON says why there is no score', async () => {
  const { sent, html } = await pickCard('pick a movie to watch with me');
  assert.equal(sent[0], DEFAULT_PROMPT);
  assert.doesNotMatch(html, /mv-sim/);
  assert.match(html, /<h2>A movie to watch<\/h2>/);
  assert.match(html, /&quot;similarity-score&quot;: null/);
  assert.match(html, /&quot;intent&quot;: null/);
});
