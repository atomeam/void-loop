// The week's stories about a topic, from Hacker News search (hn.algolia.com, free, no key): the one source the stage's "news about <topic>" card
// (skills/news.js) and the News page share, so a topic the page's headlines miss still shows the stories the card showed. Pure: tools/news-week.test.mjs.

/** the search address for a topic's stories of the past 7 days, from the time now (ms). Pure. */
export const weekUrl = (topic, now = Date.now()) => 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=20&numericFilters=created_at_i>'
  + Math.floor(now / 1000 - 7 * 86400) + '&query=' + encodeURIComponent(String(topic || '').trim());

/** the stories in an answer, at most 10: { title, url, points }, each url https (else the story's Hacker News page). The same story posted
 *  twice (one link, or one title) shows once: Hacker News keeps every repost, so a search for "nasa" once listed one lander story 3 times. Pure. */
export function weekItems(j) {
  const seen = new Set(), key = (s) => String(s).toLowerCase().replace(/^https:\/\/(?:www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '').replace(/\s+/g, ' ').trim();
  return ((j && Array.isArray(j.hits) && j.hits) || []).filter((h) => h && typeof h.title === 'string' && h.title.trim()).map((h) => ({
    title: h.title.trim(), url: /^https:\/\//.test(h.url || '') ? h.url : 'https://news.ycombinator.com/item?id=' + encodeURIComponent(String(h.objectID || '')), points: +h.points || 0 }))
    .filter((d) => { const ks = [key(d.title), /^https:\/\/news\.ycombinator\.com\/item/.test(d.url) ? '' : key(d.url)].filter(Boolean);
      if (ks.some((k) => seen.has(k))) return false; ks.forEach((k) => seen.add(k)); return true; }).slice(0, 10);
}
