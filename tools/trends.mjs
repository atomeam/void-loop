#!/usr/bin/env node
// What people are watching and searching today, for Verse's films (tools/studio.mjs makes the film, tools/shorts-loop.mjs picks the
// topic). Three free sources, no key, read from GitHub's network by .github/workflows/shorts.yml:
//   Google Trends   https://trends.google.com/trending/rss?geo=US      the day's rising searches in the US
//   Wikipedia       the most read English articles yesterday (wikimedia pageviews API)
//   Hacker News     the top stories now (firebase API, already used by the bot rack: void-live-deploy/bots/api-bots.js)
// Each topic gets its Wikipedia summary (the words a film may state as fact, with the page it came from). A topic without a summary is
// kept only for the formats that state no facts. Nothing here is written by a model: every fact line is the summary's own sentence.
//   node tools/trends.mjs [--max 24]      -> JSON { at, topics: [{ topic, source, url, summary, description, page, person }] } on stdout
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const UA = { 'user-agent': 'VerseStudio/1.0 (https://a-to-mind.com; films)', accept: 'application/json, application/rss+xml, text/xml' };
const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/** the rising searches in a Google Trends RSS text: [{ topic, source, url, traffic, news }]. Pure. */
export function googleTrends(xml) {
  const out = [];
  for (const m of String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1], tag = (n) => decode((it.match(new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>')) || [])[1]);
    const topic = tag('title'); if (!topic) continue;
    out.push({ topic, source: 'Google Trends', url: 'https://trends.google.com/trending?geo=US', traffic: tag('ht:approx_traffic'), news: tag('ht:news_item_title') });
  }
  return out;
}
// pages that are always near the top of the pageviews list and are not news: the front page, special pages, lists of deaths
const WIKI_SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|File:|Help:|Category:|Template:|Talk:|User:|Deaths_in_|List_of_|-$)/;
/** the most read English Wikipedia articles from a pageviews top response: [{ topic, source, url, page }]. Pure. */
export function wikiTop(json, n = 30) {
  const items = (((json || {}).items || [])[0] || {}).articles || [];
  return items.filter((a) => a && a.article && !WIKI_SKIP.test(a.article)).slice(0, n)
    .map((a) => ({ topic: a.article.replace(/_/g, ' '), source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(a.article), page: a.article, views: a.views }));
}
/** a Hacker News story as a topic: its title, where it points. Pure. */
export function hnStory(item) {
  if (!item || item.type !== 'story' || !item.title || item.dead || item.deleted) return null;
  return { topic: item.title.replace(/^(Show|Ask|Tell) HN:\s*/i, ''), source: 'Hacker News', url: 'https://news.ycombinator.com/item?id=' + item.id, score: item.score };
}

// words in a Wikipedia description that mean the page is about one person (a parody of a real person is not made: they get facts only)
const PERSONISH = /\b(born|actor|actress|singer|rapper|songwriter|musician|footballer|soccer player|basketball player|baseball player|player|athlete|boxer|wrestler|golfer|cricketer|tennis|politician|president|senator|governor|minister|prime minister|king|queen|prince|princess|comedian|presenter|host|youtuber|streamer|influencer|businessman|businesswoman|entrepreneur|model|author|writer|director|producer|journalist|judge|lawyer|coach|manager|chef|dancer|personality|(?:american|british|canadian|australian|english|irish|scottish|french|german|spanish|italian|mexican|brazilian|indian|japanese|korean|nigerian|south african) (?:man|woman))\b/i;
/** whether a Wikipedia summary is about a person. Pure. */
export function isPerson(sum) {
  if (!sum) return false;
  return PERSONISH.test(String(sum.description || '')) || /\(born \d|\(\d{4}\s*[–-]\s*\d{4}\)|\bborn (?:on )?\w+ \d{1,2}, \d{4}/.test(String(sum.extract || '').slice(0, 220));
}
/** the parts of a Wikipedia REST summary a film may use: plain sentences, the description, the page. Pure. */
export function summaryOf(j) {
  if (!j || j.type === 'disambiguation' || !j.extract) return null;
  const sentences = String(j.extract).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)/g) || [j.extract];
  return { title: j.title, description: j.description || '', extract: j.extract, sentences: sentences.map((s) => s.trim()).filter((s) => s.length > 12), page: ((j.content_urls || {}).desktop || {}).page || '', person: isPerson(j) };
}

async function getJson(url, fetchImpl) { const r = await fetchImpl(url, { headers: UA }); if (!r.ok) throw new Error(url + ' answered ' + r.status); return r.json(); }
async function summary(title, fetchImpl) {
  try { return summaryOf(await getJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')) + '?redirect=true', fetchImpl)); } catch (_) {}
  try { // a search phrase ("chiefs vs bills") finds its article by title search
    const s = await getJson('https://en.wikipedia.org/w/rest.php/v1/search/title?limit=1&q=' + encodeURIComponent(title), fetchImpl);
    const hit = ((s || {}).pages || [])[0];
    if (hit && hit.key) return summaryOf(await getJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(hit.key) + '?redirect=true', fetchImpl));
  } catch (_) {}
  return null;
}

/** every source read, each topic with its summary when one exists; a source that fails is named in `failed`, never fatal */
export async function readTrends({ fetchImpl = fetch, max = 24, now = Date.now() } = {}) {
  const failed = [], lists = [];
  try { const r = await fetchImpl('https://trends.google.com/trending/rss?geo=US', { headers: UA }); if (!r.ok) throw new Error('HTTP ' + r.status); lists.push(googleTrends(await r.text())); } catch (e) { failed.push('Google Trends: ' + (e.message || e)); }
  try { const d = new Date(now - 86400000), ymd = d.toISOString().slice(0, 10).replace(/-/g, '/'); lists.push(wikiTop(await getJson('https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/' + ymd, fetchImpl))); } catch (e) { failed.push('Wikipedia: ' + (e.message || e)); }
  try { const ids = (await getJson('https://hacker-news.firebaseio.com/v0/topstories.json', fetchImpl)).slice(0, 8); lists.push((await Promise.all(ids.map((id) => getJson('https://hacker-news.firebaseio.com/v0/item/' + id + '.json', fetchImpl).catch(() => null)))).map(hnStory).filter(Boolean)); } catch (e) { failed.push('Hacker News: ' + (e.message || e)); }
  // take the sources in turn (one of each, then the next), so no single source fills the list
  const seen = new Set(), picked = [];
  for (let i = 0; picked.length < max && lists.some((l) => l[i]); i++) for (const l of lists) { const t = l[i]; if (t && !seen.has(t.topic.toLowerCase()) && picked.length < max) { seen.add(t.topic.toLowerCase()); picked.push(t); } }
  for (const t of picked) { const s = t.source === 'Hacker News' ? null : await summary(t.page || t.topic, fetchImpl); if (s) Object.assign(t, { summary: s.sentences, description: s.description, page: s.page, person: s.person, title: s.title }); }
  return { at: new Date(now).toISOString(), topics: picked, failed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--max'), r = await readTrends({ max: i > 0 ? Number(process.argv[i + 1]) : 24 });
  process.stdout.write(JSON.stringify(r, null, 1) + '\n');
  for (const f of r.failed) console.error('trend source failed: ' + f);
  if (!r.topics.length) { console.error('no trend source answered'); process.exit(3); }
}
