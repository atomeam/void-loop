/**
 * news skill — today's headlines from Wikipedia's "In the news" (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "news today", "what's in the news", "headlines".
 * Every news card stays current on its own (skills/live.js): headlines and topic stories re-fetch every 30 minutes,
 * the tech front page every 10, for as long as the card is up.
 */
import { keepLive } from './live.js';
const list = (esc, items) => '<ul>' + items.map((h) => { const u = /^https:\/\//.test(h.url || '') ? h.url : 'https://news.ycombinator.com/item?id=' + encodeURIComponent(h.objectID || '');
  return '<li style="margin:6px 0"><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(h.title) + '</a> <span style="color:#8a8a8a">· ' + esc(String(h.points || 0)) + ' points</span></li>'; }).join('') + '</ul>';
// "tech news", "technology news today", "hacker news": the Hacker News front page (Algolia API, no key). Other topics
// (sports, business…) have no keyless source yet, so they are not claimed.
export function isTechNews(text) {
  return /^(?:(?:show\s+me\s+|give\s+me\s+)?(?:the\s+|today'?s\s+|latest\s+)?(?:tech|technology|hacker|startup|programming)\s+(?:news|headlines)(?:\s+today|\s+now|\s+please)?|what'?s\s+new\s+in\s+tech(?:nology)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
// the first draw fills the card or shows the "didn't answer" line; after that live.js keeps it fresh, and a failed
// refresh leaves the last good list up (stale and dated beats blank)
async function liveCard(api, el, name, every, draw) {
  try { await draw(); } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + api.esc(el._title || 'News') + '</h2><p>The ' + api.esc(el._feed || 'news feed') + ' didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
  if (!api._pageStill(el)) return name;
  keepLive(api, el, { name, every, refresh: draw });
  return name;
}
async function runTech(api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Tech news</h2><div class="sub">…</div>'; });
  el._title = 'Tech news'; el._feed = 'tech news feed';
  return liveCard(api, el, 'news', 10 * 60e3, async () => {
    const j = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10').then((r) => r.json());
    if (!api._pageStill(el)) return;
    const items = ((j && j.hits) || []).filter((h) => h.title).slice(0, 10);
    if (!items.length) throw 0;
    el.innerHTML = '<h2>Tech news</h2><div class="sub">Hacker News front page, now</div>' + list(esc, items)
      + '<div class="src">Source: <a href="https://news.ycombinator.com/" target="_blank" rel="noopener">Hacker News</a></div>';
  });
}
// "news about spacex", "latest news on rust": stories from the past week on Hacker News that mention it (keyless
// Algolia search). Labelled as Hacker News, so a non-tech topic is not passed off as general news.
export function topicNewsOf(text) {
  const m = String(text || '').trim().replace(/[?!.]+$/, '').match(/^(?:(?:show\s+me\s+|give\s+me\s+|any\s+)?(?:the\s+)?(?:latest\s+|recent\s+)?news|headlines)\s+(?:about|on|for)\s+(.{2,40})$/i);
  return m ? m[1].trim() : null;
}
async function runTopic(topic, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>News about ' + esc(topic) + '</h2><div class="sub">…</div>'; });
  el._title = 'News about ' + topic; el._feed = 'news search';
  return liveCard(api, el, 'news', 30 * 60e3, async () => {
    const since = Math.floor(Date.now() / 1000) - 7 * 86400;
    const j = await fetch('https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=10&numericFilters=created_at_i>' + since + '&query=' + encodeURIComponent(topic)).then((r) => r.json());
    if (!api._pageStill(el)) return;
    const items = ((j && j.hits) || []).filter((h) => h.title).slice(0, 10);
    if (!items.length) { el.innerHTML = '<h2>News about ' + esc(topic) + '</h2><p>No Hacker News stories mention “' + esc(topic) + '” this past week. For general headlines, ask “news today”.</p>'; return; }
    el.innerHTML = '<h2>News about ' + esc(topic) + '</h2><div class="sub">Hacker News stories from the past week</div>' + list(esc, items)
      + '<div class="src">Source: <a href="https://news.ycombinator.com/" target="_blank" rel="noopener">Hacker News</a> (tech-leaning; for world headlines ask “news today”)</div>';
  });
}
export function isNews(text) {
  return /^(?:(?:show\s+me\s+|give\s+me\s+)?(?:the\s+|today'?s\s+)?(?:(?:latest|breaking|world|top|recent)\s+)?(?:news|headlines|top\s+stories)(?:\s+today|\s+now|\s+please)?|what'?s\s+(?:in\s+the\s+news|happening(?:\s+in\s+the\s+world)?(?:\s+today)?)|what\s+is\s+in\s+the\s+news(?:\s+today)?|any\s+news)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  if (isTechNews(text)) return runTech(api);
  const topic = topicNewsOf(text);
  if (topic) return runTopic(topic, api);
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>In the news</h2><div class="sub">…</div>'; });
  el._title = 'In the news'; el._feed = 'news feed';
  const strip = (h) => { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
  return liveCard(api, el, 'news', 30 * 60e3, async () => {
    const d = new Date(), path = d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + String(d.getUTCDate()).padStart(2, '0');
    const j = await fetch('https://en.wikipedia.org/api/rest_v1/feed/featured/' + path).then((r) => r.json());
    if (!api._pageStill(el)) return;
    const items = ((j && j.news) || []).map((n) => ({ text: strip(n.story), link: (n.links && n.links[0] && n.links[0].content_urls && n.links[0].content_urls.desktop && n.links[0].content_urls.desktop.page) || '' })).filter((n) => n.text).slice(0, 8);
    if (!items.length) throw 0;
    el.innerHTML = '<h2>In the news</h2><div class="sub">' + esc(d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })) + '</div><ul>'
      + items.map((n) => '<li style="margin:6px 0">' + esc(n.text) + (/^https:\/\//.test(n.link) ? ' <a href="' + esc(n.link) + '" target="_blank" rel="noopener">more</a>' : '') + '</li>').join('') + '</ul>'
      + '<div class="src">Source: <a href="https://en.wikipedia.org/wiki/Portal:Current_events" target="_blank" rel="noopener">Wikipedia, In the news</a></div>';
  });
}
export default {
  name: 'news',
  examples: ['news today', 'what\'s in the news', 'headlines', 'latest news', 'tech news', 'news about spacex'],
  nearMisses: ['what is fake news', 'news anchor jobs', 'history of newspapers'],
  match(lower, text) { return isNews(text) || isTechNews(text) || !!topicNewsOf(text); },
  run
};
