/**
 * podcast-search skill: shows for a topic, from the directory the Podcasts page uses (functions/api/podcasts.js: Apple's free iTunes
 * Search, fyyd.de when Apple does not answer; Apple straight from the browser when Verse's edge does not answer).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "podcasts about history", "find a podcast about cooking", "search podcasts for true crime", "best podcasts about science".
 * Each show opens on the Podcasts page (/podcasts/?show=… or ?feed=…), and the card opens that page searched for the same words
 * (data-page), so the Podcasts page's own card (lib/podcasts-card.js) and this card lead to each other. "play the podcast" and
 * "make me a podcast about cats" are not searches: Verse's own show (skills/podcast.js) and the makers keep them.
 */
import { fromItunes } from '../lib/podcasts.js';

/** the topic of a podcast search, or null. Pure. */
export function podcastTopicOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:please\s+)?(?:search|find|browse|show\s+me|recommend|suggest)\s+(?:for\s+|me\s+)?)?(?:(?:a|an|some|any|the)\s+)?(?:(?:best|top|good|great|popular|new)\s+)?(?:podcasts?|pod)\s+(?:about|on|for)\s+(.{2,40})$/i)
    || t.match(/^(?:search|find)\s+(?:for\s+)?podcasts?\s+(?!about\b|on\b|for\b)(.{2,40})$/i);
  const topic = m ? m[1].trim() : '';
  return topic.length >= 2 && /[a-z0-9]/i.test(topic) ? topic : null;
}

/** the Podcasts page searched for a topic, as a plain query the card frame takes (lib/card-frame.js pageOfCard), or ''. Pure. */
export function pageOfPodcasts(topic) {
  const q = encodeURIComponent(String(topic || '').trim());
  return q && /^[A-Za-z0-9_.%-]{1,120}$/.test(q) ? '/podcasts/?q=' + q : '';
}

/** where a show opens on the Podcasts page: by its Apple id (?show=, the one the page reads), else by its feed, else ''. Pure. */
export const showHref = (s) => (s && /^\d{1,12}$/.test(String(s.id || '')) ? '/podcasts/?show=' + s.id : s && /^https:\/\//.test(s.feed || '') ? '/podcasts/?feed=' + encodeURIComponent(s.feed) : '');

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

/** a show's episodes in the card, each with a Play button for the one player (pure; esc is the stage's escape) */
export function episodesHtml(show, esc) {
  const eps = ((show && show.episodes) || []).filter((e) => e && e.title && /^https:\/\//.test(e.audio || '')).slice(0, 8);
  const mins = (d) => (Number(d) > 0 ? ' · ' + Math.round(Number(d) / 60) + ' min' : '');
  return '<h2>' + esc(show.title || 'Episodes') + '</h2>'
    + '<p><a href="#" data-pod="back">← All shows</a></p>'
    + '<audio controls preload="none" data-pod="player" style="width:100%;margin:6px 0"></audio><p class="sub" data-pod="say" role="status"></p>'
    + (eps.length ? '<ul style="list-style:none;padding:0;margin:8px 0">' + eps.map((e, i) => '<li style="display:flex;gap:10px;align-items:center;margin:8px 0">'
      + '<button type="button" data-pod="play" data-i="' + i + '">Play</button><span>' + esc(e.title) + '<br><span style="color:#8a8a8a;font-size:13px">'
      + esc((e.pub || '').slice(0, 10) + mins(e.dur)) + '</span></span></li>').join('') + '</ul>' : '<p>This show lists no playable episode.</p>');
}

/** tapping a show opens its episodes right in the card and plays them there (cards stay free; the full Podcasts page is Uni) */
function wireShows(el, listHtml, esc) {
  if (!el || typeof el.addEventListener !== 'function') return; // a test stage with no events
  el.addEventListener('click', async (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest('a[href^="/podcasts/?show="], a[data-pod="back"], button[data-pod="play"]');
    if (!a) return;
    ev.preventDefault();
    if (a.dataset.pod === 'back') { el.innerHTML = listHtml; return; } // void-review: ok (built from escaped parts)
    if (a.dataset.pod === 'play') {
      const show = el._podShow, ep = show && show.episodes.filter((e) => e && e.title && /^https:\/\//.test(e.audio || ''))[+a.dataset.i];
      const au = el.querySelector('[data-pod="player"]'), say = el.querySelector('[data-pod="say"]');
      if (!ep || !au) return;
      say.textContent = 'Loading ' + ep.title + '…';
      au.onerror = () => { say.textContent = 'This episode did not play here. ' + (show.link ? 'The show\'s own site has it.' : 'Try another one.'); };
      au.onplaying = () => { say.textContent = 'Playing: ' + ep.title; };
      au.src = ep.audio; au.play().catch(() => { if (!au.error) say.textContent = 'Press play on the player to start ' + ep.title + '.'; });
      return;
    }
    const id = (a.getAttribute('href').match(/show=(\d{1,12})/) || [])[1];
    el.innerHTML = '<p class="sub">Loading the episodes…</p>';
    let show = null; try { const j = await fetch('/api/podcasts?id=' + encodeURIComponent(id)).then((r) => r.json()); show = j && j.ok && j.show; } catch (_) { show = null; }
    if (!show) { el.innerHTML = listHtml + '<p class="sub" role="status">That show did not load just now. Tap it again in a moment.</p>'; return; } // void-review: ok (escaped parts)
    el._podShow = show; el.innerHTML = episodesHtml(show, esc); // void-review: ok (episodesHtml escapes every piece)
  });
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
  else { el.innerHTML = head + '<div class="sub">' + esc(Math.min(8, shows.length) === 1 ? '1 show' : Math.min(8, shows.length) + ' shows') + ', best match first. Tap one to see its episodes.</div>' + showsHtml(shows, esc) + '<div class="src">Source: ' + src + '</div>'; wireShows(el, el.innerHTML, esc); } // void-review: ok (escaped; src is one of two fixed links)
  return 'podcast-search';
}

export default {
  name: 'podcast-search',
  examples: [
    'podcasts about history',
    'find a podcast about cooking',
    'search podcasts for true crime',
    'best podcasts about science',
    'top pod for true crime'
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
