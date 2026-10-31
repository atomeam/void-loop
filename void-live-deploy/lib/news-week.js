// The week's stories about a topic, from Hacker News search (hn.algolia.com, free, no key): the one source the stage's "news about <topic>" card
// (skills/news.js) and the News page share, so a topic the page's headlines miss still shows the stories the card showed. Pure: tools/news-week.test.mjs.

/** the search address for a topic's stories of the past 7 days, from the time now (ms). Pure. */
export const weekUrl = (topic, now = Date.now()) => 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=30&numericFilters=created_at_i>'
  + Math.floor(now / 1000 - 7 * 86400) + '&query=' + encodeURIComponent(String(topic || '').trim());

/** the topic's own words: each must start a word in a story's title or link for the story to be about it. Hacker News search matches
 *  word beginnings and near spellings, so "nasa" also brought "Nasscad" and "Synology NAS" (2026-10-30). Small words do not count. Pure. */
const SMALL = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'and', 'or', 'for', 'to', 'with', 'about']);
export const topicWords = (topic) => String(topic || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !SMALL.has(w));
const startsWord = (text, w) => new RegExp('(?:^|[^\\p{L}\\p{N}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text);

/** the stories in an answer, at most 10: { title, url, points }, each url https (else the story's Hacker News page). The same story posted
 *  twice (one link, or one title) shows once: Hacker News keeps every repost, so a search for "nasa" once listed one lander story 3 times.
 *  With a topic, only stories whose title or link names every word of it (topicWords). Pure. */
export function weekItems(j, topic = '') {
  const words = topicWords(topic), about = (d) => words.every((w) => startsWord(d.title, w) || startsWord(d.url.replace(/^https:\/\/news\.ycombinator\.com\/.*$/, ''), w));
  const seen = new Set(), key = (s) => String(s).toLowerCase().replace(/^https:\/\/(?:www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '').replace(/\s+/g, ' ').trim();
  return ((j && Array.isArray(j.hits) && j.hits) || []).filter((h) => h && typeof h.title === 'string' && h.title.trim()).map((h) => ({
    title: h.title.trim(), url: /^https:\/\//.test(h.url || '') ? h.url : 'https://news.ycombinator.com/item?id=' + encodeURIComponent(String(h.objectID || '')), points: +h.points || 0 }))
    .filter(about).filter((d) => { const ks = [key(d.title), /^https:\/\/news\.ycombinator\.com\/item/.test(d.url) ? '' : key(d.url)].filter(Boolean);
      if (ks.some((k) => seen.has(k))) return false; ks.forEach((k) => seen.add(k)); return true; }).slice(0, 10);
}
