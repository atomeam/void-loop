// The week's stories about a topic, from Hacker News search (hn.algolia.com, free, no key): the one source the stage's "news about <topic>" card
// (skills/news.js) and the News page share, so a topic the page's headlines miss still shows the stories the card showed. Pure: tools/news-week.test.mjs.

/** the search address for a topic's stories of the past 7 days, from the time now (ms). Pure. */
export const weekUrl = (topic, now = Date.now()) => 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=10&numericFilters=created_at_i>'
  + Math.floor(now / 1000 - 7 * 86400) + '&query=' + encodeURIComponent(String(topic || '').trim());

/** the stories in an answer, at most 10: { title, url, points }, each url https (else the story's Hacker News page). Pure. */
export function weekItems(j) {
  return ((j && Array.isArray(j.hits) && j.hits) || []).filter((h) => h && typeof h.title === 'string' && h.title.trim()).slice(0, 10).map((h) => ({
    title: h.title.trim(), url: /^https:\/\//.test(h.url || '') ? h.url : 'https://news.ycombinator.com/item?id=' + encodeURIComponent(String(h.objectID || '')), points: +h.points || 0 }));
}
