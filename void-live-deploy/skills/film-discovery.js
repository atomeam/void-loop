/**
 * film-discovery skill - structured film metadata as JSON (asked by Void, daily 2026-10-14 ask-20261014-1820-3:
 * "Convert the 'film discovery' logic into a structured skill that outputs a JSON object containing film metadata").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film metadata for Inception", "discover film The Matrix", "JSON film metadata for Parasite".
 * Uses Wikipedia summary (no key). Returns { title, year, extract, thumbnail, page, source }.
 * Empty surface stays empty: no card until asked.
 */
export function filmOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?(?:(?:film|movie)\s+(?:metadata|info|details|discovery)\s+(?:for|of|on)\s+|discover(?:\s+the)?\s+(?:film|movie)\s+|json\s+(?:film|movie)\s+metadata\s+(?:for|of)\s+)["“]?(.+?)["”]?$/i);
  if (!m) return null;
  const title = m[1].trim();
  if (!title || title.length < 2 || title.split(' ').length > 8) return null;
  return title;
}

export async function metadataFor(title, fetchFn = (u, o) => fetch(u, o)) {
  const page = title.replace(/ /g, '_');
  const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(page);
  const r = await fetchFn(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const year = (j.description || '').match(/\b(19|20)\d{2}\b/)?.[0] || (j.extract || '').match(/\b(19|20)\d{2}\b/)?.[0] || null;
  return {
    title: j.title || title,
    year,
    extract: j.extract || '',
    thumbnail: j.thumbnail?.source || null,
    page: j.content_urls?.desktop?.page || 'https://en.wikipedia.org/wiki/' + encodeURIComponent(page),
    source: 'Wikipedia',
  };
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const title = filmOf(text);
  if (!title) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">reading film metadata…</div>'; });
  try {
    const meta = await metadataFor(title);
    if (_pageStill && !_pageStill(el)) return 'film-discovery';
    const json = JSON.stringify(meta, null, 2);
    el.innerHTML = '<h2>' + esc(meta.title) + (meta.year ? ' <span class="sub">(' + esc(meta.year) + ')</span>' : '') + '</h2>'
      + (meta.thumbnail ? '<img src="' + esc(meta.thumbnail) + '" alt="" style="max-width:160px;border-radius:8px;float:right;margin:0 0 8px 12px">' : '')
      + '<p>' + esc(meta.extract) + '</p>'
      + '<details open><summary style="cursor:pointer">JSON film metadata</summary><pre style="white-space:pre-wrap;font-size:12px;background:rgba(255,255,255,.04);padding:8px;border-radius:6px">' + esc(json) + '</pre></details>'
      + '<div class="src">Source: <a href="' + esc(meta.page) + '" target="_blank" rel="noopener">' + esc(meta.source) + '</a></div>';
    return 'film-discovery';
  } catch (e) {
    if (_pageStill && !_pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>Film metadata could not be read just now (' + esc((e && e.message) || String(e)) + '). Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'film-discovery',
  examples: [
    'film metadata for Inception',
    'discover film The Matrix',
    'JSON film metadata for Parasite',
    'movie info for Spirited Away',
  ],
  nearMisses: [
    'films',
    'void films',
    'best films of 2025',
    'how do I film a video',
  ],
  match(lower, text) { return !!filmOf(text || lower); },
  run,
};
