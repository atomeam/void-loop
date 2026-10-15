/**
 * film-discovery skill — returns structured JSON film metadata (asked by Void, daily 2026-10-14 ask-20261014-1820-3:
 * "Convert the 'film discovery' logic into a structured skill that outputs a JSON object containing film metadata").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film discovery", "film metadata", "discover films", "list films as json", "film discovery skill".
 * Leaves "films", "void's films", "where do I watch the films" to the films skill (the page). One-off "best films of 2025"
 * stay with other skills. Fetches /api/films (members and owner; strangers get the pay gate) and shows the JSON.
 * Empty surface stays empty: no stage thing is summoned.
 */
const ASK = /^(?:(?:please\s+)?(?:show|give|get|return|output|list|discover|what(?:'s| is))\s+(?:me\s+)?)?(?:the\s+)?(?:film\s+)?(?:discovery|metadata|meta)(?:\s+(?:as\s+)?json)?(?:\s+(?:for\s+)?(?:films?|void(?:'s)?\s+films?))?(?:\s+please)?$|^(?:film\s+discovery\s+skill|discover\s+films?(?:\s+as\s+json)?)$/i;

export function wantsDiscovery(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return ASK.test(t);
}

async function run(text, api) {
  if (!wantsDiscovery(text)) return 'none';
  const { showPage, esc, _pageStill } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Film metadata</h2><div class="sub">reading /api/films…</div>'; });
  try {
    const r = await fetch('/api/films', { cache: 'no-cache' });
    if (!_pageStill || !_pageStill(el)) return 'film-discovery';
    if (!r.ok) {
      const err = r.status === 401 ? 'Members and the owner see the films. Sign in or become a member at /films/.' : 'The films list did not answer (' + r.status + ').';
      el.innerHTML = '<h2>Film metadata</h2><p>' + esc(err) + '</p><div class="src">/api/films</div>';
      return 'film-discovery';
    }
    const data = await r.json();
    const meta = { films: (data.films || []).map((f) => ({ id: f.id, at: f.at, title: f.title, description: f.description, tags: f.tags, bytes: f.bytes, reviews: f.reviews || null })), owner: !!data.owner, until: data.until || null };
    el.innerHTML = '<h2>Film metadata</h2><div class="sub">' + (meta.films.length) + ' film' + (meta.films.length === 1 ? '' : 's') + (meta.owner ? ' · owner view' : '') + '</div>'
      + '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.4;background:rgba(255,255,255,.04);padding:10px;border-radius:8px;overflow:auto;max-height:60vh">' + esc(JSON.stringify(meta, null, 2)) + '</pre>'
      + '<div class="src">From <a href="/api/films" target="_blank" rel="noopener">/api/films</a> · for members and the owner</div>';
  } catch (e) {
    if (_pageStill && _pageStill(el)) el.innerHTML = '<h2>Film metadata</h2><p>Could not read the films just now (' + esc((e && e.message) || String(e)) + '). Ask again in a moment.</p>';
  }
  return 'film-discovery';
}

export default {
  name: 'film-discovery',
  examples: [
    'film discovery',
    'film metadata',
    'discover films',
    'list films as json',
    'film discovery skill',
    'show film metadata',
  ],
  nearMisses: [
    'films',
    "void's films",
    'where do I watch the films',
    'best films of 2025',
    'film a timer',
    'review films',
  ],
  match(lower, text) { return wantsDiscovery(text || lower); },
  run,
};
