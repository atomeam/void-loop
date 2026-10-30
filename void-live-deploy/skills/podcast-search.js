/**
 * podcast-search skill: shows for a topic, from the directory the Podcasts page uses (functions/api/podcasts.js: Apple's free iTunes
 * Search, fyyd.de when Apple does not answer; Apple straight from the browser when Verse's edge does not answer).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "podcasts about history", "find a podcast about cooking", "search podcasts for true crime", "best podcasts about science".
 * Each show opens on the Podcasts page (/podcasts/?id=… or ?feed=…), and the card opens that page searched for the same words
 * (data-page), so the Podcasts page's own card (lib/podcasts-card.js) and this card lead to each other. "play the podcast" and
 * "make me a podcast about cats" are not searches: Verse's own show (skills/podcast.js) and the makers keep them.
 */
import { fromItunes } from '../lib/podcasts.js';

/** the topic of a podcast search, or null. Pure. */
export function podcastTopicOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:please\s+)?(?:search|find|browse|show\s+me|recommend|suggest)\s+(?:for\s+|me\s+)?)?(?:(?:a|an|some|any|the)\s+)?(?:(?:best|top|good|great|popular|new)\s+)?podcasts?\s+(?:about|on|for)\s+(.{2,40})$/i)
    || t.match(/^(?:search|find)\s+(?:for\s+)?podcasts?\s+(?!about\b|on\b|for\b)(.{2,40})$/i);
  const topic = m ? m[1].trim() : '';
  return topic.length >= 2 && /[a-z0-9]/i.test(topic) ? topic : null;
}

/** the Podcasts page searched for a topic, as a plain query the card frame takes (lib/card-frame.js pageOfCard), or ''. Pure. */
export function pageOfPodcasts(topic) {
  const q = encodeURIComponent(String(topic || '').trim());
  return q && /^[A-Za-z0-9_.%-]{1,120}$/.test(q) ? '/podcasts/?q=' + q : '';
}

/** where a show opens on the Podcasts page: by its Apple id, else by its feed, else ''. Pure. */
export const showHref = (s) => (s && s.id ? '/podcasts/?id=' + encodeURIComponent(s.id) : s && /^https:\/\//.test(s.feed || '') ? '/podcasts/?feed=' + encodeURIComponent(s.feed) : '');

/** the card's list: at most 8 shows, each opening on the Podcasts page. Pure (esc is the stage's escape). */
export function showsHtml(shows, esc) {
  return '<ul style="list-style:none;padding:0;margin:8px 0">' + shows.filter((s) => s && s.title && showHref(s)).slice(0, 8).map((s) => {
    const img = /^https:\/\//.test(s.image || '') ? '<img src="' + esc(s.image) + '" alt="" width="44" height="44" loading="lazy" style="border-radius:8px;flex:none">' : '';
    return '<li style="display:flex;gap:10px;align-items:center;margin:8px 0">' + img + '<span><a href="' + esc(showHref(s)) + '">' + esc(s.title) + '</a>'
      + (s.author ? '<br><span style="color:#8a8a8a;font-size:13px">' + esc(s.author) + (s.genre ? ' · ' + esc(s.genre) : '') + '</span>' : '') + '</span></li>';
  }).join('') + '</ul>';
}

async function search(topic) {
  try { const j = await fetch('/api/podcasts?q=' + encodeURIComponent(topic)).then((r) => r.json()); if (j && j.ok && Array.isArray(j.shows)) return j; } catch (_) { /* the edge did not answer: ask Apple straight */ }
  const j = await fetch('https://itunes.apple.com/search?media=podcast&entity=podcast&limit=25&term=' + encodeURIComponent(topic)).then((r) => r.json());
  return { ok: true, shows: ((j && j.results) || []).map(fromItunes).filter(Boolean) };
}

async function run(text, api) {
  const { showPage, esc } = api, topic = podcastTopicOf(text) || String(text || '').trim().slice(0, 40);
  const head = '<h2>Podcasts about ' + esc(topic) + '</h2>';
  const el = showPage((p) => { p.innerHTML = head + '<div class="sub">…</div>'; // void-review: ok (the topic is escaped)
    const page = pageOfPodcasts(topic); if (page && p.dataset) p.dataset.page = page; });
  let got = null; try { got = await search(topic); } catch (_) { got = null; }
  if (api._pageStill && !api._pageStill(el)) return 'podcast-search';
  const shows = ((got && got.shows) || []).filter((s) => s && s.title && showHref(s));
  const src = got && got.source === 'fyyd' ? '<a href="https://fyyd.de/" target="_blank" rel="noopener">fyyd.de</a> (Apple did not answer just now)' : '<a href="https://podcasts.apple.com/" target="_blank" rel="noopener">Apple Podcasts directory</a>';
  if (!got) el.innerHTML = head + '<p>The podcast directory did not answer just now. Ask again in a moment.</p>'; // void-review: ok (the topic is escaped)
  else if (!shows.length) el.innerHTML = head + '<p>No show in the directory matches “' + esc(topic) + '”. Try fewer or other words.</p>'; // void-review: ok (escaped)
  else el.innerHTML = head + '<div class="sub">' + esc(String(Math.min(8, shows.length))) + ' shows, best match first. Tap one to see its episodes.</div>' + showsHtml(shows, esc) + '<div class="src">Source: ' + src + '</div>'; // void-review: ok (escaped; src is one of two fixed links)
  return 'podcast-search';
}

export default {
  name: 'podcast-search',
  examples: [
    'podcasts about history',
    'find a podcast about cooking',
    'search podcasts for true crime',
    'best podcasts about science'
  ],
  nearMisses: [
    'make me a podcast about cats',
    'start a podcast',
    'play the podcast',
    'latest episode of the office'
  ],
  match(lower, text) { return !!podcastTopicOf(text == null ? lower : text); },
  run
};
