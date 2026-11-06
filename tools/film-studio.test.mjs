// tools/trends.mjs, tools/topic-gate.mjs, tools/film-studio.mjs, the format planner in tools/shorts-loop.mjs and tools/film-cleanup.mjs:
// every kind of video, about what people watch today, never a small everyday sum, never harm, never a repeat, every page of /films/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { googleTrends, wikiTop, hnStory, isPerson, summaryOf, readTrends } from './trends.mjs';
import { topicCheck, filmWordsCheck, overlap, dayMinus } from './topic-gate.mjs';
import { FORMATS, ORDER, fits, scriptOf, timeline, linesOf, lineChars, factsOf, nameOf, MAX_S, pageHtml } from './film-studio.mjs';
import { planFilms, formatOrder, scriptOk, PER_DAY, MIN_VIEWS } from './shorts-loop.mjs';
import { toUnlist, cleanup } from './film-cleanup.mjs';
import { hookScore, captionCheck, SAFE } from './video-gate.mjs';

const trends = JSON.parse(fs.readFileSync(new URL('./fixtures/trends-sample.json', import.meta.url), 'utf8'));
const T = (name) => trends.topics.find((t) => t.topic === name);

// trend sources: parsed from their own shapes, no model writes a fact
const rss = '<rss><channel><item><title>Wicked &amp; Glinda</title><ht:approx_traffic>500K+</ht:approx_traffic><ht:news_item_title><![CDATA[Box office record]]></ht:news_item_title></item><item><title></title></item></channel></rss>';
assert.deepEqual(googleTrends(rss), [{ topic: 'Wicked & Glinda', source: 'Google Trends', url: 'https://trends.google.com/trending?geo=US', traffic: '500K+', news: 'Box office record' }]);
const top = wikiTop({ items: [{ articles: [{ article: 'Main_Page' }, { article: 'Special:Search' }, { article: 'Deaths_in_2026' }, { article: 'Star_Wars', views: 9 }] }] });
assert.deepEqual(top.map((t) => t.topic), ['Star Wars'], 'the front page, special pages and death lists are not news');
assert.equal(hnStory({ type: 'story', id: 7, title: 'Show HN: A synth in a tweet', score: 3 }).topic, 'A synth in a tweet');
assert.equal(hnStory({ type: 'story', title: 'x', dead: true }), null);
assert.equal(isPerson({ description: 'American singer-songwriter (born 1989)' }), true);
assert.equal(isPerson({ description: 'Hindu festival of lights', extract: 'Diwali is a festival.' }), false);
const sum = summaryOf({ title: 'Diwali', description: 'festival', extract: 'Diwali is the festival of lights. It lasts five days.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Diwali' } } });
assert.deepEqual(sum.sentences, ['Diwali is the festival of lights.', 'It lasts five days.']);
assert.equal(summaryOf({ type: 'disambiguation', extract: 'x' }), null);
// a source that fails is named, never fatal
const fake = async (url) => {
  if (url.includes('trends.google')) return new Response(rss, { status: 200 });
  if (url.includes('wikimedia.org')) return new Response('nope', { status: 503 });
  if (url.includes('topstories')) return Response.json([1]);
  if (url.includes('/item/1')) return Response.json({ type: 'story', id: 1, title: 'A synth in a tweet' });
  if (url.includes('page/summary')) return Response.json({ title: 'Wicked', extract: 'Wicked is a musical. It opened in 2003.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Wicked' } } });
  return new Response('', { status: 404 });
};
const live = await readTrends({ fetchImpl: fake, now: Date.parse('2026-11-06T12:00:00Z') });
assert.deepEqual(live.topics.map((t) => t.source), ['Google Trends', 'Hacker News']);
assert.match(live.failed[0], /^Wikipedia: .*503/);
assert.deepEqual(live.topics[0].summary, ['Wicked is a musical.', 'It opened in 2003.']);

// the topic gate: the whole class of small everyday sums, harm, adult, repeats
for (const t of ['how to split a dinner bill', 'Splitting a $84 dinner bill 3 ways?', 'how much do you tip on $47', '20% off coupon code', 'cups to grams', 'compound interest calculator', 'hourly wage to salary'])
  assert.deepEqual(topicCheck(t).kinds, ['math'], t + ' is a small everyday sum');
assert.deepEqual(topicCheck(T('earthquake today')).kinds, ['harm']);
assert.equal(topicCheck(T('Star Wars')).ok, true, 'Star Wars is not a war');
assert.equal(topicCheck('Diwali').ok, true);
assert.deepEqual(topicCheck('nsfw clips').kinds, ['adult']);
const recent = [{ topic: 'Wicked: For Good', day: '20261101' }];
assert.deepEqual(topicCheck('Wicked For Good', recent, '20261106').kinds, ['repeat'], 'the same topic within 30 days');
assert.equal(topicCheck('Wicked For Good', recent, '20261215').ok, true, 'after 30 days it may come back');
assert.equal(dayMinus('20261106', 30), '20261007');
assert.ok(overlap('chiefs vs bills', 'Chiefs Bills') === 1);
assert.deepEqual(filmWordsCheck({ title: 'Splitting a $84 dinner bill 3 ways? #Shorts', description: 'x' }).kinds, ['math'], 'the dinner-bill films fail');
assert.equal(filmWordsCheck({ title: 'Why is everyone talking about Diwali? #Shorts', description: 'Make one: https://a-to-mind.com/c/x?q=Election%202026%20news' }).ok, true, 'a link is not a percent');

// the formats: eight kinds of video, each with a hook a stranger cares about, lines that fit their cards, facts only from the summary
assert.equal(ORDER.length, 8);
const diwali = T('Diwali'), facts = new Set(factsOf(diwali));
for (const f of ORDER) {
  const sc = scriptOf(f, diwali);
  assert.ok(sc, f + ' can carry Diwali');
  assert.ok(hookScore(sc.hook) >= 60, f + ': "' + sc.hook + '" scores ' + hookScore(sc.hook));
  assert.ok(scriptOk(sc), f + ' lines fit their cards');
  for (const b of sc.beats.filter((x) => x.kind === 'fact' && /^\d\. |^[A-Z]/.test(x.text) && FORMATS[f].facts)) assert.ok(facts.has(b.text.replace(/^\d\. /, '')), f + ' states only summary sentences: ' + b.text);
  const tl = timeline(sc);
  assert.ok(tl.total <= MAX_S + 0.01 && tl.total >= 6, f + ' runs ' + tl.total + ' s');
  assert.equal(tl.beats[0].kind, 'hook'); assert.equal(tl.beats.at(-1).kind, 'cta');
  for (const b of tl.beats) for (const l of linesOf(b).text.split('\n')) assert.ok(l.length <= lineChars(linesOf(b).size) + 2, f + ': a line too wide: ' + l);
  assert.match(pageHtml(sc, tl), /window\.measure=/);
}
const swift = T('Taylor Swift');
assert.deepEqual(ORDER.filter((f) => fits(f, swift)), ['explainer', 'countdown'], 'a real person gets the fact formats only, never a parody');
assert.equal(fits('trailer', { topic: 'A synth in a tweet', source: 'Hacker News' }), false, 'a story title is a headline, not a movie');
assert.equal(nameOf({ topic: 'Pumpkin spice', title: 'Pumpkin pie spice' }), 'Pumpkin pie spice');
// the gate reads a measured caption box when the render gives one
assert.equal(captionCheck([{ text: 'a long line that the estimate would call too wide', size: 84, x: 70, y: 400, w: 860, h: 220, box: true, rect: true }]).ok, true);
assert.equal(captionCheck([{ text: 'x', size: 84, x: 70, y: 400, w: SAFE.x1, h: 100, box: true, rect: true }]).ok, false);

// the planner: three films, three formats, three topics, none refused; the formats rotate; a judged best format keeps its place
let log = { trials: [] };
const d1 = planFilms(log, trends, '20261107');
assert.equal(d1.films.length, PER_DAY);
assert.equal(new Set(d1.films.map((f) => f.format)).size, PER_DAY, 'each film a different format');
assert.equal(new Set(d1.films.map((f) => f.topic)).size, PER_DAY, 'each film a different topic');
assert.deepEqual(d1.films.map((f) => f.format), ORDER.slice(0, 3), 'the first day takes the first three formats');
for (const f of d1.films) { assert.equal(topicCheck(f.topic).ok, true); assert.match(f.film, /^20261107-[a-z]+-[a-z0-9-]+$/); }
assert.deepEqual(d1.refused.map((r) => r.kinds[0]).sort(), ['harm', 'math', 'math']);
log.trials.push(d1);
const d2 = planFilms(log, trends, '20261108');
assert.ok(d2.films.every((f) => !ORDER.slice(0, 3).includes(f.format)), 'the next day makes the formats not made yet');
assert.ok(d2.films.every((f) => !d1.films.some((g) => g.topic === f.topic)), 'and no topic again within 30 days');
const judged = { trials: [{ day: '20261101', films: [{ format: 'lyric', topic: 'x', outcome: { views: MIN_VIEWS, clicks: 3 } }, { format: 'news', topic: 'y', outcome: { views: MIN_VIEWS, clicks: 0 } }] }] };
assert.equal(formatOrder(judged)[0], 'lyric', 'the best-scoring format keeps a place');

// the cleanup: listed films whose words are a refused kind come off the list, page by page, the owner's count is the stored total
const page = (films, next, stored) => Response.json({ films, next, owner: true, stored });
const posted = [];
const site = async (url, o = {}) => {
  if (o.method === 'POST') { posted.push([url, JSON.parse(o.body)]); return Response.json({ ok: true }); }
  const from = Number(new URL(url).searchParams.get('from'));
  if (from === 0) return page([{ id: '20261106-short-split-dinner-bill-a', title: 'Splitting a $84 dinner bill 3 ways? #Shorts', description: 'd' }, { id: 'old-1', title: 'Old', description: '', unlisted: true }], 60, 75);
  return page([{ id: '20261106-short-split-dinner-bill-b', title: 'Splitting a $84 dinner bill 3 ways? #Shorts', description: 'd' }, { id: 'f2', title: 'Why is everyone talking about Diwali? #Shorts', description: 'd' }], null, 75);
};
assert.deepEqual(toUnlist([{ id: 'a', title: 'tip on $47', unlisted: true }]), [], 'an unlisted film is left as it is');
const r = await cleanup({ site: 'https://x.test', token: 't', fetchImpl: site });
assert.equal(r.stored, 75); assert.equal(r.seen, 4); assert.equal(r.pages, 2);
assert.deepEqual(r.unlisted, ['20261106-short-split-dinner-bill-a', '20261106-short-split-dinner-bill-b']);
assert.equal(posted.length, 2); assert.equal(posted[0][1].gate, undefined, 'posted again without gate pass: unlisted, still stored');
assert.equal(r.listed, 1);

// the workflow: trends, the plan, three studio renders, the cleanup, a dry run that posts nothing
const wf = fs.readFileSync(new URL('../.github/workflows/shorts.yml', import.meta.url), 'utf8');
assert.match(wf, /node tools\/trends\.mjs > trends\.json/);
assert.match(wf, /node tools\/shorts-loop\.mjs plan --trends trends\.json/);
assert.match(wf, /node tools\/film-studio\.mjs render --trial trial\.json --i "\$i"/);
assert.match(wf, /node tools\/film-cleanup\.mjs/);
assert.match(wf, /inputs\.dry/);
console.log('film-studio: ok');
