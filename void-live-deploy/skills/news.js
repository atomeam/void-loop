/**
 * news skill — today's headlines from Wikipedia's "In the news" (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "news today", "what's in the news", "headlines".
 */
export function isNews(text) {
  return /^(?:(?:show\s+me\s+|give\s+me\s+)?(?:the\s+|today'?s\s+)?(?:(?:latest|breaking|world|top|recent)\s+)?(?:news|headlines|top\s+stories)(?:\s+today|\s+now|\s+please)?|what'?s\s+(?:in\s+the\s+news|happening(?:\s+in\s+the\s+world)?(?:\s+today)?)|what\s+is\s+in\s+the\s+news(?:\s+today)?|any\s+news)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>In the news</h2><div class="sub">…</div>'; });
  const strip = (h) => { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
  try {
    const d = new Date(), path = d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + String(d.getUTCDate()).padStart(2, '0');
    const j = await fetch('https://en.wikipedia.org/api/rest_v1/feed/featured/' + path).then((r) => r.json());
    if (!api._pageStill(el)) return 'news';
    const items = ((j && j.news) || []).map((n) => ({ text: strip(n.story), link: (n.links && n.links[0] && n.links[0].content_urls && n.links[0].content_urls.desktop && n.links[0].content_urls.desktop.page) || '' })).filter((n) => n.text).slice(0, 8);
    if (!items.length) throw 0;
    el.innerHTML = '<h2>In the news</h2><div class="sub">' + esc(d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })) + '</div><ul>'
      + items.map((n) => '<li style="margin:6px 0">' + esc(n.text) + (/^https:\/\//.test(n.link) ? ' <a href="' + esc(n.link) + '" target="_blank" rel="noopener">more</a>' : '') + '</li>').join('') + '</ul>'
      + '<div class="src">Source: <a href="https://en.wikipedia.org/wiki/Portal:Current_events" target="_blank" rel="noopener">Wikipedia, In the news</a></div>';
    return 'news';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>In the news</h2><p>The news feed didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'news',
  examples: ['news today', 'what\'s in the news', 'headlines', 'latest news'],
  nearMisses: ['what is fake news', 'news anchor jobs', 'history of newspapers'],
  match(lower, text) { return isNews(text); },
  run
};
