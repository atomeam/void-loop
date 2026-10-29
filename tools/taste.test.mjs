// node --test tools/taste.test.mjs: Verse's pick algorithm (lib/taste.js): never the same pick twice, mostly the strongest taste with some exploring, the Takeout parser, honest whys.
// Every sample here is synthetic (made up for the test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, markSeen, allowed, choose, interests, parseTakeout, parseList, whyPick, rate, load, save, forget, pickRecord, EXPLORE, SEEN_MAX, wordsOf } from '../void-live-deploy/lib/taste.js';

const lcg = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const GENRES = ['Jazz', 'Rock', 'Pop', 'Folk', 'Soul', 'Blues'];
const CATALOG = Array.from({ length: 60 }, (_, i) => ({ title: 'Song Number ' + i, artist: 'Artist ' + (i % 7), genre: GENRES[i % GENRES.length], verified: true }));

test('never the same pick twice: 30 picks from a fixed catalog are 30 different titles, and "seen" is bounded per kind', () => {
  const rng = lcg(7); let t = blank(), last = '', got = [];
  for (let i = 0; i < 30; i++) {
    const c = CATALOG.filter((f) => allowed(t, 'music', f.title)), r = choose(c, t, interests(t), rng, { lastGenre: last });
    got.push(r.pick.title); last = r.pick.genre.toLowerCase(); t = markSeen(t, 'music', r.pick.title);
  }
  assert.equal(new Set(got).size, 30);
  let u = blank(); for (let i = 0; i < SEEN_MAX + 50; i++) u = markSeen(u, 'music', 'T' + i); u = markSeen(u, 'movie', 'A Film');
  assert.equal(u.seen.filter((s) => s.startsWith('music:')).length, SEEN_MAX); assert.ok(u.seen.includes('movie:film'));
});

test('exploit and explore: with a taste for jazz, about a quarter of 400 picks explore a genre not liked, the rest take the best; a same-genre repeat is marked down', () => {
  let t = rate(blank(), 'music', 'Blue Jazz Night', true, { genre: 'Jazz', words: 'jazz' }); const ints = interests(t), rng = lcg(11);
  let ex = 0, mixed = 0; const modes = { exploit: 0, explore: 0, fresh: 0 };
  for (let i = 0; i < 400; i++) { const r = choose(CATALOG, t, ints, rng); modes[r.mode]++; if (r.mode === 'explore') { ex++; assert.notEqual(r.pick.genre, 'Jazz'); } if (r.mode === 'exploit') assert.equal(r.pick.genre, 'Jazz'); }
  assert.ok(ex / 400 > EXPLORE - 0.08 && ex / 400 < EXPLORE + 0.08, 'explore share ' + ex / 400);
  assert.equal(modes.fresh, 0);
  const a = { title: 'A', genre: 'Jazz', verified: true }, b = { title: 'B', genre: 'Rock', verified: true };
  const r = choose([a, b], t, { jazz: { w: 2, src: 'thumbs' } }, () => 0.9, { lastGenre: 'jazz' }); assert.equal(r.pick.title, 'B', 'a different genre from the last pick wins when the penalty outweighs the taste');
});

test('the Takeout parser: titles and channels become topic counts (synthetic watch history), a bad file gives nothing, a list works', () => {
  const sample = [
    { title: 'Watched Sourdough bread for beginners', subtitles: [{ name: 'Baking Lab' }] }, { title: 'Watched Sourdough starter tips', subtitles: [{ name: 'Baking Lab' }] },
    { title: 'Watched Synthwave mix', subtitles: [{ name: 'Night Drive' }] }, { title: 'Watched ', subtitles: [] }, null,
  ];
  const r = parseTakeout(sample);
  assert.equal(r.n, 4); assert.equal(Math.max(...Object.values(r.topics)), 5); assert.ok(r.topics.sourdough > r.topics.synthwave && r.topics.baking >= r.topics.sourdough);
  assert.ok(!('watched' in r.topics)); assert.deepEqual(parseTakeout('not json'), { topics: {}, n: 0 }); assert.deepEqual(parseTakeout({ a: 1 }), { topics: {}, n: 0 });
  assert.ok(parseList('Cooking with Ana\nCooking basics\n\nJazz piano').topics.cooking >= 4);
  const s = { v: null, getItem: () => s.v, setItem: (k, v) => { s.v = v; }, removeItem: () => { s.v = null; } };
  save(s, { ...blank(), yt: r.topics, ytN: r.n }); assert.ok(load(s).yt.sourdough); assert.deepEqual(forget(s).yt, {}); assert.equal(s.v, null);
});

test('the why line names only signals that were really used', () => {
  const none = whyPick({ mode: 'fresh' }); assert.ok(!/thumbs-ups|kept|recent asks|strongest|wanted something/.test(none), none);
  assert.match(whyPick({ mode: 'exploit', hit: { word: 'jazz', src: 'youtube' } }), /"jazz".*YouTube history you imported/);
  assert.match(whyPick({ mode: 'exploit', hit: { word: 'jazz', src: 'thumbs' } }), /your thumbs-ups/);
  assert.match(whyPick({ mode: 'explore', genre: 'Folk' }), /new on purpose.*Folk/);
  assert.ok(!/strongest|new on purpose|YouTube history/.test(whyPick({ mood: 'cozy', kind: 'music', kindBy: 'day' })));
  const ints = interests(rate(blank(), 'music', 'Hey Jude', true, { genre: 'Rock', words: 'rock' }), { asks: ['pizza recipes'], kept: [] });
  assert.equal(ints.rock.src, 'thumbs'); assert.equal(ints.pizza.src, 'asks'); assert.deepEqual(wordsOf('The Official Video'), []);
});

test('the pick as JSON (asked by Verse): a similarity score and a reasoning link that name the same signal as the why line', () => {
  const t = rate(blank(), 'movie', 'Night Noir', true, { genre: 'Noir', words: 'noir' }), ints = interests(t);
  const r = choose([{ title: 'Noir City', genre: 'Noir', verified: true }], t, ints, () => 0.9);
  const rec = pickRecord(r, { kind: 'movie' });
  assert.equal(rec.mode, 'exploit'); assert.equal(rec.reasoning.skill, 'pick-for-me'); assert.equal(rec.reasoning.signal.from, 'thumbs'); assert.equal(rec.reasoning.signal.word, 'noir');
  assert.ok(rec.similarity >= 0.5 && rec.similarity < 1, 'similarity ' + rec.similarity);
  assert.ok(whyPick({ mode: r.mode, hit: r.hit }).includes(rec.reasoning.signal.source));
  const fresh = pickRecord(choose([{ title: 'Plain', genre: '', verified: true }], blank(), {}, () => 0.9), { kind: 'movie' });
  assert.equal(fresh.similarity, 0); assert.equal(fresh.reasoning.signal, null); assert.equal(pickRecord(null), null);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(rec)));
});
