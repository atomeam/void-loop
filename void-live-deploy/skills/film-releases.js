/**
 * film-releases skill — browser video recordings pipeline to GitHub release assets.
 * "show film releases", "film release assets", "where are the film mp4s".
 * Lists public GitHub releases that contain V01D film MP4s. No token, no secrets.
 * Empty surface stays empty.
 */
export function releasesOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show|list|where are|what are)\s+(?:the\s+)?(?:film\s+)?(?:releases?|release\s+assets|mp4s?|recordings?)(?:\s+on\s+github)?$|^film\s+releases?$|^browser\s+video\s+recordings\s+pipeline$/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!releasesOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Film release assets</h2><div class="sub">looking on GitHub…</div>'; });
  try {
    const r = await fetch('https://api.github.com/repos/atomeam/void-loop/releases?per_page=10');
    if (api._pageStill && !api._pageStill(el)) return 'film-releases';
    const data = await r.json();
    const films = (Array.isArray(data) ? data : []).filter((rel) => (rel.assets || []).some((a) => /\.mp4$/i.test(a.name || '')));
    const html = films.length
      ? films.map((rel) => {
          const mp4 = (rel.assets || []).find((a) => /\.mp4$/i.test(a.name || ''));
          return '<div style="margin:10px 0;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:8px"><b>' + esc(rel.name || rel.tag_name) + '</b><div class="sub">' + esc(rel.published_at ? rel.published_at.slice(0, 10) : '') + '</div>' + (mp4 ? '<a href="' + esc(mp4.browser_download_url) + '">Download ' + esc(mp4.name) + '</a>' : '') + '</div>';
        }).join('')
      : '<p>No film MP4 release assets found in the recent releases.</p>';
    el.innerHTML = '<h2>Film release assets</h2><div class="sub">' + esc(films.length + ' recent film release' + (films.length === 1 ? '' : 's')) + '</div>' + html + '<div class="src">from public GitHub releases · nothing uploaded from here</div>';
    return 'film-releases';
  } catch (_) {
    if (api._pageStill && !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Film release assets</h2><p>The releases could not be read just now.</p>';
    return 'none';
  }
}

export default {
  name: 'film-releases',
  examples: ['show film releases', 'film release assets', 'where are the film mp4s'],
  nearMisses: ['films', 'film metadata', 'make a poster'],
  match(lower, text) { return releasesOf(text); },
  run,
  suite() {
    return { ok: releasesOf('show film releases') === true && releasesOf('hello') === false };
  },
};
