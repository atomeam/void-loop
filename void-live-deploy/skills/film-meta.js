/**
 * film-meta skill — structured JSON film metadata (asked by Void, daily 2026-10-14 ask-20261014-1820-3:
 * "Convert the 'film discovery' logic into a structured skill that outputs a JSON object containing film metadata").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film metadata for Inception", "discover film The Matrix", "film json for Titanic", "metadata of the film Avatar".
 * Uses Wikipedia REST summary (no key) for title, extract, thumbnail, and a constructed metadata object.
 * Empty surface stays empty.
 */
export function titleOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:show|get|give|find|discover)\s+(?:me\s+)?)?(?:the\s+)?(?:film|movie)\s+(?:metadata|meta|json|info|details|discovery)\s+(?:for|of|about)\s+(.{2,60})$/i)
    || t.match(/^(?:film|movie)\s+(?:metadata|meta|json)\s+(.{2,60})$/i)
    || t.match(/^discover\s+(?:film|movie)\s+(.{2,60})$/i);
  return m ? m[1].replace(/^(?:the|a|an)\s+/i, '').trim() : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const title = titleOf(text);
  if (!title) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">reading Wikipedia…</div>'; });
  try {
    const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title);
    const j = await fetch(url).then((r) => r.ok ? r.json() : null);
    if (!api._pageStill(el)) return 'film-meta';
    if (!j || !j.title) {
      el.innerHTML = '<h2>' + esc(title) + '</h2><p>No Wikipedia summary for “' + esc(title) + '”. Try a clearer title.</p>';
      return 'none';
    }
    const meta = {
      title: j.title,
      extract: j.extract || '',
      description: j.description || '',
      thumbnail: j.thumbnail ? j.thumbnail.source : null,
      content_urls: j.content_urls || null,
      type: j.type || 'standard',
      timestamp: j.timestamp || null,
    };
    const pretty = JSON.stringify(meta, null, 2);
    el.innerHTML = '<h2>' + esc(j.title) + '</h2>'
      + (j.thumbnail ? '<img alt="" src="' + esc(j.thumbnail.source) + '" style="max-width:160px;border-radius:8px">' : '')
      + '<div class="sub">' + esc(j.description || 'film') + '</div>'
      + '<pre style="white-space:pre-wrap;font-size:13px;line-height:1.4;background:rgba(0,0,0,.2);padding:10px;border-radius:8px;overflow:auto;max-height:320px">' + esc(pretty) + '</pre>'
      + '<div class="src">Source: <a href="' + esc(j.content_urls?.desktop?.page || url) + '" target="_blank" rel="noopener">Wikipedia</a></div>';
    return 'film-meta';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>Wikipedia did not answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'film-meta',
  examples: [
    'film metadata for Inception',
    'discover film The Matrix',
    'film json for Titanic',
    'metadata of the film Avatar',
    'movie metadata for Interstellar'
  ],
  nearMisses: [
    'films',
    'void films',
    'best films of 2025',
    'what is a film',
    'film a timer'
  ],
  match(lower, text) { return !!titleOf(text || lower); },
  run,
};
