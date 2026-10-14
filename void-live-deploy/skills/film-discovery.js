/**
 * film-discovery skill — film discovery that returns JSON film metadata.
 * "find film Inception", "movie metadata for The Matrix", "film info Dune".
 * Fetches a Wikipedia summary and returns structured JSON metadata on the card.
 * Empty surface stays empty.
 */
export function titleOf(text) {
  const m = String(text || '').trim().match(/^(?:find|search|get|show|what\s+is)\s+(?:the\s+)?(?:film|movie|flick)\s+(?:metadata\s+(?:for\s+)?)?(?:info\s+(?:for\s+)?)?["']?(.+?)["']?\s*[.!?]?$/i)
    || String(text || '').trim().match(/^(?:film|movie)\s+(?:metadata|info|details)\s+(?:for\s+)?["']?(.+?)["']?\s*[.!?]?$/i);
  return m ? m[1].trim() : null;
}

export function wantsFilmDiscovery(lower, text) {
  return !!titleOf(text);
}

export function metaFromWiki(summary) {
  if (!summary || typeof summary !== 'object') return null;
  return {
    title: summary.title || null,
    extract: summary.extract || null,
    description: summary.description || null,
    thumbnail: summary.thumbnail ? summary.thumbnail.source : null,
    page: summary.content_urls && summary.content_urls.desktop ? summary.content_urls.desktop.page : null,
    type: summary.type || null,
  };
}

async function run(text, api) {
  const title = titleOf(text);
  if (!title) return 'none';
  const { showPage, esc, _pageStill } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Film</h2><div class="sub">looking up ' + esc(title) + '…</div>'; });
  try {
    const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'));
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const summary = await r.json();
    const meta = metaFromWiki(summary);
    if (!_pageStill || !_pageStill(el)) return 'film-discovery';
    if (!meta || !meta.title) throw new Error('no summary');
    const json = JSON.stringify(meta, null, 2);
    el.innerHTML = '<h2>' + esc(meta.title) + '</h2>'
      + (meta.thumbnail ? '<img src="' + esc(meta.thumbnail) + '" alt="" style="max-width:100%;border-radius:8px;margin:8px 0">' : '')
      + (meta.description ? '<p style="opacity:.8">' + esc(meta.description) + '</p>' : '')
      + (meta.extract ? '<p>' + esc(meta.extract) + '</p>' : '')
      + '<details><summary style="cursor:pointer;color:#8a8a92">JSON metadata</summary><pre style="font-size:12px;overflow:auto;background:#111;padding:8px;border-radius:8px">' + esc(json) + '</pre></details>'
      + (meta.page ? '<div class="src"><a href="' + esc(meta.page) + '" target="_blank" rel="noopener">Wikipedia</a></div>' : '');
    return 'film-discovery';
  } catch (e) {
    if (!_pageStill || !_pageStill(el)) return 'none';
    el.innerHTML = '<h2>Film</h2><p>Could not find metadata for ' + esc(title) + ' just now.</p>';
    return 'film-discovery';
  }
}

export default {
  name: 'film-discovery',
  examples: ['find film Inception', 'movie metadata for The Matrix', 'film info Dune', 'film details for Interstellar'],
  nearMisses: ['films', 'voids films', 'best films of 2025', 'how do I film a video'],
  match(lower, text) { return wantsFilmDiscovery(lower, text); },
  run,
  suite() {
    const t = titleOf('find film Inception');
    if (t !== 'Inception') return { ok: false, got: t };
    if (titleOf('films')) return { ok: false, got: 'miss' };
    const meta = metaFromWiki({ title: 'Test', extract: 'A film.', type: 'standard' });
    if (!meta || meta.title !== 'Test' || !meta.extract) return { ok: false, got: meta };
    return { ok: true };
  },
};
